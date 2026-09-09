// THE ONLY PLACE THAT WOULD TALK TO A PLATFORM. Every adapter here is a stub.
//
// THIS FILE IS THE SEAM. When credentials arrive, exactly one function per
// channel changes — the publish path in repo.js, the failure vocabulary, the
// target rows and the cost report are all already real and already tested. It
// is named `publish-adapters.js` so nobody has to go looking for where the
// network call would live.
//
// NOTHING HERE MAKES A NETWORK CALL, and nothing here may until the owner has
// recorded a decision the way CONVENTIONS.md §10 requires for Places. A
// `fetch` added to this file is a change of kind, not of degree.

// What a real adapter would cost, per channel, per attempt.
//
// `billed` means a call draws MONEY rather than a quota unit — the same
// distinction `channels.js` draws for reads, and it is carried per channel
// because the answer genuinely differs:
//
//   x               — BILLED. X made pay-per-use the default on 6 Feb 2026 and
//                     there is no free tier for new developers; writes are
//                     charged like reads.
//   instagram       — not billed. Content Publishing is quota-limited (a
//                     rolling 24-hour post quota), not charged per call.
//   google_business — not billed. This is the Business Profile API on the
//                     restaurant's OWN listing, which is free. It is NOT
//                     Places — Places is billed per call, but Places is a read
//                     API for OTHER people's listings and is never on a
//                     publish path. Conflating the two would put a price on
//                     the wrong thing.
//   whatsapp        — not billed for this path. Meta charges per conversation
//                     for outbound messaging, but a post is not a conversation
//                     and this adapter does not open one.
//   youtube         — not billed. Data API v3 writes are quota-metered.
const CHANNEL_COST = {
  instagram:       { calls: 1, billed: false, api: 'Instagram Graph API — Content Publishing' },
  google_business: { calls: 1, billed: false, api: 'Google Business Profile API — localPosts' },
  whatsapp:        { calls: 1, billed: false, api: 'WhatsApp Cloud API' },
  x:               { calls: 1, billed: true,  api: 'X API v2 — POST /2/tweets' },
  youtube:         { calls: 1, billed: false, api: 'YouTube Data API v3' },
};

// Computed BEFORE the attempt runs and returned with its result, per
// CONVENTIONS.md §10: an external call is money or quota, and a run that
// cannot say what it would cost cannot be reasoned about afterwards.
//
// Only channels that would actually be CALLED are counted. A channel whose
// connection is missing or lapsed never reaches an adapter, so it costs
// nothing — counting it would overstate the bill and hide which channel the
// money is really going to.
export function publishPlan(platformsThatWouldBeCalled) {
  const calls = [];
  for (const platform of platformsThatWouldBeCalled) {
    const cost = CHANNEL_COST[platform];
    if (!cost) continue;
    calls.push({ platform, api: cost.api, calls: cost.calls, billed: cost.billed });
  }
  return {
    totalCalls: calls.reduce((n, c) => n + c.calls, 0),
    billedCalls: calls.filter(c => c.billed).reduce((n, c) => n + c.calls, 0),
    billedPlatforms: calls.filter(c => c.billed).map(c => c.platform),
    calls,
  };
}

// The stub itself. One shape for every channel, so the caller has one thing to
// handle and the day a real adapter lands it returns the same shape.
//
// It reports `not_implemented` rather than throwing, because "we have no code
// for this yet" is an OUTCOME worth recording against the target, not an
// exception to swallow. A user who presses Publish gets a row that says so.
const NOT_BUILT = (platform) => ({
  ok: false,
  failureKind: 'not_implemented',
  reason: `Publishing to ${platform} is not built yet. The channel is connected, but nothing in this build sends a post — no request is made.`,
  externalId: null,
});

export const ADAPTERS = {
  instagram:       async () => NOT_BUILT('Instagram'),
  google_business: async () => NOT_BUILT('Google Business Profile'),
  whatsapp:        async () => NOT_BUILT('WhatsApp'),
  x:               async () => NOT_BUILT('X'),
  youtube:         async () => NOT_BUILT('YouTube'),
};

// A single entry point, so repo.js never indexes ADAPTERS directly and an
// unknown channel cannot fall through as `undefined` and be treated as success.
export async function callAdapter(platform, post) {
  const adapter = ADAPTERS[platform];
  if (!adapter) {
    return {
      ok: false,
      failureKind: 'api_error',
      reason: `No adapter exists for '${platform}'.`,
      externalId: null,
    };
  }
  return adapter(post);
}
