import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { purgePlacesContent } from '../src/retention.js';
import { insertObservation } from '../src/observations.js';
import { isoDaysAgo, nowIso } from '../src/db.js';
import { retentionDays, PLACES_RETENTION_DAYS_MAX } from '../src/config.js';

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

test('observations are NOT purged while the owner decision is open', () => {
  const db = freshDb();
  insertObservation(db, { subject: 'ChIJ_a', observedAt: isoDaysAgo(400), source: 'places', reviewCount: 10 });
  const out = purgePlacesContent(db, 30);
  assert.equal(out.observationsGoverned, false);
  assert.equal(out.observationsDeleted, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM observations').get().n, 1);
});

test('retentionDays refuses a window above the §14.3 ceiling, at boot', () => {
  assert.equal(retentionDays({}), 30);
  assert.equal(retentionDays({ PLACES_RETENTION_DAYS: '14' }), 14);
  assert.throws(() => retentionDays({ PLACES_RETENTION_DAYS: String(PLACES_RETENTION_DAYS_MAX + 1) }), /§14\.3/);
  assert.throws(() => retentionDays({ PLACES_RETENTION_DAYS: '0' }), /positive integer/);
});
