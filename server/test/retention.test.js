import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { purgePlacesContent } from '../src/retention.js';
import { insertObservation } from '../src/observations.js';
import { isoDaysAgo, nowIso } from '../src/db.js';
import { retentionDays, PLACES_RETENTION_DAYS_MAX } from '../src/config.js';
import { seriesFor } from '../src/observations.js';
import { velocityFromSeries, MIN_WINDOW_DAYS } from '../src/derive.js';

function realEstablishment(db, placeId, fetchedAt) {
  db.prepare(
    `INSERT INTO establishments
       (place_id, local_ref, is_sample, first_seen_at, fetched_at, name, rating,
        user_ratings_total, business_status, lat, lng, website)
     VALUES (?, ?, 0, ?, ?, 'Real Place', 4.4, 900, 'OPERATIONAL', 28.6, 77.0, 'https://example.test')`
  ).run(placeId, placeId, nowIso(), fetchedAt);
}

test('purge clears volatile Places content older than the window but KEEPS place_id', () => {
  const db = freshDb();
  realEstablishment(db, 'ChIJ_stale', isoDaysAgo(31));
  const out = purgePlacesContent(db, 30);
  assert.equal(out.establishmentsCleared, 1);

  const row = db.prepare('SELECT * FROM establishments WHERE place_id = ?').get('ChIJ_stale');
  assert.ok(row, 'the row itself must survive — place_id is permanent under §A.3');
  assert.equal(row.place_id, 'ChIJ_stale');
  assert.equal(row.local_ref, 'ChIJ_stale', 'our own bookkeeping columns survive too');
  for (const col of ['name', 'rating', 'user_ratings_total', 'business_status', 'lat', 'lng', 'website', 'fetched_at']) {
    assert.equal(row[col], null, `${col} must be cleared`);
  }
});

test('purge leaves content INSIDE the window untouched', () => {
  const db = freshDb();
  realEstablishment(db, 'ChIJ_fresh', isoDaysAgo(29));
  const out = purgePlacesContent(db, 30);
  assert.equal(out.establishmentsCleared, 0);
  const row = db.prepare('SELECT * FROM establishments WHERE place_id = ?').get('ChIJ_fresh');
  assert.equal(row.name, 'Real Place');
  assert.equal(row.lat, 28.6);
});

test('purge exempts fabricated sample rows — they are not Google Maps Content', () => {
  const db = freshDb();
  db.prepare(
    `INSERT INTO establishments (place_id, local_ref, is_sample, first_seen_at, fetched_at, name, rating)
     VALUES ('sample:est-1', 'est-1', 1, ?, ?, 'Dwarka Darbar', 4.5)`
  ).run(nowIso(), isoDaysAgo(400));
  purgePlacesContent(db, 30);
  const row = db.prepare('SELECT * FROM establishments WHERE place_id = ?').get('sample:est-1');
  assert.equal(row.name, 'Dwarka Darbar', 'seed data is invented, not cached from Google');
});

test('the window is a parameter, so changing the policy is one constant', () => {
  const db = freshDb();
  realEstablishment(db, 'ChIJ_a', isoDaysAgo(10));
  assert.equal(purgePlacesContent(db, 30).establishmentsCleared, 0);
  assert.equal(purgePlacesContent(db, 7).establishmentsCleared, 1, 'a 7-day policy catches a 10-day-old row');
});

// ---------------------------------------------------------------------------
// Places-sourced observations, governed since the owner's ruling of
// 2026-09-08 (CONVENTIONS.md §10). These cover the `PURGE_PLACES_OBSERVATIONS`
// branch of purgePlacesContent(), which had never executed under test while
// the switch was false — flipping it turned dead code live, so it owes tests
// for the branch and not merely for the constant.

const obs = (db, over = {}) => insertObservation(db, {
  subject: 'ChIJ_a', observedAt: isoDaysAgo(400), source: 'places',
  reviewCount: 10, isSample: 0, ...over,
});
const remaining = (db) => db.prepare('SELECT subject, source, is_sample, observed_at FROM observations').all();

test('a REAL Places observation past the window is deleted, and counted', () => {
  const db = freshDb();
  obs(db, { observedAt: isoDaysAgo(31) });
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsGoverned, true, 'the switch is on since the ruling');
  assert.equal(out.observationsDeleted, 1, 'the summary reports what it removed');
  assert.equal(remaining(db).length, 0);
});

test('a SAMPLE observation past the window survives — fabricated data is not Google Maps Content', () => {
  const db = freshDb();
  obs(db, { observedAt: isoDaysAgo(400), isSample: 1 });
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsDeleted, 0);
  assert.equal(remaining(db).length, 1, 'the demo must not empty itself');
  assert.equal(remaining(db)[0].is_sample, 1);
});

test('a non-Places observation survives at any age — §14.3 does not reach it', () => {
  const db = freshDb();
  // Business Discovery is Meta's, and business_profile is our OWN listing.
  obs(db, { subject: 'ChIJ_b', source: 'business_discovery', observedAt: isoDaysAgo(900), followers: 100, reviewCount: null });
  obs(db, { subject: 'saf-self', source: 'business_profile', observedAt: isoDaysAgo(900) });
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsDeleted, 0);
  assert.deepEqual(remaining(db).map(r => r.source).sort(), ['business_discovery', 'business_profile']);
});

test('a REAL Places observation INSIDE the window survives', () => {
  const db = freshDb();
  obs(db, { observedAt: isoDaysAgo(29) });
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsDeleted, 0);
  assert.equal(remaining(db).length, 1);
});

test('one purge separates all four cases in a single pass', () => {
  const db = freshDb();
  obs(db, { subject: 'old-real',   observedAt: isoDaysAgo(45) });                    // deleted
  obs(db, { subject: 'old-sample', observedAt: isoDaysAgo(45), isSample: 1 });       // kept
  obs(db, { subject: 'old-bd',     observedAt: isoDaysAgo(45), source: 'business_discovery' }); // kept
  obs(db, { subject: 'new-real',   observedAt: isoDaysAgo(5) });                     // kept
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsDeleted, 1);
  assert.deepEqual(remaining(db).map(r => r.subject).sort(), ['new-real', 'old-bd', 'old-sample']);
});

// The consequence the ruling was made on. If this fails, the ruling was taken
// on a false premise and the finding is a STOP, not a test to adjust.
test('competitor review velocity still resolves to `rate` after a purge', () => {
  const db = freshDb();
  const subject = 'ChIJ_rival';
  // A year of readings. Everything past 30 days is about to be deleted.
  for (const [daysAgo, reviews] of [[90, 800], [60, 860], [40, 900], [25, 930], [18, 944], [10, 960], [2, 975]]) {
    obs(db, { subject, observedAt: isoDaysAgo(daysAgo), reviewCount: reviews });
  }
  assert.equal(velocityFromSeries(seriesFor(db, subject)).state, 'rate', 'rate before the purge');

  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsDeleted, 3, 'the 90, 60 and 40 day readings go');

  const after = seriesFor(db, subject);
  assert.equal(after.length, 4, 'the four readings inside the window remain');
  const v = velocityFromSeries(after);
  assert.equal(v.state, 'rate',
    'velocity must survive the purge — the ruling was made on this understanding');
  assert.ok(v.windowDays >= MIN_WINDOW_DAYS,
    `the surviving window (${v.windowDays}d) must still clear the ${MIN_WINDOW_DAYS}-day floor`);
  assert.ok(v.windowDays <= 30, 'and it is now capped by the retention window, not unbounded');
  assert.ok(Number.isFinite(v.perMonth) && v.perMonth > 0, 'a real monthly rate, not null');
});

test('our own velocity is untouched by the purge — saf-self is Business Profile, not Places', () => {
  const db = freshDb();
  for (const [daysAgo, reviews] of [[90, 1098], [60, 1158], [30, 1220], [0, 1284]]) {
    obs(db, { subject: 'saf-self', source: 'business_profile', observedAt: isoDaysAgo(daysAgo), reviewCount: reviews });
  }
  purgePlacesContent(db, 30);
  const v = velocityFromSeries(seriesFor(db, 'saf-self'));
  assert.equal(seriesFor(db, 'saf-self').length, 4, 'all four readings survive');
  assert.equal(v.state, 'rate');
  assert.equal(v.perMonth, 62, 'the same figure it has always produced');
});

test('retentionDays refuses a window above the §14.3 ceiling, at boot', () => {
  assert.equal(retentionDays({}), 30);
  assert.equal(retentionDays({ PLACES_RETENTION_DAYS: '14' }), 14);
  assert.throws(() => retentionDays({ PLACES_RETENTION_DAYS: String(PLACES_RETENTION_DAYS_MAX + 1) }), /§14\.3/);
  assert.throws(() => retentionDays({ PLACES_RETENTION_DAYS: '0' }), /positive integer/);
});
