import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, freshDb } from './helpers.js';
import * as repo from '../src/repo.js';
import { assertSchemaCurrent, openDb, migrate } from '../src/db.js';
import { summarisePost, normaliseChannel } from '../src/posts.js';
import { publishPlan, ADAPTERS } from '../src/publish-adapters.js';

const draft = (db, over = {}) =>
  repo.createPost(db, { platforms: ['ig'], content: 'Monsoon menu is here.', ...over });

// --- creation ---------------------------------------------------------------

test('a draft is created and read back with its targets pending', () => {
  const db = freshDb();
  const made = draft(db, { platforms: ['ig', 'gg'], tags: ['#SaffronHouse'], author: 'Priya Menon' });
  const read = repo.getPost(db, made.id);

  assert.equal(read.state, 'draft');
  assert.equal(read.content, 'Monsoon menu is here.');
  assert.deepEqual(read.tags, ['#SaffronHouse']);
  assert.deepEqual(read.targets.map(t => t.platform), ['google_business', 'instagram']);
  assert.equal(read.targets.every(t => t.status === 'pending'), true);
  assert.equal(read.scheduledAt, null, 'a draft has no schedule — not a schedule of null meaning now');
});

test('a scheduled post keeps BOTH its instant and the zone that produced it', () => {
  const db = freshDb();
  const made = draft(db, { scheduledAt: '2026-09-06T13:00:00+05:30', scheduledTz: 'Asia/Kolkata' });

  assert.equal(made.state, 'scheduled', 'a scheduledAt is what makes it scheduled — there is no second flag');
  assert.equal(made.scheduledAt, '2026-09-06T13:00:00+05:30');
  // The offset cannot reconstruct the zone: +05:30 is also Asia/Colombo, and a
  // zone's offset moves across a DST boundary while "9am local" does not.
  assert.equal(made.scheduledTz, 'Asia/Kolkata');
});

test('creating a post with no channel, or an unknown one, is refused', () => {
  const db = freshDb();
  assert.throws(() => repo.createPost(db, { platforms: [], content: 'x' }), /at least one channel/);
  assert.throws(() => repo.createPost(db, { platforms: ['tiktok'], content: 'x' }), /unknown channel/);
  assert.throws(() => repo.createPost(db, { platforms: ['ig'], content: '  ' }), /content is required/);
});

test('client channel ids and platform names both resolve to one spelling', () => {
  assert.equal(normaliseChannel('ig'), 'instagram');
  assert.equal(normaliseChannel('instagram'), 'instagram');
  assert.equal(normaliseChannel('gg'), 'google_business');
  assert.equal(normaliseChannel('zomato'), null, 'an unknown channel is null, never a guess');
});

// --- the publish attempt ----------------------------------------------------

test('publishing to a NEVER CONNECTED channel records a failed target that says so', async () => {
  const db = seededDb();                       // x is never_connected in the seed
  const made = repo.createPost(db, { platforms: ['x'], content: 'hello' });
  const { post } = await repo.publishPost(db, made.id);

  const t = post.targets[0];
  assert.equal(t.status, 'failed');
  assert.equal(t.failureKind, 'never_connected');
  assert.match(t.reason, /never been connected/i);
  assert.match(t.reason, /setting up, not signing in again/i, 'it must not read as a sign-in problem');
  assert.equal(t.attemptedAt !== null, true, 'the attempt is recorded, not refused before writing');
});

test('publishing to an EXPIRED channel gives a DIFFERENT reason from never connected', async () => {
  const db = seededDb();                       // instagram is expired in the seed
  const madeX = repo.createPost(db, { platforms: ['x'], content: 'a' });
  const madeIg = repo.createPost(db, { platforms: ['ig'], content: 'b' });
  const { post: px } = await repo.publishPost(db, madeX.id);
  const { post: pig } = await repo.publishPost(db, madeIg.id);

  assert.equal(pig.targets[0].failureKind, 'expired');
  assert.match(pig.targets[0].reason, /sign-in has expired/i);
  assert.notEqual(pig.targets[0].failureKind, px.targets[0].failureKind);
  assert.notEqual(pig.targets[0].reason, px.targets[0].reason,
    'three connection states are three different problems and must not share one sentence');
});

test('a REVOKED channel is its own reason, not folded into expired', async () => {
  const db = seededDb();
  db.prepare(`UPDATE connections SET status = 'revoked' WHERE platform = 'youtube'`).run();
  const made = repo.createPost(db, { platforms: ['yt'], content: 'c' });
  const { post } = await repo.publishPost(db, made.id);

  assert.equal(post.targets[0].failureKind, 'revoked');
  assert.match(post.targets[0].reason, /withdrawn at the provider end/i);
});

test('a CONNECTED channel reaches the adapter and records that it is not built', async () => {
  const db = seededDb();                       // google_business is connected
  const made = repo.createPost(db, { platforms: ['gg'], content: 'd' });
  const { post } = await repo.publishPost(db, made.id);

  assert.equal(post.targets[0].status, 'failed');
  assert.equal(post.targets[0].failureKind, 'not_implemented',
    'connected-but-unbuilt is a different answer from not connected');
});

// THE CASE THE TWO-TABLE DESIGN EXISTS FOR.
test('when channels disagree there are per-target outcomes and NO single misleading post state', async () => {
  const db = seededDb();
  const real = ADAPTERS.google_business;
  ADAPTERS.google_business = async () => ({ ok: true, externalId: 'gbp-123' });
  try {
    // google_business connected → succeeds; instagram expired → fails.
    const made = repo.createPost(db, { platforms: ['gg', 'ig'], content: 'e' });
    const { post } = await repo.publishPost(db, made.id);

    const by = Object.fromEntries(post.targets.map(t => [t.platform, t]));
    assert.equal(by.google_business.status, 'published');
    assert.equal(by.google_business.externalId, 'gbp-123');
    assert.equal(by.instagram.status, 'failed');
    assert.equal(by.instagram.failureKind, 'expired');

    // The post itself claims nothing about the outcome.
    assert.equal(post.state, 'attempted');
    assert.notEqual(post.state, 'published');
    assert.equal(post.summary.outcome, 'mixed');
    assert.equal(post.summary.label, 'Published to 1, failed on 1',
      'the one-line summary names both halves rather than picking the flattering one');
    assert.equal(post.summary.failures.length, 1);
  } finally {
    ADAPTERS.google_business = real;
  }
});

test('the attempt reports its call count and which calls are billed, before it runs', async () => {
  const db = seededDb();
  db.prepare(`UPDATE connections SET status = 'connected' WHERE platform = 'x'`).run();
  const made = repo.createPost(db, { platforms: ['x', 'gg', 'ig'], content: 'f' });
  const { plan } = await repo.publishPost(db, made.id);

  // instagram is expired, so it never reaches an adapter and costs nothing.
  assert.deepEqual(plan.calls.map(c => c.platform).sort(), ['google_business', 'x']);
  assert.equal(plan.totalCalls, 2);
  assert.equal(plan.billedCalls, 1);
  assert.deepEqual(plan.billedPlatforms, ['x'], 'X writes are billed; Business Profile on our own listing is not');
});

test('publishPlan prices only what would actually be called', () => {
  assert.equal(publishPlan([]).totalCalls, 0);
  assert.equal(publishPlan(['instagram', 'whatsapp', 'youtube']).billedCalls, 0);
  assert.equal(publishPlan(['x']).billedCalls, 1);
});

// --- the derived summary ----------------------------------------------------

test('summarisePost never says published unless every target did', () => {
  const p = { state: 'attempted' };
  assert.equal(summarisePost(p, [{ status: 'published' }, { status: 'published' }]).outcome, 'published');
  assert.equal(summarisePost(p, [{ status: 'published' }, { status: 'failed' }]).outcome, 'mixed');
  assert.equal(summarisePost(p, [{ status: 'failed' }]).outcome, 'failed');
  assert.equal(summarisePost({ state: 'draft' }, [{ status: 'pending' }]).outcome, 'not_attempted');
  assert.equal(summarisePost({ state: 'sending' }, [{ status: 'pending' }]).outcome, 'in_flight');
});

// --- deletion ---------------------------------------------------------------

test('a draft can be deleted; an attempted post is a record and cannot', async () => {
  const db = seededDb();
  const d = draft(db);
  assert.equal(repo.deletePost(db, d.id).deleted, true);

  const a = repo.createPost(db, { platforms: ['x'], content: 'g' });
  await repo.publishPost(db, a.id);
  const out = repo.deletePost(db, a.id);
  assert.equal(out.deleted, false);
  assert.match(out.reason, /record of an attempt/);
});

// --- the seed ---------------------------------------------------------------

test('every seeded post and target survives flagged as sample data', () => {
  const db = seededDb();
  const posts = repo.listPosts(db);
  assert.equal(posts.length, 13, '7 posts + 6 scheduled');
  assert.equal(posts.every(p => p.isSample), true);
  assert.equal(posts.every(p => p.targets.every(t => t.isSample)), true);
});

test('SCHEDULED became the same lifecycle, not a second mechanism', () => {
  const db = seededDb();
  const scheduled = repo.listPosts(db, { state: 'scheduled' });
  assert.equal(scheduled.length, 6);
  assert.equal(scheduled.every(p => p.scheduledAt && p.scheduledTz === 'Asia/Kolkata'), true);
  assert.equal(scheduled.every(p => p.targets.every(t => t.status === 'pending')), true);
});

// THE SEED TRAP: metricsFrom: 'ig' on posts that went to two channels.
test('seeded metrics land on the channel they came from, and nowhere else', () => {
  const db = seededDb();
  for (const id of ['p1', 'p3', 'p5']) {          // all three went to ig AND gg
    const by = Object.fromEntries(repo.getPost(db, id).targets.map(t => [t.platform, t]));
    assert.ok(by.instagram.metrics, `${id}: Instagram carries the figures`);
    assert.equal(by.google_business.metrics, null,
      `${id}: Google was never measured — null, not zero, and not Instagram's numbers`);
    assert.equal(by.google_business.status, 'published',
      'not measured is a different fact from not published');
  }
});

test('the seeded failed post keeps its per-channel error', () => {
  const db = seededDb();
  const p4 = repo.getPost(db, 'p4');
  assert.equal(p4.state, 'attempted', 'a failure is still an attempt that happened');
  assert.equal(p4.summary.outcome, 'failed');
  assert.match(p4.targets[0].reason, /token expired/i);
});

// --- the schema guard -------------------------------------------------------

test('assertSchemaCurrent catches a database created before the posts tables', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE post_targets');
  db.exec('DROP TABLE posts');
  assert.throws(() => assertSchemaCurrent(db), /table posts does not exist/);
});

test('assertSchemaCurrent catches a posts table with a stale CHECK', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE post_targets');
  db.exec('DROP TABLE posts');
  // A plausible earlier shape: the 'published' post state this design rejects.
  db.exec(`CREATE TABLE posts (id TEXT PRIMARY KEY,
             state TEXT CHECK (state IN ('draft', 'scheduled', 'published')))`);
  assert.throws(() => assertSchemaCurrent(db), /posts\.state does not allow 'attempted'/);
});

// --- HTTP -------------------------------------------------------------------

test('the posts routes serve, create and attempt', async () => {
  const { createServer } = await import('../src/http.js');
  const server = createServer(seededDb());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const list = await (await fetch(`${base}/posts`)).json();
    assert.equal(list.posts.length, 13);

    const filtered = await (await fetch(`${base}/posts?state=scheduled`)).json();
    assert.equal(filtered.posts.length, 6);

    const bad = await fetch(`${base}/posts?state=published`);
    assert.equal(bad.status, 400, "'published' is not a post state and the route says so");

    const created = await fetch(`${base}/posts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platforms: ['ig'], content: 'From the API' }),
    });
    assert.equal(created.status, 201);
    const post = await created.json();

    // The attempt returns 200: making it succeeded, and the outcome is inside.
    const attempted = await fetch(`${base}/posts/${post.id}/publish`, { method: 'POST' });
    assert.equal(attempted.status, 200);
    const body = await attempted.json();
    assert.equal(body.post.state, 'attempted');
    assert.equal(body.post.targets[0].failureKind, 'expired');
    assert.ok(body.plan, 'the cost report travels with the result');

    assert.equal((await fetch(`${base}/posts/nope`)).status, 404);
  } finally {
    server.close();
  }
});
