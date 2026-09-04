// Queries. Kept apart from the HTTP layer so the tests can exercise them
// without a socket.

import { availability } from './availability.js';
import { seriesFor, insertObservation, SELF_SUBJECT } from './observations.js';
import { velocityFromSeries, changeFromSeries, newestWith } from './derive.js';
import { nowIso } from './db.js';

// "Do we hold Business Discovery content for this establishment." Keyed on the
// DATA being present, not on the `source` label: the seed writes its
// follower-carrying rows as `places` (flagged as an imprecision in 432ebc0
// finding i), and a definition that disagreed with the seed would report every
// seeded rival as never pulled. Follower count is the field only Business
// Discovery can produce, so its presence is the evidence.
export function hasContent(db, placeId) {
  const row = db.prepare(
    `SELECT 1 AS hit FROM observations
      WHERE subject = ? AND followers IS NOT NULL LIMIT 1`
  ).get(placeId);
  return !!row;
}

export function socialFor(db, placeId) {
  return db.prepare(
    `SELECT platform, handle, account_type, readable, last_post_days_ago,
            verified_at, verification_error, discovered_from
       FROM establishment_social WHERE place_id = ? ORDER BY platform`
  ).all(placeId);
}

// Filtering happens in SQL, not in the browser: `distance_km` and `rating` are
// real columns, and a scan of a real catchment returns more rows than a client
// should be shipped in order to throw most of them away.
//
// A TRACKED establishment is never filtered out. Hiding a competitor the user
// has explicitly chosen, because a slider moved, is how someone ends up
// comparing themselves against a set they think is complete and is not — and
// the row that would go first is `est-4` The Curry Room at 3.8, a tracked
// rival whose LOW rating is exactly why it is worth watching. Tracked rows
// come back flagged `belowFilters` so the screen can say why they are there.
export function listEstablishments(db, filters = {}) {
  const where = [];
  const args = [];
  const maxDistanceKm = numOrNull(filters.maxDistanceKm);
  const minRating = numOrNull(filters.minRating);

  if (maxDistanceKm !== null) {
    // A row with no distance is NOT silently dropped: unknown is not "far".
    where.push('(e.distance_km IS NULL OR e.distance_km <= ?)');
    args.push(maxDistanceKm);
  }
  if (minRating !== null) {
    // Same for an unrated listing — a new restaurant with no rating yet has
    // not failed the threshold, it has not been measured against it.
    where.push('(e.rating IS NULL OR e.rating >= ?)');
    args.push(minRating);
  }
  const filterSql = where.length ? `(${where.join(' AND ')})` : '1=1';

  const rows = db.prepare(
    `SELECT e.*, (t.place_id IS NOT NULL) AS tracked,
            (NOT (${filterSql})) AS below_filters
       FROM establishments e LEFT JOIN tracked t ON t.place_id = e.place_id
      WHERE ${filterSql} OR t.place_id IS NOT NULL
      ORDER BY e.local_ref`
  ).all(...args, ...args);
  return rows.map(r => shapeEstablishment(db, r));
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  // The CURRENT review count is the newest reading of it, not the column — the
  // column records the last Places fetch, and a sync since then has written a
  // newer observation. Followers already work this way (see listCompetitors);
  // reviews must too, or the Establishments screen and the Competitors table
  // disagree about the same restaurant after a sync.
  const series = seriesFor(db, row.place_id);
  const newestReviews = newestWith(series, 'reviews');
  const newestRating = newestWith(series, 'rating');
  const current = {
    ...row,
    user_ratings_total: newestReviews ? newestReviews.reviews : row.user_ratings_total,
    rating: newestRating ? newestRating.rating : row.rating,
  };
  const avail = availability(current, social);
  row = current;
  return {
    placeId: row.place_id,
    localRef: row.local_ref,
    competitorRef: row.competitor_ref,
    isSample: !!row.is_sample,
    name: row.name,
    category: row.category,
    rating: row.rating,
    userRatingsTotal: row.user_ratings_total,
    businessStatus: row.business_status,
    website: row.website,
    distanceKm: row.distance_km,
    // Null when the volatile content has been purged — that is the retention
    // policy working, and a consumer must be able to see it rather than being
    // handed a stale copy.
    fetchedAt: row.fetched_at,
    tracked: !!row.tracked,
    // True only for a tracked row that the current filters would otherwise
    // exclude. The screen says so rather than quietly showing it.
    belowFilters: !!row.below_filters,
    availability: avail,
    // "Has Business Discovery ever returned content for this establishment."
    // Derived from the observations, NOT stored: `synced` used to live only on
    // the in-memory LISTENING_COMPETITORS record in mock.jsx, so a reload lost
    // it — the same observed-state-only-in-memory class as the two reset traps
    // already closed. A business_discovery reading is the durable evidence
    // that a pull happened, so that is the source.
    synced: hasContent(db, row.place_id),
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

// ---------------------------------------------------------------------------
// Competitors — the tracked set with every change metric already derived.
//
// This is the endpoint the client renders from. It exists so that availability
// tiers, review velocity, follower change and engagement change are computed
// ONCE, here, where they are tested — rather than a second time in the
// browser. The client receives values carrying their explicit state and
// displays them.
//
// Instagram post CONTENT (captions, formats, per-post interactions, themes) is
// deliberately not here: it still lives in the client's LISTENING_COMPETITORS,
// and `competitorRef` is the join. See finding (iii) of this commit's report.
export function listCompetitors(db) {
  return listTracked(db).map(t => {
    const est = getEstablishment(db, t.placeId);
    const series = seriesFor(db, t.placeId);

    // "Current" values are the newest reading that carried them, never a
    // separately stored number — that is what keeps one fact in one place.
    const newestFollowers = newestWith(series, 'followers');
    const newestInter = newestWith(series, 'avgInteractions');
    const followers = newestFollowers ? newestFollowers.followers : null;
    const avgInteractions = newestInter ? newestInter.avgInteractions : null;

    const igReason = est.availability.reasons.find(r => /instagram/i.test(r.text) && !r.ok);

    return {
      placeId: est.placeId,
      competitorRef: est.competitorRef,
      name: est.name,
      dataTier: est.availability.tier,
      googleRating: est.rating,
      googleReviews: est.userRatingsTotal,
      // Present only on the full tier: Business Discovery is what produces
      // them, and it never runs for a ratings-only establishment.
      followers: est.availability.tier === 'full' ? followers : null,
      avgInteractions: est.availability.tier === 'full' ? avgInteractions : null,
      engagementRate: est.availability.tier === 'full' && followers > 0 && avgInteractions !== null
        ? +(avgInteractions / followers).toFixed(4)
        : null,
      velocity: velocityFromSeries(series),
      followerChange: changeFromSeries(series, 'followers'),
      engagementChange: changeFromSeries(series, 'engagement'),
      unreadableReason: est.availability.tier === 'ratings'
        ? (igReason ? igReason.text : 'Instagram cannot be read')
        : null,
      // Full tier but no content pulled yet. The row is real and belongs on
      // the table; its Instagram-derived cells have nothing in them, and they
      // must say that rather than render null as "null" or an engagement rate
      // of 0.0% — a rival nobody has pulled has not been measured at zero.
      synced: est.synced,
    };
  });
}

// When competitor CONTENT was last pulled. Business Discovery rows are written
// only by a sync — the seed writes `places` and `business_profile` readings and
// never a `business_discovery` one — so their newest timestamp is the honest
// answer to "has a sync ever run, and when". A count of runs was what the old
// localStorage blob held, and it recorded that pulls happened without
// recording what any of them returned.
export function lastSyncedAt(db) {
  const row = db.prepare(
    `SELECT MAX(observed_at) AS at FROM observations WHERE source = 'business_discovery'`
  ).get();
  return row && row.at ? row.at : null;
}

// Our own restaurant's derived figures, from the reserved subject. Same code
// path as every rival, so the two sides of a comparison cannot be computed
// differently.
export function selfMetrics(db) {
  const series = seriesFor(db, SELF_SUBJECT);
  return {
    subject: SELF_SUBJECT,
    velocity: velocityFromSeries(series),
    followerChange: changeFromSeries(series, 'followers'),
    engagementChange: changeFromSeries(series, 'engagement'),
  };
}

// Persist a batch of readings. Validated rather than trusted: `source` is
// CHECK-constrained in the schema, and an unknown subject or a non-finite
// measure is rejected here so a bad write cannot poison a derivation later.
export function recordObservations(db, rows) {
  let written = 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r || typeof r.subject !== 'string' || !r.subject) throw new Error('each observation needs a subject');
      if (!r.observedAt || Number.isNaN(Date.parse(r.observedAt))) throw new Error(`bad observedAt for ${r.subject}`);
      for (const k of ['reviewCount', 'followers', 'avgInteractions', 'mediaCount']) {
        if (r[k] !== undefined && r[k] !== null && !Number.isFinite(r[k])) {
          throw new Error(`${k} must be a finite number or absent, got ${JSON.stringify(r[k])} for ${r.subject}`);
        }
      }
      insertObservation(db, { ...r, isSample: r.isSample ?? 1 });
      written++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return written;
}

// ---------------------------------------------------------------------------
// Handle entry.
//
// THE TRAP THIS GUARDS: typing a handle tells you nothing about whether the
// account can be read. Business Discovery reads public Business and Creator
// accounts only, and the only way to find out which one this is, is to attempt
// it. So a hand-entered handle is recorded as `unknown` / `readable NULL` /
// `verified_at NULL`, and availability() already treats `unknown` as not
// readable — an establishment does NOT become "full comparison" because
// somebody typed something.
//
// Normalised to a leading '@' and lower case so the same account entered two
// ways is one account.
export function normaliseHandle(raw) {
  if (typeof raw !== 'string') return null;
  let h = raw.trim();
  if (!h) return null;
  // Accept a pasted profile URL as well as a bare handle.
  const url = /(?:instagram\.com\/)([A-Za-z0-9._]+)/i.exec(h);
  if (url) h = url[1];
  h = h.replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;
  return `@${h}`;
}

export function setInstagramHandle(db, placeId, rawHandle, { source = 'manual' } = {}) {
  const handle = normaliseHandle(rawHandle);
  if (!handle) {
    throw new Error('handle must be 1-30 characters of letters, digits, dots or underscores');
  }
  db.prepare(
    `INSERT INTO establishment_social
       (place_id, platform, handle, account_type, readable, last_post_days_ago,
        verified_at, verification_error, discovered_from)
     VALUES (?, 'instagram', ?, 'unknown', NULL, NULL, NULL, NULL, ?)
     ON CONFLICT (place_id, platform) DO UPDATE SET
       handle = excluded.handle,
       -- Reset the verification state. A corrected handle is a DIFFERENT
       -- account; carrying the old account's readability across would be
       -- asserting a fact about a profile nobody has looked at.
       account_type = 'unknown',
       readable = NULL,
       last_post_days_ago = NULL,
       verified_at = NULL,
       verification_error = NULL,
       discovered_from = excluded.discovered_from`
  ).run(placeId, handle, source);
  return handle;
}

// Removing a handle records that we LOOKED and there is none — `absent`, with
// a `verified_at`. That is deliberately different from having no row at all,
// which means nobody has looked yet (schema.sql, establishment_social).
// Collapsing the two would lose the difference between "this restaurant has no
// Instagram" and "we have not checked", and the tier reasons read differently
// for each.
export function clearInstagramHandle(db, placeId, { at = nowIso() } = {}) {
  db.prepare(
    `INSERT INTO establishment_social
       (place_id, platform, handle, account_type, readable, last_post_days_ago,
        verified_at, verification_error, discovered_from)
     VALUES (?, 'instagram', NULL, 'absent', 0, NULL, ?, NULL, 'manual')
     ON CONFLICT (place_id, platform) DO UPDATE SET
       handle = NULL,
       account_type = 'absent',
       readable = 0,
       last_post_days_ago = NULL,
       verified_at = excluded.verified_at,
       verification_error = NULL,
       discovered_from = 'manual'`
  ).run(placeId, at);
}
