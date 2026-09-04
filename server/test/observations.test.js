import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, seededDb } from './helpers.js';
import { seriesFor, insertObservation, rowToSample } from '../src/observations.js';
import { samplePlaceId } from '../seed/seed.js';
import { isoDaysAgo } from '../src/db.js';

test('a NULL column is an ABSENT key, never a zero', () => {
  // This is the property mock.jsx's changeFromSeries() depends on: it filters
  // to samples carrying the field it needs, and absence means "not observed".
  const s = rowToSample({
    observed_at: '2026-01-01T00:00:00.000Z', source: 'places',
    review_count: 3120, rating: null, followers: null, media_count: null, avg_interactions: null,
  });
  assert.deepEqual(s, { at: '2026-01-01T00:00:00.000Z', source: 'places', reviews: 3120 });
  assert.equal('followers' in s, false, 'a skipped Business Discovery must not appear as 0 followers');
  assert.equal(Object.hasOwn(s, 'rating'), false);
});

test('a Places-only sample and a Business-Discovery-only sample coexist on one subject', () => {
  const db = freshDb();
  insertObservation(db, { subject: 'p1', observedAt: isoDaysAgo(2), source: 'places', reviewCount: 100 });
  insertObservation(db, { subject: 'p1', observedAt: isoDaysAgo(1), source: 'business_discovery', followers: 900, avgInteractions: 40 });
  const series = seriesFor(db, 'p1');
  assert.equal(series.length, 2);
  assert.deepEqual(Object.keys(series[0]).sort(), ['at', 'reviews', 'source']);
  assert.deepEqual(Object.keys(series[1]).sort(), ['at', 'avgInteractions', 'followers', 'source']);
});

test('series comes back oldest -> newest, which every derivation assumes', () => {
  const db = freshDb();
  for (const d of [1, 90, 30, 60]) {
    insertObservation(db, { subject: 'p1', observedAt: isoDaysAgo(d), source: 'places', reviewCount: 1000 - d });
  }
  const at = seriesFor(db, 'p1').map(s => s.at);
  assert.deepEqual(at, [...at].sort(), 'ascending by observed_at');
  assert.deepEqual(seriesFor(db, 'p1').map(s => s.reviews), [910, 940, 970, 999]);
});

test('the seeded series matches OBSERVATION_HISTORY in shape and content', () => {
  const db = seededDb();
  const series = seriesFor(db, samplePlaceId('est-1'));
  assert.equal(series.length, 4);
  assert.deepEqual(series.map(s => s.reviews), [2676, 2810, 2965, 3120]);
  assert.deepEqual(series.map(s => s.followers), [39692, 40195, 40697, 41200]);
  assert.deepEqual(series.map(s => s.avgInteractions), [2213, 2670, 3127, 3584]);
  // 90 days between first and last, as the client's seed intends
  const days = (Date.parse(series[3].at) - Date.parse(series[0].at)) / 86_400_000;
  assert.ok(Math.abs(days - 90) < 0.01, `expected a 90-day window, got ${days}`);
});

test("our own readings are labelled business_profile, a rival's places — §10 forbids conflating them", () => {
  const db = seededDb();
  assert.deepEqual([...new Set(seriesFor(db, 'saf-self').map(s => s.source))], ['business_profile']);
  assert.deepEqual([...new Set(seriesFor(db, samplePlaceId('est-1')).map(s => s.source))], ['places']);
});

test('an unknown subject returns an empty series, not an error', () => {
  assert.deepEqual(seriesFor(seededDb(), 'sample:est-99'), []);
});
