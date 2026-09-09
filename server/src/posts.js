// The post lifecycle, and the ONE place a per-channel outcome is collapsed
// into a single line for a screen.
//
// The database keeps two facts apart on purpose (see schema.sql): what the
// user ASKED FOR is `posts.state`, what HAPPENED is `post_targets.status`.
// Screens still sometimes need one word. That word is derived HERE, once,
// where it is tested — not computed in the client, and never written back to
// the post row, because the moment it is stored it starts disagreeing with the
// targets it came from.

export const POST_STATES = ['draft', 'scheduled', 'sending', 'attempted'];
export const TARGET_STATUSES = ['pending', 'published', 'failed', 'skipped'];

// The client speaks in two-letter channel ids (CLAUDE.md §9); `connections`
// and `post_targets` speak in full platform names. One translation table, at
// the edge, so a join never silently fails to match.
export const CHANNEL_BY_CLIENT_ID = {
  ig: 'instagram',
  gg: 'google_business',
  wa: 'whatsapp',
  x: 'x',
  yt: 'youtube',
};
export const CLIENT_ID_BY_CHANNEL = Object.fromEntries(
  Object.entries(CHANNEL_BY_CLIENT_ID).map(([k, v]) => [v, k])
);
export const PUBLISHABLE_CHANNELS = Object.values(CHANNEL_BY_CLIENT_ID);

// Accepts either spelling and returns the canonical platform, or null. Null is
// the caller's problem to report; guessing would put a post on a channel the
// user did not choose.
export function normaliseChannel(id) {
  if (typeof id !== 'string') return null;
  const key = id.trim().toLowerCase();
  if (CHANNEL_BY_CLIENT_ID[key]) return CHANNEL_BY_CLIENT_ID[key];
  return PUBLISHABLE_CHANNELS.includes(key) ? key : null;
}

// ONE LINE FOR A SCREEN, WITHOUT PRETENDING THE OUTCOMES AGREE.
//
// `outcome` is deliberately not a post state and is never persisted:
//   not_attempted — nothing has been tried yet (draft / scheduled).
//   in_flight     — an attempt is running.
//   published     — every target succeeded. The only case the word is true.
//   failed        — every target failed.
//   mixed         — some succeeded and some did not. THIS IS THE CASE THAT
//                   MATTERS: it is why the post row has no 'published' state,
//                   and a screen showing `mixed` must show the targets too.
export function summarisePost(post, targets = []) {
  const counts = { pending: 0, published: 0, failed: 0, skipped: 0 };
  for (const t of targets) counts[t.status] = (counts[t.status] || 0) + 1;

  const settled = counts.published + counts.failed;
  let outcome;
  if (post.state === 'sending') outcome = 'in_flight';
  else if (!targets.length || settled === 0) outcome = 'not_attempted';
  else if (counts.failed === 0 && counts.published > 0) outcome = 'published';
  else if (counts.published === 0 && counts.failed > 0) outcome = 'failed';
  else outcome = 'mixed';

  return {
    outcome,
    counts,
    // A short sentence a screen may print verbatim. It names both halves when
    // they disagree rather than picking the flattering one.
    label: {
      not_attempted: post.state === 'scheduled' ? 'Scheduled' : 'Draft',
      in_flight: 'Sending',
      published: `Published to ${counts.published} channel${counts.published === 1 ? '' : 's'}`,
      failed: `Failed on ${counts.failed} channel${counts.failed === 1 ? '' : 's'}`,
      mixed: `Published to ${counts.published}, failed on ${counts.failed}`,
    }[outcome],
    // Every distinct failure reason, so a caller never has to re-derive them
    // from the target list to show "why".
    failures: targets
      .filter(t => t.status === 'failed')
      .map(t => ({ platform: t.platform, failureKind: t.failureKind, reason: t.reason })),
  };
}
