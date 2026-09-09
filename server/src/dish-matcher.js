// Finding dish names in guest text, and carrying the evidence out with them.
//
// EVIDENCE IS THE FEATURE. THE COUNT IS A BY-PRODUCT.
//
// The Menu screen's `mentions7d: 412` is a number nobody can check. Replacing
// it with a smaller number nobody can check would be no better. So every
// mention this returns carries the sentence it came from, what kind of source
// that was, and where in it the match landed — so a screen can put the guest's
// own words next to the dish and an owner can read them and disagree.
//
// There is NO sentiment here, by owner decision (2026-09-09) and because the
// resource to do it honestly does not exist — see the negative results
// recorded at the top of src/text-normalize.js.

import { tokenizeWithSpans, normalizeAlias } from './text-normalize.js';

// Builds the lookup the matcher walks.
//
// IT REFUSES AN AMBIGUOUS ALIAS RATHER THAN PICKING A WINNER. "Galouti Kebab"
// and "Kathal Galouti" both contain the token `galouti`; if both claimed the
// bare alias, every unqualified "the galouti was excellent" would be credited
// to whichever happened to be indexed first, and half the counts on two dishes
// would be quietly wrong. A wrong attribution is worse than a missed one,
// because it is invisible. The database enforces this too — alias is the
// PRIMARY KEY of menu_item_aliases — and this is the same rule in the one
// place that would otherwise bypass it, an in-memory index built from a list.
export function buildDishIndex(aliasRows) {
  const byAlias = new Map();
  let maxWords = 1;
  for (const row of aliasRows) {
    const alias = normalizeAlias(row.alias);
    if (!alias) throw new Error(`alias '${row.alias}' normalizes to nothing`);
    const existing = byAlias.get(alias);
    if (existing && existing.menuItemId !== row.menuItemId) {
      throw new Error(
        `ambiguous alias '${alias}': claimed by both '${existing.menuItemId}' and '${row.menuItemId}'. ` +
        `An alias must identify exactly one dish — qualify it (e.g. 'kathal galouti') or drop it.`
      );
    }
    const words = alias.split(' ').length;
    if (words > maxWords) maxWords = words;
    byAlias.set(alias, { menuItemId: row.menuItemId, alias, wordCount: words });
  }
  return { byAlias, maxWords };
}

// Finds every dish mention in one piece of text.
//
// LONGEST MATCH WINS AT A POSITION, and the match then consumes its tokens, so
// "kathal galouti" is one mention of the jackfruit dish rather than also a
// mention of anything claiming `galouti` alone.
//
// ORDER IS SIGNIFICANT — this walks a token SEQUENCE, never a bag of words, so
// "chocolate milk" cannot satisfy an alias of "milk chocolate". That
// distinction is the failure mode Salehian et al. (KDD 2017) document for
// exactly this task, and it is why aliases are phrases rather than keyword
// sets.
//
// `source` describes where the text came from and is copied onto every
// mention: { kind: 'review' | 'comment' | 'dm' | 'signal', id, at }.
export function findDishMentions(text, index, source = {}) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const spans = tokenizeWithSpans(text);
  const mentions = [];

  for (let i = 0; i < spans.length; i++) {
    const longestFirst = Math.min(index.maxWords, spans.length - i);
    for (let n = longestFirst; n >= 1; n--) {
      const candidate = spans.slice(i, i + n).map(s => s.token).join(' ');
      const hit = index.byAlias.get(candidate);
      if (!hit) continue;

      const start = spans[i].start;
      const end = spans[i + n - 1].end;
      mentions.push({
        menuItemId: hit.menuItemId,
        alias: hit.alias,
        // The guest's words as written, not the normalized form. "Corn
        // pakoras", not "corn pakora".
        matchedText: text.slice(start, end),
        start,
        end,
        // The whole fragment, so a screen can show the sentence around it.
        // These are short — a review, a comment, one DM — so there is nothing
        // to gain from windowing and something to lose: a clipped quote can
        // reverse what a guest meant.
        quote: text.trim(),
        source: { ...source },
      });
      i += n - 1;        // consume the matched span; the outer i++ moves past it
      break;
    }
  }
  return mentions;
}

// Rolls mentions up per dish WITHOUT losing the evidence. A caller that only
// wants the number can read `.count`, but it cannot get one without the
// sentences being right there beside it.
export function tallyMentions(mentions) {
  const byItem = new Map();
  for (const m of mentions) {
    if (!byItem.has(m.menuItemId)) byItem.set(m.menuItemId, { menuItemId: m.menuItemId, count: 0, evidence: [] });
    const bucket = byItem.get(m.menuItemId);
    bucket.count += 1;
    bucket.evidence.push(m);
  }
  return [...byItem.values()].sort((a, b) => b.count - a.count || a.menuItemId.localeCompare(b.menuItemId));
}
