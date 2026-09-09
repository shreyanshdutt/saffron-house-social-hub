// Recommendation engine.
//
// Turns the listening / review / menu / analytics data into a ranked list of
// things a human should actually do this week. Every recommendation is
// COMPUTED from the datasets — none are hand-written — so changing the seed
// data changes the output, and the engine can be pointed at live data later
// without touching the screen that renders it.
//
// Design constraints, in priority order:
//
//   1. Explainable over clever. Every recommendation carries the evidence that
//      produced it, with the actual numbers, and the score arithmetic is shown
//      in the UI. An owner who cannot see why will not act, and should not.
//   2. Actions happen outside this app. The output is a briefing, not a button
//      that posts for you: "tell the kitchen", "update the Google listing",
//      "brief the floor". Each carries an owner and a place.
//   3. No invented causality. The engine never claims "this will raise your
//      rating by 0.2". It states what is true (a review past SLA, nothing
//      scheduled on your best day) and what it projects, labelled as
//      projection with the arithmetic attached.
//
//      FOUR DISH RULES WERE REMOVED for failing this test, not for being
//      unpopular: rising-dish, sinking-dish, menu-discoverability and
//      price-resistance all keyed on `sentiment`, `sentimentDelta` and
//      `topComplaint` fields that were invented in mock.jsx. Advice founded on
//      a fabricated number is invented causality wearing a citation. If they
//      come back it will be over the real mention counts.
//
// Adding a rule: append to REC_RULES. A rule takes the context and returns
// zero or more recommendation objects. It must attach evidence with sources.

// --- Evidence provenance -----------------------------------------------------
// Every evidence row names where the number would come from in production.
// This is not decoration: it is the difference between a recommendation you
// can ship on day one and one that needs a middleware contract first. See
// DATA-SOURCES.md for the full map.
const REC_SOURCES = {
  ig:        { label: 'Instagram Graph API',        tier: 'api',     note: 'First-party, pollable' },
  gbp:       { label: 'Google Business Profile',    tier: 'api',     note: 'First-party, needs allowlisting' },
  gbpPerf:   { label: 'GBP Performance API',        tier: 'api',     note: 'Daily granularity' },
  wa:        { label: 'WhatsApp Cloud API',         tier: 'api',     note: 'Real-time webhooks' },
  gbpQanda:  { label: 'GBP Q&A API',                tier: 'api',     note: 'Public questions, polled' },
  nlp:       { label: 'Your NLP over guest text',   tier: 'derived', note: 'Computed from text you already hold' },
  pos:       { label: 'POS / booking system',       tier: 'own',     note: 'Your own system' },
  internal:  { label: 'This hub',                   tier: 'own',     note: 'Scheduling + reply state' },
  publicApi: { label: 'IG Business Discovery',      tier: 'partial', note: 'Competitor public counts only — no reach' },
};

const REC_TIER_LABEL = {
  api:     'Live via API',
  derived: 'Derived in-house',
  own:     'Your own data',
  partial: 'Partial / approximate',
};

// --- Recommendation kinds ----------------------------------------------------
const REC_KINDS = {
  content: { label: 'Content',   icon: 'Camera',          hint: 'A post to publish' },
  promo:   { label: 'Promotion', icon: 'Tag',             hint: 'An offer or deal' },
  event:   { label: 'Event',     icon: 'CalendarDays',    hint: 'A seating or ticketed night' },
  reply:   { label: 'Reply',     icon: 'MessageSquare',   hint: 'Guest response owed' },
  menu:    { label: 'Menu',      icon: 'UtensilsCrossed', hint: 'A menu or pricing change' },
  ops:     { label: 'Operations',icon: 'Wrench',          hint: 'Kitchen, packing or floor' },
  fix:     { label: 'Fix',       icon: 'AlertTriangle',   hint: 'Something is broken' },
};

// --- Small helpers -----------------------------------------------------------
function median(nums) {
  const a = [...nums].filter(n => typeof n === 'number' && !Number.isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Does a piece of copy actually feature this dish? Requires every significant
// word in the dish name, so "Kathal Galouti" is not satisfied by a post about
// the meat galouti — which is exactly the confusion that would make the engine
// tell you to promote something you already promoted.
function mentionsDish(text, dishName) {
  const hay = (text || '').toLowerCase();
  const words = dishName.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
  return words.length > 0 && words.every(w => hay.includes(w));
}

function dishHasCoverage(dish, ctx) {
  const recent = [...ctx.posts, ...ctx.scheduled];
  return recent.some(p => mentionsDish(p.content, dish.name));
}

function daysAgo(iso, now) {
  return (now - new Date(iso).getTime()) / 86_400_000;
}

// --- Context -----------------------------------------------------------------
// Built once per generation so rules never re-derive the same aggregate.
function buildRecommendationContext() {
  const now = Date.now();
  // Posts that HAVE a reach figure. Previously this filtered on the post's
  // status and then read `p.metrics.reach` as though every published post had
  // one; with metrics per target, having the number is the actual condition.
  const withReach = measuredPosts().filter(p => p.metrics && p.metrics.reach > 0);
  const publishedReach = withReach.map(p => p.metrics.reach);

  return {
    now,
    // Adapted server posts. The engine keeps its own vocabulary — `content`,
    // `format`, `platforms`, `metrics` — and gains `outcome`, which is the
    // server's word for what happened and replaces the old `status` on the
    // three rules that branched on it.
    posts: allPosts(),
    scheduled: scheduledPosts(),
    reviews: REVIEWS,
    reviewStats: REVIEW_STATS,
    signals: LISTENING_SIGNALS,
    // Only what the user marked on the Establishments screen, so the
    // engine compares against the set they actually chose.
    // The tracked set and every rate over it are derived on the server. This
    // stays synchronous because the Actions screen renders inside
    // <RequiresServerData>, so the snapshot is loaded before any rule runs.
    competitors: serverData().competitors.map(mergeCompetitor),
    self: SAF_SELF_STATS,
    // Our own velocity is derived from the same stored review-count history as
    // every rival's, under the reserved `saf-self` key, so both sides of the
    // comparison come from one code path.
    selfVelocity: serverData().self
      ? serverData().self.velocity
      : { state: 'none', samples: 0, windowDays: null, delta: null, perMonth: null },
    analytics: ANALYTICS_IG.daily,
    trends: LISTENING_TRENDS,
    medianReach: median(publishedReach),
    slaMins: REVIEW_STATS.slaMins,
  };
}


// --- Rules -------------------------------------------------------------------
// Each returns an array of recommendations. impact / confidence / effort are
// 0–1 weights; see scoreRecommendation() for how they combine.
const REC_RULES = [
  // ---------------------------------------------------------------------
  // The Google listing is where intent-to-visit is decided, and its funnel is
  // fully instrumented by the Performance API. A listing seen 56k times that
  // produces 96 bookings is not a marketing problem, it is a conversion one —
  // and the fixes are free.
  {
    id: 'gbp-conversion',
    title: 'Google listing conversion',
    run(ctx) {
      const g = ANALYTICS_GG;
      const impressions = g.totals.searchImpressions + g.totals.mapsImpressions;
      const actions = g.totals.directionRequests + g.totals.callClicks + g.totals.websiteClicks + g.totals.bookings;
      const rate = actions / impressions;
      // Below ~7% of impressions producing any action, the listing itself is
      // the bottleneck rather than demand.
      if (rate >= 0.07) return [];
      const photos = g.photos;

      return [{
        kind: 'ops',
        title: `Your Google listing converts at ${(rate * 100).toFixed(1)}% — the traffic is already there`,
        detail: `${fmt(impressions)} people saw the listing this week and ${fmt(actions)} did anything about it. That is not a demand problem; it is a shop-window problem. The three things that move this are recent photos, answered questions, and replied-to reviews — all free, all within your control, and the listing has had ${photos.addedLast30d} new photos in 30 days.`,
        action: 'Add 8–10 fresh photos and answer the open questions',
        owner: 'executive',
        where: 'Google Business Profile',
        channels: ['gg'],
        window: 'This week',
        evidence: [
          { label: 'Impressions (7d)', value: `${fmt(g.totals.searchImpressions)} search + ${fmt(g.totals.mapsImpressions)} maps`, source: 'gbpPerf' },
          { label: 'Actions taken', value: `${fmt(actions)} (${(rate * 100).toFixed(1)}%)`, source: 'gbpPerf' },
          { label: 'Bookings', value: `${fmt(g.totals.bookings)}`, source: 'gbpPerf' },
          { label: 'Photos added in 30d', value: `${photos.addedLast30d} — last one ${photos.lastAddedDaysAgo} days ago`, source: 'gbp' },
        ],
        impact: 0.85,
        confidence: 0.75,
        effort: 0.25,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // Anyone can answer a question on a Google listing, including people who
  // have never eaten here. An unanswered question is a stranger's guess
  // waiting to become the top answer — and it is answered in public, forever.
  {
    id: 'gbp-qanda',
    title: 'Unanswered questions on the listing',
    run(ctx) {
      const qa = ANALYTICS_GG.qanda;
      if (!qa || qa.open < 3) return [];
      return [{
        kind: 'reply',
        title: `${qa.open} questions on your Google listing have no answer from you`,
        detail: `${qa.answeredByPublic} of your listing's questions were answered by members of the public rather than by you — those answers are now what a prospective guest reads, and nobody checked them. The oldest unanswered question has been sitting for ${qa.oldestOpenDays} days. Answering is free and takes ten minutes.`,
        action: 'Answer all open questions, and post the common ones yourself',
        owner: 'srexec',
        where: 'Google Business Profile → Q&A',
        channels: ['gg'],
        window: 'Today',
        evidence: [
          { label: 'Open questions', value: `${qa.open}`, source: 'gbpQanda' },
          { label: 'Answered by strangers', value: `${qa.answeredByPublic}`, source: 'gbpQanda' },
          { label: 'Oldest unanswered', value: `${qa.oldestOpenDays} days`, source: 'gbpQanda' },
          { label: 'Answered by you', value: `${qa.answeredByUs}`, source: 'gbpQanda' },
        ],
        impact: 0.7,
        confidence: 0.9,
        effort: 0.15,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // WhatsApp allows free-form replies for 24 hours after a guest messages you.
  // Miss the window and the only way back is an approved template, billed per
  // message. This rule is a cost control as much as a service one.
  {
    id: 'wa-window',
    title: 'WhatsApp service windows closing',
    run(ctx) {
      const closing = CONVERSATIONS.filter(c =>
        c.platform === 'wa' &&
        typeof c.windowMinsLeft === 'number' &&
        c.windowMinsLeft > 0 &&
        c.windowMinsLeft < 240 &&
        c.unread > 0
      );
      if (!closing.length) return [];
      const soonest = closing.sort((a, b) => a.windowMinsLeft - b.windowMinsLeft)[0];
      const mins = soonest.windowMinsLeft;

      return [{
        kind: 'reply',
        title: `${closing.length} WhatsApp conversation${closing.length > 1 ? 's' : ''} about to fall outside the free reply window`,
        detail: `${soonest.user} messaged ${Math.round((24 * 60 - mins) / 60)} hours ago and is still waiting. You have ${Math.floor(mins / 60)}h ${mins % 60}m of free-form reply left. After that the only way to reach them is an approved template message, which costs money per send and reads like marketing — to someone who asked you a direct question.`,
        action: 'Reply now, before the window closes',
        owner: 'executive',
        where: 'Inbox → WhatsApp',
        channels: ['wa'],
        window: `${Math.floor(mins / 60)}h ${mins % 60}m`,
        evidence: [
          { label: 'Windows closing within 4h', value: `${closing.length}`, source: 'wa' },
          { label: 'Soonest', value: `${soonest.user} — ${Math.floor(mins / 60)}h ${mins % 60}m left`, source: 'wa' },
          { label: 'Their message', value: `"${soonest.preview}"`, source: 'wa' },
          { label: 'Median reply time', value: `${ANALYTICS_WA.totals.medianResponseMins} min`, source: 'wa' },
        ],
        impact: 0.8,
        confidence: 0.95,
        effort: 0.1,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // A like is applause; a save is someone planning to come. Comparing save
  // rate by format tells you what to shoot next, and the data is per-media in
  // Instagram insights.
  {
    id: 'format-saves',
    title: 'Which format earns intent',
    run(ctx) {
      // What this rule needs is a MEASURED post, not a published one: it
      // compares formats by reach, and reach is what it is missing without a
      // measured target. The status check was always a proxy for that.
      const published = ctx.posts.filter(p => p.metrics && p.metrics.reach > 0 && p.format);
      if (published.length < 3) return [];
      const byFormat = {};
      published.forEach(p => {
        const f = p.format;
        if (!byFormat[f]) byFormat[f] = { saves: 0, reach: 0, n: 0 };
        byFormat[f].saves += p.metrics.saves;
        byFormat[f].reach += p.metrics.reach;
        byFormat[f].n += 1;
      });
      const ranked = Object.entries(byFormat)
        .map(([f, v]) => ({ format: f, rate: v.saves / v.reach, n: v.n }))
        .sort((a, b) => b.rate - a.rate);
      if (ranked.length < 2) return [];
      const best = ranked[0], worst = ranked[ranked.length - 1];
      const multiple = worst.rate > 0 ? best.rate / worst.rate : 0;
      if (multiple < 1.5) return [];

      return [{
        kind: 'content',
        title: `${best.format}s earn ${multiple.toFixed(1)}× the save rate of ${worst.format}s`,
        detail: `Saves are the closest thing Instagram gives you to intent — a like is applause, a save is someone planning a visit. Your ${best.format}s save at ${(best.rate * 100).toFixed(2)}% of reach against ${(worst.rate * 100).toFixed(2)}% for ${worst.format}s. Shift the shooting schedule accordingly rather than posting whatever is easiest that day.`,
        action: `Make ${best.format}s the default format`,
        owner: 'executive',
        where: 'Content plan',
        channels: ['ig'],
        window: 'Next content batch',
        evidence: ranked.map(r => ({
          label: `${r.format} save rate (${r.n} post${r.n > 1 ? 's' : ''})`,
          value: `${(r.rate * 100).toFixed(2)}% of reach`,
          source: 'ig',
        })),
        impact: 0.6,
        confidence: 0.6,
        effort: 0.3,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // The same question arriving on three different channels is not three
  // support tickets, it is one missing piece of published information.
  {
    id: 'repeat-question',
    title: 'Questions you are answering over and over',
    run(ctx) {
      // Pull guest-side text from every channel and look for recurring topics
      // that a published answer would kill off permanently.
      const guestText = [
        ...CONVERSATIONS.flatMap(c => c.messages.filter(m => m.from === 'user').map(m => m.text)),
        ...POST_COMMENTS.filter(c => !c.isBrand).map(c => c.text),
      ];
      const topics = [
        { id: 'booking',   label: 'booking and table-holding policy', re: /book|table|reserv|walk-?in/i },
        { id: 'group',     label: 'group and large-party bookings',   re: /group of|\bfor \d{2}|private din|corporate/i },
        { id: 'veg',       label: 'vegetarian options',               re: /vegetarian|veg version|jackfruit|kathal/i },
        { id: 'parking',   label: 'parking',                          re: /parking|park\b/i },
        { id: 'kids',      label: 'children and high chairs',         re: /toddler|high chair|kids?\b|child/i },
        { id: 'hours',     label: 'opening hours and late kitchen',   re: /open till|closing|late|what time/i },
      ];
      const hits = topics
        .map(t => ({ ...t, n: guestText.filter(x => t.re.test(x)).length }))
        .filter(t => t.n >= 2)
        .sort((a, b) => b.n - a.n);
      if (!hits.length) return [];
      const top = hits[0];

      return [{
        kind: 'content',
        title: `Guests keep asking about ${top.label}`,
        detail: `The same question is arriving across Instagram DMs, comments and Google Q&A — ${top.n} times in the current window, each one answered by hand. Publishing the answer once, in the three places people look before they ask, removes the work permanently and helps the guests who would never bother to ask.`,
        action: 'Answer it on the Google listing, an Instagram highlight, and the WhatsApp greeting',
        owner: 'executive',
        where: 'Google Q&A · Instagram highlights · WhatsApp auto-reply',
        channels: ['gg', 'ig', 'wa'],
        window: 'This week',
        evidence: [
          { label: `Asked about ${top.label}`, value: `${top.n} times`, source: 'nlp' },
          ...hits.slice(1, 4).map(h => ({ label: `Also asked: ${h.label}`, value: `${h.n} times`, source: 'nlp' })),
          { label: 'Open Google questions', value: `${ANALYTICS_GG.qanda.open}`, source: 'gbpQanda' },
        ],
        impact: 0.6,
        confidence: 0.75,
        effort: 0.2,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // Review velocity is the competitor metric nobody watches and everybody
  // loses to. Google sorts and surfaces on volume as well as score: a rival
  // gaining reviews twice as fast will out-rank you eventually regardless of
  // who cooks better. Computable from stored Places review counts.
  {
    id: 'review-velocity',
    title: 'Losing ground on review volume',
    run(ctx) {
      // Both sides of the comparison have to be in state `rate`. If OUR own
      // history is `none` or `measuring` there is no figure to be behind by,
      // and firing on a half-known comparison would put a fabricated number in
      // front of someone about to change how their floor staff work.
      const ourVelocity = ctx.selfVelocity;
      if (!ourVelocity || ourVelocity.state !== 'rate' || !ourVelocity.perMonth) return [];
      const us = ourVelocity.perMonth;
      // Same test on the rivals. A rival pulled once, or pulled twice inside
      // the 7-day floor, is not part of this population — and the denominator
      // counts only rivals we can genuinely compare on, so "3 of 11" cannot
      // silently include rivals with no rate at all.
      const rated = ctx.competitors.filter(c => c.velocity && c.velocity.state === 'rate');
      const faster = rated
        .filter(c => c.velocity.perMonth > us)
        .sort((a, b) => b.velocity.perMonth - a.velocity.perMonth);
      if (!faster.length) return [];
      const leader = faster[0];
      const gap = leader.velocity.perMonth / us;
      // Months until they overtake us on total review count, if nothing changes.
      const monthsToOvertake = leader.googleReviews > ctx.self.googleReviews
        ? null
        : Math.ceil((ctx.self.googleReviews - leader.googleReviews) / (leader.velocity.perMonth - us));

      return [{
        kind: 'ops',
        title: `${leader.name} is gaining Google reviews ${gap.toFixed(1)}× faster than you`,
        detail: `They add roughly ${leader.velocity.perMonth} reviews a month against your ${us}. Google weighs volume as well as score, so this compounds quietly: ${faster.length} of the ${rated.length} rivals with ${serverData().minWindowDays}+ days of stored review counts ${faster.length > 1 ? 'are' : 'is'} outpacing you${leader.googleReviews > ctx.self.googleReviews ? ' and already ahead on total count' : monthsToOvertake ? `, and at this rate they pass your total in about ${monthsToOvertake} months` : ''}. The fix is a review ask built into the end of service, not a campaign.`,
        action: 'Add a review ask to the bill drop and the WhatsApp thank-you',
        owner: 'admin',
        where: 'Floor process · WhatsApp template',
        channels: ['gg', 'wa'],
        window: 'This month',
        evidence: [
          { label: 'Our review velocity', value: `${us}/month over ${formatObservationWindow(ourVelocity.windowDays)} (${fmt(ctx.self.googleReviews)} total)`, source: 'gbp' },
          { label: `${leader.name}`, value: `${leader.velocity.perMonth}/month over ${formatObservationWindow(leader.velocity.windowDays)} (${fmt(leader.googleReviews)} total)`, source: 'publicApi' },
          { label: 'Faster than us', value: `${faster.length} of ${rated.length} rivals with a measurable rate`, source: 'publicApi' },
          { label: 'Their rating', value: `${leader.googleRating.toFixed(1)} vs our ${ctx.self.googleRating.toFixed(1)}`, source: 'publicApi' },
        ],
        impact: 0.75,
        confidence: 0.7,
        effort: 0.35,
      }];
    },
  },

  // ---------------------------------------------------------------------
  // Posting cadence against the catchment. Business Discovery gives media
  // counts for every public competitor, so this is a real comparison.
  {
    id: 'cadence-gap',
    title: 'Posting cadence against the catchment',
    run(ctx) {
      const us = ctx.self.postsPerWeek;
      // Cadence and engagement come from Business Discovery, so a ratings-only
      // rival has neither. median() already skips non-numbers, but the
      // DENOMINATOR has to skip them too — "3 of 11 restaurants nearby post
      // more often than you" is false when four of the eleven have no cadence
      // we can see.
      const readable = ctx.competitors.filter(c => typeof c.postsPerWeek === 'number');
      const medianCadence = median(readable.map(c => c.postsPerWeek));
      const target = Math.ceil(medianCadence);
      if (us >= medianCadence) return [];
      const busier = readable.filter(c => c.postsPerWeek > us);
      // Only worth raising if our engagement rate is competitive — telling
      // someone to post more when nobody engages is bad advice.
      const ourRate = ctx.self.engagementRate;
      const medianRate = median(readable.map(c => c.engagementRate));
      if (ourRate < medianRate * 0.8) return [];

      return [{
        kind: 'content',
        title: `You post ${us}× a week; the catchment median is ${medianCadence}`,
        detail: `${busier.length} of the ${readable.length} rivals whose feed we can read post more often than you, and your engagement rate (${(ourRate * 100).toFixed(1)}%) is at or above the local median (${(medianRate * 100).toFixed(1)}%) — meaning the audience responds when you do show up. This is the cheapest growth available: the content works, there is just not enough of it.`,
        action: `Lift to ${target} posts a week using existing kitchen footage`,
        owner: 'executive',
        where: 'Content plan · schedule queue',
        channels: ['ig'],
        window: 'From next week',
        evidence: [
          { label: 'Our cadence', value: `${us} posts/week`, source: 'ig' },
          { label: 'Median of readable rivals', value: `${medianCadence} posts/week across ${readable.length}`, source: 'publicApi' },
          { label: 'Busiest peer', value: `${busier.sort((a, b) => b.postsPerWeek - a.postsPerWeek)[0].name} — ${busier[0].postsPerWeek}/week`, source: 'publicApi' },
          { label: 'Our engagement rate', value: `${(ourRate * 100).toFixed(1)}% vs ${(medianRate * 100).toFixed(1)}% median`, source: 'ig' },
        ],
        impact: 0.55,
        confidence: 0.65,
        effort: 0.4,
      }];
    },
  },



  // ---------------------------------------------------------------------
  {
    id: 'review-sla',
    title: 'Reviews past the reply SLA',
    run(ctx) {
      const slaMs = ctx.slaMins * 60_000;
      const overdue = ctx.reviews.filter(
        r => !r.replied && (ctx.now - new Date(r.t).getTime()) > slaMs
      );
      if (!overdue.length) return [];
      const critical = overdue.filter(r => r.rating <= 2);
      // The listing with the most overdue reviews is where the damage compounds.
      const byChannel = {};
      overdue.forEach(r => { byChannel[r.channel] = (byChannel[r.channel] || 0) + 1; });
      const worst = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0];

      return [{
        kind: 'reply',
        title: critical.length
          ? `${overdue.length} reviews past SLA — ${critical.length} of them 1–2★`
          : `${overdue.length} reviews past the ${ctx.slaMins / 60}h reply SLA`,
        detail: critical.length
          ? `An unanswered low rating is a standing advertisement against you: it sits at the top of the listing, and the absence of a reply reads as indifference to everyone who scrolls past. Start with the ${critical.length} rated 1–2★, oldest first.`
          : `None are critical, but the response rate is what a prospective guest reads as "do they care". Clear the queue.`,
        action: 'Reply publicly, oldest and lowest first',
        owner: 'srexec',
        where: 'Reviews screen → publishes to the live listing',
        channels: [...new Set(overdue.map(r => r.channel))],
        window: 'Today',
        evidence: [
          { label: 'Past SLA', value: `${overdue.length} reviews`, source: 'internal' },
          { label: 'Rated 1–2★', value: `${critical.length}`, source: 'gbp' },
          { label: 'Listing', value: `${PLATFORM_BY_ID[worst[0]].name} — ${worst[1]} overdue`, source: 'gbp' },
          { label: 'Audience', value: `${ctx.reviewStats.total90d.toLocaleString('en-IN')} reviews on that listing`, source: 'gbp' },
          { label: 'Current response rate', value: `${Math.round(ctx.reviewStats.responseRate * 100)}% against a ${Math.round(ctx.reviewStats.responseRateTarget * 100)}% target`, source: 'internal' },
        ],
        impact: critical.length ? 0.9 : 0.6,
        confidence: 0.95,
        effort: 0.2,
      }];
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'service-capacity',
    title: 'Service failures clustering',
    run(ctx) {
      const crisis = ctx.signals.filter(s => s.kind === 'crisis_cluster' && s.severity === 'critical');
      if (!crisis.length) return [];
      const s = crisis[0];
      // Corroborate the signal against the reviews rather than trusting it —
      // a signal is a hypothesis, the review text is the evidence. Split the
      // reviews on whether they mention a wait and compare the ratings; if
      // the gap is not real, this recommendation does not fire.
      const isWait = (r) => (r.themes || []).some(t => /wait|booking|staffing/i.test(t));
      const waited = ctx.reviews.filter(isWait);
      const rest = ctx.reviews.filter(r => !isWait(r));
      const avg = (list) => list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
      const gap = avg(rest) - avg(waited);
      if (gap < 0.5 || waited.length < 2) return [];

      return [{
        kind: 'ops',
        title: 'The kitchen is fine. The floor is losing you the rating.',
        detail: `Reviews mentioning a wait average ${avg(waited).toFixed(1)}★; every other review averages ${avg(rest).toFixed(1)}★ — a ${gap.toFixed(1)} star gap, and none of it is about the food. Demand from the Top 50 listing is arriving faster than the floor can seat it. More marketing makes this worse, not better.`,
        action: 'Add weekend floor cover and stop over-booking the 8pm slot',
        owner: 'admin',
        where: 'Floor rota · booking system',
        channels: [],
        window: 'Before Friday service',
        evidence: [
          { label: 'Signal', value: s.title, source: 'nlp' },
          { label: 'Reviews mentioning a wait', value: `${waited.length}, averaging ${avg(waited).toFixed(1)}★`, source: 'gbp' },
          { label: 'All other reviews', value: `${rest.length}, averaging ${avg(rest).toFixed(1)}★`, source: 'gbp' },
          { label: 'Direction requests (7d)', value: `${ANALYTICS_GG.totals.directionRequests.toLocaleString('en-IN')} (+${ANALYTICS_GG.change.directionRequests}%)`, source: 'gbpPerf' },
        ],
        impact: 0.95,
        confidence: 0.85,
        effort: 0.5,
      }];
    },
  },


  // ---------------------------------------------------------------------
  {
    id: 'competitor-response',
    title: 'Competitor moves worth answering',
    run(ctx) {
      return ctx.signals
        .filter(s => s.kind === 'competitor_move' && s.severity === 'warn')
        .map(s => {
          const mover = ctx.competitors.find(c => s.title.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
          return {
            kind: 'content',
            title: `Answer: ${s.title}`,
            detail: `${s.body} Matching their format is the losing move — they went first and will win the comparison. Counter with what they cannot copy: the kitchen, the chef, the reason a dish is made the way it is.`,
            action: 'Counter-programme with a chef or provenance story',
            owner: 'manager',
            where: 'Instagram · Google post',
            channels: ['ig', 'gg'],
            window: 'Within the week',
            evidence: [
              // Their reach is private. Public interaction counts and posting
              // cadence are all Business Discovery gives, and that is what is
              // shown — no invented reach figure.
              ...(mover ? [
                { label: `${mover.name} interactions per post`, value: mover.avgInteractions.toLocaleString('en-IN'), source: 'publicApi' },
                { label: 'Ours per post', value: ctx.self.avgInteractions.toLocaleString('en-IN'), source: 'ig' },
                { label: `${mover.name} posting cadence`, value: `${mover.postsPerWeek}/week vs our ${ctx.self.postsPerWeek}`, source: 'publicApi' },
                { label: 'Their Google rating', value: `${mover.googleRating.toFixed(1)} (${mover.googleReviews.toLocaleString('en-IN')} reviews)`, source: 'publicApi' },
              ] : [{ label: 'Signal', value: s.title, source: 'nlp' }]),
            ],
            impact: 0.6,
            confidence: 0.55,
            effort: 0.5,
          };
        });
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'schedule-gap',
    title: 'High-traffic days with nothing scheduled',
    run(ctx) {
      // Rank weekdays by total reach, then find the best one with no post
      // scheduled in the coming week.
      const byDay = ctx.analytics
        .map(d => ({ day: d.d, reach: d.reach }))
        .sort((a, b) => b.reach - a.reach);

      const scheduledDays = new Set(
        ctx.scheduled
          .filter(s => {
            const days = daysAgo(s.when, ctx.now);
            return days <= 0 && days > -8;   // within the next week
          })
          .map(s => new Date(s.when).toLocaleDateString('en-GB', { weekday: 'short' }))
      );

      const gap = byDay.slice(0, 3).find(d => !scheduledDays.has(d.day));
      if (!gap) return [];

      return [{
        kind: 'content',
        title: `Nothing scheduled for ${gap.day} — your #${byDay.findIndex(d => d.day === gap.day) + 1} reach day`,
        detail: `${gap.day} carries ${gap.reach.toLocaleString('en-IN')} Instagram reach, and the queue is empty. Weekend dining decisions get made on the day, so a post that lands in the afternoon converts differently from one that lands on a Tuesday.`,
        action: 'Fill the slot — a dish photo will do',
        owner: 'executive',
        where: 'Composer → schedule queue',
        channels: ['ig'],
        window: `Before ${gap.day}`,
        evidence: [
          { label: `${gap.day} Instagram reach`, value: gap.reach.toLocaleString('en-IN'), source: 'ig' },
          { label: 'Best day', value: `${byDay[0].day} (${byDay[0].reach.toLocaleString('en-IN')})`, source: 'ig' },
          { label: 'Scheduled this week', value: `${ctx.scheduled.length} posts, none on ${gap.day}`, source: 'internal' },
        ],
        impact: 0.5,
        confidence: 0.7,
        effort: 0.2,
      }];
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'demand-overflow',
    title: 'Event demand exceeding capacity',
    run(ctx) {
      // Saves on an event listing far above the seats available is the clearest
      // "charge more or open more" signal a restaurant gets.
      // Capacity is hard-coded here; in production it comes from the booking system.
      const EVENT_SEATS_PER_NIGHT = 24;
      const eventSignal = ctx.signals.find(
        s => s.channel === 'ig' && s.kind === 'volume_spike' && /sav(e|ed)/i.test(s.title)
      );
      if (!eventSignal) return [];
      const ratio = Math.round(eventSignal.metrics.mentions / EVENT_SEATS_PER_NIGHT);

      return [{
        kind: 'event',
        title: 'Diwali seating is over-subscribed before it opens',
        detail: `${eventSignal.metrics.mentions} saves on the teaser against ${EVENT_SEATS_PER_NIGHT} seats a night — roughly ${ratio} interested guests per seat. Either open a second seating, extend the run, or accept that you are under-priced for the demand. Deciding after bookings open means deciding badly.`,
        action: 'Open a second seating or revisit the price',
        owner: 'admin',
        where: 'Booking system · Instagram',
        channels: ['ig'],
        window: 'Before bookings open Monday',
        evidence: [
          { label: 'Saves on the teaser', value: `${eventSignal.metrics.mentions}`, source: 'ig' },
          { label: 'Seats per night', value: `${EVENT_SEATS_PER_NIGHT}`, source: 'pos' },
          { label: 'Interest per seat', value: `~${ratio}×`, source: 'internal' },
          { label: 'Teaser sentiment', value: eventSignal.metrics.sentiment.toFixed(2), source: 'nlp' },
        ],
        impact: 0.8,
        confidence: 0.6,
        effort: 0.4,
      }];
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'broken-channel',
    title: 'Channels that are not publishing',
    run(ctx) {
      // `outcome` is the server's answer, not a re-derivation. 'failed' means
      // EVERY channel refused it; a partly-published post is 'mixed' and is
      // deliberately not swept in here, because "this channel is not
      // publishing" is a different claim from "one of two channels refused".
      const failed = ctx.posts.filter(p => p.outcome === 'failed');
      if (!failed.length) return [];
      const channels = [...new Set(failed.flatMap(p => p.platforms))];
      return [{
        kind: 'fix',
        title: `${channels.map(c => PLATFORM_BY_ID[c].name).join(', ')} is not publishing`,
        detail: `${failed.length} post${failed.length > 1 ? 's' : ''} failed to go out. Everything scheduled to this channel will fail the same way until the connection is renewed, silently — the queue will look healthy while nothing ships.`,
        action: 'Reconnect the account',
        owner: 'admin',
        where: 'Settings → Connected accounts',
        channels,
        window: 'Now',
        evidence: [
          { label: 'Failed posts', value: `${failed.length}`, source: 'internal' },
          { label: 'Error', value: failed[0].error || 'Authentication failure', source: 'ig' },
          { label: 'Lost content', value: `"${failed[0].content.slice(0, 60)}…"`, source: 'internal' },
        ],
        impact: 0.65,
        confidence: 1.0,
        effort: 0.1,
      }];
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'praise-theme',
    title: 'Praise you are not using',
    run(ctx) {
      // Themes recurring in 4–5★ reviews that no published or queued content
      // touches. Guests are telling you what your marketing should say.
      const counts = {};
      ctx.reviews.filter(r => r.rating >= 4).forEach(r => {
        (r.themes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      });
      const allCopy = [...ctx.posts, ...ctx.scheduled].map(p => p.content).join(' ').toLowerCase();
      const uncovered = Object.entries(counts)
        .filter(([theme, n]) => n >= 2 && !allCopy.includes(theme.toLowerCase()))
        .sort((a, b) => b[1] - a[1]);
      if (!uncovered.length) return [];
      const [theme, n] = uncovered[0];

      return [{
        kind: 'content',
        title: `Guests keep praising "${theme}" and you never mention it`,
        detail: `${n} four- and five-star reviews name ${theme} unprompted, and no published or scheduled post touches it. This is the cheapest content there is: the words are already written, by people with no reason to flatter you.`,
        action: 'Build a post around this, quoting the reviews',
        owner: 'executive',
        where: 'Instagram · Google post',
        channels: ['ig', 'gg'],
        window: 'Next content batch',
        evidence: [
          { label: `4–5★ reviews naming "${theme}"`, value: `${n}`, source: 'nlp' },
          { label: 'Existing content on it', value: 'None', source: 'internal' },
          { label: 'Other uncovered themes', value: uncovered.slice(1, 4).map(([t]) => t).join(', ') || 'none', source: 'nlp' },
        ],
        impact: 0.55,
        confidence: 0.65,
        effort: 0.3,
      }];
    },
  },

];

// --- Scoring -----------------------------------------------------------------
// score = impact × confidence × effort-discount, on 0–100.
//
// Effort discounts rather than divides: a high-effort recommendation that
// matters should still outrank a trivial one that does not. The 0.45 ceiling
// means effort can cost a recommendation at most 45% of its score — enough to
// break ties, not enough to bury important work because it is hard.
function scoreRecommendation(r) {
  const effortDiscount = 1 - 0.45 * r.effort;
  return Math.round(100 * r.impact * r.confidence * effortDiscount);
}

function generateRecommendations() {
  const ctx = buildRecommendationContext();
  const out = [];
  for (const rule of REC_RULES) {
    let produced = [];
    try {
      produced = rule.run(ctx) || [];
    } catch (e) {
      // A broken rule must never take the whole screen down with it.
      if (typeof console !== 'undefined') console.warn(`Recommendation rule "${rule.id}" failed:`, e);
      continue;
    }
    produced.forEach((r, i) => {
      out.push({
        ...r,
        id: `${rule.id}-${i}`,
        ruleId: rule.id,
        ruleTitle: rule.title,
        score: scoreRecommendation(r),
      });
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

// --- Persistence -------------------------------------------------------------
// Status is per-user state that survives a reload. Keyed with a version so the
// schema can move later without colliding with stale browser state.
const RECS_KEY = 'saf-recs-v1';
const RECS_DEFAULT = { status: {} };   // id -> 'accepted' | 'done' | 'dismissed'

function recsLoad() {
  try {
    const raw = localStorage.getItem(RECS_KEY);
    if (!raw) return { ...RECS_DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.status !== 'object') {
      return { ...RECS_DEFAULT };
    }
    return { ...RECS_DEFAULT, ...parsed };
  } catch (e) {
    return { ...RECS_DEFAULT };
  }
}
function recsSave(state) {
  try { localStorage.setItem(RECS_KEY, JSON.stringify(state)); } catch (e) {}
}

Object.assign(window, {
  REC_SOURCES, REC_TIER_LABEL, REC_KINDS, REC_RULES,
  generateRecommendations, scoreRecommendation, buildRecommendationContext,
  recsLoad, recsSave,
});
