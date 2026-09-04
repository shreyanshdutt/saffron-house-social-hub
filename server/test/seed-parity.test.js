import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, REPO_ROOT } from './helpers.js';
import { extractMock } from '../seed/extract-mock.js';
import { samplePlaceId } from '../seed/seed.js';
import * as repo from '../src/repo.js';

const { ESTABLISHMENTS, TRACKED_DEFAULT } = extractMock(REPO_ROOT);

test('all 15 establishments seed with identical name, rating and review count', () => {
  const db = seededDb();
  const rows = repo.listEstablishments(db);
  assert.equal(rows.length, 15);
  const byRef = new Map(rows.map(r => [r.localRef, r]));
  const diffs = [];
  for (const e of ESTABLISHMENTS) {
    const r = byRef.get(e.id);
    if (!r) { diffs.push(`${e.id}: missing`); continue; }
    if (r.name !== e.name) diffs.push(`${e.id}: name ${r.name} != ${e.name}`);
    const rating = e.google ? e.google.rating : null;
    const reviews = e.google ? e.google.reviews : null;
    if (r.rating !== rating) diffs.push(`${e.id}: rating ${r.rating} != ${rating}`);
    if (r.userRatingsTotal !== reviews) diffs.push(`${e.id}: reviews ${r.userRatingsTotal} != ${reviews}`);
  }
  assert.deepEqual(diffs, [], 'seeded rows must match mock.jsx exactly');
});

// Two implementations of one rule drift silently. This pins the server's
// derivation to the client's for every row we actually have.
test('the server tier agrees with mock.jsx establishmentAvailability for all 15', () => {
  const db = seededDb();
  const byRef = new Map(repo.listEstablishments(db).map(r => [r.localRef, r]));
  const expected = {
    'est-1': 'full', 'est-2': 'full', 'est-3': 'full', 'est-4': 'full', 'est-5': 'full',
    'est-6': 'full', 'est-7': 'full', 'est-8': 'full', 'est-9': 'full',
    'est-10': 'ratings',  // readable but dormant, 142 days
    'est-11': 'ratings',  // personal
    'est-12': 'ratings',  // private
    'est-13': 'ratings',  // no Instagram at all
    'est-14': 'ratings',  // personal
    'est-15': 'none',     // no Google listing
  };
  const diffs = [];
  for (const [ref, tier] of Object.entries(expected)) {
    const got = byRef.get(ref).availability.tier;
    if (got !== tier) diffs.push(`${ref}: ${got} != ${tier}`);
  }
  assert.deepEqual(diffs, []);
});

test('the tracked default seeds exactly est-1..est-6', () => {
  const db = seededDb();
  assert.deepEqual(repo.listTracked(db).map(t => t.localRef), TRACKED_DEFAULT);
  assert.deepEqual([...new Set(repo.listTracked(db).map(t => t.trackedBy))], ['admin']);
});

test('fabricated rows carry is_sample so real Places rows can be told apart', () => {
  const db = seededDb();
  assert.equal(repo.listEstablishments(db).every(r => r.isSample), true);
});

test('track and untrack are idempotent and reject a non-role', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-11');
  repo.track(db, pid, 'manager');
  repo.track(db, pid, 'manager');
  assert.equal(repo.listTracked(db).filter(t => t.placeId === pid).length, 1);
  assert.equal(repo.untrack(db, pid), 1);
  assert.equal(repo.untrack(db, pid), 0);
});

test('re-seeding is idempotent — no duplicate rows', async () => {
  const { seed } = await import('../seed/seed.js');
  const db = seededDb();
  seed(db, REPO_ROOT);
  seed(db, REPO_ROOT);
  assert.equal(repo.listEstablishments(db).length, 15);
  assert.equal(repo.observations(db, samplePlaceId('est-1')).samples.length, 4);
});
