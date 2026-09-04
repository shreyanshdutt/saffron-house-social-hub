// The change-over-time derivations, moved here from src/mock.jsx in this
// commit. They live server-side for one reason: this is where they can be
// tested. Two implementations of one rule drift silently, and the client's
// copy is deleted rather than kept in sync.
//
// Ported verbatim in behaviour from mock.jsx as of 40c9100 — the numbers it
// produced must not move, and test/derive.test.js pins the seven seeded
// figures from 3eb4344's report to prove it.

// Below this the window is too short to scale. Two readings four minutes
// apart give a real delta and a meaningless rate; multiplying it out would
// manufacture ten thousand a month from one extra review.
export const MIN_WINDOW_DAYS = 7;

export const SERIES_METRICS = {
  // Reviews scale to a monthly rate.
  reviews: {
    read: (s) => s.reviews,
    compute: (first, last, windowDays, read) => Math.round(((read(last) - read(first)) / windowDays) * 30),
  },
  // Followers are a percent change across the window, not a rate — a follower
  // count is a level, and "+3.8%" is what a level's movement means.
  followers: {
    read: (s) => s.followers,
    compute: (first, last, windowDays, read) => +(((read(last) - read(first)) / read(first)) * 100).toFixed(1),
  },
  // Engagement is the percent change in interactions ÷ followers. It needs
  // BOTH fields on a sample: one without the other cannot produce a ratio, so
  // such a sample is not an observation of this metric even though it is an
  // observation of the other two.
  engagement: {
    read: (s) => (s.followers > 0 ? s.avgInteractions / s.followers : undefined),
    compute: (first, last, windowDays, read) => +(((read(last) - read(first)) / read(first)) * 100).toFixed(1),
  },
};

// The ONE derivation path, shared by all three metrics. Three states, and they
// are not interchangeable:
//   none      — under 2 OBSERVATIONS of this metric. Never measured at all.
//   measuring — 2+ observations less than MIN_WINDOW_DAYS apart. The delta is
//               real and is reported; `value` stays null.
//   rate      — 7+ days apart. `value` is the metric's computed figure.
// The client must render neither `none` nor `measuring` as an em dash or a
// zero, both of which read as a measured nothing (CLAUDE.md §11 trap 1). The
// state travels over the wire so the client cannot lose that distinction.
export function changeFromSeries(series, metricId) {
  const m = SERIES_METRICS[metricId];
  // A sample from a call that was skipped simply does not carry the field.
  // That is "not observed" — drop it rather than letting undefined reach the
  // arithmetic. In SQL the same statement is a NULL column.
  const obs = (Array.isArray(series) ? series : []).filter(s => s && Number.isFinite(m.read(s)));
  const samples = obs.length;
  if (samples < 2) {
    return { state: 'none', samples, windowDays: null, delta: null, value: null };
  }
  const first = obs[0];
  const last = obs[samples - 1];
  const windowDays = (Date.parse(last.at) - Date.parse(first.at)) / 86_400_000;
  const delta = m.read(last) - m.read(first);
  // Negated comparison so a NaN window falls to `measuring` rather than
  // producing a NaN figure.
  if (!(windowDays >= MIN_WINDOW_DAYS)) {
    return { state: 'measuring', samples, windowDays, delta, value: null };
  }
  return { state: 'rate', samples, windowDays, delta, value: m.compute(first, last, windowDays, m.read) };
}

// Review velocity keeps its own name and its `perMonth` field, because the
// Insights card, the sync report and the review-velocity rule all read it.
export function velocityFromSeries(series) {
  const c = changeFromSeries(series, 'reviews');
  return { state: c.state, samples: c.samples, windowDays: c.windowDays, delta: c.delta, perMonth: c.value };
}

// The newest sample that carries a given field, or null. Used for "current"
// values — a follower count is the newest reading, not a separately stored
// number, which is why LISTENING_COMPETITORS does not become a table.
export function newestWith(series, field) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (Number.isFinite(series[i][field])) return series[i];
  }
  return null;
}
