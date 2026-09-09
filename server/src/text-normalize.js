// Normalizing guest text so a dish name can be found in it. Pure, no I/O.
//
// WHY THIS PROBLEM IS MUCH SMALLER THAN IT LOOKS, and the reason the rest of
// this file is thirty lines rather than a language pipeline:
//
//   DISH NAMES SURVIVE HINGLISH INTACT. Nobody translates "biryani". A guest
//   writing "khana was bohut acha, biryani ekdum mast thi" has switched
//   language around the dish and not for it. The dish name is the anchor; the
//   language surrounding it is irrelevant to a mention COUNT. We are not
//   reading the sentence, we are finding a noun in it.
//
// That reframing is what makes this tractable offline with no dependency. What
// follows is what was tried before arriving at it, recorded so the next reader
// does not spend an afternoon rediscovering it.
//
// ---------------------------------------------------------------------------
// NEGATIVE RESULTS. All tested 2026-09-09. None of these is a candidate.
//
//   franc 6.2.0 — language detection. Classified
//     "khana was bohut acha, biryani ekdum mast thi"      -> Ayacucho Quechua, confidence 1.00
//     "service bakwas thi, 40 minute wait karna pada"     -> Luo,              confidence 1.00
//     Devanagari Hindi                                    -> "Magahi"
//     Only plain English came back correct. This is not a bug in franc:
//     Romanized Hindi IS Latin script, so a script-and-n-gram detector has
//     nothing to key on. Confidence 1.00 on a wrong answer is the danger —
//     it would read as certainty to any caller that trusted it.
//
//   transliteration 2.6.1 — runs the wrong way. Devanagari in, Latin out.
//     Latin input passes through unchanged, which is silent, not an error.
//
//   @indic-transliteration/sanscript — requires scheme-conformant input
//     (ITRANS, Harvard-Kyoto, IAST). "bohut" is not ITRANS; it is how a person
//     types. Guest text is never scheme-conformant.
//
//   Romanized-Hindi SENTIMENT lexicon — none exists publicly. Every published
//     pipeline routes Latin -> Devanagari -> Hindi SentiWordNet, and that
//     middle step has no free, offline, deterministic option. HSWN itself is
//     Devanagari and is gated behind a request form with no stated licence.
//     This is moot here anyway: the owner ruled on 2026-09-09 that this
//     feature counts mentions and shows evidence, and carries NO sentiment
//     score — not a column, not a field, not a placeholder.
//
//   Levenshtein distance against an English wordlist — DOES work offline, and
//     is the one useful idea in that literature (vipul-khatana/
//     Hinglish-Sentiment-Analysis, MIT). Recorded as a future option and
//     deliberately NOT built: it detects whether a WORD is English, and
//     counting a dish mention needs the dish name, not the surrounding
//     language.
// ---------------------------------------------------------------------------

// Romanized Hindi has no standard spelling, so the same dish arrives spelled
// several ways. This map folds them to one form before matching.
//
// IT IS DATA, NOT CODE, AND IT IS DELIBERATELY SMALL. It covers the vocabulary
// of THIS menu and nothing else. Every entry should be here because someone
// saw a guest write it — it grows from real guest text, never from guessing at
// what a person might type. A speculative variant costs nothing to add and
// silently widens what counts as a mention, which is how a count stops being
// checkable.
export const SPELLING_VARIANTS = {
  biryani: ['biriyani', 'biriani', 'briyani', 'biryaani'],
  galouti: ['galauti', 'gilouti', 'galoti', 'galawati'],
  kebab:   ['kabab', 'kebap', 'kabob'],
  pakora:  ['pakoda', 'bhajji'],
  paneer:  ['panir'],
  kheer:   ['khir'],
  pulao:   ['pilaf', 'pulav', 'pilau'],
  kathal:  ['katahal'],
  tikka:   ['tika'],
  masala:  ['masaala'],
};

// Inverted once, at module load: variant -> canonical.
const CANONICAL_BY_VARIANT = (() => {
  const m = new Map();
  for (const [canonical, variants] of Object.entries(SPELLING_VARIANTS)) {
    m.set(canonical, canonical);
    for (const v of variants) {
      if (m.has(v) && m.get(v) !== canonical) {
        throw new Error(`spelling variant '${v}' maps to both '${m.get(v)}' and '${canonical}'`);
      }
      m.set(v, canonical);
    }
  }
  return m;
})();

// Lowercase, strip punctuation, collapse whitespace. Unicode-aware so that an
// accented or Devanagari character is kept rather than silently deleted —
// dropping characters we do not understand would join two words into one and
// invent a token nobody wrote.
export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[‘’“”]/g, '')      // smart quotes, before the class below
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')              // any punctuation or emoji -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// A single token, folded to its canonical spelling.
//
// The trailing-'s' rule is the one piece of morphology here and it is
// deliberate: guests write "corn pakoras" and "the kebabs", and an alias list
// that had to carry every plural would double in size and still miss one. It
// is applied ONLY when stripping the 's' yields a word we already know, so
// "gas" does not become "ga" and an unknown word is left exactly as written.
export function canonicalToken(token) {
  const t = token.toLowerCase();
  if (CANONICAL_BY_VARIANT.has(t)) return CANONICAL_BY_VARIANT.get(t);
  // ONLY when the singular is a word this map already knows. Stripping 's'
  // from anything else invents tokens: an earlier draft turned "this" into
  // "thi" and "was" into "wa", which is a silent corruption of every sentence
  // it touches. An unknown word is left exactly as the guest wrote it.
  if (t.endsWith('s')) {
    const singular = t.slice(0, -1);
    if (CANONICAL_BY_VARIANT.has(singular)) return CANONICAL_BY_VARIANT.get(singular);
  }
  return t;
}

// THE PRIMITIVE: canonical tokens WITH their offsets into the original string.
//
// Offsets are kept because the evidence a screen shows must be the guest's own
// words as they wrote them — "Corn pakoras", not the normalized "corn pakora".
// Reconstructing the span from normalized text is impossible once punctuation
// runs have been collapsed, so the original is walked directly and never
// rewritten.
//
// Word boundaries fall out of this walk: a token is a maximal run of letters
// and digits, so "pakora" cannot match inside "pakorawala" — that is one token
// and tokens are compared whole.
export function tokenizeWithSpans(input) {
  if (typeof input !== 'string' || !input) return [];
  const out = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(input)) !== null) {
    out.push({
      token: canonicalToken(m[0]),
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

// Text -> canonical tokens. One implementation, derived from the primitive, so
// the matcher and any other caller cannot drift apart on what a token is.
export function tokenize(input) {
  return tokenizeWithSpans(input).map(t => t.token);
}

// The stored form of an alias. Aliases go into the database through this, so
// the UNIQUE constraint on menu_item_aliases.alias guards the same strings the
// matcher will later compare.
export function normalizeAlias(alias) {
  return tokenize(alias).join(' ');
}
