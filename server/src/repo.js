// Queries. Kept apart from the HTTP layer so the tests can exercise them
// without a socket.

import { availability } from './availability.js';
import { channelCapabilities } from './channels.js';
import { seriesFor, insertObservation, SELF_SUBJECT } from './observations.js';
import { velocityFromSeries, changeFromSeries, newestWith } from './derive.js';
import { nowIso } from './db.js';
import { summarisePost, normaliseChannel, PUBLISHABLE_CHANNELS, CLIENT_ID_BY_CHANNEL } from './posts.js';
import { publishPlan, callAdapter } from './publish-adapters.js';
import { buildDishIndex, findDishMentions } from './dish-matcher.js';
import { summariseSegment, customersForDish, toCustomer } from './customers.js';

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
    // Per-channel capability, BESIDE the tier rather than feeding it. The tier
    // above keeps its exact meaning (Instagram readability + a Google
    // listing); this answers the finer question "what can we know about them
    // on each channel, and if not, whose limitation is it" — see channels.js.
    channels: channelCapabilities(current, social),
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
    posts: count('posts'),
    postTargets: count('post_targets'),
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

    // Social identity comes from `establishment_social`, which is the table
    // that holds it — NOT from a join through `competitorRef`. That ref is a
    // seed-era link to the client's post-content records, and an establishment
    // without one (est-15 is the live case) then arrived with no handle at
    // all, which the row turned into the positive claim "No Instagram
    // account" about a business account the database was holding at the time.
    // A fact the database has must not be gated on a link that predates it.
    const ig = est.social.find(x => x.platform === 'instagram') || null;

    const igReason = est.availability.reasons.find(r => /instagram/i.test(r.text) && !r.ok);
    // A `none`-tier establishment has no Google listing, so Places gives us no
    // way in at all — a different absence from "Instagram cannot be read", and
    // it needs its own sentence. Sourced from availability() rather than
    // written fresh here, so the row and the Establishments screen cannot
    // explain the same fact two different ways.
    const googleReason = est.availability.reasons.find(r => /google/i.test(r.text) && !r.ok);

    return {
      placeId: est.placeId,
      competitorRef: est.competitorRef,
      name: est.name,
      dataTier: est.availability.tier,
      googleRating: est.rating,
      googleReviews: est.userRatingsTotal,
      // The handle, and enough state for the client to tell three different
      // things apart without inferring:
      //   handle set                     — we hold an account
      //   accountType 'absent'           — we looked and there is none
      //   accountType 'unknown' / no row — nobody has checked yet
      // Collapsing the last two into one message is the defect this fixes, so
      // the state travels rather than being guessed from a falsy handle.
      handle: ig ? ig.handle : null,
      handlePlatform: ig ? ig.platform : null,
      handleAccountType: ig ? ig.accountType : null,
      handleVerifiedAt: ig ? ig.verifiedAt : null,
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
      // Why this row cannot be fully compared, in the tier's own terms. Set
      // for BOTH constrained tiers: `ratings` is missing Instagram, `none` is
      // missing the Google listing itself. Leaving `none` null meant the cell
      // had nothing to say even once it stopped crashing.
      unreadableReason: est.availability.tier === 'ratings'
        ? (igReason ? igReason.text : 'Instagram cannot be read')
        : est.availability.tier === 'none'
          ? (googleReason ? googleReason.text : 'No Google listing for this establishment')
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

// ---------------------------------------------------------------------------
// Our own channel connections.
//
// The Settings > Accounts tab used to hardcode three of these with a follower
// count and a "Token expired" pill, none of which corresponded to anything.
// This serves the real row, including the states that were previously
// indistinguishable: a channel nobody has ever connected is NOT the same as
// one whose credential lapsed, and the screen needs different words for each.
export function listConnections(db) {
  return db.prepare(
    `SELECT platform, status, account_ref, account_label, connected_at,
            last_synced_at, expires_at, last_error, is_sample
       FROM connections ORDER BY platform`
  ).all().map(r => ({
    platform: r.platform,
    status: r.status,
    accountRef: r.account_ref,
    accountLabel: r.account_label,
    connectedAt: r.connected_at,
    lastSyncedAt: r.last_synced_at,
    expiresAt: r.expires_at,
    lastError: r.last_error,
    isSample: !!r.is_sample,
  }));
}

// ---------------------------------------------------------------------------
// posts
//
// Reads return the post WITH its targets and a derived summary. The summary is
// computed by summarisePost() and never stored — see src/posts.js for why.

const targetRow = (r) => ({
  platform: r.platform,
  clientId: CLIENT_ID_BY_CHANNEL[r.platform] || null,
  status: r.status,
  failureKind: r.failure_kind,
  reason: r.reason,
  externalId: r.external_id,
  attemptedAt: r.attempted_at,
  publishedAt: r.published_at,
  // NULL means NOT MEASURED, and it stays null rather than becoming 0. A post
  // nobody has pulled figures for has not got zero reach (CLAUDE.md §11 trap 1).
  metrics: (r.views == null && r.reach == null && r.likes == null)
    ? null
    : { views: r.views, reach: r.reach, likes: r.likes, comments: r.comments,
        shares: r.shares, saves: r.saves, rate: r.engagement_rate },
  isSample: !!r.is_sample,
});

function hydratePost(db, row) {
  const targets = db.prepare(
    `SELECT * FROM post_targets WHERE post_id = ? ORDER BY platform`
  ).all(row.id).map(targetRow);
  const post = {
    id: row.id,
    state: row.state,
    content: row.content,
    format: row.format,
    author: row.author,
    tags: JSON.parse(row.tags || '[]'),
    media: row.media_kind ? { kind: row.media_kind, label: row.media_label, tone: row.media_tone } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scheduledAt: row.scheduled_at,
    scheduledTz: row.scheduled_tz,
    isSample: !!row.is_sample,
    targets,
  };
  return { ...post, summary: summarisePost(post, targets) };
}

export function listPosts(db, { state } = {}) {
  const rows = state
    ? db.prepare(`SELECT * FROM posts WHERE state = ? ORDER BY COALESCE(scheduled_at, created_at) DESC`).all(state)
    : db.prepare(`SELECT * FROM posts ORDER BY COALESCE(scheduled_at, created_at) DESC`).all();
  return rows.map(r => hydratePost(db, r));
}

export function getPost(db, id) {
  const row = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
  return row ? hydratePost(db, row) : null;
}

let postSeq = 0;
const newPostId = (now) => `post-${now}-${(++postSeq).toString(36)}`;

// Create a draft or a scheduled post. A `scheduledAt` makes it scheduled; its
// absence makes it a draft. There is no third way to say the same thing.
export function createPost(db, input, now = new Date().toISOString()) {
  const channels = (input.platforms || []).map(normaliseChannel);
  if (!channels.length) throw new Error('at least one channel is required');
  if (channels.some(c => c === null)) {
    throw new Error(`unknown channel in platforms; allowed: ${PUBLISHABLE_CHANNELS.join(', ')}`);
  }
  if (!input.content || !String(input.content).trim()) throw new Error('content is required');
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) {
    throw new Error('scheduledAt must be an ISO 8601 instant');
  }

  const id = input.id || newPostId(Date.parse(now) || Date.now());
  const state = input.scheduledAt ? 'scheduled' : 'draft';

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO posts (id, state, content, format, author, tags,
                          media_kind, media_label, media_tone,
                          created_at, updated_at, scheduled_at, scheduled_tz, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, state, String(input.content), input.format ?? null, input.author ?? null,
      JSON.stringify(input.tags || []),
      input.media?.kind ?? null, input.media?.label ?? null, input.media?.tone ?? null,
      now, now, input.scheduledAt ?? null, input.scheduledTz ?? null,
      input.isSample ? 1 : 0
    );
    const insT = db.prepare(
      `INSERT INTO post_targets (post_id, platform, status, is_sample) VALUES (?, ?, 'pending', ?)`
    );
    for (const platform of [...new Set(channels)]) insT.run(id, platform, input.isSample ? 1 : 0);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return getPost(db, id);
}

// Only work that has not been attempted can be deleted. An attempted post is
// history — including its failures — and deleting it would erase the record of
// something that really happened to a real channel.
export function deletePost(db, id) {
  const row = db.prepare(`SELECT state FROM posts WHERE id = ?`).get(id);
  if (!row) return { deleted: false, reason: 'no such post' };
  if (row.state === 'attempted' || row.state === 'sending') {
    return { deleted: false, reason: `a ${row.state} post is a record of an attempt and is not deletable` };
  }
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
  return { deleted: true };
}

// THE PUBLISH ATTEMPT.
//
// It RECORDS rather than refuses. Owner decision 2026-09-09: pressing Publish
// with nothing connected writes the attempt and marks each target failed with
// the reason — it does not bail out before writing. A refusal leaves no trace,
// and "I pressed it and nothing happened" is exactly the class of silence this
// codebase has spent seven commits removing.
//
// The connection is read PER TARGET, and the four connection states produce
// four different outcomes, because they are four different problems.
export async function publishPost(db, id, now = new Date().toISOString()) {
  const existing = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
  if (!existing) return null;

  const targets = db.prepare(`SELECT platform FROM post_targets WHERE post_id = ? ORDER BY platform`).all(id);
  const conns = Object.fromEntries(
    db.prepare(`SELECT platform, status, last_error FROM connections`).all().map(c => [c.platform, c])
  );

  // Decide, for every target, whether an adapter would be reached — BEFORE
  // anything runs, so the cost report describes the run that is about to
  // happen rather than the one that did.
  const decisions = targets.map(t => {
    const conn = conns[t.platform];
    if (!conn || conn.status === 'never_connected') {
      return { platform: t.platform, call: false, failureKind: 'never_connected',
        reason: `${t.platform} has never been connected. Nobody has authorised this channel, so there is no account to post to. This needs setting up, not signing in again.` };
    }
    if (conn.status === 'expired') {
      return { platform: t.platform, call: false, failureKind: 'expired',
        reason: `The ${t.platform} sign-in has expired. The account is still known and its history is still ours — the credential needs replacing. ${conn.last_error || ''}`.trim() };
    }
    if (conn.status === 'revoked') {
      return { platform: t.platform, call: false, failureKind: 'revoked',
        reason: `Access to ${t.platform} was withdrawn at the provider end. Reconnecting may not be ours to do — someone with access to that account has to grant it again.` };
    }
    return { platform: t.platform, call: true };
  });

  const plan = publishPlan(decisions.filter(d => d.call).map(d => d.platform));

  db.prepare(`UPDATE posts SET state = 'sending', updated_at = ? WHERE id = ?`).run(now, id);

  const upd = db.prepare(
    `UPDATE post_targets
        SET status = ?, failure_kind = ?, reason = ?, external_id = ?,
            attempted_at = ?, published_at = ?
      WHERE post_id = ? AND platform = ?`
  );

  for (const d of decisions) {
    if (!d.call) {
      upd.run('failed', d.failureKind, d.reason, null, now, null, id, d.platform);
      continue;
    }
    const result = await callAdapter(d.platform, existing);
    if (result.ok) {
      upd.run('published', null, null, result.externalId ?? null, now, now, id, d.platform);
    } else {
      upd.run('failed', result.failureKind, result.reason, null, now, null, id, d.platform);
    }
  }

  // 'attempted', never 'published'. Whether it worked is a per-target fact and
  // the summary derives it; the row itself only records that it was tried.
  db.prepare(`UPDATE posts SET state = 'attempted', updated_at = ? WHERE id = ?`).run(now, id);

  return { post: getPost(db, id), plan };
}

// ---------------------------------------------------------------------------
// menu
//
// No HTTP route this commit: nothing renders the menu yet, and part 2 owns
// both the corpus move and the screen. An endpoint with no caller is the
// dead-export class the drift register has three entries about.

export function listMenuItems(db) {
  const items = db.prepare(
    `SELECT id, name, category, price, is_sample FROM menu_items ORDER BY name`
  ).all();
  const aliases = db.prepare(
    `SELECT alias, menu_item_id, word_count FROM menu_item_aliases ORDER BY alias`
  ).all();
  const byItem = new Map();
  for (const a of aliases) {
    if (!byItem.has(a.menu_item_id)) byItem.set(a.menu_item_id, []);
    byItem.get(a.menu_item_id).push(a.alias);
  }
  return items.map(r => ({
    id: r.id, name: r.name, category: r.category, price: r.price,
    aliases: byItem.get(r.id) || [],
    isSample: !!r.is_sample,
  }));
}

// The matcher's index, built from what is actually stored. Going through
// buildDishIndex() rather than trusting the table means the ambiguity check
// runs on every load, so a row inserted by some future path that bypassed the
// PRIMARY KEY still cannot produce a silently wrong attribution.
export function dishIndex(db) {
  const rows = db.prepare(`SELECT alias, menu_item_id FROM menu_item_aliases`).all();
  return buildDishIndex(rows.map(r => ({ alias: r.alias, menuItemId: r.menu_item_id })));
}

// Every guest fragment, as evidence-bearing source text.
export function listGuestTexts(db) {
  return db.prepare(
    `SELECT id, kind, body, author, channel, said_at, source_kind, source_id
       FROM guest_texts ORDER BY said_at DESC, id`
  ).all().map(r => ({
    id: r.id, kind: r.kind, body: r.body, author: r.author, channel: r.channel,
    saidAt: r.said_at, sourceKind: r.source_kind, sourceId: r.source_id,
  }));
}

// THE ANSWER THE MENU SCREEN ASKS FOR: every dish, how many times a guest
// named it, and the sentences they named it in.
//
// The count is derived HERE, from the stored corpus, every time it is asked
// for — it is not a column. A stored count would immediately begin disagreeing
// with the text it came from, which is exactly the failure `mentions7d: 412`
// represents: a number with no way back to its evidence.
//
// A dish with no mentions comes back with `count: 0` and an EMPTY evidence
// array, and that is a real answer about the corpus, not a missing one. The
// screen says so in words.
export function menuWithMentions(db) {
  const items = listMenuItems(db);
  const index = dishIndex(db);
  const corpus = listGuestTexts(db);

  const byItem = new Map(items.map(i => [i.id, []]));
  for (const frag of corpus) {
    const source = {
      id: frag.id, kind: frag.kind, author: frag.author,
      channel: frag.channel, saidAt: frag.saidAt,
      sourceKind: frag.sourceKind, sourceId: frag.sourceId,
    };
    for (const m of findDishMentions(frag.body, index, source)) {
      if (byItem.has(m.menuItemId)) byItem.get(m.menuItemId).push(m);
    }
  }

  return {
    corpus: {
      fragments: corpus.length,
      characters: corpus.reduce((n, f) => n + f.body.length, 0),
      // Stated so a screen can explain why the numbers are small without
      // anyone having to guess at the denominator.
      kinds: corpus.reduce((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {}),
    },
    items: items.map(item => {
      const mentions = byItem.get(item.id) || [];
      return {
        ...item,
        mentionCount: mentions.length,
        mentions: mentions.map(m => ({
          matchedText: m.matchedText,
          alias: m.alias,
          quote: m.quote,
          start: m.start,
          end: m.end,
          source: m.source,
        })),
      };
    }).sort((a, b) => b.mentionCount - a.mentionCount || a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// customers
//
// SEGMENT NUMBERS ARE COMPUTED HERE AND SENT AS THREE FIELDS. The client is
// never handed a list to count: a client that counts is a second
// implementation of CONVENTIONS.md §11 decision 3, and the two will drift the
// first time one of them is edited alone. `summariseSegment()` is the only
// thing that produces these numbers, and it cannot produce a lone total.

export function listCustomers(db) {
  const rows = db.prepare(
    `SELECT id, source, contact_ref, display_label, created_at, is_sample
       FROM customers ORDER BY display_label`
  ).all().map(toCustomer);

  const tags = db.prepare(
    `SELECT t.customer_id, t.menu_item_id, t.tagged_by, t.tagged_at, m.name
       FROM customer_tags t
       JOIN menu_items m ON m.id = t.menu_item_id
      ORDER BY t.tagged_at DESC`
  ).all();

  const byCustomer = new Map();
  for (const t of tags) {
    if (!byCustomer.has(t.customer_id)) byCustomer.set(t.customer_id, []);
    byCustomer.get(t.customer_id).push({
      menuItemId: t.menu_item_id,
      name: t.name,
      // The provenance travels all the way out. A tag without its author is
      // indistinguishable from something the system derived (§11).
      taggedBy: t.tagged_by,
      taggedAt: t.tagged_at,
    });
  }
  return rows.map(c => ({ ...c, tags: byCustomer.get(c.id) || [] }));
}

// One entry per dish that has at least one tag. A dish nobody is tagged with
// is not a segment of zero — it is not a segment, and offering it as one would
// invite a cost line for an audience that does not exist.
export function customerSegments(db) {
  const dishes = db.prepare(
    `SELECT DISTINCT t.menu_item_id, m.name
       FROM customer_tags t
       JOIN menu_items m ON m.id = t.menu_item_id
      ORDER BY m.name`
  ).all();

  return dishes.map(d => ({
    menuItemId: d.menu_item_id,
    name: d.name,
    ...summariseSegment(customersForDish(db, d.menu_item_id)),
  }));
}

// A hand-entered customer. STAFF ONLY — there is no path here that creates an
// imported row, because creating one means holding a provider-issued reference
// and that is gated (§11) behind knowing the provider.
export function createStaffCustomer(db, displayLabel, now = new Date().toISOString()) {
  const label = typeof displayLabel === 'string' ? displayLabel.trim() : '';
  if (!label) throw new Error('display_label is required');
  if (label.length > 120) throw new Error('display_label is too long (120 characters maximum)');
  const id = `cu-staff-${Date.parse(now) || Date.now()}-${Math.abs(hashLabel(label)).toString(36)}`;
  db.prepare(
    `INSERT INTO customers (id, source, contact_ref, display_label, created_at, is_sample)
     VALUES (?, 'staff', NULL, ?, ?, 0)`
  ).run(id, label, now);
  return getCustomer(db, id);
}

// Deterministic, tiny, and only used to keep generated ids apart. Not a
// security primitive and not applied to anything personal.
function hashLabel(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function getCustomer(db, id) {
  const row = db.prepare(
    `SELECT id, source, contact_ref, display_label, created_at, is_sample FROM customers WHERE id = ?`
  ).get(id);
  if (!row) return null;
  const c = toCustomer(row);
  c.tags = db.prepare(
    `SELECT t.menu_item_id, t.tagged_by, t.tagged_at, m.name
       FROM customer_tags t JOIN menu_items m ON m.id = t.menu_item_id
      WHERE t.customer_id = ? ORDER BY t.tagged_at DESC`
  ).all(id).map(t => ({ menuItemId: t.menu_item_id, name: t.name, taggedBy: t.tagged_by, taggedAt: t.tagged_at }));
  return c;
}

// `taggedBy` is REQUIRED and has no default. A judgement with no author
// recorded is indistinguishable from a derived fact, so the absence is an
// error rather than something to fill in with 'system' or the empty string.
export function tagCustomer(db, customerId, menuItemId, taggedBy, now = new Date().toISOString()) {
  const by = typeof taggedBy === 'string' ? taggedBy.trim() : '';
  if (!by) throw new Error('tagged_by is required — a tag is somebody\'s judgement and is recorded as theirs');
  db.prepare(
    `INSERT INTO customer_tags (customer_id, menu_item_id, tagged_by, tagged_at, is_sample)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT (customer_id, menu_item_id) DO UPDATE SET tagged_by = excluded.tagged_by, tagged_at = excluded.tagged_at`
  ).run(customerId, menuItemId, by, now);
  return getCustomer(db, customerId);
}

// A mis-tag has to be removable. This removes a TAG and never a customer —
// there is deliberately no route that deletes a person.
export function untagCustomer(db, customerId, menuItemId) {
  const out = db.prepare(
    `DELETE FROM customer_tags WHERE customer_id = ? AND menu_item_id = ?`
  ).run(customerId, menuItemId);
  return Number(out.changes) > 0;
}
