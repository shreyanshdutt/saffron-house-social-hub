// What can actually be analysed for an establishment, and why.
//
// This is the server's own derivation, deriving from DATABASE rows rather than
// from mock.jsx's object shape — the server is the future source of truth and
// must not depend on the client. It is held to agreeing with
// establishmentAvailability() in src/mock.jsx for every seeded row, and
// test/seed-parity.test.js checks exactly that, because two implementations of
// one rule drift silently otherwise.
//
// Three tiers, unchanged in meaning from the client:
//   full    — a Google listing AND a readable, non-dormant Instagram account
//   ratings — a Google listing only; Business Discovery cannot read the rest
//   none    — no Google listing, so Places gives us no way in at all

export const STALE_AFTER_DAYS = 60;

const READABLE_TYPES = new Set(['business', 'creator']);

// `social` is the establishment_social rows for one establishment.
export function availability(est, social = []) {
  const reasons = [];
  const hasGoogle = est.business_status === 'OPERATIONAL';
  const ig = social.find(s => s.platform === 'instagram') || null;

  // `unknown` is NOT readable. Nothing has attempted a pull, so claiming the
  // account can be read is a guess, and the tier would promise data we cannot
  // yet produce. It resolves to a real type on the first attempt.
  const igReadable = !!ig && READABLE_TYPES.has(ig.account_type);
  const stale = !!(ig && ig.last_post_days_ago && ig.last_post_days_ago > STALE_AFTER_DAYS);

  if (hasGoogle) {
    reasons.push({ ok: true, text: `Google listing — ${Number(est.rating).toFixed(1)}★, ${est.user_ratings_total} reviews` });
  } else {
    reasons.push({ ok: false, text: 'No Google listing — delivery-only kitchens often have none, and Places is the only way in' });
  }

  if (!ig || ig.account_type === 'absent') {
    reasons.push({ ok: false, text: 'No Instagram account found' });
  } else if (ig.account_type === 'unknown') {
    reasons.push({ ok: false, text: 'Instagram account not yet verified — no Business Discovery attempt has been made' });
  } else if (igReadable) {
    reasons.push({
      ok: !stale,
      text: stale
        ? `Instagram ${ig.account_type} account, but last posted ${ig.last_post_days_ago} days ago — readable, nothing to compare`
        : `Instagram ${ig.account_type} account — Business Discovery can read it`,
    });
  } else {
    reasons.push({
      ok: false,
      text: `Instagram account is ${ig.account_type} — Business Discovery cannot read ${ig.account_type} accounts at all`,
    });
  }

  if (social.some(s => s.platform === 'x' && s.handle)) {
    reasons.push({ ok: false, text: 'X handle exists, but reading posts needs a paid API tier — not counted toward availability' });
  }

  const tier = !hasGoogle ? 'none' : (igReadable && !stale ? 'full' : 'ratings');
  return { tier, reasons, hasGoogle, igReadable, stale };
}
