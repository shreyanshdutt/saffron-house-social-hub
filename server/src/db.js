// The ONLY module that talks to the driver. Everything else takes a `db`.
//
// Driver choice: `node:sqlite`, built into Node 22.5+. Justification —
//   · zero dependencies, so no supply chain and no lockfile to audit for a
//     service whose whole job is to hold other people's credentials;
//   · no native build, so no node-gyp/prebuild step on deploy (better-sqlite3
//     is faster and stable, but it compiles, and a compile step on a box that
//     holds tokens is a liability the performance does not buy back here);
//   · the surface used is prepare/run/all/get/exec — the intersection with
//     better-sqlite3, so swapping is this file and nothing else.
// Cost, stated plainly: it is EXPERIMENTAL in Node 22 and prints a warning on
// import; the API may change. That is why it is quarantined here.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SERVER_ROOT } from './config.js';

export function openDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function migrate(db) {
  db.exec(readFileSync(join(SERVER_ROOT, 'src', 'schema.sql'), 'utf8'));
  return db;
}

// SQLite cannot ALTER a CHECK constraint, and `CREATE TABLE IF NOT EXISTS` is
// a NO-OP against a table that already exists — so a database created before a
// CHECK changed keeps the OLD constraint silently, and the only symptom is an
// insert being rejected at runtime for a value the schema file plainly allows.
// That is precisely the silent failure this repo keeps paying for.
//
// There is no migration framework (server/README.md § Known gaps) and this
// commit does not add one: the database holds fabricated sample rows only, so
// the remedy is to delete it and re-seed, which costs nothing. What is NOT
// acceptable is finding that out from a confusing runtime error, so the
// mismatch is detected at boot and named.
const REQUIRED_CHECK_VALUES = [
  { table: 'establishment_social', column: 'platform', values: ['youtube'] },
  { table: 'observations', column: 'source', values: ['youtube_data', 'x_api'] },
  // `connections` is newer than some databases. A missing TABLE is caught by
  // the separate check below; this catches a table that exists but predates a
  // status value.
  { table: 'connections', column: 'status', values: ['never_connected', 'revoked'] },
  // `posts` / `post_targets` arrived with the publish path. A database made
  // before it has neither table; a database made during it could have an
  // earlier CHECK. Both are caught — the table check below, and these values.
  { table: 'posts', column: 'state', values: ['draft', 'scheduled', 'sending', 'attempted'] },
  { table: 'post_targets', column: 'status', values: ['pending', 'published', 'failed', 'skipped'] },
  { table: 'post_targets', column: 'failure_kind', values: ['never_connected', 'expired', 'revoked', 'not_implemented'] },
];

// Tables added after a database may already have been created. CREATE TABLE IF
// NOT EXISTS does create these, so this is belt-and-braces — but a table that
// silently does not exist is the same failure mode as a stale CHECK, and the
// endpoint reading it would return an empty list rather than an error.
const REQUIRED_TABLES = ['establishments', 'establishment_social', 'tracked', 'observations', 'connections', 'scans', 'posts', 'post_targets', 'menu_items', 'menu_item_aliases'];

export function assertSchemaCurrent(db) {
  const stale = [];
  for (const t of REQUIRED_TABLES) {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t);
    if (!row) stale.push(`table ${t} does not exist`);
  }
  for (const req of REQUIRED_CHECK_VALUES) {
    const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(req.table);
    if (!row || !row.sql) continue;                 // table not created yet — migrate() will make it
    for (const v of req.values) {
      if (!row.sql.includes(`'${v}'`)) stale.push(`${req.table}.${req.column} does not allow '${v}'`);
    }
  }
  if (stale.length) {
    throw new Error(
      `This database predates the current schema:\n  - ${stale.join('\n  - ')}\n` +
      `SQLite cannot alter a CHECK constraint in place and there is no migration framework. ` +
      `The database holds only fabricated sample rows, so delete it and re-seed:\n` +
      `  rm -f server/data/saffron.sqlite* && npm run seed`
    );
  }
}

export function openAndMigrate(path) {
  const db = migrate(openDb(path));
  assertSchemaCurrent(db);
  return db;
}

export const nowIso = () => new Date().toISOString();
export const isoDaysAgo = (days, from = Date.now()) =>
  new Date(from - days * 86_400_000).toISOString();
