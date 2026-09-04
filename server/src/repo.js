// Queries. Kept apart from the HTTP layer so the tests can exercise them
// without a socket.

import { availability } from './availability.js';
import { seriesFor } from './observations.js';
import { nowIso } from './db.js';

export function socialFor(db, placeId) {
  return db.prepare(
    `SELECT platform, handle, account_type, readable, last_post_days_ago,
            verified_at, verification_error, discovered_from
       FROM establishment_social WHERE place_id = ? ORDER BY platform`
  ).all(placeId);
}

export function listEstablishments(db) {
  const rows = db.prepare(
    `SELECT e.*, (t.place_id IS NOT NULL) AS tracked
       FROM establishments e LEFT JOIN tracked t ON t.place_id = e.place_id
      ORDER BY e.local_ref`
  ).all();
  return rows.map(r => shapeEstablishment(db, r));
}

export function getEstablishment(db, placeId) {
  const row = db.prepare(
    `SELECT e.*, (t.place_id IS NOT NULL) AS tracked
       FROM establishments e LEFT JOIN tracked t ON t.place_id = e.place_id
      WHERE e.place_id = ?`
  ).get(placeId);
  return row ? shapeEstablishment(db, row) : null;
}

function shapeEstablishment(db, row) {
  const social = socialFor(db, row.place_id);
  const avail = availability(row, social);
  return {
    placeId: row.place_id,
    localRef: row.local_ref,
    isSample: !!row.is_sample,
    name: row.name,
    category: row.category,
    rating: row.rating,
    userRatingsTotal: row.user_ratings_total,
    businessStatus: row.business_status,
    website: row.website,
    // Null when the volatile content has been purged — that is the retention
    // policy working, and a consumer must be able to see it rather than being
    // handed a stale copy.
    fetchedAt: row.fetched_at,
    tracked: !!row.tracked,
    availability: avail,
    social: social.map(s => ({
      platform: s.platform,
      handle: s.handle,
      accountType: s.account_type,
      readable: s.readable === null ? null : !!s.readable,
      lastPostDaysAgo: s.last_post_days_ago,
      verifiedAt: s.verified_at,
      verificationError: s.verification_error,
      discoveredFrom: s.discovered_from,
    })),
  };
}

export function listTracked(db) {
  return db.prepare(
    `SELECT t.place_id, t.tracked_at, t.tracked_by, e.local_ref, e.name
       FROM tracked t JOIN establishments e ON e.place_id = t.place_id
      ORDER BY e.local_ref`
  ).all().map(r => ({
    placeId: r.place_id, localRef: r.local_ref, name: r.name,
    trackedAt: r.tracked_at, trackedBy: r.tracked_by,
  }));
}

export function track(db, placeId, by) {
  db.prepare(
    `INSERT INTO tracked (place_id, tracked_at, tracked_by) VALUES (?, ?, ?)
       ON CONFLICT (place_id) DO UPDATE SET tracked_at = excluded.tracked_at,
                                            tracked_by = excluded.tracked_by`
  ).run(placeId, nowIso(), by);
}

export function untrack(db, placeId) {
  return Number(db.prepare(`DELETE FROM tracked WHERE place_id = ?`).run(placeId).changes ?? 0);
}

export function observations(db, subject) {
  return { subject, samples: seriesFor(db, subject) };
}

export function health(db) {
  const count = (t) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
  return {
    ok: true,
    establishments: count('establishments'),
    social: count('establishment_social'),
    tracked: count('tracked'),
    observations: count('observations'),
    scans: count('scans'),
  };
}
