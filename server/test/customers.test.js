import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, freshDb } from './helpers.js';
import { assertSchemaCurrent, openDb, migrate } from '../src/db.js';
import { isReachable, summariseSegment, customersForDish, toCustomer } from '../src/customers.js';
import { importContacts, IMPORT_BLOCKED_REASON } from '../src/contact-import.js';

const NOW = '2026-09-09T12:00:00.000Z';
const addCustomer = (db, { id, source, contactRef = null, label = 'Someone' }) =>
  db.prepare(`INSERT INTO customers (id, source, contact_ref, display_label, created_at, is_sample)
              VALUES (?, ?, ?, ?, ?, 1)`).run(id, source, contactRef, label, NOW);

// --- the schema refuses the contradictions -----------------------------------

test('an IMPORTED row with no contact reference is refused by the database', () => {
  const db = freshDb();
  assert.throws(
    () => addCustomer(db, { id: 'x1', source: 'imported', contactRef: null }),
    /CHECK|constraint/i,
    'an imported row without a reference would claim to be reachable while having nothing to reach',
  );
});

test('a STAFF row carrying a contact reference is refused by the database', () => {
  const db = freshDb();
  assert.throws(
    () => addCustomer(db, { id: 'x2', source: 'staff', contactRef: 'sample:wa-c-9' }),
    /CHECK|constraint/i,
    'a staff row never had a reference to begin with — one here was issued by nobody',
  );
});

test('UNIQUE(contact_ref) refuses the same contact imported twice', () => {
  const db = freshDb();
  addCustomer(db, { id: 'x3', source: 'imported', contactRef: 'sample:wa-c-1' });
  assert.throws(
    () => addCustomer(db, { id: 'x4', source: 'imported', contactRef: 'sample:wa-c-1' }),
    /UNIQUE|constraint/i,
  );
});

test('MANY staff rows coexist with a NULL reference — SQLite allows many NULLs under UNIQUE', () => {
  const db = freshDb();
  addCustomer(db, { id: 'x5', source: 'staff', label: 'Table 12 regular' });
  addCustomer(db, { id: 'x6', source: 'staff', label: 'Mr Bhatia' });
  addCustomer(db, { id: 'x7', source: 'staff', label: 'Corporate — Sector 10' });
  assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM customers`).get().n), 3,
    'the UNIQUE that stops a duplicate import must not stop a third hand-entered person');
});

// --- tags --------------------------------------------------------------------

test('a tag naming a dish that is not on the menu is refused', () => {
  const db = seededDb();
  assert.throws(
    () => db.prepare(`INSERT INTO customer_tags (customer_id, menu_item_id, tagged_by, tagged_at, is_sample)
                      VALUES ('cu-1', 'mi-does-not-exist', 'Priya Menon', ?, 1)`).run(NOW),
    /FOREIGN KEY|constraint/i,
    'a tag names a dish that exists; it is not free text',
  );
});

test('a tag with no author is refused — a judgement needs someone who made it', () => {
  const db = seededDb();
  assert.throws(
    () => db.prepare(`INSERT INTO customer_tags (customer_id, menu_item_id, tagged_by, tagged_at, is_sample)
                      VALUES ('cu-2', 'mi-1', NULL, ?, 1)`).run(NOW),
    /NOT NULL|constraint/i,
    'an unattributed tag is indistinguishable from something the system derived',
  );
});

test('deleting a customer takes their tags with them', () => {
  const db = seededDb();
  const before = Number(db.prepare(`SELECT COUNT(*) n FROM customer_tags WHERE customer_id = 'cu-1'`).get().n);
  assert.ok(before > 0);
  db.prepare(`DELETE FROM customers WHERE id = 'cu-1'`).run();
  assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM customer_tags WHERE customer_id = 'cu-1'`).get().n), 0);
});

// --- reachability is derived, not stored -------------------------------------

test('isReachable follows the source and the reference, and nothing else', () => {
  assert.equal(isReachable({ source: 'imported', contactRef: 'sample:wa-c-1' }), true);
  assert.equal(isReachable({ source: 'staff', contactRef: null }), false);
  // Neither of these can exist in the database — the CHECK forbids both — but
  // the function is the last line of defence for a row assembled in memory.
  assert.equal(isReachable({ source: 'imported', contactRef: null }), false);
  assert.equal(isReachable({ source: 'staff', contactRef: 'x' }), false);
  assert.equal(isReachable(null), false);
});

test('there is NO reachable column — it is derived every time it is asked for', () => {
  const db = seededDb();
  const cols = db.prepare(`SELECT * FROM customers LIMIT 1`).all()[0];
  assert.equal('reachable' in cols, false, 'a stored copy could disagree with the row it describes');
  assert.equal(toCustomer(db.prepare(`SELECT * FROM customers WHERE id = 'cu-1'`).get()).reachable, true);
});

test('NO CONTACT DETAIL COLUMN EXISTS, and none may be added', () => {
  const db = seededDb();
  const cols = Object.keys(db.prepare(`SELECT * FROM customers LIMIT 1`).all()[0]);
  for (const banned of ['phone', 'phone_number', 'msisdn', 'email', 'address', 'wa_id', 'e164']) {
    assert.equal(cols.includes(banned), false, `'${banned}' must not exist on customers (§11 decision 1)`);
  }
  assert.deepEqual(cols.sort(), ['contact_ref', 'created_at', 'display_label', 'id', 'is_sample', 'source']);
});

// --- the two-number rule -----------------------------------------------------

test('summariseSegment ALWAYS returns all three numbers, and they reconcile', () => {
  const rows = [
    { source: 'imported', contactRef: 'sample:wa-c-1' },
    { source: 'imported', contactRef: 'sample:wa-c-2' },
    { source: 'staff', contactRef: null },
    { source: 'staff', contactRef: null },
    { source: 'staff', contactRef: null },
  ];
  const s = summariseSegment(rows);
  assert.deepEqual(s, { tagged: 5, reachable: 2, unreachable: 3 });
  assert.ok(s.tagged > s.reachable, 'the case the rule exists for');
  assert.equal(s.tagged, s.reachable + s.unreachable, 'if these ever disagree one of the three is lying');
  assert.deepEqual(Object.keys(s).sort(), ['reachable', 'tagged', 'unreachable'],
    'no variant returns a lone total — a single figure beside a Send button is the defect');
});

test('summariseSegment on an empty segment is three zeroes, not an absence', () => {
  assert.deepEqual(summariseSegment([]), { tagged: 0, reachable: 0, unreachable: 0 });
  assert.deepEqual(summariseSegment(), { tagged: 0, reachable: 0, unreachable: 0 });
});

test('THE SEEDED BIRYANI SEGMENT SHOWS THE GAP: 5 tagged, 3 reachable', () => {
  const db = seededDb();
  const s = summariseSegment(customersForDish(db, 'mi-2'));
  assert.deepEqual(s, { tagged: 5, reachable: 3, unreachable: 2 });
  assert.ok(s.unreachable > 0,
    'both sources are seeded so this is a real gap, not a zero that hides the distinction');
});

// --- provenance survives the trip out ----------------------------------------

test('customersForDish carries taggedBy and taggedAt on EVERY row', () => {
  const db = seededDb();
  const rows = customersForDish(db, 'mi-2');
  assert.equal(rows.length, 5);
  for (const r of rows) {
    assert.ok(r.taggedBy, `${r.id} lost its author`);
    assert.ok(r.taggedAt && !Number.isNaN(Date.parse(r.taggedAt)), `${r.id} lost its timestamp`);
    assert.equal(typeof r.reachable, 'boolean');
  }
  assert.deepEqual([...new Set(rows.map(r => r.taggedBy))].sort(),
    ['Ananya Rao', 'Priya Menon', 'Rohit Malhotra']);
});

test('customersForDish does not touch guest_texts — the two provenances never join', () => {
  const db = seededDb();
  const rows = customersForDish(db, 'mi-2');
  for (const r of rows) {
    assert.equal('quote' in r, false);
    assert.equal('mentions' in r, false, 'a guest mention is not a customer tag and must not travel as one');
  }
});

test('a dish nobody is tagged with returns an empty segment, not an error', () => {
  const db = seededDb();
  assert.deepEqual(customersForDish(db, 'mi-7'), []);
  assert.deepEqual(summariseSegment(customersForDish(db, 'mi-7')), { tagged: 0, reachable: 0, unreachable: 0 });
});

// --- the import gate ---------------------------------------------------------

test('importContacts REFUSES, writes no row, and says what it is waiting on', async () => {
  const db = seededDb();
  const before = Number(db.prepare(`SELECT COUNT(*) n FROM customers`).get().n);

  const result = await importContacts();

  assert.equal(result.ok, false);
  assert.equal(result.blockedBy, 'provider_unknown');
  assert.equal(result.imported, 0);
  assert.match(result.reason, /WhatsApp provider/i);
  assert.match(result.reason, /does not store phone numbers/i);
  assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM customers`).get().n), before,
    'a blocked import must leave the table exactly as it found it');
});

test('the refusal explains the gate rather than reading as a generic failure', () => {
  assert.match(IMPORT_BLOCKED_REASON, /Cloud API/);
  assert.match(IMPORT_BLOCKED_REASON, /added by hand are unaffected/i,
    'a restaurant reading this must learn that staff rows still work');
});

// --- the seed ----------------------------------------------------------------

test('every seeded customer is sample data, and every reference is marked fabricated', () => {
  const db = seededDb();
  const rows = db.prepare(`SELECT * FROM customers`).all().map(toCustomer);
  assert.equal(rows.length, 8);
  assert.equal(rows.every(r => r.isSample), true);
  for (const r of rows.filter(r => r.source === 'imported')) {
    assert.match(r.contactRef, /^sample:/,
      'a sample reference can never be mistaken for one a provider issued — which is what keeps the seed inside the gate');
  }
  assert.equal(rows.filter(r => r.source === 'staff').length, 3);
  assert.equal(rows.filter(r => r.source === 'imported').length, 5);
});

test('no seeded tag mirrors a guest_texts dish mention', () => {
  const db = seededDb();
  // The dishes guests actually named are mi-2, mi-3, mi-4 and mi-6. The point
  // is not that tags avoid those dishes — it is that no tag was DERIVED from a
  // mention, so the tag rows carry a staff author and reference no fragment.
  const tags = db.prepare(`SELECT * FROM customer_tags`).all();
  for (const t of tags) {
    assert.ok(t.tagged_by, 'every tag is somebody`s judgement');
    assert.equal('guest_text_id' in t, false, 'no column links a tag to a guest fragment');
  }
});

test('assertSchemaCurrent catches a database created before the customer tables', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE customer_tags');
  db.exec('DROP TABLE customers');
  assert.throws(() => assertSchemaCurrent(db), /table customers does not exist/);
});

test('assertSchemaCurrent catches a customers table with a stale source CHECK', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE customer_tags');
  db.exec('DROP TABLE customers');
  db.exec(`CREATE TABLE customers (id TEXT PRIMARY KEY, source TEXT CHECK (source IN ('imported')))`);
  assert.throws(() => assertSchemaCurrent(db), /customers\.source does not allow 'staff'/);
});

test('re-seeding does not duplicate customers or tags', async () => {
  const { seed } = await import('../seed/seed.js');
  const { REPO_ROOT } = await import('./helpers.js');
  const db = seededDb();
  seed(db, REPO_ROOT);
  assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM customers`).get().n), 8);
  assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM customer_tags`).get().n), 8);
});

// --- routes ------------------------------------------------------------------

const withServer = async (fn) => {
  const { createServer } = await import('../src/http.js');
  const server = createServer(seededDb());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, opts) => {
    const res = await fetch(base + path, opts);
    return { status: res.status, body: await res.json() };
  };
  const post = (path, payload) => call(path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  try { await fn({ call, post, base }); } finally { server.close(); }
};

test('GET /customers sends three numbers per segment, and they reconcile', async () => {
  await withServer(async ({ call }) => {
    const { status, body } = await call('/customers');
    assert.equal(status, 200);
    assert.equal(body.customers.length, 8);
    assert.ok(body.segments.length >= 1);
    for (const s of body.segments) {
      assert.equal(typeof s.tagged, 'number');
      assert.equal(typeof s.reachable, 'number');
      assert.equal(typeof s.unreachable, 'number');
      assert.equal(s.tagged, s.reachable + s.unreachable, `${s.name} does not reconcile`);
    }
    const biryani = body.segments.find(s => s.menuItemId === 'mi-2');
    assert.deepEqual(
      { tagged: biryani.tagged, reachable: biryani.reachable, unreachable: biryani.unreachable },
      { tagged: 5, reachable: 3, unreachable: 2 },
    );
    // A segment nobody can be messaged in exists in the seed on purpose.
    const kheer = body.segments.find(s => s.menuItemId === 'mi-6');
    assert.equal(kheer.reachable, 0);
  });
});

test('GET /customers serves the marketing rate so no screen hardcodes a price', async () => {
  await withServer(async ({ call }) => {
    const { body } = await call('/customers');
    assert.equal(body.marketingRateInr, 0.8631);
  });
});

test('every customer served carries its tags WITH who tagged and when', async () => {
  await withServer(async ({ call }) => {
    const { body } = await call('/customers');
    const tagged = body.customers.filter(c => c.tags.length);
    assert.ok(tagged.length >= 5);
    for (const c of tagged) {
      assert.equal(typeof c.reachable, 'boolean');
      for (const t of c.tags) {
        assert.ok(t.taggedBy, `${c.id} tag lost its author`);
        assert.ok(t.taggedAt && !Number.isNaN(Date.parse(t.taggedAt)));
        assert.ok(t.name, 'the dish name travels so the client need not join');
      }
    }
  });
});

test("POST /customers REFUSES source 'imported' — there is no route that imports", async () => {
  await withServer(async ({ post, call }) => {
    const before = (await call('/customers')).body.customers.length;
    const { status, body } = await post('/customers', { display_label: 'X', source: 'imported' });
    assert.equal(status, 400);
    assert.deepEqual(body.rejectedKeys, ['source']);
    assert.equal((await call('/customers')).body.customers.length, before, 'nothing was created');
  });
});

test('POST /customers refuses ANY unknown key, so a phone cannot be smuggled through', async () => {
  await withServer(async ({ post }) => {
    for (const extra of [{ phone: '+91 98110 44213' }, { contact_ref: 'wa-1' }, { wa_id: '919811044213' }, { email: 'a@b.c' }]) {
      const { status, body } = await post('/customers', { display_label: 'X', ...extra });
      assert.equal(status, 400, `${Object.keys(extra)[0]} was not refused`);
      assert.deepEqual(body.rejectedKeys, Object.keys(extra));
    }
    // Even the correct value is refused: accepting the field at all makes
    // 'imported' look like something a caller may pass.
    assert.equal((await post('/customers', { display_label: 'X', source: 'staff' })).status, 400);
  });
});

test('POST /customers creates a staff row that is explicitly not reachable', async () => {
  await withServer(async ({ post }) => {
    const { status, body } = await post('/customers', { display_label: 'Thursday regular, table 12' });
    assert.equal(status, 201);
    assert.equal(body.source, 'staff');
    assert.equal(body.contactRef, null);
    assert.equal(body.reachable, false);
    assert.deepEqual(body.tags, []);
  });
});

test('POST /customers refuses an empty label rather than creating a nameless person', async () => {
  await withServer(async ({ post }) => {
    assert.equal((await post('/customers', { display_label: '   ' })).status, 400);
    assert.equal((await post('/customers', {})).status, 400);
  });
});

test('POST tags REFUSES a missing tagged_by — no default author', async () => {
  await withServer(async ({ post }) => {
    const { status, body } = await post('/customers/cu-1/tags', { menu_item_id: 'mi-1' });
    assert.equal(status, 400);
    assert.match(body.error, /tagged_by is required/);
    assert.match(body.reason, /judgement/i);
    assert.equal((await post('/customers/cu-1/tags', { menu_item_id: 'mi-1', tagged_by: '  ' })).status, 400,
      'whitespace is not an author');
  });
});

test('POST tags requires a dish and refuses one that is not on the menu', async () => {
  await withServer(async ({ post }) => {
    assert.equal((await post('/customers/cu-1/tags', { tagged_by: 'Priya Menon' })).status, 400);
    assert.equal((await post('/customers/cu-1/tags', { menu_item_id: 'mi-nope', tagged_by: 'Priya Menon' })).status, 400);
  });
});

test('POST tags on an unknown customer is a 404', async () => {
  await withServer(async ({ post }) => {
    assert.equal((await post('/customers/nobody/tags', { menu_item_id: 'mi-1', tagged_by: 'Priya Menon' })).status, 404);
  });
});

test('a tag can be added and removed, and removing one never removes the person', async () => {
  await withServer(async ({ post, call }) => {
    const added = await post('/customers/cu-4/tags', { menu_item_id: 'mi-2', tagged_by: 'Ananya Rao' });
    assert.equal(added.status, 200);
    assert.ok(added.body.tags.some(t => t.menuItemId === 'mi-2'));

    const removed = await call('/customers/cu-4/tags/mi-2', { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.tags.some(t => t.menuItemId === 'mi-2'), false);
    assert.equal(removed.body.id, 'cu-4', 'the customer is still here');

    assert.equal((await call('/customers/cu-4/tags/mi-2', { method: 'DELETE' })).status, 404);
    assert.equal((await call('/customers')).body.customers.length, 8, 'nobody was deleted');
  });
});

test('there is NO route that deletes a customer', async () => {
  await withServer(async ({ call }) => {
    const res = await call('/customers/cu-1', { method: 'DELETE' });
    assert.equal(res.status, 404, 'deleting a person is not an operation this API offers');
    assert.equal((await call('/customers')).body.customers.length, 8);
  });
});

test('GET /customers/import-status serves the refusal, so the screen never writes it', async () => {
  await withServer(async ({ call }) => {
    const { status, body } = await call('/customers/import-status');
    assert.equal(status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.blockedBy, 'provider_unknown');
    assert.equal(body.imported, 0);
    assert.equal(body.reason, IMPORT_BLOCKED_REASON, 'one source for the sentence');
  });
});
