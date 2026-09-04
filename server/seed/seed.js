// One-shot seed: load the client's current data into the database so the
// server serves exactly what the screen already shows. Nothing here is
// invented — every value comes out of src/mock.jsx via extract-mock.js.
//
// Idempotent: re-running replaces the sample rows and leaves any real rows
// alone, because real rows carry is_sample = 0 and are never touched here.

import { openAndMigrate, nowIso } from '../src/db.js';
import { insertObservation } from '../src/observations.js';
import { config, loadDotEnv } from '../src/config.js';
import { extractMock } from './extract-mock.js';
import { pathToFileURL } from 'node:url';

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

export function seed(db, repoRoot, { trackedBy = 'admin', now = Date.now() } = {}) {
  const { ESTABLISHMENTS, OBSERVATION_HISTORY, TRACKED_DEFAULT, COMPETITOR_CATCHMENT } = extractMock(repoRoot);
  const isSample = COMPETITOR_CATCHMENT.isSampleData ? 1 : 0;
  const stamp = new Date(now).toISOString();

  const counts = { establishments: 0, social: 0, tracked: 0, observations: 0 };

  db.exec('BEGIN');
  try {
    // Clear only sample rows; real Places rows are never seeded over.
    db.prepare(`DELETE FROM observations WHERE is_sample = 1`).run();
    db.prepare(`DELETE FROM establishments WHERE is_sample = 1`).run();

    const insEst = db.prepare(
      `INSERT INTO establishments
         (place_id, local_ref, is_sample, first_seen_at, fetched_at, name, category,
          rating, user_ratings_total, business_status, formatted_address, lat, lng, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        pid, e.id, isSample, stamp, stamp,
        e.name, e.category,
        e.google ? e.google.rating : null,
        e.google ? e.google.reviews : null,
        e.google ? e.google.status : null,
        null,          // formatted_address — mock.jsx has none
        null, null,    // lat / lng        — mock.jsx has none (see finding i)
        null           // website          — mock.jsx has none (see finding i)
      );
      counts.establishments++;
      for (const s of socialRows(e)) {
        insSocial.run(pid, s.platform, s.handle, s.accountType, s.readable, s.lastPostDaysAgo, s.verifiedAt, s.discoveredFrom);
        counts.social++;
      }
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
