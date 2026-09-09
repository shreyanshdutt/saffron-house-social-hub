import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededDb, freshDb } from './helpers.js';
import * as repo from '../src/repo.js';
import { assertSchemaCurrent, openDb, migrate } from '../src/db.js';
import { buildDishIndex, findDishMentions, tallyMentions } from '../src/dish-matcher.js';
import { tokenize, normalizeText, normalizeAlias, canonicalToken, SPELLING_VARIANTS } from '../src/text-normalize.js';

const IX = () => repo.dishIndex(seededDb());
const ids = (ms) => ms.map(m => m.menuItemId);

// --- the normalizer ---------------------------------------------------------

test('normalizeText lowercases, strips punctuation and collapses whitespace', () => {
  assert.equal(normalizeText('  The GALOUTI  Kebab!! 🔥 '), 'the galouti kebab');
  assert.equal(normalizeText('“Corn & Chilli” — pakora?'), 'corn chilli pakora');
  assert.equal(normalizeText(null), '');
});

test('Romanized Hindi spelling variants fold to one canonical form', () => {
  assert.equal(canonicalToken('biriyani'), 'biryani');
  assert.equal(canonicalToken('biriani'), 'biryani');
  assert.equal(canonicalToken('galauti'), 'galouti');
  assert.equal(canonicalToken('gilouti'), 'galouti');
  assert.equal(canonicalToken('kabab'), 'kebab');
});

test('a plural folds ONLY when the singular is a word we know', () => {
  assert.equal(canonicalToken('pakoras'), 'pakora');
  assert.equal(canonicalToken('kebabs'), 'kebab');
  // The bug this guard exists for: an earlier draft stripped any trailing 's'
  // and turned every "this" in the corpus into "thi".
  assert.equal(canonicalToken('this'), 'this');
  assert.equal(canonicalToken('was'), 'was');
  assert.equal(canonicalToken('gas'), 'gas');
});

test('no spelling variant claims two canonical forms', () => {
  const seen = new Map();
  for (const [canonical, vs] of Object.entries(SPELLING_VARIANTS)) {
    for (const v of vs) {
      assert.equal(seen.has(v), false, `'${v}' is listed under both '${seen.get(v)}' and '${canonical}'`);
      seen.set(v, canonical);
    }
  }
});

// --- the index --------------------------------------------------------------

test('AN AMBIGUOUS ALIAS IS REFUSED, not resolved by insertion order', () => {
  assert.throws(
    () => buildDishIndex([
      { alias: 'galouti', menuItemId: 'mi-1' },
      { alias: 'galouti', menuItemId: 'mi-3' },
    ]),
    /ambiguous alias 'galouti'.*mi-1.*mi-3/s,
  );
});

test('the same alias twice for the SAME dish is fine — it is not a collision', () => {
  const ix = buildDishIndex([
    { alias: 'Galouti Kebab', menuItemId: 'mi-1' },
    { alias: 'galouti kebab', menuItemId: 'mi-1' },
  ]);
  assert.equal(ix.byAlias.size, 1);
});

test('the database refuses the ambiguous alias too, not just the index builder', () => {
  const db = seededDb();
  db.prepare(`INSERT INTO menu_item_aliases (alias, menu_item_id, word_count, is_sample) VALUES ('galouti','mi-1',1,1)`).run();
  assert.throws(
    () => db.prepare(`INSERT INTO menu_item_aliases (alias, menu_item_id, word_count, is_sample) VALUES ('galouti','mi-3',1,1)`).run(),
    /UNIQUE|PRIMARY|constraint/i,
  );
});

// --- matching ---------------------------------------------------------------

test('an alias matches — guests write "biryani", not "Awadhi Biryani"', () => {
  assert.deepEqual(ids(findDishMentions('The biryani was worth the wait.', IX())), ['mi-2']);
});

test('a spelling variant matches', () => {
  assert.deepEqual(ids(findDishMentions('that biriyani though', IX())), ['mi-2']);
  assert.deepEqual(ids(findDishMentions('the galauti kebab is unreal', IX())), ['mi-1']);
});

test('WORD ORDER DEFEATS A WRONG MATCH — this is a sequence, not a bag of words', () => {
  const ix = buildDishIndex([{ alias: 'milk chocolate', menuItemId: 'mi-x' }]);
  assert.deepEqual(findDishMentions('chocolate milk', ix), [],
    'a bag-of-words matcher would call this a hit; Salehian et al. (KDD 2017) is about exactly this');
  assert.deepEqual(ids(findDishMentions('milk chocolate', ix)), ['mi-x']);
});

test('THE GALOUTI COLLISION: the qualified phrase wins and consumes its tokens', () => {
  const ix = IX();
  // Both dishes contain the token `galouti`, and neither claims it alone.
  assert.deepEqual(ids(findDishMentions('the kathal galouti is a genuine achievement', ix)), ['mi-3']);
  assert.deepEqual(ids(findDishMentions('the galouti kebab arrived first', ix)), ['mi-1']);
  // The honest cost of refusing the bare alias: an unqualified mention is
  // MISSED rather than guessed at. A wrong attribution would be invisible.
  assert.deepEqual(findDishMentions('saw the galouti reel and now I need it', ix), [],
    'unqualified "galouti" belongs to no dish, and inventing an owner would be worse than missing it');
});

test('longest match wins where one alias is a prefix of another', () => {
  const ix = IX();
  assert.deepEqual(ids(findDishMentions('the paneer tikka masala was fine', ix)), ['mi-5']);
  const m = findDishMentions('the paneer tikka masala was fine', ix);
  assert.equal(m.length, 1, 'not three overlapping mentions of the same dish');
  assert.equal(m[0].alias, 'paneer tikka masala');
});

test('a word-boundary near-miss does NOT match', () => {
  const ix = IX();
  assert.deepEqual(findDishMentions('we went to the pakorawala down the road', ix), []);
  assert.deepEqual(findDishMentions('biryanis-r-us is a different restaurant', ix).length, 1,
    'a hyphen is a boundary, so this legitimately contains "biryanis"');
  assert.deepEqual(findDishMentions('unpaneered', ix), []);
});

test('text with no dish returns nothing at all', () => {
  const ix = IX();
  assert.deepEqual(findDishMentions('The service was slow and the room was loud.', ix), []);
  assert.deepEqual(findDishMentions('', ix), []);
  assert.deepEqual(findDishMentions('   ', ix), []);
  assert.deepEqual(findDishMentions(null, ix), []);
});

test('the same dish twice in one review counts twice and carries BOTH pieces of evidence', () => {
  const ix = IX();
  const text = 'The biryani was excellent. My wife also had the biryani and agreed.';
  const ms = findDishMentions(text, ix, { kind: 'review', id: 'rv-9' });
  assert.equal(ms.length, 2);
  assert.deepEqual(ids(ms), ['mi-2', 'mi-2']);
  assert.notEqual(ms[0].start, ms[1].start, 'two distinct positions, not the same match twice');
  const tally = tallyMentions(ms);
  assert.equal(tally[0].count, 2);
  assert.equal(tally[0].evidence.length, 2, 'the count and the evidence cannot come apart');
});

test('A HINGLISH SENTENCE AROUND AN ENGLISH DISH NAME STILL MATCHES', () => {
  const ix = IX();
  // The reason the whole problem is small: nobody translates "biryani".
  assert.deepEqual(ids(findDishMentions('khana was bohut acha, biryani ekdum mast thi', ix)), ['mi-2']);
  assert.deepEqual(ids(findDishMentions('service bakwas thi par galouti kebab lajawab tha', ix)), ['mi-1']);
});

// --- evidence ---------------------------------------------------------------

test('EVERY MENTION CARRIES THE GUEST\'S OWN WORDS, not the normalized form', () => {
  const ix = IX();
  const text = 'Corn pakoras were the best thing I have eaten this month.';
  const [m] = findDishMentions(text, ix, { kind: 'comment', id: 'cm5', at: '2026-09-02' });

  assert.equal(m.matchedText, 'Corn pakoras', 'as written, capitals and plural intact');
  assert.equal(text.slice(m.start, m.end), 'Corn pakoras', 'the offsets index the original string');
  assert.equal(m.quote, text, 'the sentence is carried so a screen can show it beside the dish');
  assert.deepEqual(m.source, { kind: 'comment', id: 'cm5', at: '2026-09-02' });
  assert.equal(m.alias, 'corn pakora');
});

test('NO MENTION CARRIES A SENTIMENT FIELD — owner decision, 2026-09-09', () => {
  const [m] = findDishMentions('The biryani was superb.', IX());
  const keys = Object.keys(m);
  for (const banned of ['sentiment', 'polarity', 'score', 'tone', 'positive', 'negative']) {
    assert.equal(keys.includes(banned), false, `'${banned}' must not exist, not even as a placeholder`);
  }
});

// --- the stored menu --------------------------------------------------------

test('the eight menu items seed with their aliases, flagged as sample', () => {
  const items = repo.listMenuItems(seededDb());
  assert.equal(items.length, 8);
  assert.equal(items.every(i => i.isSample), true);
  assert.equal(items.every(i => i.aliases.length >= 1), true);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  assert.equal(byId['mi-1'].name, 'Galouti Kebab');
  assert.equal(byId['mi-1'].price, 495);
  assert.ok(byId['mi-2'].aliases.includes('biryani'), 'the short form guests actually write');
});

test('aliases are stored already normalized, so the key guards what the matcher compares', () => {
  const db = seededDb();
  const rows = db.prepare(`SELECT alias FROM menu_item_aliases`).all().map(r => r.alias);
  for (const a of rows) assert.equal(a, normalizeAlias(a), `'${a}' is not in normalized form`);
});

test('NO seeded mention count or sentiment came across from mock.jsx', () => {
  const db = seededDb();
  const cols = db.prepare(`SELECT * FROM menu_items LIMIT 1`).all()[0] || {};
  for (const banned of ['mentions7d', 'sentiment', 'top_praise', 'top_complaint', 'sentiment_delta']) {
    assert.equal(banned in cols, false, `${banned} must not exist on menu_items`);
  }
});

test('assertSchemaCurrent catches a database created before the menu tables', () => {
  const db = migrate(openDb(':memory:'));
  db.exec('DROP TABLE menu_item_aliases');
  db.exec('DROP TABLE menu_items');
  assert.throws(() => assertSchemaCurrent(db), /table menu_items does not exist/);
});

test('re-seeding does not duplicate menu items or aliases', async () => {
  const { seed } = await import('../seed/seed.js');
  const { REPO_ROOT } = await import('./helpers.js');
  const db = seededDb();
  seed(db, REPO_ROOT);
  assert.equal(repo.listMenuItems(db).length, 8);
  assert.equal(repo.dishIndex(db).byAlias.size, 23);
});
