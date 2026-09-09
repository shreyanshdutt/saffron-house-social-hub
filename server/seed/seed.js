// One-shot seed: load the client's current data into the database so the
// server serves exactly what the screen already shows. Nothing here is
// invented — every value comes out of src/mock.jsx via extract-mock.js.
//
// Idempotent: re-running replaces the sample rows and leaves any real rows
// alone, because real rows carry is_sample = 0 and are never touched here.

import { openAndMigrate, nowIso } from '../src/db.js';
import { CHANNEL_BY_CLIENT_ID } from '../src/posts.js';
import { insertObservation } from '../src/observations.js';
import { config, loadDotEnv } from '../src/config.js';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The seed data now lives HERE, not in the client.
//
// It was extracted once from src/mock.jsx at commit 40c9100 — the commit
// immediately before that data was deleted from the client — by the
// throwaway `extract-mock.js`, which has been removed along with the coupling
// it represented. The server no longer reads anything under src/, so
// CLAUDE.md §2's "the server never imports from src/" now holds without an
// exception. Regenerate with: git show 40c9100:src/mock.jsx
const SEED_DATA = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'seed-data.json'), 'utf8')
);

// Seeded establishments have no Places identity — they are invented. Giving
// them a `sample:` prefixed key keeps them in the primary-key namespace
// without ever being mistakable for a real place_id, which is a 27-character
// Google-issued opaque string. See finding (i) in the commit report.
export const samplePlaceId = (localRef) => `sample:${localRef}`;

// mock.jsx models "no Instagram account" as `instagram: null`, and the schema
// models it as an explicit `absent` row. Recording the absence is better than
// recording nothing: "we looked and there is none" and "we have not looked"
// are different states and the tier derivation depends on telling them apart.
function socialRows(est) {
  const rows = [];
  if (est.instagram) {
    rows.push({
      platform: 'instagram',
      handle: est.instagram.handle,
      // The seed knows the account types because they are invented. A real
      // row starts 'unknown' and is resolved by a Business Discovery attempt.
      accountType: est.instagram.accountType,
      readable: ['business', 'creator'].includes(est.instagram.accountType) ? 1 : 0,
      lastPostDaysAgo: est.instagram.lastPostDaysAgo ?? null,
      verifiedAt: nowIso(),
      discoveredFrom: 'seed:mock.jsx',
    });
  } else {
    rows.push({
      platform: 'instagram', handle: null, accountType: 'absent', readable: 0,
      lastPostDaysAgo: null, verifiedAt: nowIso(), discoveredFrom: 'seed:mock.jsx',
    });
  }
  if (est.x) {
    rows.push({
      platform: 'x', handle: est.x.handle, accountType: 'unknown', readable: null,
      lastPostDaysAgo: null, verifiedAt: null, discoveredFrom: 'seed:mock.jsx',
    });
  }
  return rows;
}

export function seed(db, _repoRoot, { trackedBy = 'admin', now = Date.now() } = {}) {
  const ESTABLISHMENTS = SEED_DATA.establishments;
  const OBSERVATION_HISTORY = SEED_DATA.observationHistory;
  const TRACKED_DEFAULT = SEED_DATA.trackedDefault;
  const isSample = SEED_DATA.isSampleData ? 1 : 0;
  const stamp = new Date(now).toISOString();

  const SEED_POSTS = SEED_DATA.posts || [];
  const SEED_SCHEDULED = SEED_DATA.scheduled || [];

  const counts = { establishments: 0, social: 0, connections: 0, tracked: 0, observations: 0, posts: 0, postTargets: 0 };

  db.exec('BEGIN');
  try {
    // Clear only sample rows; real Places rows are never seeded over.
    db.prepare(`DELETE FROM observations WHERE is_sample = 1`).run();
    db.prepare(`DELETE FROM establishments WHERE is_sample = 1`).run();

    const insEst = db.prepare(
      `INSERT INTO establishments
         (place_id, local_ref, competitor_ref, is_sample, first_seen_at, fetched_at, name, category,
          rating, user_ratings_total, business_status, formatted_address, lat, lng, website, distance_km)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insSocial = db.prepare(
      `INSERT INTO establishment_social
         (place_id, platform, handle, account_type, readable, last_post_days_ago,
          verified_at, verification_error, discovered_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    );
    const insTracked = db.prepare(
      `INSERT INTO tracked (place_id, tracked_at, tracked_by) VALUES (?, ?, ?)`
    );

    for (const e of ESTABLISHMENTS) {
      const pid = samplePlaceId(e.id);
      insEst.run(
        pid, e.id, e.competitorId ?? null, isSample, stamp, stamp,
        e.name, e.category,
        e.google ? e.google.rating : null,
        e.google ? e.google.reviews : null,
        e.google ? e.google.status : null,
        null,          // formatted_address — mock.jsx has none
        null, null,    // lat / lng        — mock.jsx has none (see finding i)
        null,          // website          — mock.jsx has none (see finding i)
        // Precomputed in mock.jsx. Carried across so the screen sorts
        // identically; a real scan computes it from lat/lng instead.
        e.distanceKm ?? null
      );
      counts.establishments++;
      for (const s of socialRows(e)) {
        insSocial.run(pid, s.platform, s.handle, s.accountType, s.readable, s.lastPostDaysAgo, s.verifiedAt, s.discoveredFrom);
        counts.social++;
      }
    }

    // OUR OWN channel connections. Every row is_sample = 1: none of these is a
    // real authorisation, and the screen says so in the same amber banner the
    // Establishments and Competitors screens already use for invented data.
    //
    // Three are shown connected and two never connected, which mirrors the
    // product's actual position: Instagram, Google Business Profile and
    // WhatsApp are the channels it was built around, while X and YouTube were
    // added to the model in 1917fc9 / 16cb119 and have no integration at all.
    // That is a truthful shape even though the values are fabricated.
    db.prepare(`DELETE FROM connections WHERE is_sample = 1`).run();
    const insConn = db.prepare(
      `INSERT INTO connections
         (platform, status, account_ref, account_label, connected_at, last_synced_at,
          expires_at, last_error, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const daysFromNow = (d) => new Date(now + d * 86_400_000).toISOString();
    const minsAgo = (m) => new Date(now - m * 60_000).toISOString();
    for (const c of [
      // Expired rather than broken: it WAS connected, the history is ours, and
      // the fix is to sign in again — a different sentence from "set this up".
      ['instagram',       'expired',         '@saffronhouse',                    'Instagram account',
       daysFromNow(-120), minsAgo(48),  daysFromNow(-2),
       'Long-lived token expired. Instagram tokens last 60 days and must be refreshed before then.'],
      ['google_business', 'connected',       'Saffron House · Sector 10 Dwarka', 'Business Profile location',
       daysFromNow(-180), minsAgo(1),   daysFromNow(38),  null],
      ['whatsapp',        'connected',       '+91 11 4160 2200',                 'Business phone number',
       daysFromNow(-95),  minsAgo(6),   null,             null],
      // Never connected: no credential, so no expiry and no account to name.
      ['x',               'never_connected', null, null, null, null, null, null],
      ['youtube',         'never_connected', null, null, null, null, null, null],
    ]) {
      insConn.run(...c);
      counts.connections = (counts.connections || 0) + 1;
    }

    // POSTS AND SCHEDULED, and the metrics trap that decided the schema.
    //
    // Every seeded post carries `metricsFrom: 'ig'` — including p1, p3 and p5,
    // which went to BOTH Instagram and Google. Those figures were never the
    // post's totals; they are Instagram's. So they are written to the
    // INSTAGRAM TARGET and the Google target is left with NULL metrics, which
    // reads as "not measured" rather than as zero reach. Hanging them on the
    // post row would have turned one channel's numbers into every channel's,
    // silently, for three of seven posts.
    //
    // The client's `status` collapses two facts and is unpicked here: it is the
    // post's LIFECYCLE plus its OUTCOME in one word. 'published' and 'failed'
    // both become state 'attempted' with the outcome carried per target.
    db.prepare(`DELETE FROM posts WHERE is_sample = 1`).run();   // targets cascade
    const insPost = db.prepare(
      `INSERT INTO posts (id, state, content, format, author, tags,
                          media_kind, media_label, media_tone,
                          created_at, updated_at, scheduled_at, scheduled_tz, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const insTarget = db.prepare(
      `INSERT INTO post_targets (post_id, platform, status, failure_kind, reason,
                                 attempted_at, published_at,
                                 views, reach, likes, comments, shares, saves, engagement_rate, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );

    for (const post of SEED_POSTS) {
      const state = post.status === 'draft' ? 'draft' : 'attempted';
      insPost.run(
        post.id, state, post.content, post.format ?? null, post.author ?? null,
        JSON.stringify(post.tags || []),
        post.media?.kind ?? null, post.media?.label ?? null, post.media?.tone ?? null,
        post.date, post.date, null, null
      );
      for (const clientId of post.platforms) {
        const platform = CHANNEL_BY_CLIENT_ID[clientId];
        if (!platform) throw new Error(`seed post ${post.id} names unknown channel '${clientId}'`);
        // A draft has been attempted nowhere; its targets are still pending.
        const targetStatus = state === 'draft' ? 'pending'
          : post.status === 'failed' ? 'failed' : 'published';
        // THE TRAP: metrics only on the channel they actually came from.
        const owns = clientId === post.metricsFrom && post.metrics && targetStatus === 'published';
        const m = owns ? post.metrics : null;
        insTarget.run(
          post.id, platform, targetStatus,
          targetStatus === 'failed' ? 'expired' : null,
          targetStatus === 'failed' ? (post.error || null) : null,
          state === 'draft' ? null : post.date,
          targetStatus === 'published' ? post.date : null,
          m ? m.views : null, m ? m.reach : null, m ? m.likes : null,
          m ? m.comments : null, m ? m.shares : null, m ? m.saves : null,
          m ? m.rate : null
        );
        counts.postTargets = (counts.postTargets || 0) + 1;
      }
      counts.posts = (counts.posts || 0) + 1;
    }

    // SCHEDULED rows are the same lifecycle, not a second mechanism — owner
    // decision 2026-09-09. They are posts in state 'scheduled' whose targets
    // are pending, and the Calendar reads them from the same table History does.
    for (const s of SEED_SCHEDULED) {
      insPost.run(
        s.id, 'scheduled', s.content, null, null,
        JSON.stringify(s.tags || []),
        null, null, null,
        s.when, s.when, s.when,
        // The seed's `when` carries +05:30 but not the zone that produced it.
        // The restaurant is in Dwarka, so the zone is recorded rather than left
        // to be re-derived from an offset that cannot identify it (schema.sql).
        'Asia/Kolkata'
      );
      for (const clientId of s.platforms) {
        const platform = CHANNEL_BY_CLIENT_ID[clientId];
        if (!platform) throw new Error(`seed scheduled ${s.id} names unknown channel '${clientId}'`);
        insTarget.run(s.id, platform, 'pending', null, null, null, null,
          null, null, null, null, null, null, null);
        counts.postTargets = (counts.postTargets || 0) + 1;
      }
      counts.posts = (counts.posts || 0) + 1;
    }

    for (const id of TRACKED_DEFAULT) {
      insTracked.run(samplePlaceId(id), stamp, trackedBy);
      counts.tracked++;
    }

    // OBSERVATION_HISTORY is keyed by establishment id, plus the reserved
    // 'saf-self'. Its samples are relative (`daysAgo`) exactly as the client
    // hydrates them, so the 90-day window is preserved on the way in.
    for (const [key, samples] of Object.entries(OBSERVATION_HISTORY)) {
      const subject = key === 'saf-self' ? 'saf-self' : samplePlaceId(key);
      for (const s of samples) {
        insertObservation(db, {
          subject,
          observedAt: new Date(now - s.daysAgo * 86_400_000).toISOString(),
          // Our own readings come from Business Profile, a rival's from
          // Places. §10 forbids conflating the two without labelling which is
          // which, and this is that label.
          source: key === 'saf-self' ? 'business_profile' : 'places',
          reviewCount: s.reviews ?? null,
          followers: s.followers ?? null,
          avgInteractions: s.avgInteractions ?? null,
          isSample: 1,
        });
        counts.observations++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return counts;
}

// CLI entry.
// pathToFileURL, not string concatenation: this repo's path contains a space,
// and `import.meta.url` percent-encodes it while process.argv[1] does not — so
// the naive comparison is false and the script silently does nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadDotEnv();
  const cfg = config();
  const db = openAndMigrate(cfg.databasePath);
  const counts = seed(db, cfg.repoRoot);
  console.log(`seeded into ${cfg.databasePath}`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}
