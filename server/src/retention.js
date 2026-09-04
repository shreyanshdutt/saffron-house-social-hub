// Retention purge.
//
// The window is NOT a number in this file. It arrives as an argument, sourced
// from retentionDays() in config.js, where the §14.3 clause is quoted beside
// it. Changing the policy is a change there and nowhere else — that is the
// property the owner asked for while the question of how long competitor
// review history may live is still open (CONVENTIONS.md §10).

import { isoDaysAgo } from './db.js';
import { PURGE_PLACES_OBSERVATIONS } from './config.js';

// Volatile Places content on `establishments`. `place_id` and our own
// bookkeeping columns survive; everything Google grants no caching permission
// for is nulled once it is older than the window.
//
// The row is NOT deleted. place_id is permanent under §A.3, and the row is
// what links tracking, social handles and observations together — dropping it
// would cascade away things the terms never asked us to forget.
const VOLATILE_COLUMNS = [
  'name', 'category', 'rating', 'user_ratings_total',
  'business_status', 'formatted_address', 'lat', 'lng', 'website',
];

export function purgePlacesContent(db, retentionDays, now = Date.now()) {
  const cutoff = isoDaysAgo(retentionDays, now);
  const setNull = VOLATILE_COLUMNS.map(c => `${c} = NULL`).join(', ');

  // Sample rows are fabricated seed data, not Google Maps Content, so §14.3
  // does not reach them — and purging them would empty the demo for no legal
  // gain. Real rows are governed; seeded ones are labelled and exempt.
  const establishments = db.prepare(
    `UPDATE establishments SET ${setNull}, fetched_at = NULL
      WHERE is_sample = 0 AND fetched_at IS NOT NULL AND fetched_at < ?`
  ).run(cutoff);

  let observations = { changes: 0 };
  if (PURGE_PLACES_OBSERVATIONS) {
    observations = db.prepare(
      `DELETE FROM observations
        WHERE is_sample = 0 AND source = 'places' AND observed_at < ?`
    ).run(cutoff);
  }

  return {
    cutoff,
    retentionDays,
    establishmentsCleared: Number(establishments.changes ?? 0),
    observationsDeleted: Number(observations.changes ?? 0),
    observationsGoverned: PURGE_PLACES_OBSERVATIONS,
  };
}
