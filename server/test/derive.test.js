import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb } from './helpers.js';
import { changeFromSeries, velocityFromSeries, MIN_WINDOW_DAYS, newestWith } from '../src/derive.js';
import { samplePlaceId } from '../seed/seed.js';
import * as repo from '../src/repo.js';
import { insertObservation } from '../src/observations.js';
import { isoDaysAgo } from '../src/db.js';

// The figures from 3eb4344 and f4662b8. If any of these moves, the move off
// localStorage changed a number on screen, which is a defect not a side effect.
const EXPECTED = {
  'est-1': { velocity: 148, followers: 3.8,  engagement: 56 },
  'est-2': { velocity: 96,  followers: 2.1,  engagement: 9 },
  'est-3': { velocity: 74,  followers: 4.2,  engagement: 4 },
  'est-4': { velocity: 21,  followers: -0.4, engagement: -12.1 },
  'est-5': { velocity: 58,  followers: 6.1,  engagement: 17.9 },
  'est-6': { velocity: 44,  followers: 0,    engagement: -1.1 },
};

test('the six default rivals derive exactly the figures the client used to', () => {
  const db = seededDb();
  const by = new Map(repo.listCompetitors(db).map(c => [c.placeId, c]));
  const diffs = [];
  for (const [ref, want] of Object.entries(EXPECTED)) {
    const c = by.get(samplePlaceId(ref));
    if (c.velocity.perMonth !== want.velocity) diffs.push(`${ref} velocity ${c.velocity.perMonth} != ${want.velocity}`);
    if (c.followerChange.value !== want.followers) diffs.push(`${ref} followers ${c.followerChange.value} != ${want.followers}`);
    if (c.engagementChange.value !== want.engagement) diffs.push(`${ref} engagement ${c.engagementChange.value} != ${want.engagement}`);
  }
  assert.deepEqual(diffs, []);
});

test('our own metrics come from the same code path as every rival', () => {
  const self = repo.selfMetrics(seededDb());
  assert.equal(self.velocity.perMonth, 62);
  assert.equal(self.followerChange.value, 1.4);
  assert.equal(self.engagementChange.value, 3.2);
  assert.equal(self.velocity.state, 'rate');
});

test('under two observations is `none`, never a zero', () => {
  for (const metric of ['reviews', 'followers', 'engagement']) {
    const c = changeFromSeries([{ at: isoDaysAgo(1), reviews: 5, followers: 5, avgInteractions: 1 }], metric);
    assert.equal(c.state, 'none');
    assert.equal(c.value, null);
    assert.equal(c.samples, 1);
  }
  assert.equal(changeFromSeries([], 'reviews').state, 'none');
});

test(`a window under ${MIN_WINDOW_DAYS} days is \`measuring\` — a real delta but no rate`, () => {
  const s = [
    { at: isoDaysAgo(0.01), reviews: 100, followers: 1000, avgInteractions: 50 },
    { at: isoDaysAgo(0),    reviews: 103, followers: 1010, avgInteractions: 50 },
  ];
  for (const metric of ['reviews', 'followers', 'engagement']) {
    const c = changeFromSeries(s, metric);
    assert.equal(c.state, 'measuring', metric);
    assert.equal(c.value, null, `${metric} must not state a figure from a sub-7-day window`);
    assert.ok(c.delta !== null, `${metric} still reports the measured delta`);
  }
});

test('a sample missing a field is NOT an observation of that metric', () => {
  // Places-only readings: reviews derive, followers do not.
  const s = [
    { at: isoDaysAgo(90), reviews: 100 },
    { at: isoDaysAgo(0),  reviews: 400 },
  ];
  assert.equal(velocityFromSeries(s).state, 'rate');
  assert.equal(velocityFromSeries(s).perMonth, 100);
  assert.equal(changeFromSeries(s, 'followers').state, 'none');
  assert.equal(changeFromSeries(s, 'followers').samples, 0);
  assert.equal(changeFromSeries(s, 'engagement').state, 'none');
});

test('engagement needs BOTH followers and avgInteractions on the same sample', () => {
  const s = [
    { at: isoDaysAgo(90), followers: 1000 },                        // no interactions
    { at: isoDaysAgo(0),  followers: 1100, avgInteractions: 60 },
  ];
  assert.equal(changeFromSeries(s, 'followers').state, 'rate');
  assert.equal(changeFromSeries(s, 'engagement').state, 'none', 'one usable ratio is not two');
});

test('a ratings-only rival has no follower or engagement change, ever', () => {
  const db = seededDb();
  repo.track(db, samplePlaceId('est-11'), 'admin');   // Gupta Bhojnalaya, personal IG
  const c = repo.listCompetitors(db).find(x => x.placeId === samplePlaceId('est-11'));
  assert.equal(c.dataTier, 'ratings');
  assert.equal(c.followerChange.state, 'none');
  assert.equal(c.engagementChange.state, 'none');
  assert.equal(c.followers, null);
  assert.equal(c.engagementRate, null);
  assert.match(c.unreadableReason, /personal/);
  // and its review velocity is still absent until it has been sampled twice
  assert.equal(c.velocity.state, 'none');
});

// Tracking a delivery-only kitchen is a SUPPORTED action — the user decides
// who counts as a competitor, so POST /tracked deliberately has no tier check.
// The row therefore has to survive the trip to the screen, which means the
// client needs both a null rating it can guard on AND a sentence explaining
// it. Rendering it unguarded white-screened the Competitors tab.
test('a `none`-tier tracked establishment has a null rating AND a reason for it', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-15');   // Biryani Junction, delivery only, google: null
  repo.track(db, pid, 'admin');

  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  assert.ok(c, 'tracking it must put it on the Competitors list, not drop it');
  assert.equal(c.dataTier, 'none');
  assert.equal(c.googleRating, null, 'no listing means no rating — not a zero');
  assert.equal(c.googleReviews, null);
  assert.notEqual(c.unreadableReason, null,
    'a null rating with no reason leaves the cell blank once the crash is guarded');
  assert.match(c.unreadableReason, /No Google listing/);
});

test('the `none` reason comes from availability(), not from a fresh string', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-15');
  repo.track(db, pid, 'admin');
  const est = repo.getEstablishment(db, pid);
  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  // The same sentence the Establishments screen shows, so one fact is not
  // explained two different ways on two screens.
  const fromAvailability = est.availability.reasons.find(r => /google/i.test(r.text) && !r.ok);
  assert.equal(c.unreadableReason, fromAvailability.text);
});

test('the two constrained tiers give DIFFERENT reasons — they are different absences', () => {
  const db = seededDb();
  repo.track(db, samplePlaceId('est-11'), 'admin');   // ratings: personal Instagram
  repo.track(db, samplePlaceId('est-15'), 'admin');   // none: no Google listing
  const list = repo.listCompetitors(db);
  const ratings = list.find(x => x.placeId === samplePlaceId('est-11'));
  const none = list.find(x => x.placeId === samplePlaceId('est-15'));
  assert.match(ratings.unreadableReason, /Instagram/);
  assert.match(none.unreadableReason, /Google listing/);
  assert.notEqual(ratings.unreadableReason, none.unreadableReason);
  // and a full-tier row still carries no reason, because nothing is missing
  assert.equal(list.find(x => x.placeId === samplePlaceId('est-1')).unreadableReason, null);
});

test('current followers is the newest reading, not a separately stored number', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-1');
  const before = repo.listCompetitors(db).find(c => c.placeId === pid);
  assert.equal(before.followers, 41200);
  repo.recordObservations(db, [{ subject: pid, observedAt: new Date().toISOString(), source: 'business_discovery', followers: 41999, avgInteractions: 3584 }]);
  const after = repo.listCompetitors(db).find(c => c.placeId === pid);
  assert.equal(after.followers, 41999);
  assert.equal(after.engagementRate, +(3584 / 41999).toFixed(4));
});

test('newestWith skips samples that lack the field', () => {
  const s = [{ at: 'a', followers: 10 }, { at: 'b', reviews: 3 }];
  assert.equal(newestWith(s, 'followers').followers, 10);
  assert.equal(newestWith(s, 'avgInteractions'), null);
});

test('recordObservations rejects a non-finite measure rather than poisoning a series', () => {
  const db = seededDb();
  assert.throws(() => repo.recordObservations(db, [
    { subject: 'x', observedAt: new Date().toISOString(), source: 'places', reviewCount: Number.NaN },
  ]), /finite number/);
  assert.throws(() => repo.recordObservations(db, [
    { subject: 'x', observedAt: 'not-a-date', source: 'places' },
  ]), /bad observedAt/);
});

test('a rejected batch writes nothing — the transaction rolls back', () => {
  const db = seededDb();
  const before = db.prepare('SELECT COUNT(*) n FROM observations').get().n;
  assert.throws(() => repo.recordObservations(db, [
    { subject: 'ok', observedAt: new Date().toISOString(), source: 'places', reviewCount: 1 },
    { subject: '', observedAt: new Date().toISOString(), source: 'places' },
  ]));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM observations').get().n, before);
});

test('competitorRef is served, so the client need not guess it from a string pattern', () => {
  const db = seededDb();
  const c = repo.listCompetitors(db).find(x => x.placeId === samplePlaceId('est-1'));
  assert.equal(c.competitorRef, 'cmp-1');
});

test('every response carries CORS, and a preflight is answered', async () => {
  const { createServer } = await import('../src/http.js');
  const db = seededDb();
  const server = createServer(db);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = await fetch(`${base}/competitors`);
    assert.equal(get.headers.get('access-control-allow-origin'), '*');
    const body = await get.json();
    assert.equal(body.competitors.length, 6);
    assert.equal(body.minWindowDays, MIN_WINDOW_DAYS, 'the client must not hardcode the threshold');
    assert.equal(body.self.velocity.perMonth, 62);

    const pre = await fetch(`${base}/competitors`, { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get('access-control-allow-methods'), /POST/);

    const post = await fetch(`${base}/observations`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ observations: [{ subject: samplePlaceId('est-1'), observedAt: new Date().toISOString(), source: 'places', reviewCount: 3121 }] }),
    });
    assert.equal((await post.json()).written, 1);

    const bad = await fetch(`${base}/observations`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});

test('lastSyncedAt is null on a fresh seed and set once a sync writes content', () => {
  const db = seededDb();
  assert.equal(repo.lastSyncedAt(db), null,
    'the seed writes places/business_profile readings, never a business_discovery one');
  const at = new Date().toISOString();
  repo.recordObservations(db, [{ subject: samplePlaceId('est-1'), observedAt: at, source: 'business_discovery', followers: 41210, avgInteractions: 3584 }]);
  assert.equal(repo.lastSyncedAt(db), at);
});

test('a sync moves the review count on BOTH the establishment and the competitor row', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-1');
  assert.equal(repo.getEstablishment(db, pid).userRatingsTotal, 3120);
  assert.equal(repo.listCompetitors(db).find(c => c.placeId === pid).googleReviews, 3120);
  repo.recordObservations(db, [{ subject: pid, observedAt: new Date().toISOString(), source: 'places', reviewCount: 3123, rating: 4.5 }]);
  assert.equal(repo.getEstablishment(db, pid).userRatingsTotal, 3123, 'Establishments screen');
  assert.equal(repo.listCompetitors(db).find(c => c.placeId === pid).googleReviews, 3123, 'Competitors table');
});
