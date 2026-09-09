// Detects top-level name collisions across src/*.jsx.
//
// WHY THIS EXISTS RATHER THAN ANOTHER SENTENCE IN CLAUDE.md.
//
// Every `src/*.jsx` compiles as a classic script into ONE global scope, so a
// top-level name is either unique across the whole client or it is a
// collision. A duplicate `const` throws and you find out immediately. A
// duplicate `function` SILENTLY SHADOWS by load order, and the later file
// wins — for every caller, including the earlier file's own.
//
// CLAUDE.md §5 has said "grep before you introduce a top-level name" for a
// long time, and on 2026-09-09 `page-customers.jsx` declared `SourceBadge`
// anyway. `page-recommendations.jsx` already had one and loads after it, so
// every source badge on the new screen rendered nothing. Nothing threw, no
// test failed, and it was found by looking at a screenshot. An instruction is
// the weakest available control for a silent failure; this one is checkable,
// so it is checked.
//
// NO DEPENDENCY. `"dependencies": {}` has held for 48 commits and is
// load-bearing for a service that exists to hold credentials. This is a small
// script over files the repo already ships.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// LOAD ORDER IS THE POINT, so it is read from the one place that decides it
// rather than from a directory listing. `index.html` lists the scripts in the
// order the browser executes them, and the LAST declaration of a name wins.
export function loadOrder(repoRoot = REPO_ROOT) {
  const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
  const order = [];
  const re = /<script\b[^>]*\bsrc=["'](src\/[^"']+\.jsx)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) order.push(m[1].slice('src/'.length));
  return order;
}

// A declaration at column 0. The client is written that way throughout —
// nothing in `src/` indents a top-level declaration — and matching only column
// 0 is what keeps a `const` inside a function body from being mistaken for a
// global.
//
// KNOWN LIMITS, stated rather than discovered later. This is a text scan, not
// a parse: it does not see a name introduced by destructuring
// (`const { a, b } = x` at column 0 is read as the single name `{`, and so is
// skipped), nor `var`, which the client does not use. It is deliberately
// conservative — everything it reports is a real duplicate, and the cost is
// that an exotic declaration form could slip past. If one ever does, widen
// this rather than going back to grepping by hand.
const DECL = /^(?:export\s+)?(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;

export function declarationsIn(source) {
  const found = new Map();          // name -> line number of first declaration
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = DECL.exec(lines[i]);
    if (m && !found.has(m[2])) found.set(m[2], i + 1);
  }
  return found;
}

export function listClientFiles(repoRoot = REPO_ROOT) {
  return readdirSync(join(repoRoot, 'src')).filter(f => f.endsWith('.jsx')).sort();
}

// IS THE CLIENT EVEN HERE.
//
// The one situation where it is not is the server standing alone without the
// client checkout — the exact boundary server/README.md documents an exception
// for. Reporting that as an unhandled ENOENT would be absence rendered as
// breakage, which is the defect this product has spent twenty commits removing
// from its screens; a tool that checks the client is not exempt from the rule
// it exists to enforce.
//
// BOTH inputs are checked, not just `src/`. `loadOrder()` reads `index.html`
// and runs FIRST, so a bare server checkout crashed there before ever reaching
// the directory listing — fixing only one of the two would have left the very
// scenario this is for still throwing.
export function checkClientPresent(repoRoot = REPO_ROOT) {
  const wanted = [
    { path: join(repoRoot, 'index.html'), what: 'index.html', why: 'it is what defines load order' },
    { path: join(repoRoot, 'src'), what: 'src/', why: 'it holds the files whose declarations are compared' },
  ];
  const missing = wanted.filter(w => !existsSync(w.path));
  if (!missing.length) return { ok: true, missing: [], message: null };

  const lines = [
    'Cannot check for name collisions: the client is not here.',
    '',
    `  looked in: ${repoRoot}`,
  ];
  for (const m of missing) lines.push(`  missing:   ${m.what}  — ${m.why}`);
  lines.push(
    '',
    'This is what a server-only checkout looks like, and it is a state rather than',
    'a failure of the check. Run this from a working tree that has the client, or',
    'skip it where the client is deliberately absent.',
  );
  return { ok: false, missing: missing.map(m => m.what), message: lines.join('\n') };
}

// What the CLI prints and what the test asserts on — ONE path, so the test
// verifies exactly what a person sees. It never throws.
export function reportGlobals(repoRoot = REPO_ROOT) {
  const presence = checkClientPresent(repoRoot);
  if (!presence.ok) return { code: 2, output: presence.message, collisions: null };
  const collisions = findCollisions(repoRoot);
  return { code: collisions.length ? 1 : 0, output: formatCollisions(collisions), collisions };
}

// Every name declared at column 0 in more than one file.
//
// The result names the files IN LOAD ORDER and says which one WINS, because
// "duplicate" alone makes the reader work out the half that matters. A file
// not listed in index.html never loads at all, which is its own defect
// (CLAUDE.md §4 trap 7), so it is reported instead of being ranked.
export function findCollisions(repoRoot = REPO_ROOT) {
  const order = loadOrder(repoRoot);
  const rank = new Map(order.map((f, i) => [f, i]));
  const files = listClientFiles(repoRoot);

  const byName = new Map();
  for (const file of files) {
    const decls = declarationsIn(readFileSync(join(repoRoot, 'src', file), 'utf8'));
    for (const [name, line] of decls) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push({ file, line, order: rank.has(file) ? rank.get(file) : null });
    }
  }

  const collisions = [];
  for (const [name, sites] of byName) {
    if (sites.length < 2) continue;
    const sorted = [...sites].sort((a, b) => {
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      return a.order - b.order;
    });
    const loaded = sorted.filter(s => s.order !== null);
    collisions.push({
      name,
      sites: sorted,
      // The last one to load is the one every caller gets.
      winner: loaded.length ? loaded[loaded.length - 1] : null,
      unloaded: sorted.filter(s => s.order === null).map(s => s.file),
    });
  }
  return collisions.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatCollisions(collisions) {
  if (!collisions.length) return 'No top-level name is declared in more than one src/*.jsx file.';
  const out = [`${collisions.length} top-level name${collisions.length === 1 ? '' : 's'} declared in more than one file.`,
               'Files are listed in LOAD ORDER; the last one to load wins for every caller.', ''];
  for (const c of collisions) {
    out.push(`  ${c.name}`);
    for (const s of c.sites) {
      const mark = c.winner && s.file === c.winner.file ? '  <-- WINS' : '';
      const pos = s.order === null ? 'NOT IN index.html — never loads' : `load #${s.order + 1}`;
      out.push(`    ${s.file}:${s.line}  (${pos})${mark}`);
    }
    out.push('');
  }
  return out.join('\n');
}

// CLI. `node tools/check-globals.mjs` — exits 1 when it finds something, so it
// is usable from a hook or a CI step without further glue.
// Exit codes are distinct on purpose: 1 means "checked, and found collisions";
// 2 means "could not check". A caller that conflates them would treat a missing
// checkout as a clean bill of health, which is the failure being removed here.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { code, output } = reportGlobals();
  console.log(output);
  process.exit(code);
}
