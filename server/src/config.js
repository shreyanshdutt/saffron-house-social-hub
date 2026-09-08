// Configuration. Every value comes from the environment or a documented
// default; no credential appears in this file or any other committed file
// (CONVENTIONS.md §10, CLAUDE.md §2).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = join(here, '..');
export const REPO_ROOT = join(SERVER_ROOT, '..');

// A three-line .env reader, so that `node src/index.js` works without a
// dotenv dependency. Real values only ever live in server/.env, which is
// gitignored; server/.env.example carries the keys with no values.
export function loadDotEnv(path = join(SERVER_ROOT, '.env')) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of raw.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (value) out[m[1]] = value;
  }
  Object.assign(process.env, { ...out, ...process.env }); // real env wins
  return out;
}

// ---------------------------------------------------------------------------
// RETENTION — the single constant that governs how long non-`place_id` Google
// Places content may be kept. Do not inline this number at a call site.
//
// Google Maps Platform Service Specific Terms §14.3, quoted:
//
//   "Customer will not cache Google Maps Content except as expressly
//    permitted under this Section. Customer can temporarily cache latitude
//    (Lat) and longitude (Lng) values ... for up to 30 consecutive calendar
//    days, after which Customer must delete the cached Lat/Lng values."
//
// §A.3 separately permits caching `place_id` indefinitely, which is why
// `place_id` is the one permanent column in `establishments` and everything
// else in that table is volatile and stamped with `fetched_at`.
//
// RULED 2026-09-08 (CONVENTIONS.md §10, "Ruling (owner, 2026-09-08)").
// Whether the competitor review-count history from 3eb4344 may outlive this
// window was an open question; it is now answered, and `observations` remain
// on a SEPARATE switch below so the two policies stay independently legible.
// ---------------------------------------------------------------------------
export const PLACES_RETENTION_DAYS_MAX = 30;   // the §14.3 ceiling. Not ours to raise.
export const PLACES_RETENTION_DAYS_DEFAULT = 30;

// When true, `observations` rows sourced from Places are purged on the same
// window as establishment content.
//
// TRUE since the owner's ruling of 2026-09-08. The reasoning, in one line: a
// snapshot held for 30 days and a 90-day archive kept in order to derive a
// RATE are different asks, and only the first survives a clause that grants
// these columns no window at all. Keeping the archive would have meant
// claiming a permission §14.3 does not give, in service of a number we can
// still produce without it.
//
// What this costs is smaller than it first sounds and is worth stating where
// someone will read it: competitor review velocity is NOT removed.
// `changeFromSeries()` needs two readings seven or more days apart, and a
// 30-day window always holds several — so velocity survives with its lookback
// capped at 30 days instead of growing without bound. It becomes noisier and
// slower to settle; it does not become `none`. Our own velocity reads
// `saf-self`, which is Business Profile rather than Places, and is untouched.
// `test/retention.test.js` pins both halves of that claim.
export const PURGE_PLACES_OBSERVATIONS = true;

export function retentionDays(env = process.env) {
  const raw = env.PLACES_RETENTION_DAYS;
  if (raw === undefined || raw === '') return PLACES_RETENTION_DAYS_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`PLACES_RETENTION_DAYS must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  if (n > PLACES_RETENTION_DAYS_MAX) {
    // Refusing at boot rather than at purge time: a service that has already
    // over-retained cannot un-retain, so the check belongs before any write.
    throw new Error(
      `PLACES_RETENTION_DAYS=${n} exceeds the ${PLACES_RETENTION_DAYS_MAX}-day ceiling in Google Maps Platform ` +
      `Service Specific Terms §14.3. Lower it, or take the question to the owner — it is not an engineering call.`
    );
  }
  return n;
}

export function config(env = process.env) {
  return {
    port: Number(env.PORT || 8787),
    databasePath: env.DATABASE_PATH || join(SERVER_ROOT, 'data', 'saffron.sqlite'),
    retentionDays: retentionDays(env),
    repoRoot: REPO_ROOT,
  };
}
