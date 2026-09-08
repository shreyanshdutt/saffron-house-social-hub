import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, freshDb, REPO_ROOT } from './helpers.js';
import { samplePlaceId } from '../seed/seed.js';
import * as repo from '../src/repo.js';
import { availability } from '../src/availability.js';
import { assertSchemaCurrent, openDb } from '../src/db.js';
import {
  CHANNEL_CAPABILITIES, CAPABILITIES, channelCapabilities, accountState, billedCapabilities,
} from '../src/channels.js';

const addSocial = (db, pid, platform, accountType, handle) =>
  db.prepare(
    `INSERT INTO establishment_social (place_id, platform, handle, account_type, readable, verified_at, discovered_from)
     VALUES (?, ?, ?, ?, ?, ?, 'test')`
  ).run(pid, platform, handle, accountType, ['business', 'creator'].includes(accountType) ? 1 : 0, new Date().toISOString());

// --- schema ----------------------------------------------------------------

test('a youtube row is accepted by the schema', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(pid);
  assert.doesNotThrow(() => addSocial(db, pid, 'youtube', 'business', '@sethisweets'));
  const row = repo.socialFor(db, pid).find(s => s.platform === 'youtube');
  assert.equal(row.handle, '@sethisweets');
});

test('an invalid platform is still rejected', () => {
  const db = seededDb();
  assert.throws(() => addSocial(db, samplePlaceId('est-13'), 'tiktok', 'business', '@x'), /CHECK|constraint/i);
});

test('youtube_data and x_api are accepted as observation sources; nonsense is not', () => {
  const db = seededDb();
  const ins = (src) => db.prepare(
    `INSERT INTO observations (subject, observed_at, source, is_sample) VALUES ('s', ?, ?, 1)`
  ).run(new Date().toISOString(), src);
  assert.doesNotThrow(() => ins('youtube_data'));
  assert.doesNotThrow(() => ins('x_api'));
  assert.throws(() => ins('carrier_pigeon'), /CHECK|constraint/i);
});

test('a database predating the new CHECK is caught at boot, not at insert time', () => {
  const db = openDb(':memory:');
  db.exec(`CREATE TABLE establishment_social (id INTEGER PRIMARY KEY,
             platform TEXT NOT NULL CHECK (platform IN ('instagram','x','facebook')))`);
  assert.throws(() => assertSchemaCurrent(db), /predates the current schema|does not allow 'youtube'/);
});

// --- the static half: what a platform can EVER do ---------------------------

test('the platform table states the four facts the owner specified', () => {
  const C = CHANNEL_CAPABILITIES;
  assert.equal(C.instagram.posts.supported, true);
  assert.equal(C.instagram.commentText.supported, false, 'counts only, at any price');
  assert.equal(C.youtube.posts.supported, true);
  assert.equal(C.youtube.commentText.supported, true);
  assert.equal(C.youtube.commentText.billed, false, 'API key, quota units — not billed per read');
  assert.equal(C.x.posts.supported, true);
  assert.equal(C.x.commentText.supported, true);
  assert.equal(C.x.posts.billed, true);
  assert.equal(C.x.commentText.billed, true, 'both billed per read — this is where the money goes');
  assert.equal(C.google.ratings.supported, true);
  assert.equal(C.google.reviewText.supported, false, 'the number yes, the words no');
});

test('posts and commentText are SEPARATE capabilities, so the costly one can be switched off alone', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(pid);
  addSocial(db, pid, 'x', 'business', '@somebody');
  const est = repo.getEstablishment(db, pid);
  const x = est.channels.x.capabilities;
  assert.equal(x.posts.available, true);
  assert.equal(x.commentText.available, true);
  // Both are reachable and both are billed, but they are distinct entries — a
  // caller can read posts and refuse replies without disabling the channel.
  assert.notEqual(x.posts, x.commentText);
  assert.equal(x.posts.billed, true);
  assert.equal(x.commentText.billed, true);
  assert.deepEqual(billedCapabilities(est.channels).filter(b => b.platform === 'x').map(b => b.capability).sort(),
    ['commentText', 'posts']);
});

// --- the product, and WHICH SIDE said no ------------------------------------

test('a readable YouTube account can read comment text; an Instagram-only one cannot', () => {
  const db = seededDb();
  const yt = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(yt);
  addSocial(db, yt, 'youtube', 'business', '@sethisweets');

  const withYouTube = repo.getEstablishment(db, yt).channels;
  const instagramOnly = repo.getEstablishment(db, samplePlaceId('est-1')).channels;

  assert.equal(withYouTube.youtube.capabilities.commentText.available, true);
  assert.equal(instagramOnly.instagram.capabilities.commentText.available, false);
});

test('THE TWO NOs CARRY DIFFERENT REASONS — platform limit vs missing account', () => {
  const db = seededDb();
  // est-1 has a readable Instagram. Instagram itself cannot return comment
  // text, so the account is irrelevant: the PLATFORM said no.
  const ig = repo.getEstablishment(db, samplePlaceId('est-1')).channels.instagram.capabilities.commentText;
  assert.equal(ig.available, false);
  assert.equal(ig.blockedBy, 'platform');
  assert.match(ig.reason, /counts, never comment text|hard API limit/i);

  // The same establishment has no YouTube account. YouTube CAN return comment
  // text, so here the ACCOUNT said no — a different problem with a different
  // fix, and one the user can act on.
  const yt = repo.getEstablishment(db, samplePlaceId('est-1')).channels.youtube.capabilities.commentText;
  assert.equal(yt.available, false);
  assert.equal(yt.blockedBy, 'account');

  assert.notEqual(ig.blockedBy, yt.blockedBy);
  assert.notEqual(ig.reason, yt.reason,
    'saying "we cannot read their comments" for both is the collapse this model exists to prevent');
});

test('no account on a channel is distinguishable from a channel that cannot answer', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(pid);
  const ch = repo.getEstablishment(db, pid).channels;
  // YouTube: capable platform, no account -> blockedBy account
  assert.equal(ch.youtube.accountState, 'no-account');
  assert.equal(ch.youtube.capabilities.commentText.blockedBy, 'account');
  // Instagram: also no account, but commentText is impossible regardless, so
  // the platform limit is reported — getting the account would not help.
  assert.equal(ch.instagram.accountState, 'no-account');
  assert.equal(ch.instagram.capabilities.commentText.blockedBy, 'platform');
  assert.equal(ch.instagram.capabilities.posts.blockedBy, 'account',
    'posts ARE possible on Instagram, so for that capability the account is what is missing');
});

test('absent, unverified and no-account stay three separate states', () => {
  assert.equal(accountState(null).state, 'no-account');
  assert.equal(accountState({ account_type: 'absent' }).state, 'absent');
  assert.equal(accountState({ account_type: 'unknown' }).state, 'unverified');
  assert.equal(accountState({ account_type: 'personal' }).readable, false);
  assert.equal(accountState({ account_type: 'business' }).readable, true);
  const reasons = new Set([accountState(null).why, accountState({ account_type: 'absent' }).why,
                           accountState({ account_type: 'unknown' }).why]);
  assert.equal(reasons.size, 3, 'three states, three sentences');
});

test('an unverified handle grants no capability — same rule as the tier', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(pid);
  addSocial(db, pid, 'youtube', 'unknown', '@maybe');
  const yt = repo.getEstablishment(db, pid).channels.youtube;
  assert.equal(yt.accountState, 'unverified');
  assert.equal(yt.capabilities.commentText.available, false);
  assert.equal(yt.capabilities.commentText.blockedBy, 'account');
});

// --- THE TIER DID NOT MOVE --------------------------------------------------

test('SEED PARITY: the tier is byte-identical for all 15 seeded establishments', () => {
  const db = seededDb();
  const expected = {
    'est-1': 'full', 'est-2': 'full', 'est-3': 'full', 'est-4': 'full', 'est-5': 'full',
    'est-6': 'full', 'est-7': 'full', 'est-8': 'full', 'est-9': 'full',
    'est-10': 'ratings', 'est-11': 'ratings', 'est-12': 'ratings',
    'est-13': 'ratings', 'est-14': 'ratings', 'est-15': 'none',
  };
  const got = Object.fromEntries(repo.listEstablishments(db).map(e => [e.localRef, e.availability.tier]));
  assert.deepEqual(got, expected);
});

test('SEED PARITY: the whole availability object is exactly what availability() produces', () => {
  // Stronger than the tier alone: proves adding `channels` did not perturb the
  // reasons, flags or ordering that the client renders.
  const db = seededDb();
  for (const e of repo.listEstablishments(db)) {
    const row = db.prepare(`SELECT * FROM establishments WHERE place_id = ?`).get(e.placeId);
    const series = db.prepare(
      `SELECT review_count, rating FROM observations WHERE subject = ? AND review_count IS NOT NULL
        ORDER BY observed_at DESC LIMIT 1`).get(e.placeId);
    const current = { ...row,
      user_ratings_total: series ? series.review_count : row.user_ratings_total,
      rating: series && series.rating !== null ? series.rating : row.rating };
    assert.deepEqual(e.availability, availability(current, repo.socialFor(db, e.placeId)),
      `${e.localRef}: the served availability must be exactly availability()'s output`);
  }
});

test('every establishment gets a channel record for all four channels', () => {
  const db = seededDb();
  for (const e of repo.listEstablishments(db)) {
    assert.deepEqual(Object.keys(e.channels).sort(), ['google', 'instagram', 'x', 'youtube']);
    for (const ch of Object.values(e.channels)) {
      assert.deepEqual(Object.keys(ch.capabilities).sort(), [...CAPABILITIES].sort());
    }
  }
});
