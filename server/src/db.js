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

export function openAndMigrate(path) {
  return migrate(openDb(path));
}

export const nowIso = () => new Date().toISOString();
export const isoDaysAgo = (days, from = Date.now()) =>
  new Date(from - days * 86_400_000).toISOString();
