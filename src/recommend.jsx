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
//      that posts for you: "tell the kitchen", "add this on the Zomato partner
//      dashboard", "brief the floor". Each carries an owner and a place.
//   3. No invented causality. The engine never claims "this will raise your
//      rating by 0.2". It states what is true (mentions up 240%, sentiment
//      0.78, nothing scheduled) and what it projects, labelled as projection
//      with the arithmetic attached.
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
  partner:   { label: 'Zomato / Swiggy partner',    tier: 'partner', note: 'Via POS middleware — no public API' },
  nlp:       { label: 'Your NLP over guest text',   tier: 'derived', note: 'Computed from text you already hold' },
  pos:       { label: 'POS / booking system',       tier: 'own',     note: 'Your own system' },
  internal:  { label: 'This hub',                   tier: 'own',     note: 'Scheduling + reply state' },
  publicApi: { label: 'Public listing data',        tier: 'partial', note: 'Competitor public metrics only' },
};

const REC_TIER_LABEL = {
  api:     'Live via API',
  partner: 'Needs partner integration',
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
  const publishedReach = POSTS
    .filter(p => p.status === 'published' && p.metrics.reach > 0)
    .map(p => p.metrics.reach);

  return {
    now,
    posts: POSTS,
    scheduled: SCHEDULED,
    reviews: REVIEWS,
    reviewStats: REVIEW_STATS,
    menu: MENU_ITEMS,
    signals: LISTENING_SIGNALS,
    competitors: LISTENING_COMPETITORS,
    self: SAF_SELF_STATS,
    analytics: ANALYTICS_TIME,
    trends: LISTENING_TRENDS,
    medianReach: median(publishedReach),
    medianDishMentions: median(MENU_ITEMS.map(m => m.mentions7d)),
    slaMins: REVIEW_STATS.slaMins,
  };
}

// Projected reach for a content recommendation. Deliberately transparent: the
// median reach of your published posts, scaled by BOTH how fast a dish is
// moving and how much is actually being said about it.
//
// Momentum alone was the first version and it was wrong — a dish with 174
// mentions growing 240% projected higher reach than one with 412 mentions
// growing 68%, which inverts the sensible ordering. Percentage growth on a
// small base is not the same opportunity as volume. Volume is therefore
// weighted more heavily (range 0.5–1.8) than momentum (0.25 coefficient), and
// the combined multiplier is capped so nothing runs away.
function projectReach(ctx, dish) {
  const momentum = 1 + (dish.mentionsChange7dPct / 100) * 0.25;
  const volume = Math.max(0.5, Math.min(1.8, dish.mentions7d / (ctx.medianDishMentions || 1)));
  const multiplier = Math.min(2.2, momentum * volume);
  return {
    value: Math.round(ctx.medianReach * multiplier),
    basis: `median post reach ${Math.round(ctx.medianReach).toLocaleString('en-IN')} × ${momentum.toFixed(2)} momentum × ${volume.toFixed(2)} volume = ×${multiplier.toFixed(2)}`,
  };
}

// --- Rules -------------------------------------------------------------------
// Each returns an array of recommendations. impact / confidence / effort are
// 0–1 weights; see scoreRecommendation() for how they combine.
const REC_RULES = [
  // ---------------------------------------------------------------------
  {
    id: 'rising-dish',
    title: 'Dishes gaining attention with nothing scheduled',
    run(ctx) {
      return ctx.menu
        .filter(m => m.mentionsChange7dPct >= 60 && m.sentiment >= 0.6)
        .map(m => {
          const covered = dishHasCoverage(m, ctx);
          const proj = projectReach(ctx, m);
          return {
            kind: 'content',
            title: `Post the ${m.name} while it is climbing`,
            detail: covered
              ? `${m.name} is up ${m.mentionsChange7dPct}% and already has content out. Push a second angle — a short reel of it being cooked to order — rather than repeating the launch post.`
              : `${m.name} is up ${m.mentionsChange7dPct}% in guest conversation at ${m.sentiment.toFixed(2)} sentiment, and there is nothing published or scheduled about it. This is the cheapest post you can make this week.`,
            action: covered ? 'Shoot a second-angle reel' : 'Shoot and publish this week',
            owner: 'executive',
            where: 'Instagram · District',
            channels: covered ? ['ig'] : ['ig', 'di'],
            window: 'Within 3 days — momentum decays',
            projected: `~${proj.value.toLocaleString('en-IN')} reach`,
            projectedBasis: proj.basis,
            evidence: [
              { label: `${m.name} mentions (7d)`, value: `${m.mentions7d} (+${m.mentionsChange7dPct}%)`, source: 'nlp' },
              { label: 'Sentiment', value: `${m.sentiment.toFixed(2)} (${m.sentimentDelta >= 0 ? '+' : ''}${m.sentimentDelta.toFixed(2)} in 7d)`, source: 'nlp' },
              { label: 'Guests are saying', value: m.topPraise, source: 'nlp' },
              { label: 'Existing content', value: covered ? 'Already posted' : 'None published or scheduled', source: 'internal' },
            ],
            impact: covered ? 0.5 : 0.85,
            confidence: 0.8,
            effort: 0.3,
          };
        });
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'sinking-dish',
    title: 'Dishes losing ground',
    run(ctx) {
      return ctx.menu
        .filter(m => m.sentimentDelta <= -0.15)
        .map(m => ({
          kind: 'menu',
          title: `${m.name} is sliding — do not promote it`,
          detail: `Sentiment down ${Math.abs(m.sentimentDelta).toFixed(2)} over 7 days to ${m.sentiment.toFixed(2)}. The complaint is consistent: ${m.topComplaint.toLowerCase()}. Marketing will not fix this and will amplify it — put it in front of the kitchen instead.`,
          action: 'Kitchen review: recipe, portion or price',
          owner: 'admin',
          where: 'Kitchen · menu meeting',
          channels: [],
          window: 'Next menu meeting',
          evidence: [
            { label: `${m.name} sentiment`, value: `${m.sentiment.toFixed(2)} (${m.sentimentDelta.toFixed(2)} in 7d)`, source: 'nlp' },
            { label: 'Mentions (7d)', value: `${m.mentions7d} (${m.mentionsChange7dPct > 0 ? '+' : ''}${m.mentionsChange7dPct}%)`, source: 'nlp' },
            { label: 'Recurring complaint', value: m.topComplaint, source: 'nlp' },
            { label: 'Menu price', value: `₹${m.price}`, source: 'pos' },
          ],
          impact: 0.7,
          confidence: 0.75,
          effort: 0.6,
        }));
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
      const worstMeta = ctx.reviewStats.byChannel.find(c => c.channel === worst[0]);

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
          { label: 'Worst listing', value: `${PLATFORM_BY_ID[worst[0]].name} — ${worst[1]} overdue`, source: worst[0] === 'gg' ? 'gbp' : 'partner' },
          ...(worstMeta ? [{ label: `${PLATFORM_BY_ID[worst[0]].name} audience`, value: `${worstMeta.count.toLocaleString('en-IN')} reviews on that listing`, source: worst[0] === 'gg' ? 'gbp' : 'partner' }] : []),
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
    id: 'delivery-quality',
    title: 'Delivery quality cluster',
    run(ctx) {
      const crisis = ctx.signals.filter(s => s.kind === 'crisis_cluster' && s.severity === 'critical');
      if (!crisis.length) return [];
      const s = crisis[0];
      // Corroborate the signal against the review themes rather than trusting
      // it alone — a signal is a hypothesis, the reviews are the evidence.
      const themed = ctx.reviews.filter(r =>
        (r.themes || []).some(t => /packag|temperature|missing|late|cold/i.test(t))
      );
      // Compare the 90-day channel aggregates, not the handful of reviews in
      // the current list. Google stands in for dine-in and the marketplaces
      // for delivery — an approximation, and labelled as one in the evidence.
      const gg = ctx.reviewStats.byChannel.find(c => c.channel === 'gg');
      const marketplaces = ctx.reviewStats.byChannel.filter(c => c.channel !== 'gg');
      const mktCount = marketplaces.reduce((a, c) => a + c.count, 0);
      const mktAvg = mktCount
        ? marketplaces.reduce((a, c) => a + c.avg * c.count, 0) / mktCount
        : 0;
      const gap = (gg ? gg.avg : 0) - mktAvg;
      // If delivery is not actually worse, this recommendation is a lie.
      if (gap < 0.15) return [];

      return [{
        kind: 'ops',
        title: 'Delivery is dragging the rating; dine-in is not',
        detail: `Delivery listings average ${mktAvg.toFixed(2)}★ against ${gg.avg.toFixed(1)}★ on Google — a ${gap.toFixed(2)} gap. The complaints are packing and handover, not cooking: ${themed.length} reviews name packaging, temperature or missing items. No amount of content fixes this, and promoting delivery right now buys you more of these reviews.`,
        action: 'Insulated containers + a checklist at the packing station',
        owner: 'admin',
        where: 'Kitchen · packing station · rider handover',
        channels: [],
        window: 'This week — before the weekend peak',
        evidence: [
          { label: 'Signal', value: s.title, source: 'nlp' },
          { label: 'Marketplace avg (delivery proxy)', value: `${mktAvg.toFixed(2)}★ across ${mktCount.toLocaleString('en-IN')} reviews`, source: 'partner' },
          { label: 'Google avg (dine-in proxy)', value: `${gg.avg.toFixed(1)}★ across ${gg.count.toLocaleString('en-IN')} reviews`, source: 'gbp' },
          { label: 'Reviews naming packing or temperature', value: `${themed.length}`, source: 'nlp' },
          { label: 'Cluster reach', value: `${s.metrics.reach.toLocaleString('en-IN')} at ${s.metrics.sentiment.toFixed(2)} sentiment`, source: 'nlp' },
        ],
        impact: 0.95,
        confidence: 0.85,
        effort: 0.5,
      }];
    },
  },

  // ---------------------------------------------------------------------
  {
    id: 'menu-parity',
    title: 'Demand that the delivery menu cannot serve',
    run(ctx) {
      const parity = ctx.reviews.filter(r => (r.themes || []).some(t => /parity|delivery menu/i.test(t)));
      if (!parity.length) return [];
      // A dish worth adding: strong sentiment, real volume, complaint about
      // delivery availability.
      const candidate = ctx.menu
        .filter(m => m.sentiment >= 0.75 && /deliver|menu/i.test(m.topComplaint))
        .sort((a, b) => b.mentions7d - a.mentions7d)[0]
        || [...ctx.menu].sort((a, b) => b.sentiment - a.sentiment)[0];

      return [{
        kind: 'promo',
        title: `Put the ${candidate.name} on the delivery menu`,
        detail: `Guests are discovering dishes on Instagram and then failing to find them when they go to order. ${candidate.name} runs at ${candidate.sentiment.toFixed(2)} sentiment and its most common complaint is availability, not quality — that is demand you are turning away at the checkout.`,
        action: 'Add the item on both marketplace dashboards',
        owner: 'manager',
        where: 'Zomato partner dashboard · Swiggy partner dashboard',
        channels: ['zo', 'sw'],
        window: 'Before the weekend',
        evidence: [
          { label: 'Reviews citing menu parity', value: `${parity.length}`, source: 'nlp' },
          { label: `${candidate.name} sentiment`, value: candidate.sentiment.toFixed(2), source: 'nlp' },
          { label: 'Its top complaint', value: candidate.topComplaint, source: 'nlp' },
          { label: 'Mentions (7d)', value: `${candidate.mentions7d}`, source: 'nlp' },
        ],
        impact: 0.75,
        // One corroborating review is a hint, not a finding. Scale confidence
        // with the evidence rather than asserting a flat 0.7.
        confidence: Math.min(0.8, 0.45 + 0.12 * parity.length),
        effort: 0.35,
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
            where: 'Instagram · District',
            channels: ['ig', 'di'],
            window: 'Within the week',
            evidence: [
              { label: 'Their reach on this move', value: s.metrics.reach.toLocaleString('en-IN'), source: 'publicApi' },
              ...(mover ? [
                { label: `${mover.name} engagement rate`, value: `${(mover.engagementRate * 100).toFixed(1)}% (${mover.engagementChange7dPct > 0 ? '+' : ''}${mover.engagementChange7dPct}% in 7d)`, source: 'publicApi' },
                { label: 'Ours', value: `${(ctx.self.engagementRate * 100).toFixed(1)}% (${ctx.self.engagementChange7dPct > 0 ? '+' : ''}${ctx.self.engagementChange7dPct}% in 7d)`, source: 'ig' },
              ] : []),
              { label: 'Their mentions (7d)', value: `${s.metrics.mentions}`, source: 'nlp' },
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
        .map(d => ({
          day: d.d,
          reach: Object.entries(d).filter(([k]) => k !== 'd').reduce((s, [, v]) => s + v, 0),
        }))
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
        detail: `${gap.day} carries ${gap.reach.toLocaleString('en-IN')} reach across channels, and the queue is empty. Weekend dining decisions get made on the day, so a post that lands in the afternoon converts differently from one that lands on a Tuesday.`,
        action: 'Fill the slot — a dish photo will do',
        owner: 'executive',
        where: 'Composer → schedule queue',
        channels: ['ig'],
        window: `Before ${gap.day}`,
        evidence: [
          { label: `${gap.day} reach`, value: gap.reach.toLocaleString('en-IN'), source: 'ig' },
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
        s => s.channel === 'di' && s.kind === 'volume_spike' && s.metrics.mentions >= 300
      );
      if (!eventSignal) return [];
      const ratio = Math.round(eventSignal.metrics.mentions / EVENT_SEATS_PER_NIGHT);

      return [{
        kind: 'event',
        title: 'Diwali seating is over-subscribed before it opens',
        detail: `${eventSignal.metrics.mentions} saves against ${EVENT_SEATS_PER_NIGHT} seats a night — roughly ${ratio} interested guests per seat. Either open a second seating, extend the run, or accept that you are under-priced for the demand. Deciding after bookings open means deciding badly.`,
        action: 'Open a second seating or revisit the price',
        owner: 'admin',
        where: 'Booking system · District listing',
        channels: ['di'],
        window: 'Before bookings open Monday',
        evidence: [
          { label: 'Saves on the listing', value: `${eventSignal.metrics.mentions}`, source: 'publicApi' },
          { label: 'Seats per night', value: `${EVENT_SEATS_PER_NIGHT}`, source: 'pos' },
          { label: 'Interest per seat', value: `~${ratio}×`, source: 'internal' },
          { label: 'Listing sentiment', value: eventSignal.metrics.sentiment.toFixed(2), source: 'nlp' },
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
      const failed = ctx.posts.filter(p => p.status === 'failed');
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

  // ---------------------------------------------------------------------
  {
    id: 'price-resistance',
    title: 'Price resistance on a well-liked dish',
    run(ctx) {
      const items = ctx.menu.filter(
        m => /price|₹|expensive|cost/i.test(m.topComplaint) && m.sentiment >= 0.5
      );
      if (!items.length) return [];
      const m = items.sort((a, b) => b.price - a.price)[0];
      return [{
        kind: 'promo',
        title: `${m.name} is liked but resisted on price`,
        detail: `Sentiment is ${m.sentiment.toFixed(2)} — the dish is not the problem, the ₹${m.price} ticket is. Bundling it into a set menu moves the comparison away from the single line item, which is usually cheaper than discounting it.`,
        action: 'Build it into a set menu rather than discounting',
        owner: 'manager',
        where: 'Menu · marketplace dashboards',
        channels: ['zo', 'sw'],
        window: 'Next menu print',
        evidence: [
          { label: `${m.name} price`, value: `₹${m.price}`, source: 'pos' },
          { label: 'Sentiment', value: m.sentiment.toFixed(2), source: 'nlp' },
          { label: 'Recurring complaint', value: m.topComplaint, source: 'nlp' },
          { label: 'Mentions (7d)', value: `${m.mentions7d}`, source: 'nlp' },
        ],
        impact: 0.5,
        confidence: 0.55,
        effort: 0.45,
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
