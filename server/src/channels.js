// What we can know about a competitor, per channel.
//
// TWO DIFFERENT THINGS MULTIPLY HERE, AND THIS FILE KEEPS THEM APART.
//
//   (a) What a channel's API can EVER return. A static fact about the
//       platform. No account, budget or permission changes it — Instagram
//       will not return comment text at any price, ever.
//   (b) Whether THIS establishment has a readable account on that channel.
//       A per-row fact, from establishment_social.
//
// A capability is the product of the two, and when it comes out false the
// reason has to say WHICH SIDE produced the no. Collapsing them is how a
// screen ends up saying "we can't read their comments" when the truth is
// "they have no account there" — a different problem with a different fix,
// and one the user can actually act on. The codebase already draws this line
// (absent vs unknown in 3949f8b; the two constrained tiers in 98ff5d8) and
// this follows it.
//
// This sits BESIDE the full/ratings/none tier in availability.js. That tier
// keeps its exact meaning — Instagram readability plus a Google listing — and
// nothing here feeds back into it.

export const CAPABILITIES = ['posts', 'commentText', 'ratings', 'reviewText'];

// (a) The static half. What each platform's API can return, and what it costs.
//
// `billed` means a read draws real money per call rather than a quota unit.
// It is carried per CAPABILITY, not per platform, because on X the two differ
// enormously in volume: a competitor's replies run roughly ten times the cost
// of their posts, so the expensive path has to be switchable without turning
// the channel off (see POSTS AND COMMENT TEXT ARE SEPARATE, below).
export const CHANNEL_CAPABILITIES = {
  instagram: {
    api: 'Instagram Graph API — Business Discovery',
    posts: {
      supported: true, billed: false,
      why: 'Business Discovery returns the media edge for public Business and Creator accounts.',
    },
    commentText: {
      supported: false, billed: false,
      // The single most load-bearing line in this file. It is why the product
      // has never shown competitor sentiment and never will from Instagram.
      why: 'Business Discovery returns comment COUNTS, never comment text. This is a hard API limit, not a permission or a price — there is nothing to classify, at any tier.',
    },
    ratings: { supported: false, billed: false, why: 'Instagram has no rating.' },
    reviewText: { supported: false, billed: false, why: 'Instagram has no reviews.' },
  },

  youtube: {
    api: 'YouTube Data API v3',
    posts: {
      supported: true, billed: false,
      why: 'Public videos are readable with an API key. Quota-metered, not billed per call.',
    },
    commentText: {
      supported: true, billed: false,
      // The reason YouTube is worth having at all: it is the only channel here
      // that gives competitor comment TEXT without a per-read price.
      why: 'commentThreads returns full comment text for public videos with an API key, at 1 quota unit per call. This is the only channel that answers this question without being billed per read.',
    },
    ratings: { supported: false, billed: false, why: 'YouTube has no business rating.' },
    reviewText: { supported: false, billed: false, why: 'YouTube has no reviews.' },
  },

  x: {
    api: 'X API v2',
    posts: {
      supported: true, billed: true,
      why: 'Readable, but billed per read. X made pay-per-use the default on 6 Feb 2026 and there is no free tier for new developers.',
    },
    commentText: {
      supported: true, billed: true,
      why: 'Replies are readable and are where essentially all of the cost lands — a competitor\'s replies run roughly ten times the volume of their posts, at the same per-read price.',
    },
    ratings: { supported: false, billed: false, why: 'X has no rating.' },
    reviewText: { supported: false, billed: false, why: 'X has no reviews.' },
  },

  google: {
    api: 'Google Places / Business Profile',
    posts: { supported: false, billed: false, why: 'Places does not expose a competitor post feed.' },
    commentText: { supported: false, billed: false, why: 'Places does not expose comment text.' },
    ratings: {
      supported: true, billed: true,
      why: 'Places Details returns rating and user_ratings_total. Billed per call, and the content is retention-capped (CONVENTIONS.md §10).',
    },
    reviewText: {
      supported: false, billed: false,
      // Distinct from ratings on purpose: the number is obtainable, the words
      // are not, and the product has always said so.
      why: 'Review TEXT for someone else\'s listing is not ours to store or show. The rating and the count are; the words are not.',
    },
  },
};

// Channels that describe a social account on an establishment. `google` is a
// listing rather than an account, so it is not in establishment_social and is
// resolved from the establishment row instead.
export const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'x'];

const READABLE_TYPES = new Set(['business', 'creator']);

// (b) The per-establishment half. Deliberately mirrors availability.js's
// vocabulary — `unknown` is NOT readable, and "no row at all" is a different
// state from "we looked and there is none".
export function accountState(row) {
  if (!row) return { state: 'no-account', readable: false, why: 'No account recorded on this channel. Nobody has looked — that is not the same as there being none.' };
  if (row.account_type === 'absent') return { state: 'absent', readable: false, why: 'We looked and there is no account on this channel.' };
  if (row.account_type === 'unknown') return { state: 'unverified', readable: false, why: 'A handle is recorded but nothing has read the account yet, so what it can return is unknown.' };
  if (!READABLE_TYPES.has(row.account_type)) {
    return { state: row.account_type, readable: false, why: `The account is ${row.account_type} — the API cannot read ${row.account_type} accounts at all.` };
  }
  return { state: row.account_type, readable: true, why: `Readable ${row.account_type} account.` };
}

// The product of (a) and (b), per channel, per capability.
//
// `blockedBy` is the field that keeps the two apart:
//   'platform' — the API cannot answer this, ever. An account would not help.
//   'account'  — the API could, but this establishment has nothing readable.
//   null       — available.
// Platform beats account when both are false, because the platform limit is
// the unfixable one: getting the account would still not produce the data.
export function channelCapabilities(est, social = []) {
  const out = {};
  for (const [platform, spec] of Object.entries(CHANNEL_CAPABILITIES)) {
    const isSocial = SOCIAL_PLATFORMS.includes(platform);
    const row = isSocial ? (social.find(s => s.platform === platform) || null) : null;

    // Google is a listing, not an account: readability is whether the
    // establishment has an operational listing at all.
    const account = isSocial
      ? accountState(row)
      : (est.business_status === 'OPERATIONAL'
          ? { state: 'listed', readable: true, why: 'Google listing is operational.' }
          : { state: 'no-account', readable: false, why: 'No Google listing — Places is the only way in and there is nothing to look up.' });

    const capabilities = {};
    for (const cap of CAPABILITIES) {
      const p = spec[cap];
      const platformCan = !!p.supported;
      const available = platformCan && account.readable;
      capabilities[cap] = {
        available,
        billed: !!p.billed,
        blockedBy: available ? null : (platformCan ? 'account' : 'platform'),
        // The reason names the side that said no. When the platform cannot do
        // it, the account is irrelevant and saying otherwise would send
        // someone off to fix the wrong thing.
        reason: available ? null : (platformCan ? account.why : p.why),
      };
    }

    out[platform] = {
      api: spec.api,
      handle: row ? row.handle : null,
      accountState: account.state,
      accountReadable: account.readable,
      capabilities,
    };
  }
  return out;
}

// Every capability that would cost money if it were read, for a given set of
// channel records. This is DATA for a caller that plans a fan-out — it is not
// itself the planning surface CONVENTIONS.md §10 requires, because no
// server-side job fans out over tracked establishments yet. See the report.
export function billedCapabilities(channels) {
  const out = [];
  for (const [platform, ch] of Object.entries(channels)) {
    for (const cap of CAPABILITIES) {
      const c = ch.capabilities[cap];
      if (c.available && c.billed) out.push({ platform, capability: cap });
    }
  }
  return out;
}
