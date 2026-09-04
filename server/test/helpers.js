import { openAndMigrate } from '../src/db.js';
import { seed } from '../seed/seed.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export function freshDb() { return openAndMigrate(':memory:'); }
export function seededDb(opts) { const db = freshDb(); seed(db, REPO_ROOT, opts); return db; }
