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

  const sortedRows = React.useMemo(() => {
    const col = COMPETITOR_COLUMNS.find(c => c.id === sort.field);
    if (!col || !col.getValue) return LISTENING_COMPETITORS;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...LISTENING_COMPETITORS].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }, [sort.field, sort.dir]);

  const onSort = (field) => {
    const col = COMPETITOR_COLUMNS.find(c => c.id === field);
    if (!col || !col.sortable) return;
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: col.defaultDir });
  };

  return (
    <div id="listening-competitors" role="tabpanel" className="space-y-3">
      {/* Saffron House sits above the peer table — internal-source data, our own
          baseline. The peer table below is purely external observation. */}
      <SelfRowCard data={SAF_SELF_STATS} theme={theme} t={t} />
      <CompetitorsTable rows={sortedRows} sort={sort} onSort={onSort} theme={theme} t={t} />
    </div>
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
              <SortableHeader col="mentions"   sort={sort} onSort={onSort} label={t.listening.competitors.column.mentions}
                              ariaLabel={sortLabel('mentions')}   className="text-end px-3 py-2.5 hidden lg:table-cell" />
              <SortableHeader col="sentiment"  sort={sort} onSort={onSort} label={t.listening.competitors.column.sentiment}
                              ariaLabel={sortLabel('sentiment')}  className="text-end px-3 py-2.5 hidden lg:table-cell" />
              <th scope="col" className="text-end pe-4 ps-3 py-2.5 text-[11px] uppercase tracking-wider font-medium text-saf-muted hidden md:table-cell">
                {t.listening.competitors.column.trend}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <CompetitorRow key={c.id} c={c} theme={theme} t={t} />
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

function CompetitorRow({ c, theme, t, inSelfCard }) {
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
  return (
    <tr className={`border-b border-saf-border last:border-b-0 transition-colors ${rowBg}`}>
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
