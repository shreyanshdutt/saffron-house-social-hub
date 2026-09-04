import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availability, STALE_AFTER_DAYS } from '../src/availability.js';

const est = (over = {}) => ({ business_status: 'OPERATIONAL', rating: 4.2, user_ratings_total: 900, ...over });
const ig  = (over = {}) => ({ platform: 'instagram', account_type: 'business', last_post_days_ago: null, handle: '@x', ...over });

test('full tier — Google listing plus a readable, active Instagram account', () => {
  const a = availability(est(), [ig()]);
  assert.equal(a.tier, 'full');
  assert.equal(a.hasGoogle, true);
  assert.equal(a.igReadable, true);
  assert.equal(a.stale, false);
});

test('creator accounts are readable too', () => {
  assert.equal(availability(est(), [ig({ account_type: 'creator' })]).tier, 'full');
});

test('ratings tier — personal and private accounts cannot be read at all', () => {
  for (const t of ['personal', 'private']) {
    const a = availability(est(), [ig({ account_type: t })]);
    assert.equal(a.tier, 'ratings', `${t} must not reach the full tier`);
    assert.equal(a.igReadable, false);
    assert.match(a.reasons.map(r => r.text).join(' '), new RegExp(`cannot read ${t}`));
  }
});

test('ratings tier — no Instagram row at all', () => {
  assert.equal(availability(est(), []).tier, 'ratings');
  assert.equal(availability(est(), [ig({ account_type: 'absent', handle: null })]).tier, 'ratings');
});

test(`a dormant account (> ${STALE_AFTER_DAYS}d) is readable but downgrades to ratings`, () => {
  const a = availability(est(), [ig({ last_post_days_ago: 142 })]);
  assert.equal(a.tier, 'ratings');
  assert.equal(a.igReadable, true, 'still readable — the tier reflects that there is nothing to compare');
  assert.equal(a.stale, true);
  assert.match(a.reasons.map(r => r.text).join(' '), /last posted 142 days ago/);
  // the boundary itself is not stale
  assert.equal(availability(est(), [ig({ last_post_days_ago: STALE_AFTER_DAYS })]).tier, 'full');
  assert.equal(availability(est(), [ig({ last_post_days_ago: STALE_AFTER_DAYS + 1 })]).tier, 'ratings');
});

test('none tier — no Google listing means Places gives us no way in', () => {
  const a = availability(est({ business_status: null }), [ig()]);
  assert.equal(a.tier, 'none');
  assert.equal(a.hasGoogle, false);
});

test('UNKNOWN is a real state and is not treated as readable', () => {
  const a = availability(est(), [ig({ account_type: 'unknown' })]);
  assert.equal(a.tier, 'ratings', 'an unverified account must not promise data we cannot produce');
  assert.equal(a.igReadable, false);
  assert.match(a.reasons.map(r => r.text).join(' '), /not yet verified/);
});

test('an X handle is noted but never counts toward availability', () => {
  const withX = availability(est(), [ig({ account_type: 'personal' }), { platform: 'x', handle: '@a' }]);
  assert.equal(withX.tier, 'ratings');
  assert.match(withX.reasons.map(r => r.text).join(' '), /paid API tier/);
});
