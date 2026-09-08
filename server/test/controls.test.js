import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb } from './helpers.js';
import * as repo from '../src/repo.js';
import { samplePlaceId } from '../seed/seed.js';
import { normaliseHandle } from '../src/repo.js';

const ref = (rows) => rows.map(r => r.localRef).sort();

// --- filters ---------------------------------------------------------------

test('no filters returns all 15', () => {
  assert.equal(repo.listEstablishments(seededDb(), {}).length, 15);
  assert.equal(repo.listEstablishments(seededDb()).length, 15);
});

test('maxDistanceKm filters in SQL, not in the browser', () => {
  const db = seededDb();
  const near = repo.listEstablishments(db, { maxDistanceKm: 0.3 });
  for (const r of near) {
    if (!r.tracked) assert.ok(r.distanceKm <= 0.3, `${r.localRef} at ${r.distanceKm}km should be excluded`);
  }
  assert.ok(near.length < 15);
});

test('minRating filters, and est-14 Grill & Chill (3.6) leaves at 4.0', () => {
  const db = seededDb();
  const rows = repo.listEstablishments(db, { minRating: 4.0 });
  assert.equal(rows.some(r => r.localRef === 'est-14'), false, 'untracked and below threshold — gone');
  assert.equal(rows.find(r => r.localRef === 'est-1').rating, 4.5);
});

test('a TRACKED establishment is never filtered out, and says why it stayed', () => {
  const db = seededDb();
  // est-4 The Curry Room, 3.8, tracked by default.
  const rows = repo.listEstablishments(db, { minRating: 4.0 });
  const curry = rows.find(r => r.localRef === 'est-4');
  assert.ok(curry, 'a tracked competitor must not vanish because a slider moved');
  assert.equal(curry.belowFilters, true);
  assert.equal(curry.tracked, true);
  // and an untracked row that passes is not flagged
  assert.equal(rows.find(r => r.localRef === 'est-1').belowFilters, false);
});

test('a tracked row below BOTH filters is still kept, once', () => {
  const db = seededDb();
  const rows = repo.listEstablishments(db, { minRating: 4.9, maxDistanceKm: 0.05 });
  const tracked = rows.filter(r => r.tracked);
  assert.equal(tracked.length, 6, 'all six defaults survive');
  assert.equal(new Set(rows.map(r => r.placeId)).size, rows.length, 'no duplicate rows from the OR');
  assert.equal(tracked.every(r => r.belowFilters), true);
});

test('unknown distance or rating is not treated as failing the filter', () => {
  const db = seededDb();
  // est-15 has no rating (no Google listing at all).
  assert.equal(repo.listEstablishments(db, { minRating: 4.9 }).some(r => r.localRef === 'est-15'), true,
    'unrated is "not measured", not "below threshold"');
});

test('a non-numeric filter is ignored rather than silently excluding everything', () => {
  const db = seededDb();
  assert.equal(repo.listEstablishments(db, { minRating: 'abc', maxDistanceKm: '' }).length, 15);
});

// --- handle entry ----------------------------------------------------------

test('normaliseHandle accepts a bare handle, an @handle and a pasted URL', () => {
  assert.equal(normaliseHandle('SethiSweets'), '@sethisweets');
  assert.equal(normaliseHandle('  @SethiSweets '), '@sethisweets');
  assert.equal(normaliseHandle('https://instagram.com/Sethi.Sweets_01/'), '@sethi.sweets_01');
  assert.equal(normaliseHandle(''), null);
  assert.equal(normaliseHandle('has spaces'), null);
  assert.equal(normaliseHandle('a'.repeat(31)), null);
});

test('ENTERING A HANDLE DOES NOT RAISE THE TIER', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');   // Sethi Sweets, no Instagram at all
  const before = repo.getEstablishment(db, pid);
  assert.equal(before.availability.tier, 'ratings');

  repo.setInstagramHandle(db, pid, '@sethisweets');
  const after = repo.getEstablishment(db, pid);
  assert.equal(after.availability.tier, 'ratings',
    'typing a handle is not evidence the account can be read');
  const ig = after.social.find(s => s.platform === 'instagram');
  assert.equal(ig.handle, '@sethisweets');
  assert.equal(ig.accountType, 'unknown');
  assert.equal(ig.readable, null, 'NULL = never attempted, not false');
  assert.equal(ig.verifiedAt, null);
  assert.equal(ig.discoveredFrom, 'manual');
  assert.equal(after.availability.igReadable, false);
  assert.match(after.availability.reasons.map(r => r.text).join(' '), /not yet verified/);
});

test('correcting a handle resets verification — it is a different account', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-1');   // seeded business account, readable
  assert.equal(repo.getEstablishment(db, pid).availability.tier, 'full');
  repo.setInstagramHandle(db, pid, '@somethingelse');
  const after = repo.getEstablishment(db, pid);
  const ig = after.social.find(s => s.platform === 'instagram');
  assert.equal(ig.accountType, 'unknown');
  assert.equal(ig.readable, null);
  assert.equal(after.availability.tier, 'ratings',
    'the old account\'s readability must not carry over to a new handle');
});

test('removing a handle records `absent` — distinct from never having looked', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  repo.setInstagramHandle(db, pid, '@sethisweets');
  repo.clearInstagramHandle(db, pid);
  const ig = repo.getEstablishment(db, pid).social.find(s => s.platform === 'instagram');
  assert.equal(ig.handle, null);
  assert.equal(ig.accountType, 'absent');
  assert.ok(ig.verifiedAt, 'absent carries a verified_at: we looked, on this date');
  assert.match(repo.getEstablishment(db, pid).availability.reasons.map(r => r.text).join(' '),
    /No Instagram account found/);
});

test('an establishment nobody has looked at has NO instagram row at all', () => {
  const db = seededDb();
  // Prove the two states are representable and different.
  const pid = samplePlaceId('est-13');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ? AND platform = 'instagram'`).run(pid);
  const noRow = repo.getEstablishment(db, pid);
  assert.equal(noRow.social.some(s => s.platform === 'instagram'), false);
  repo.clearInstagramHandle(db, pid);
  const absentRow = repo.getEstablishment(db, pid);
  assert.equal(absentRow.social.find(s => s.platform === 'instagram').accountType, 'absent');
});

test('an invalid handle is rejected and nothing is written', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  assert.throws(() => repo.setInstagramHandle(db, pid, 'not a handle'), /letters, digits/);
  const ig = repo.getEstablishment(db, pid).social.find(s => s.platform === 'instagram');
  assert.equal(ig.accountType, 'absent', 'unchanged from the seed');
});

// --- social identity on the competitor row ----------------------------------
// establishment_social is the source of truth for a handle. It used to reach
// the Competitors row by a join through `competitorRef`, so an establishment
// without that seed-era link arrived with no handle — and the row turned the
// null into "No Instagram account" about an account the database was holding.

test('a tracked establishment with NO competitorRef still serves its handle', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-15');   // Biryani Junction: competitorId null
  repo.track(db, pid, 'admin');
  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  assert.equal(c.competitorRef, null, 'this is the case that was broken');
  assert.equal(c.handle, '@biryanijunction.ncr', 'served from establishment_social, not the ref');
  assert.equal(c.handlePlatform, 'instagram');
  assert.equal(c.handleAccountType, 'business');
});

test('the served handle does not contradict the availability banner', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-15');
  repo.track(db, pid, 'admin');
  const est = repo.getEstablishment(db, pid);
  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  // The banner says the account is readable; the row must not say there is none.
  assert.equal(est.availability.igReadable, true);
  assert.ok(c.handle, 'a readable account must not arrive at the row as a null handle');
});

test('`absent` and `unknown` are distinguishable in what the server serves', () => {
  const db = seededDb();
  const checked = samplePlaceId('est-13');    // seeded 'absent': we looked, none
  const unchecked = samplePlaceId('est-12');
  repo.track(db, checked, 'admin');
  repo.track(db, unchecked, 'admin');
  // Put est-12 in the unchecked state a hand-entered handle produces.
  db.prepare(`UPDATE establishment_social SET account_type = 'unknown', verified_at = NULL
               WHERE place_id = ? AND platform = 'instagram'`).run(unchecked);

  const list = repo.listCompetitors(db);
  const a = list.find(x => x.placeId === checked);
  const u = list.find(x => x.placeId === unchecked);

  assert.equal(a.handleAccountType, 'absent', 'we looked and there is none');
  assert.equal(a.handle, null);
  assert.equal(u.handleAccountType, 'unknown', 'nobody has looked');
  assert.notEqual(a.handleAccountType, u.handleAccountType,
    'the client must be able to tell these apart — collapsing them is the defect');
});

test('an establishment with no social row at all serves nulls, not a guess', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-13');
  repo.track(db, pid, 'admin');
  db.prepare(`DELETE FROM establishment_social WHERE place_id = ?`).run(pid);
  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  assert.equal(c.handle, null);
  assert.equal(c.handleAccountType, null, 'no row is its own state — not `absent`');
});

test('clearing a handle leaves the row serveable — content and handle are independent', () => {
  const db = seededDb();
  const pid = samplePlaceId('est-1');   // HAS a competitorRef, so the client finds posts
  repo.clearInstagramHandle(db, pid);
  const c = repo.listCompetitors(db).find(x => x.placeId === pid);
  assert.equal(c.competitorRef, 'cmp-1', 'the post-content link is untouched');
  assert.equal(c.handle, null, 'but the handle is gone');
  assert.equal(c.handleAccountType, 'absent');
  // The client renders both; neither may assume the other exists.
});

// --- synced ----------------------------------------------------------------

test('synced is DERIVED from stored content, so it survives a reload', () => {
  const db = seededDb();
  assert.equal(repo.getEstablishment(db, samplePlaceId('est-1')).synced, true);
  assert.equal(repo.getEstablishment(db, samplePlaceId('est-7')).synced, false);

  repo.track(db, samplePlaceId('est-7'), 'admin');
  const c = repo.listCompetitors(db).find(x => x.placeId === samplePlaceId('est-7'));
  assert.equal(c.synced, false, 'tracked but never pulled');
  assert.equal(c.followers, null);
  assert.equal(c.dataTier, 'full', 'it IS readable — it just has not been read yet');

  repo.recordObservations(db, [{ subject: samplePlaceId('est-7'), observedAt: new Date().toISOString(),
    source: 'business_discovery', followers: 14800, avgInteractions: 533 }]);
  const after = repo.listCompetitors(db).find(x => x.placeId === samplePlaceId('est-7'));
  assert.equal(after.synced, true);
  assert.equal(after.followers, 14800);
});
