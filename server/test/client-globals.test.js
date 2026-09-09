import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findCollisions, formatCollisions, declarationsIn, loadOrder, listClientFiles, REPO_ROOT,
  checkClientPresent, reportGlobals,
} from '../../tools/check-globals.mjs';

// WHY A CHECK ABOUT THE CLIENT RUNS IN THE SERVER'S TEST SUITE.
//
// The client is permanently buildless — no package.json, no toolchain, no test
// runner, and CLAUDE.md §12.2 forbids adding one — so `server/`'s `npm test` is
// the ONLY automated runner in this repo. A check that has to be remembered is
// the same weak control as the instruction it replaces, so it goes where
// something already runs.
//
// THE BOUNDARY, PRECISELY. CLAUDE.md §2 says the server never imports from
// `src/`, and that still holds: nothing under `server/src/` touches the client,
// and the service has no client dependency at deploy time. What happens here is
// that a TEST invokes a repo-root tool which reads `src/*.jsx` AS TEXT and never
// imports, executes or requires any of it. `server/README.md` is amended in the
// same commit rather than being left to say something that is no longer exactly
// true.

test('NO top-level name is declared in more than one src/*.jsx', () => {
  const collisions = findCollisions();
  assert.deepEqual(collisions, [], `\n\n${formatCollisions(collisions)}\n`);
});

test('the detector is actually reading the client, not silently finding nothing', () => {
  // A detector that reports "clean" because it is broken is worse than none.
  const order = loadOrder();
  const files = listClientFiles();
  assert.ok(order.length >= 25, `index.html lists only ${order.length} scripts`);
  assert.ok(files.length >= 25, `only ${files.length} src/*.jsx found`);
  assert.deepEqual(files.filter(f => !order.includes(f)), [],
    'a file on disk but absent from index.html never loads at all — CLAUDE.md §4 trap 7');
});

// --- the detector's own logic, on fixtures rather than on the live tree ------

const fixture = (files, scripts) => {
  const root = mkdtempSync(join(tmpdir(), 'globals-'));
  mkdirSync(join(root, 'src'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'src', name), body);
  writeFileSync(join(root, 'index.html'),
    scripts.map(s => `<script type="text/babel" src="src/${s}"></script>`).join('\n'));
  return root;
};

test('IT CATCHES THE CASE THAT SHIPPED: a function shadowed by a later file', () => {
  const root = fixture({
    'a.jsx': 'function SourceBadge({ source }) {}\n',
    'b.jsx': 'function SourceBadge({ src }) {}\n',
  }, ['a.jsx', 'b.jsx']);
  try {
    const [c] = findCollisions(root);
    assert.equal(c.name, 'SourceBadge');
    // Naming the WINNER is the point — "duplicate" alone leaves the reader to
    // work out the half that decides the bug.
    assert.equal(c.winner.file, 'b.jsx', 'the later script wins for every caller');
    assert.deepEqual(c.sites.map(s => s.file), ['a.jsx', 'b.jsx'], 'reported in load order');
    assert.match(formatCollisions([c]), /WINS/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('load order comes from index.html, not from the filename', () => {
  // z.jsx loads FIRST here, so a.jsx wins despite sorting last.
  const root = fixture({
    'a.jsx': 'const Thing = 1\n',
    'z.jsx': 'const Thing = 2\n',
  }, ['z.jsx', 'a.jsx']);
  try {
    const [c] = findCollisions(root);
    assert.equal(c.winner.file, 'a.jsx');
    assert.deepEqual(c.sites.map(s => s.file), ['z.jsx', 'a.jsx']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a file missing from index.html is reported rather than ranked', () => {
  const root = fixture({
    'a.jsx': 'function Dup() {}\n',
    'orphan.jsx': 'function Dup() {}\n',
  }, ['a.jsx']);
  try {
    const [c] = findCollisions(root);
    assert.deepEqual(c.unloaded, ['orphan.jsx']);
    assert.equal(c.winner.file, 'a.jsx', 'a file that never loads cannot win');
    assert.match(formatCollisions([c]), /never loads/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only COLUMN 0 counts — an inner declaration is not a global', () => {
  const src = [
    'function Outer() {',
    '  const Helper = 1;',       // not a global
    '  function Inner() {}',     // not a global
    '}',
    'const Real = 2;',
    'export function Exported() {}',
    'async function Waits() {}',
    'class Klass {}',
    'let Mutable = 3;',
  ].join('\n');
  const names = [...declarationsIn(src).keys()];
  assert.deepEqual(names.sort(), ['Exported', 'Klass', 'Mutable', 'Outer', 'Real', 'Waits']);
  assert.equal(names.includes('Helper'), false);
  assert.equal(names.includes('Inner'), false);
});

test('the same name twice in ONE file is not a cross-file collision', () => {
  // It is a syntax error for const, or a within-file shadow for function —
  // either way it is not what this check is for, and reporting it would be noise.
  const root = fixture({ 'a.jsx': 'function Dup() {}\nfunction Dup() {}\n' }, ['a.jsx']);
  try {
    assert.deepEqual(findCollisions(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a clean tree formats as a plain sentence, not an empty report', () => {
  assert.match(formatCollisions([]), /No top-level name is declared in more than one/);
});

test('REPO_ROOT resolves to the repo, not to server/', () => {
  assert.deepEqual(listClientFiles(REPO_ROOT).includes('app.jsx'), true);
});

// --- the client is not here -------------------------------------------------
//
// A server-only checkout is a STATE, not a crash. Before this, `src/` missing
// died on a raw ENOENT stack trace out of readdirSync — absence rendered as
// breakage, which is the defect this repo has spent twenty commits removing
// from its screens.

test('a root with no src/ states the absence and does not throw', () => {
  const root = mkdtempSync(join(tmpdir(), 'globals-nosrc-'));
  writeFileSync(join(root, 'index.html'), '<html></html>');
  try {
    const presence = checkClientPresent(root);
    assert.equal(presence.ok, false);
    assert.deepEqual(presence.missing, ['src/']);
    assert.match(presence.message, /src\//, 'the message names the directory it looked for');
    assert.ok(presence.message.includes(root), 'and the root it resolved from');
    assert.match(presence.message, /state rather than\s+a failure/);

    // The path a person actually hits, and it returns rather than throwing.
    const report = reportGlobals(root);
    assert.equal(report.code, 2, '2 is "could not check" — distinct from 1, "found collisions"');
    assert.equal(report.collisions, null, 'and it must NOT report an empty list, which would read as clean');
    assert.equal(report.output, presence.message);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a BARE server checkout — no index.html either — also states it', () => {
  // The real scenario. index.html is read by loadOrder(), which runs first, so
  // this crashed before ever reaching the directory listing.
  const root = mkdtempSync(join(tmpdir(), 'globals-bare-'));
  try {
    const presence = checkClientPresent(root);
    assert.equal(presence.ok, false);
    assert.deepEqual(presence.missing, ['index.html', 'src/']);
    assert.match(presence.message, /index\.html/);
    assert.match(presence.message, /load order/);
    assert.equal(reportGlobals(root).code, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a present client still reports normally — the guard changed nothing else', () => {
  const root = mkdtempSync(join(tmpdir(), 'globals-ok-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.jsx'), 'function Dup() {}\n');
  writeFileSync(join(root, 'src', 'b.jsx'), 'function Dup() {}\n');
  writeFileSync(join(root, 'index.html'),
    '<script type="text/babel" src="src/a.jsx"></script>\n<script type="text/babel" src="src/b.jsx"></script>');
  try {
    assert.equal(checkClientPresent(root).ok, true);
    const report = reportGlobals(root);
    assert.equal(report.code, 1, 'found collisions');
    assert.equal(report.collisions.length, 1);
    assert.match(report.output, /WINS/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('this repo has its client, so the check really ran above', () => {
  assert.equal(checkClientPresent().ok, true);
  assert.equal(reportGlobals().code, 0);
});
