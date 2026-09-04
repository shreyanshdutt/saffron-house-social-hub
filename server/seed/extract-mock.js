// Reads seed data out of the CLIENT's src/mock.jsx without importing it.
//
// CLAUDE.md §2: "The client NEVER imports from `server/`, and the server never
// imports from `src/`. They meet at HTTP and nowhere else." This file is the
// one controlled exception and it is deliberately not an exception to the
// spirit of the rule:
//
//   · it is a ONE-SHOT SEEDING TOOL, not part of the running service. Nothing
//     under server/src/ references it, so the server at runtime has no edge to
//     src/ at all;
//   · it does not `import` or `require` mock.jsx. It reads the file as TEXT,
//     slices out named `const` declarations by bracket matching, and evaluates
//     only those isolated data literals in a locked-down `node:vm` context
//     with no globals. mock.jsx contains JSX (the PlatformGlyph SVGs) and
//     touches `window` and `localStorage`, none of which is reachable this way;
//   · the alternative was retyping 15 establishments and 28 observation
//     samples into a second file, which the task forbids for the right reason:
//     a hand-copied seed drifts from the source it claims to mirror, silently.
//
// Once real Places rows replace the seeds this file stops being used and
// should be deleted rather than maintained.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const OPEN = { '{': '}', '[': ']' };

// Slice `const <name> = <literal>;` out of the source by matching brackets,
// skipping over strings and comments so a `}` inside a caption cannot end the
// scan early.
export function sliceLiteral(source, name) {
  const decl = new RegExp(`(?:^|\\n)\\s*const\\s+${name}\\s*=\\s*`, 'm');
  const m = decl.exec(source);
  if (!m) throw new Error(`extract-mock: no top-level \`const ${name}\` in mock.jsx`);

  let i = m.index + m[0].length;
  const first = source[i];
  if (!OPEN[first]) throw new Error(`extract-mock: ${name} is not an object/array literal (starts with ${JSON.stringify(first)})`);

  const stack = [];
  let inString = null, inLine = false, inBlock = false;
  const start = i;

  for (; i < source.length; i++) {
    const c = source[i], next = source[i + 1];

    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '/' && next === '/') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }

    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) throw new Error(`extract-mock: unbalanced bracket reading ${name} at offset ${i}`);
      if (!stack.length) return source.slice(start, i + 1);
    }
  }
  throw new Error(`extract-mock: never closed the literal for ${name}`);
}

// Evaluate one extracted literal in an empty context. No require, no process,
// no window, no localStorage, no timers — if a literal ever stops being a
// literal, this throws instead of quietly running client code.
function evalLiteral(literal, name) {
  const ctx = vm.createContext(Object.create(null));
  try {
    const value = vm.runInContext(`(${literal})`, ctx, { timeout: 1000, filename: `mock.jsx:${name}` });
    // Cloned back into THIS realm. A value returned straight out of a vm
    // carries that context's Array/Object prototypes, and deepStrictEqual
    // compares prototypes — so a caller comparing an extracted array against a
    // plain one gets a failure whose diff shows two identical-looking values.
    return structuredClone(value);
  } catch (err) {
    throw new Error(`extract-mock: ${name} is not a self-contained data literal — ${err.message}`);
  }
}

export const MOCK_PATH_DEFAULT = 'src/mock.jsx';

export function extractMock(repoRoot, names = [
  'ESTABLISHMENTS', 'OBSERVATION_HISTORY', 'TRACKED_DEFAULT', 'COMPETITOR_CATCHMENT',
]) {
  const source = readFileSync(join(repoRoot, MOCK_PATH_DEFAULT), 'utf8');
  const out = {};
  for (const n of names) out[n] = evalLiteral(sliceLiteral(source, n), n);
  return out;
}
