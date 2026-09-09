import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, freshDb } from './helpers.js';
import * as repo from '../src/repo.js';
import { assertSchemaCurrent, openDb, migrate } from '../src/db.js';

const CHANNELS = ['google_business', 'instagram', 'whatsapp', 'x', 'youtube'];

test('all five channels we connect to are present, in a stable order', () => {
  const rows = repo.listConnections(seededDb());
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.platform), CHANNELS);
});

test('every seeded connection is flagged as sample data', () => {
  assert.equal(repo.listConnections(seededDb()).every(r => r.isSample), true,
    'none of these is a real authorisation and the screen must be able to say so');
});

// The distinction this whole table exists for.
test('NEVER CONNECTED and EXPIRED are different states, not one "not working"', () => {
  const by = Object.fromEntries(repo.listConnections(seededDb()).map(r => [r.platform, r]));

  // Was connected; the credential lapsed. History and account are still ours.
  assert.equal(by.instagram.status, 'expired');
  assert.ok(by.instagram.accountRef, 'an expired connection still knows its account');
  assert.ok(by.instagram.connectedAt, 'and still knows when it was connected');
  assert.ok(by.instagram.expiresAt, 'and has an expiry, because a credential existed');
  assert.match(by.instagram.lastError, /token expired/i);

  // Nobody ever authorised it. There is no credential to have expired.
  assert.equal(by.x.status, 'never_connected');
  assert.equal(by.x.accountRef, null, 'no account to name');
  assert.equal(by.x.connectedAt, null);
  assert.equal(by.x.expiresAt, null, 'no credential means no expiry — not an expiry of null meaning zero');
  assert.equal(by.x.lastError, null, 'nothing has failed; nothing has been attempted');

  assert.notEqual(by.instagram.status, by.x.status);
});

test('X and YouTube are not connected; the other three are seeded as working', () => {
  const by = Object.fromEntries(repo.listConnections(seededDb()).map(r => [r.platform, r]));
  assert.equal(by.x.status, 'never_connected');
  assert.equal(by.youtube.status, 'never_connected');
  assert.equal(by.google_business.status, 'connected');
  assert.equal(by.whatsapp.status, 'connected');
  assert.ok(by.google_business.accountRef && by.whatsapp.accountRef);
});

test('a connected channel carries a sync time; a never-connected one cannot', () => {
  const by = Object.fromEntries(repo.listConnections(seededDb()).map(r => [r.platform, r]));
  assert.ok(by.google_business.lastSyncedAt, 'connected and has run');
  assert.equal(by.youtube.lastSyncedAt, null, 'never connected, so never synced');
});

// The vocabulary trap: this CHECK is not establishment_social's.
test('the connections CHECK covers OUR channels, not the competitor set', () => {
  const db = seededDb();
  const ins = (platform) => db.prepare(
    `INSERT INTO connections (platform, status, is_sample) VALUES (?, 'never_connected', 1)`
  ).run(platform);
  // 'facebook' is valid on establishment_social and must NOT be valid here.
  assert.throws(() => ins('facebook'), /CHECK|constraint/i,
    'facebook describes competitors, not a channel we connect to');
  assert.throws(() => ins('tiktok'), /CHECK|constraint/i);
  // and the two we connect to that competitors never carry ARE valid here
  db.prepare(`DELETE FROM connections WHERE platform IN ('google_business','whatsapp')`).run();
  assert.doesNotThrow(() => ins('google_business'));
  assert.doesNotThrow(() => ins('whatsapp'));
});

test('an unknown status is rejected', () => {
  const db = seededDb();
  assert.throws(() => db.prepare(
    `INSERT INTO connections (platform, status, is_sample) VALUES ('x', 'probably_fine', 1)`
  ).run(), /CHECK|constraint/i);
});

test('one row per channel — the platform is the primary key', () => {
  const db = seededDb();
  assert.throws(() => db.prepare(
    `INSERT INTO connections (platform, status, is_sample) VALUES ('instagram', 'connected', 1)`
  ).run(), /UNIQUE|constraint/i);
});

test('assertSchemaCurrent catches a database with no connections table', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE connections');
  assert.throws(() => assertSchemaCurrent(db), /table connections does not exist/);
});

test('re-seeding does not duplicate connections', async () => {
  const { seed } = await import('../seed/seed.js');
  const { REPO_ROOT } = await import('./helpers.js');
  const db = seededDb();
  seed(db, REPO_ROOT);
  assert.equal(repo.listConnections(db).length, 5);
});

test('GET /connections serves the rows', async () => {
  const { createServer } = await import('../src/http.js');
  const server = createServer(seededDb());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/connections`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.connections.length, 5);
    assert.deepEqual(body.connections.map(c => c.platform), CHANNELS);
    assert.equal(body.connections.every(c => c.isSample), true);
  } finally { server.close(); }
});
