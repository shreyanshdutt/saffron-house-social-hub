// Social Listening — Competitors screen.
// Read-only orientation + benchmarking surface. Used monthly / pre-
// strategy-meeting per the original spec; that's analytical context,
// hence a sortable semantic <table> rather than a card grid (the other
// two read-only screens — Overview and Trends — are card-based, so
// table here also gives Listening visual differentiation).

// Shared <colgroup> for both the SelfRowCard (Saffron House anchor, above) and the
// CompetitorsTable (peers, below). Two separate tables can't auto-layout
// to the same column widths because their content drives sizing
// independently. Explicit widths via colgroup + table-layout:fixed
// guarantee pixel-aligned columns so the eye can scan across rows.
//
// Responsive collapse mirrors the <td>/<th> classes — when a column's
// cells go display:none at a breakpoint, the matching <col> hides too so
// the column takes zero space uniformly across both tables.
//
// .map()-rendered to avoid whitespace text nodes between sibling <col>
// elements — those would trip validateDOMNesting per HTML spec (only
// <col> is allowed inside <colgroup>, no text content).
const COMPETITOR_COLS = [
  { width: 8 },                                            // moment stripe
  {},                                                       // competitor — fluid
  { className: 'hidden md:table-column', width: 130 },     // channel
  { width: 110 },                                          // followers
  { width: 120 },                                          // engagement
  { className: 'hidden lg:table-column', width: 120 },     // mentions
  { className: 'hidden lg:table-column', width: 120 },     // sentiment
  { className: 'hidden md:table-column', width: 140 },     // trend
];

const COMPETITOR_COLGROUP = (
  <colgroup>
    {COMPETITOR_COLS.map((c, i) => (
      <col key={i} className={c.className} style={c.width ? { width: c.width } : undefined} />
    ))}
  </colgroup>
);

// Column definitions. `sortable` controls whether the header is a button +
// shows aria-sort. `getValue` extracts the sort key from a competitor row.
const COMPETITOR_COLUMNS = [
  { id: 'moment',     sortable: false },
  { id: 'competitor', sortable: true,  getValue: (c) => c.name.toLowerCase(),     defaultDir: 'asc'  },
  { id: 'channel',    sortable: true,  getValue: (c) => c.channel,                defaultDir: 'asc'  },
  { id: 'followers',  sortable: true,  getValue: (c) => c.followers,              defaultDir: 'desc' },
  { id: 'engagement', sortable: true,  getValue: (c) => c.engagementRate,         defaultDir: 'desc' },
  { id: 'cadence',    sortable: true,  getValue: (c) => c.postsPerWeek,           defaultDir: 'desc' },
  { id: 'rating',     sortable: true,  getValue: (c) => c.googleRating,           defaultDir: 'desc' },
  { id: 'trend',      sortable: false },
];

function CompetitorsScreen({ theme }) {
  const t = useT();
  const [sort, setSort] = React.useState({ field: 'engagement', dir: 'desc' });

  // Driven by what is marked on the Establishments screen, so one choice
  // controls both this table and the recommendation engine.
  const tracked = React.useMemo(() => trackedCompetitors(), []);

  const sortedRows = React.useMemo(() => {
    const col = COMPETITOR_COLUMNS.find(c => c.id === sort.field);
    if (!col || !col.getValue) return tracked;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...tracked].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }, [sort.field, sort.dir, tracked]);

  const onSort = (field) => {
    const col = COMPETITOR_COLUMNS.find(c => c.id === field);
    if (!col || !col.sortable) return;
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: col.defaultDir });
  };

  return (
    <div id="listening-competitors" role="tabpanel" className="space-y-4">
      <CatchmentHeader tracked={tracked} />
      <PendingSyncNote />
      {tracked.length > 0
        ? <CompetitorInsights theme={theme} peers={tracked} />
        : <EmptyCatchment />}
      {/* Saffron House sits above the peer table — internal-source data, our own
          baseline. The peer table below is purely external observation. */}
      <SelfRowCard data={SAF_SELF_STATS} theme={theme} t={t} />
      <CompetitorsTable rows={sortedRows} sort={sort} onSort={onSort} theme={theme} t={t} />
      <SourceNote />
    </div>
  );
}

// Names the catchment, because a competitor set without a boundary is just a
// list of restaurants. Google Places nearby search seeds it; a human curates.
function CatchmentHeader({ tracked }) {
  const c = COMPETITOR_CATCHMENT;
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-saf-light text-saf-primary grid place-items-center shrink-0">
        <Icon name="MapPin" size={16} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14.5px] font-semibold text-saf-text">
            {c.label} · {c.pincode}
          </span>
          {c.isSampleData && (
            <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10.5px] font-semibold uppercase tracking-wide">
              <Icon name="AlertTriangle" size={10} />
              Sample data
            </span>
          )}
        </div>
        <div className="text-[12px] text-saf-muted">
          {c.radiusKm} km radius · {tracked.length} tracked with content data · {c.note}
        </div>
        {c.isSampleData && (
          <p className="text-[11.5px] text-amber-700 mt-1 leading-relaxed">
            These six restaurants are invented and the handles resolve to nothing. Replace them with
            real establishments from Places Nearby Search before showing this to anyone outside the team.
          </p>
        )}
      </div>
    </div>
  );
}

// The table shows numbers; the insight is in the gaps between them. Each of
// these is computed from public fields only — Business Discovery counts and
// Places ratings — and says what the gap means rather than just how big it is.
function CompetitorInsights({ theme, peers }) {
  const us = SAF_SELF_STATS;

  const med = (arr) => {
    const a = [...arr].sort((x, y) => x - y);
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  };
  // A median of an even-length set can land on a half. Show it exactly — it is
  // a measurement — but drop a trailing .0 so whole numbers read as whole.
  const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  const medCadence = med(peers.map(p => p.postsPerWeek));
  const medEngagement = med(peers.map(p => p.engagementRate));
  const medRating = med(peers.map(p => p.googleRating));
  const medVelocity = med(peers.map(p => p.reviewVelocityPerMonth));

  // Theme gap: what the catchment posts about that we do not, and vice versa.
  const peerThemes = {};
  peers.forEach(p => (p.themes || []).forEach(t => { peerThemes[t] = (peerThemes[t] || 0) + 1; }));
  const ourThemes = new Set(us.themes || []);
  const uncontested = (us.themes || []).filter(t => !peerThemes[t]);
  const crowded = Object.entries(peerThemes)
    .filter(([t, n]) => n >= 2 && !ourThemes.has(t))
    .sort((a, b) => b[1] - a[1]);

  const cards = [
    {
      icon: 'Repeat',
      label: 'Posting cadence',
      value: `${us.postsPerWeek} vs ${num(medCadence)}`,
      unit: 'posts/week',
      good: us.postsPerWeek >= medCadence,
      note: us.postsPerWeek >= medCadence
        ? 'At or above the catchment median.'
        : `Behind the median. ${peers.filter(p => p.postsPerWeek > us.postsPerWeek).length} of ${peers.length} post more often.`,
    },
    {
      icon: 'Heart',
      label: 'Engagement rate',
      value: `${(us.engagementRate * 100).toFixed(1)}% vs ${(medEngagement * 100).toFixed(1)}%`,
      unit: 'interactions ÷ followers',
      good: us.engagementRate >= medEngagement,
      note: us.engagementRate >= medEngagement
        ? 'The audience responds when you post. Cadence is the constraint, not content.'
        : 'Below median — more posting will not fix this; the content needs to change.',
    },
    {
      icon: 'Star',
      label: 'Google rating',
      value: `${us.googleRating.toFixed(1)} vs ${medRating.toFixed(1)}`,
      unit: 'catchment median',
      good: us.googleRating >= medRating,
      note: us.googleRating >= medRating
        ? 'At or above the local median.'
        : `${peers.filter(p => p.googleRating > us.googleRating).length} nearby restaurants rate higher.`,
    },
    {
      icon: 'TrendingUp',
      label: 'Review velocity',
      value: `${us.reviewVelocityPerMonth} vs ${num(medVelocity)}`,
      unit: 'new reviews/month',
      good: us.reviewVelocityPerMonth >= medVelocity,
      note: us.reviewVelocityPerMonth >= medVelocity
        ? 'Keeping pace on volume.'
        : 'Falling behind on volume. Google weighs count as well as score, so this compounds.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} padding="p-4">
            <div className="flex items-center gap-1.5">
              <Icon name={c.icon} size={13} className="text-saf-muted" />
              <span className="text-[11.5px] uppercase tracking-wider text-saf-muted">{c.label}</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[19px] font-bold text-saf-text tabular-nums">{c.value}</span>
              {/* Direction is carried by an icon and by the note text, never by
                  colour alone. */}
              <Icon
                name={c.good ? 'ArrowUp' : 'ArrowDown'}
                size={13}
                className={c.good ? 'text-emerald-700' : 'text-rose-700'}
              />
            </div>
            <div className="text-[10.5px] text-saf-muted mt-0.5">{c.unit}</div>
            <p className="text-[11.5px] text-saf-muted mt-2 leading-relaxed">{c.note}</p>
          </Card>
        ))}
      </div>

      <Card padding="p-4">
        <div className="text-[11.5px] uppercase tracking-wider text-saf-muted">Content positioning</div>
        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[12.5px] font-medium text-saf-text">Yours alone in this market</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {uncontested.length ? uncontested.map(t => (
                <span key={t} className="px-2 h-6 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium">{t}</span>
              )) : <span className="text-[12px] text-saf-muted">Nothing uncontested — every theme you post is also posted nearby.</span>}
            </div>
            <p className="text-[11.5px] text-saf-muted mt-2 leading-relaxed">
              Themes no competitor in the catchment is posting. This is where you win by default.
            </p>
          </div>
          <div>
            <div className="text-[12.5px] font-medium text-saf-text">Crowded — two or more rivals, you absent</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {crowded.length ? crowded.map(([t, n]) => (
                <span key={t} className="px-2 h-6 inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[11.5px] font-medium">
                  {t} · {n}
                </span>
              )) : <span className="text-[12px] text-saf-muted">Nothing crowded that you are missing.</span>}
            </div>
            <p className="text-[11.5px] text-saf-muted mt-2 leading-relaxed">
              Entering a crowded theme means competing on their terms. Usually a reason to stay out, not to join in.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Tracked and readable, but no content pulled yet. Saying so beats a silent
// omission that reads as the feature being broken.
function PendingSyncNote() {
  const pending = trackedPendingEstablishments();
  if (!pending.length) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-light border border-saf-primary/30">
      <Icon name="Clock" size={14} className="text-saf-primary mt-0.5 shrink-0" />
      <p className="text-[12.5px] text-saf-text leading-relaxed">
        <span className="font-semibold">
          {pending.length} tracked establishment{pending.length > 1 ? 's have' : ' has'} not synced yet
        </span>{' '}
        — {pending.map(p => p.name).join(', ')}. Their Instagram accounts are readable, so their
        posts and cadence will appear here after the next Business Discovery fetch.
      </p>
    </div>
  );
}

// Nothing tracked yet — point at the screen where the set is chosen rather
// than showing an empty table with no explanation.
function EmptyCatchment() {
  return (
    <Card padding="p-8">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-saf-light grid place-items-center text-saf-primary">
          <Icon name="Store" size={22} />
        </div>
        <div className="mt-3 text-[15px] font-semibold text-saf-text">No competitors tracked</div>
        <p className="text-[13px] text-saf-muted mt-1 max-w-md mx-auto leading-relaxed">
          Nothing is being compared. Open Establishments to see every restaurant in the catchment
          and mark the ones you compete with — the list there shows which have public data to
          compare against.
        </p>
      </div>
    </Card>
  );
}

// States the limits out loud, on the screen where they matter most.
function SourceNote() {
  return (
    <Card padding="p-3.5">
      <div className="flex items-start gap-2">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[11.5px] text-saf-muted leading-relaxed">
          <span className="font-medium text-saf-text">Public data only.</span>{' '}
          Followers, posting cadence and interactions come from Instagram Business Discovery;
          rating and review count from Google Places. Engagement rate is computed as
          interactions ÷ followers — the same formula for them and for us, so the comparison is
          like-for-like, but it is an approximation. Their reach, impressions, ad spend and
          sentiment are private and are not shown here at any confidence, because they cannot be
          obtained at all.
        </p>
      </div>
    </Card>
  );
}

// Saffron House self-row in its own warm-tinted card above the peer table.
// Column-aligned with CompetitorsTable below via the shared
// COMPETITOR_COLGROUP + table-layout:fixed. No <thead> — the viewer
// reads our own values by column position alignment with the headers on
// the table underneath.
function SelfRowCard({ data, theme, t }) {
  return (
    <div className="rounded-2xl border border-saf-border shadow-card overflow-hidden bg-saf-primary/10 dark:bg-saf-primary/20">
      <div className="overflow-x-auto nice-scroll">
        <table className="w-full text-[13px] border-collapse" style={{ tableLayout: 'fixed' }}>
          {COMPETITOR_COLGROUP}
          <tbody>
            <CompetitorRow c={data} theme={theme} t={t} inSelfCard />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompetitorsTable({ rows, sort, onSort, theme, t }) {
  const [openId, setOpenId] = React.useState(null);
  const sortLabel = (field) => {
    const col = t.listening.competitors.column[field];
    return t.listening.competitors.sortAriaLabel.replace('{column}', col || field);
  };
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="overflow-x-auto nice-scroll">
        <table className="w-full text-[13px] border-collapse" style={{ tableLayout: 'fixed' }}>
          {COMPETITOR_COLGROUP}
          <thead>
            <tr className="bg-saf-surface border-b border-saf-border">
              {/* Moment indicator column — narrow, no label */}
              <th scope="col" className="w-2 p-0" aria-label={t.listening.competitors.column.moment}>
                <span className="sr-only">{t.listening.competitors.column.moment}</span>
              </th>
              <SortableHeader col="competitor" sort={sort} onSort={onSort} label={t.listening.competitors.column.competitor}
                              ariaLabel={sortLabel('competitor')} className="text-start ps-4 pe-3 py-2.5" />
              <SortableHeader col="channel"    sort={sort} onSort={onSort} label={t.listening.competitors.column.channel}
                              ariaLabel={sortLabel('channel')}    className="text-start px-3 py-2.5 hidden md:table-cell" />
              <SortableHeader col="followers"  sort={sort} onSort={onSort} label={t.listening.competitors.column.followers}
                              ariaLabel={sortLabel('followers')}  className="text-end px-3 py-2.5" />
              <SortableHeader col="engagement" sort={sort} onSort={onSort} label={t.listening.competitors.column.engagement}
                              ariaLabel={sortLabel('engagement')} className="text-end px-3 py-2.5" />
              <SortableHeader col="cadence"    sort={sort} onSort={onSort} label={t.listening.competitors.column.cadence}
                              ariaLabel={sortLabel('cadence')}    className="text-end px-3 py-2.5 hidden lg:table-cell" />
              <SortableHeader col="rating"     sort={sort} onSort={onSort} label={t.listening.competitors.column.rating}
                              ariaLabel={sortLabel('rating')}     className="text-end px-3 py-2.5 hidden lg:table-cell" />
              <th scope="col" className="text-end pe-4 ps-3 py-2.5 text-[11px] uppercase tracking-wider font-medium text-saf-muted hidden md:table-cell">
                {t.listening.competitors.column.trend}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <CompetitorRow
                key={c.id}
                c={c}
                theme={theme}
                t={t}
                expanded={openId === c.id}
                onToggle={() => setOpenId(prev => (prev === c.id ? null : c.id))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SortableHeader({ col, sort, onSort, label, ariaLabel, className }) {
  const active = sort.field === col;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`text-[11px] uppercase tracking-wider font-medium text-saf-muted ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 hover:text-saf-text focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-saf-surface rounded ${active ? 'text-saf-primary' : ''}`}
      >
        <span>{label}</span>
        {active && (
          <Icon name={sort.dir === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={11} aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function CompetitorRow({ c, theme, t, inSelfCard, expanded, onToggle }) {
  const p = PLATFORM_BY_ID[c.channel];
  const channelColor = platformColor(p, theme);
  // The Saffron House self-row gets a YOU badge + sparkline-in-avatarColor +
  // suppressed hover. When rendered inside SelfRowCard the card itself
  // carries the sapphire tint, so the per-row tint is suppressed to
  // avoid stacking; when rendered standalone (legacy in-table position)
  // the per-row tint applies. Either way the row has no hover.
  const isSelf = !!c.isSelf;
  const sparkColor = isSelf ? c.avatarColor : channelColor;
  const rowBg = isSelf
    ? (inSelfCard ? '' : 'bg-saf-primary/10 dark:bg-saf-primary/20')
    : 'hover:bg-saf-surface/60';
  const canExpand = !isSelf && Array.isArray(c.recentPosts) && c.recentPosts.length > 0;
  return (
    <React.Fragment>
    <tr className={`border-b border-saf-border last:border-b-0 transition-colors ${expanded ? 'bg-saf-light/40' : rowBg}`}>
      {/* Moment indicator column — full-height amber stripe when isMoment.
          The self-row has no isMoment flag, so renders nothing. */}
      <td className="w-2 p-0 relative">
        {c.isMoment ? (
          <Tooltip label={t.listening.competitors.momentTooltip} side="right">
            <span
              aria-label={t.listening.competitors.momentBadge}
              role="img"
              className="block absolute inset-y-0 start-0 w-1 bg-amber-500"
            />
          </Tooltip>
        ) : null}
      </td>

      {/* Competitor (avatar + name + handle). YOU badge inline next to
          the name for the self-row. */}
      <td className="ps-4 pe-3 py-3">
        {canExpand ? (
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`feed-${c.id}`}
            className="flex items-center gap-2.5 min-w-0 w-full text-start rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent group"
          >
            <Icon
              name="ChevronRight"
              size={14}
              className={`text-saf-muted shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            <CompetitorMark name={c.name} color={c.avatarColor} size={32} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
                <span className="text-[13px] font-medium text-saf-text truncate group-hover:text-saf-primary transition-colors">{c.name}</span>
              </div>
              <div className="text-[11px] text-saf-muted truncate" dir="ltr">
                {c.handle} · {c.recentPosts.length} posts / 14d
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <CompetitorMark name={c.name} color={c.avatarColor} size={32} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
                <span className="text-[13px] font-medium text-saf-text truncate">{c.name}</span>
                {isSelf && (
                  <span className="inline-flex items-center px-1.5 h-4 text-[9px] font-semibold uppercase tracking-wider rounded bg-saf-primary text-white shrink-0">
                    {t.listening.competitors.youBadge}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-saf-muted truncate" dir="ltr">{c.handle}</div>
            </div>
          </div>
        )}
      </td>

      {/* Channel */}
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-5 h-5 rounded-full grid place-items-center text-white shrink-0"
            style={{ background: channelColor }}
            aria-hidden="true"
          >
            <PlatformGlyph id={c.channel} size={10} />
          </span>
          <span className="text-[12px] text-saf-text">{p.name}</span>
        </span>
      </td>

      {/* Followers */}
      <td className="text-end px-3 py-3" dir="ltr">
        <div className="text-[13px] font-medium text-saf-text tabular-nums">{fmtCompact(c.followers)}</div>
        <ChangePctText pct={c.followersChange7dPct} />
      </td>

      {/* Engagement rate */}
      <td className="text-end px-3 py-3" dir="ltr">
        <div className="text-[13px] font-semibold text-saf-text tabular-nums">{(c.engagementRate * 100).toFixed(1)}%</div>
        <ChangePctText pct={c.engagementChange7dPct} />
      </td>

      {/* Posting cadence — media_count over the window, from Business Discovery */}
      <td className="text-end px-3 py-3 hidden lg:table-cell" dir="ltr">
        <div className="text-[13px] font-medium text-saf-text tabular-nums">{c.postsPerWeek}</div>
        <div className="text-[11px] text-saf-muted tabular-nums">{fmtCompact(c.avgInteractions)} avg</div>
      </td>

      {/* Google rating — Places API, public */}
      <td className="text-end px-3 py-3 hidden lg:table-cell" dir="ltr">
        <div className="text-[13px] font-semibold text-saf-text tabular-nums">{c.googleRating.toFixed(1)}</div>
        <div className="text-[11px] text-saf-muted tabular-nums">{fmtCompact(c.googleReviews)} reviews</div>
      </td>

      {/* Trend sparkline. Self-row uses the brand colour; peer rows use
          channel color. */}
      <td className="text-end pe-4 ps-3 py-3 hidden md:table-cell" dir="ltr">
        <Sparkline data={c.sparkEngagement} width={120} height={26} stroke={sparkColor} className="inline-block h-6" />
      </td>
    </tr>

    {canExpand && expanded && (
      <tr>
        <td colSpan={8} className="p-0 border-b border-saf-border bg-saf-surface">
          <CompetitorFeed c={c} theme={theme} />
        </td>
      </tr>
    )}
    </React.Fragment>
  );
}


// --- Competitor post feed ----------------------------------------------------
// One post at a time, with prev/next — the whole feed at a glance is a grid you
// skim and forget; one post at a time is a feed you actually read.
//
// Every field here comes from the Business Discovery `media` edge: caption,
// media_type, timestamp, like_count, comments_count, permalink. What is NOT
// here, and why:
//
//   · SENTIMENT. Business Discovery returns comment COUNTS, not comment text.
//     There is no way to read what people said on a competitor's post, so
//     there is nothing to run sentiment over — classifying their own caption
//     would just be their marketing copy rating itself. The "performance"
//     figure replaces it: interactions against that competitor's own median,
//     which answers the real question (did this work for them?) using data
//     that exists.
//   · Their reach, impressions and saves — private.
//   · Their media files — Meta's terms restrict storing platform media, so
//     this shows a format placeholder and links out to the original.
function CompetitorFeed({ c, theme }) {
  const posts = c.recentPosts;
  const [i, setI] = React.useState(0);
  const post = posts[i];

  const go = React.useCallback((delta) => {
    setI(prev => Math.min(posts.length - 1, Math.max(0, prev + delta)));
  }, [posts.length]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
  };

  const offers = posts.filter(m => m.isOffer).length;
  const best = posts.reduce((a, b) => (b.interactions > a.interactions ? b : a), posts[0]);

  return (
    <div
      id={`feed-${c.id}`}
      className="p-4 focus-visible:outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={`${c.name} posts from the last 14 days`}
    >
      {/* Feed-level summary — the pattern across their fortnight, which is the
          part that actually informs a decision. */}
      <div className="flex items-center gap-4 flex-wrap mb-3">
        <div className="text-[12px] text-saf-muted">
          <span className="font-semibold text-saf-text">{posts.length} posts</span> in 14 days
        </div>
        <div className="text-[12px] text-saf-muted">
          <span className="font-semibold text-saf-text">{Math.round(c.offerShare * 100)}%</span> are offers or discounts
        </div>
        <div className="text-[12px] text-saf-muted">
          Median <span className="font-semibold text-saf-text">{fmtCompact(c.medianInteractions)}</span> interactions
        </div>
        <div className="text-[12px] text-saf-muted">
          Best <span className="font-semibold text-saf-text">{fmtCompact(best.interactions)}</span> ({best.theme})
        </div>
        <a
          href={`https://instagram.com/${c.handle.replace('@', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ms-auto text-[12px] font-medium text-saf-primary hover:underline inline-flex items-center gap-1"
        >
          Open profile <Icon name="ExternalLink" size={12} />
        </a>
      </div>

      {/* Performance strip — every post as a bar, so the outliers are visible
          before you page through. Click to jump. */}
      <div className="flex items-end gap-1 h-12 mb-3" role="list" aria-label="All posts by interactions">
        {posts.map((m, idx) => {
          const h = Math.max(8, (m.interactions / best.interactions) * 100);
          const active = idx === i;
          return (
            <button
              key={m.id}
              role="listitem"
              onClick={() => setI(idx)}
              aria-label={`Post ${idx + 1}: ${fmt(m.interactions)} interactions, ${m.theme}`}
              aria-current={active}
              title={`${fmt(m.interactions)} interactions · ${m.theme}`}
              className={`flex-1 min-w-[6px] rounded-t transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent ${active ? '' : 'opacity-45 hover:opacity-80'}`}
              style={{ height: `${h}%`, background: m.isOffer ? '#D99A16' : c.avatarColor }}
            />
          );
        })}
      </div>

      {/* The post */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="grid grid-cols-12">
          <div className="col-span-12 sm:col-span-4 lg:col-span-3">
            {/* Their media is not mirrored — see the note above. */}
            <div className="relative h-full min-h-[150px] bg-saf-light grid place-items-center">
              <div className="text-center px-3 py-6">
                <Icon
                  name={post.format === 'reel' ? 'Video' : post.format === 'carousel' ? 'Copy' : 'Image'}
                  size={26}
                  className="text-saf-primary mx-auto"
                />
                <div className="text-[11px] font-medium text-saf-text mt-1.5 capitalize">{post.format}</div>
                <div className="text-[10px] text-saf-muted mt-0.5">media not mirrored</div>
              </div>
            </div>
          </div>

          <div className="col-span-12 sm:col-span-8 lg:col-span-9 p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-saf-muted">{fmtTime(post.t, { withDate: true })}</span>
              <span className="text-[11px] text-saf-muted">·</span>
              <span className="px-2 h-5 inline-flex items-center rounded-full bg-saf-light text-saf-primary text-[10.5px] font-medium">
                {post.theme}
              </span>
              {post.isOffer && (
                <span className="px-2 h-5 inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[10.5px] font-semibold">
                  Discount / offer
                </span>
              )}
              <span className="ms-auto text-[11px] text-saf-muted tabular-nums">
                Post {i + 1} of {posts.length}
              </span>
            </div>

            <p className="mt-2 text-[13.5px] leading-relaxed text-saf-text">{post.caption}</p>

            {post.hashtags.length > 0 && (
              <div className="mt-1.5 text-[12px] text-saf-primary">{post.hashtags.join(' ')}</div>
            )}

            <div className="mt-3 flex items-center gap-5 flex-wrap">
              <FeedMetric icon="Heart" label="Likes" value={fmt(post.likes)} />
              <FeedMetric icon="MessageCircle" label="Comments" value={fmt(post.comments)} />
              <PerformanceChip index={post.index} />
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-saf-primary hover:underline inline-flex items-center gap-1"
              >
                View on Instagram <Icon name="ExternalLink" size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Pager */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-saf-border bg-saf-surface">
          <Button size="sm" variant="secondary" leadingIcon="ChevronLeft" onClick={() => go(-1)} disabled={i === 0}>
            Previous
          </Button>
          <span className="text-[11.5px] text-saf-muted">Use ← → to move between posts</span>
          <Button size="sm" variant="secondary" trailingIcon="ChevronRight" onClick={() => go(1)} disabled={i === posts.length - 1}>
            Next
          </Button>
        </div>
      </Card>

      {/* The honesty note, on the screen rather than in a doc nobody opens. */}
      <div className="flex items-start gap-2 mt-3">
        <Icon name="Info" size={13} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[11.5px] text-saf-muted leading-relaxed">
          <span className="font-medium text-saf-text">No sentiment on competitor posts.</span>{' '}
          Business Discovery returns comment counts, not comment text — there is no way to read what
          people said on someone else's post, so there is nothing to classify. Performance against
          their own median is shown instead. Their reach, impressions and saves are private, and
          their media is linked rather than mirrored.
        </p>
      </div>
    </div>
  );
}

function FeedMetric({ icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} size={14} className="text-saf-muted" />
      <span className="text-[13px] font-semibold text-saf-text tabular-nums">{value}</span>
      <span className="text-[11.5px] text-saf-muted">{label}</span>
    </span>
  );
}

// Performance against this competitor's own median. Carries a word as well as
// a tone, so it survives greyscale and colour-blind viewing.
function PerformanceChip({ index }) {
  const pct = Math.round((index - 1) * 100);
  const meta = index >= 1.5 ? { tone: 'bg-emerald-50 text-emerald-700', label: 'Outperformed' }
             : index >= 0.8 ? { tone: 'bg-saf-light text-saf-primary',  label: 'Typical' }
             :                { tone: 'bg-slate-100 text-saf-muted',     label: 'Underperformed' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11.5px] font-semibold ${meta.tone}`}>
      {meta.label} · {pct > 0 ? '+' : ''}{pct}% vs their median
    </span>
  );
}

// Small inline components scoped to the Competitors screen.
function CompetitorMark({ name, color, size = 32 }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div
      className="inline-flex items-center justify-center font-semibold select-none rounded-lg text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

function ChangePctText({ pct }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const sign = up ? '+' : '';
  return (
    <div className={`text-[11px] tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      {sign}{pct.toFixed(1)}%
    </div>
  );
}

function SentimentValue({ value }) {
  const up = value >= 0;
  const tone = up ? 'green' : 'red';
  return (
    <Pill tone={tone}>
      <Icon name={up ? 'TrendingUp' : 'TrendingDown'} size={10} />
      <span className="tabular-nums">{up ? '+' : ''}{value.toFixed(2)}</span>
    </Pill>
  );
}

window.CompetitorsScreen = CompetitorsScreen;

// Exported for verification harnesses; the screen uses it directly.
window.CompetitorFeed = CompetitorFeed;
