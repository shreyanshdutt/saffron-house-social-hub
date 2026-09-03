// Analytics.
//
// Structured as three per-channel sections rather than one blended table,
// because the three APIs report genuinely different things:
//
//   Instagram Graph API  → reach, views, interactions, saves, follows
//   GBP Performance API  → search/maps impressions, direction requests,
//                          calls, website clicks, bookings
//   WhatsApp Cloud API   → conversations and message counts
//
// Forcing those into a shared "likes / comments / shares" grid would mean
// inventing numbers for two of the three. Google has no likes; WhatsApp has
// no reach. The earlier version did exactly that, and it has been unpicked.
//
// A "total reach across all channels" figure is deliberately absent: adding
// Instagram reach to Google impressions to WhatsApp conversations produces a
// number with no meaning that an owner would nonetheless quote.

function AnalyticsPage({ onOpenPost }) {
  const t = useT();
  const [range, setRange] = React.useState('7');
  const { theme } = React.useContext(AppCtx);

  const ig = ANALYTICS_IG, gg = ANALYTICS_GG, wa = ANALYTICS_WA;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">{t.analytics.title}</h1>
          <p className="text-sm text-saf-muted mt-1">{t.analytics.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: '7',  label: t.analytics.filters.last7 },
              { value: '30', label: t.analytics.filters.last30 },
              { value: '90', label: t.analytics.filters.last90 },
            ]}
          />
          <Button variant="secondary" leadingIcon="Download">Export</Button>
        </div>
      </div>

      {/* ── Instagram ─────────────────────────────────────────────────── */}
      <ChannelSection id="ig">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsKpiCard label="Reach"        value={ig.totals.reach}    delta={ig.change.reach}    sparkColor="#B4451F" data={ig.daily.map(d => ({ v: d.reach }))} />
          <AnalyticsKpiCard label="Views"        value={ig.totals.views}    delta={ig.change.views}    sparkColor="#D99A16" data={ig.daily.map(d => ({ v: d.views }))} />
          <AnalyticsKpiCard label="Interactions" value={ig.totals.likes + ig.totals.comments + ig.totals.shares + ig.totals.saves} delta={ig.change.likes} sparkColor="#6E2412" data={ig.daily.map(d => ({ v: d.interactions }))} />
          <AnalyticsKpiCard label="New follows"  value={ig.totals.follows}  delta={ig.change.follows}  sparkColor="#2E7D4F" data={ig.daily.map(d => ({ v: d.interactions / 3 }))} />
        </div>

        <div className="grid grid-cols-12 gap-4 mt-4">
          <Card padding="p-5" className="col-span-12 xl:col-span-8">
            <ChartHeader title="Reach and views" subtitle="Daily, from Instagram account insights" />
            <IgChart data={ig.daily} />
          </Card>
          <Card padding="p-5" className="col-span-12 xl:col-span-4">
            <ChartHeader title="Interaction mix" subtitle="Instagram media insights, trailing 7 days" />
            <InteractionMix totals={ig.totals} />
          </Card>
        </div>
      </ChannelSection>

      {/* ── Google ────────────────────────────────────────────────────── */}
      <ChannelSection id="gg">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsKpiCard label="Search impressions" value={gg.totals.searchImpressions} delta={gg.change.searchImpressions} sparkColor="#B4451F" data={gg.daily.map(d => ({ v: d.searchImpressions }))} />
          <AnalyticsKpiCard label="Maps impressions"   value={gg.totals.mapsImpressions}   delta={gg.change.mapsImpressions}   sparkColor="#D99A16" data={gg.daily.map(d => ({ v: d.mapsImpressions }))} />
          <AnalyticsKpiCard label="Direction requests" value={gg.totals.directionRequests} delta={gg.change.directionRequests} sparkColor="#2E7D4F" data={gg.daily.map(d => ({ v: d.mapsImpressions / 6 }))} />
          <AnalyticsKpiCard label="Bookings"           value={gg.totals.bookings}          delta={gg.change.bookings}          sparkColor="#6E2412" data={gg.daily.map(d => ({ v: d.searchImpressions / 20 }))} />
        </div>

        <div className="grid grid-cols-12 gap-4 mt-4">
          <Card padding="p-5" className="col-span-12 xl:col-span-8">
            <ChartHeader title="Discovery" subtitle="Search vs Maps impressions, from the Business Profile Performance API" />
            <GgChart data={gg.daily} />
          </Card>
          <Card padding="p-5" className="col-span-12 xl:col-span-4">
            <ChartHeader title="Actions taken" subtitle="What people did after finding the listing" />
            <ActionList rows={[
              { label: 'Direction requests', value: gg.totals.directionRequests, change: gg.change.directionRequests, icon: 'Navigation' },
              { label: 'Website clicks',     value: gg.totals.websiteClicks,     change: gg.change.websiteClicks,     icon: 'Link' },
              { label: 'Calls',              value: gg.totals.callClicks,        change: gg.change.callClicks,        icon: 'Phone' },
              { label: 'Bookings',           value: gg.totals.bookings,          change: gg.change.bookings,          icon: 'CalendarCheck' },
            ]} />
          </Card>
        </div>
      </ChannelSection>

      {/* ── WhatsApp ──────────────────────────────────────────────────── */}
      <ChannelSection id="wa">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsKpiCard label="Conversations"  value={wa.totals.conversations} delta={wa.change.conversations} sparkColor="#2E7D4F" data={wa.daily.map(d => ({ v: d.conversations }))} />
          <AnalyticsKpiCard label="Messages in"    value={wa.totals.messagesIn}    delta={wa.change.messagesIn}    sparkColor="#B4451F" data={wa.daily.map(d => ({ v: d.messagesIn }))} />
          <AnalyticsKpiCard label="Messages out"   value={wa.totals.messagesOut}   delta={wa.change.messagesOut}   sparkColor="#D99A16" data={wa.daily.map(d => ({ v: d.messagesOut }))} />
          <AnalyticsKpiCard label="Templates sent" value={wa.totals.templatesSent} delta={wa.change.templatesSent} sparkColor="#6E2412" data={wa.daily.map(d => ({ v: d.conversations / 2 }))} />
        </div>

        <div className="grid grid-cols-12 gap-4 mt-4">
          <Card padding="p-5" className="col-span-12 xl:col-span-8">
            <ChartHeader title="Conversation volume" subtitle="Daily, from the WhatsApp Cloud API" />
            <WaChart data={wa.daily} />
          </Card>
          <Card padding="p-5" className="col-span-12 xl:col-span-4">
            <ChartHeader title="Responsiveness" subtitle="Your own timing over WhatsApp webhooks" />
            <div className="mt-2">
              <div className="text-[36px] font-bold text-saf-text leading-none tabular-nums">{wa.totals.medianResponseMins}<span className="text-[18px] text-saf-muted ms-1">min</span></div>
              <div className="text-[12px] text-saf-muted mt-1">Median first reply</div>
              <p className="text-[12px] text-saf-muted mt-4 leading-relaxed">
                WhatsApp allows free-form replies for 24 hours after a guest messages you.
                Outside that window you can only send an approved template, and it is billed
                per message — which is why speed here is a cost control, not just a courtesy.
              </p>
            </div>
          </Card>
        </div>
      </ChannelSection>

      {/* ── Cross-channel, derived ────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-5" className="col-span-12 xl:col-span-7">
          <ChartHeader title={t.analytics.top} subtitle="Instagram media insights" />
          <TopPostsTable onOpen={onOpenPost} />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-5">
          <ChartHeader title={t.analytics.sentiment.title} subtitle="Derived in-house from the text each API returns" />
          <SentimentChart />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-5">
          <ChartHeader title={t.analytics.breakdown} subtitle="Your own content tagging, weighted by Instagram reach" />
          <BreakdownChart />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-7">
          <ChartHeader title="Instagram audience" subtitle="Followers and engaged accounts — not your guests" />
          <AudienceCard />
        </Card>
      </div>
    </div>
  );
}

// Section wrapper that names the channel AND the API behind it, so nobody has
// to guess where a number came from.
function ChannelSection({ id, children }) {
  const { theme } = React.useContext(AppCtx);
  const p = PLATFORM_BY_ID[id];
  return (
    <section aria-label={`${p.name} analytics`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0"
          style={{ background: p.color }}
        >
          <PlatformGlyph id={id} size={16} />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-saf-text leading-tight">{p.name}</h2>
          <div className="text-[11.5px] text-saf-muted">{p.api}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

// Simple two-series area chart, reused with different keys per channel.
function DualAreaChart({ data, series }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <Recharts.ResponsiveContainer>
        <Recharts.AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`ana-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#FCEFE7" vertical={false} />
          <Recharts.XAxis dataKey="d" stroke="#7A6A5F" tick={{ fontSize: 12 }} />
          <Recharts.YAxis stroke="#7A6A5F" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
          <Recharts.Tooltip content={<EngagementTooltip />} />
          <Recharts.Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
          {series.map(s => (
            <Recharts.Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.4}
              fill={`url(#ana-${s.key})`}
              animationDuration={900}
            />
          ))}
        </Recharts.AreaChart>
      </Recharts.ResponsiveContainer>
    </div>
  );
}


// Shared chart tooltip. Used by the per-channel charts here and by the
// dashboard's engagement chart.
function EngagementTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-saf-border rounded-xl shadow-pop p-3 text-[12px]">
      <div className="font-medium text-saf-text mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-saf-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="text-saf-text font-medium tabular-nums">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IgChart({ data }) {
  return <DualAreaChart data={data} series={[
    { key: 'reach', name: 'Reach', color: '#B4451F' },
    { key: 'views', name: 'Views', color: '#D99A16' },
  ]} />;
}

function GgChart({ data }) {
  return <DualAreaChart data={data} series={[
    { key: 'searchImpressions', name: 'Search', color: '#B4451F' },
    { key: 'mapsImpressions',   name: 'Maps',   color: '#D99A16' },
  ]} />;
}

function WaChart({ data }) {
  return <DualAreaChart data={data} series={[
    { key: 'messagesIn',  name: 'Received', color: '#2E7D4F' },
    { key: 'messagesOut', name: 'Sent',     color: '#D99A16' },
  ]} />;
}

// Instagram interaction split. Saves are broken out deliberately — for a
// restaurant a save is intent to visit, which a like is not.
function InteractionMix({ totals }) {
  const rows = [
    { label: 'Likes',    value: totals.likes,    color: '#B4451F' },
    { label: 'Saves',    value: totals.saves,    color: '#2E7D4F' },
    { label: 'Shares',   value: totals.shares,   color: '#D99A16' },
    { label: 'Comments', value: totals.comments, color: '#6E2412' },
  ];
  const max = Math.max(...rows.map(r => r.value));
  return (
    <div className="space-y-3 mt-2">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-saf-text font-medium">{r.label}</span>
            <span className="text-saf-muted tabular-nums">{fmt(r.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-saf-light overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
      <p className="text-[11.5px] text-saf-muted pt-2 border-t border-saf-border mt-3 leading-relaxed">
        Saves are the metric to watch: a like is applause, a save is someone
        planning to come.
      </p>
    </div>
  );
}

// Google "what happened next" list — the actions the Performance API reports.
function ActionList({ rows }) {
  return (
    <div className="space-y-3 mt-2">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-saf-light grid place-items-center text-saf-primary shrink-0">
            <Icon name={r.icon} size={15} />
          </span>
          <span className="text-[13px] text-saf-text flex-1">{r.label}</span>
          <span className="text-[14px] font-semibold text-saf-text tabular-nums">{fmt(r.value)}</span>
          <span className={`text-[11.5px] tabular-nums w-12 text-end ${r.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {r.change >= 0 ? '+' : ''}{r.change}%
          </span>
        </div>
      ))}
    </div>
  );
}

// Instagram audience demographics. Labelled precisely: these are followers and
// engaged accounts, NOT the people who ate here. For a restaurant those differ
// enormously, and presenting them as guest demographics would mislead.
function AudienceCard() {
  const [tab, setTab] = React.useState('age');
  const a = ANALYTICS_IG.audience;
  const data = a[tab === 'cities' ? 'cities' : tab];
  const max = Math.max(...data.map(d => d.value));
  return (
    <div>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'age',    label: 'Age' },
          { value: 'gender', label: 'Gender' },
          { value: 'cities', label: 'Cities' },
        ]}
      />
      <div className="mt-4 space-y-2.5">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-32 text-[12px] text-saf-muted shrink-0">{d.label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-saf-light overflow-hidden">
              <div className="h-full rounded-full bg-saf-primary transition-all duration-700" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="w-10 text-end text-[12px] text-saf-text tabular-nums">{d.value}%</span>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-saf-muted pt-3 border-t border-saf-border mt-4 leading-relaxed">
        Instagram reports this for your followers and engaged accounts, and
        suppresses it below a follower threshold. It is not a guest census —
        plenty of followers have never eaten here, and plenty of guests do not
        follow you.
      </p>
    </div>
  );
}

function ChartHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="text-[15px] font-semibold text-saf-text">{title}</div>
        {subtitle && <div className="text-[12px] text-saf-muted mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center bg-saf-surface border border-saf-border rounded-full p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 px-3 rounded-full text-[12px] font-medium transition whitespace-nowrap ${value === o.value ? 'bg-white text-saf-primary shadow-sm' : 'text-saf-muted hover:text-saf-text'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function AnalyticsKpiCard({ label, value, delta, suffix = '', sparkColor, data, format }) {
  const trendUp = delta >= 0;
  const fmtFn = format || ((v) => fmt(v));
  return (
    <Card padding="p-5" className="relative overflow-hidden group hover:shadow-pop hover:-translate-y-1 transition-all duration-300 pb-14">
      {/* Foreground content sits above the sparkline. `relative z-10` keeps
          the label / number / delta / footnote readable when the chart fill
          would otherwise wash over them. */}
      <div className="relative z-10">
        <div className="text-[12px] text-slate-500">{label}</div>
        <div className="mt-2 flex items-end gap-2">
          <div className="text-[28px] font-bold text-saf-text leading-none tabular-nums">
            <AnimatedNumber value={value} format={fmtFn} />
          </div>
          <Pill
            tone={trendUp ? 'green' : 'red'}
            className="mb-1"
          >
            <Icon name={trendUp ? 'TrendingUp' : 'TrendingDown'} size={12} />
            <span aria-label={`${trendUp ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} percent`}>
              {trendUp ? '+' : ''}{delta.toFixed(1)}%
            </span>
          </Pill>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">vs previous period</div>
      </div>

      {/* Decorative trend sparkline. Lightened to a soft wash so the
          stroke colour and the foreground text both keep WCAG-AA contrast
          against the card. Marked aria-hidden — the value above conveys
          the data already. The gradient lifts in dark mode so the trend
          stays visible on the deeper card surface. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-12 pointer-events-none opacity-100 dark:opacity-90"
      >
        <Recharts.ResponsiveContainer width="100%" height="100%">
          <Recharts.AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={'g-' + label} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.10} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Recharts.Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2.2} fill={`url(#g-${label})`} />
          </Recharts.AreaChart>
        </Recharts.ResponsiveContainer>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function BreakdownChart() {
  const total = ANALYTICS_BREAKDOWN.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      {/* Donut wrapper — fixed height for Recharts ResponsiveContainer.
          Only contains the chart SVG + the absolutely-positioned center
          label. The legend lives outside so it doesn't overflow this
          fixed-height box (which was the original bug). */}
      <div style={{ width: '100%', height: 240 }} className="relative">
        <Recharts.ResponsiveContainer>
          <Recharts.PieChart>
            <Recharts.Pie data={ANALYTICS_BREAKDOWN} dataKey="value" nameKey="name" innerRadius={68} outerRadius={100} paddingAngle={2} animationDuration={900}>
              {ANALYTICS_BREAKDOWN.map(s => (<Recharts.Cell key={s.name} fill={s.color} stroke="white" strokeWidth={3} />))}
            </Recharts.Pie>
          </Recharts.PieChart>
        </Recharts.ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-saf-muted uppercase tracking-wider">{useT().analytics.ch.totalPosts}</div>
          <div className="text-3xl font-bold text-saf-text"><AnimatedNumber value={total} format={(v) => Math.round(v).toString()} /></div>
        </div>
      </div>
      {/* Legend grid — normal-flow sibling, contained by the parent
          Card's auto-height. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ANALYTICS_BREAKDOWN.map(s => (
          <div key={s.name} className="flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} /><span className="text-saf-muted">{s.name}</span></span>
            <span className="text-saf-text font-medium tabular-nums">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function TopPostsTable({ onOpen }) {
  const t = useT();
  const [sort, setSort] = React.useState('rate');
  const posts = [...POSTS.filter(p => p.status === 'published')]
    .sort((a, b) => {
      if (sort === 'reach') return b.metrics.reach - a.metrics.reach;
      if (sort === 'date')  return new Date(b.date) - new Date(a.date);
      return b.metrics.rate - a.metrics.rate;
    })
    .slice(0, 5);
  return (
    <div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-saf-muted">
              <th className="text-start font-medium px-2 py-2">{t.analytics.table.post}</th>
              <th className="text-start font-medium px-2 py-2">{t.analytics.table.platform}</th>
              <Th label={t.analytics.table.reach} active={sort === 'reach'} onClick={() => setSort('reach')} />
              <Th label={t.analytics.table.eng}   active={sort === 'rate'}  onClick={() => setSort('rate')} />
              <Th label={t.analytics.table.date}  active={sort === 'date'}  onClick={() => setSort('date')} />
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr
                key={p.id}
                onClick={() => onOpen && onOpen(p)}
                className="border-t border-saf-border hover:bg-saf-light/50 cursor-pointer transition"
              >
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.media ? <MockImage tone={p.media.tone} kind={p.media.kind} label="" className="w-12 h-12 shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-saf-light grid place-items-center text-saf-primary shrink-0"><Icon name="FileText" size={18} /></div>}
                    <div className="min-w-0">
                      <div className="text-saf-text font-medium truncate max-w-[260px]">{p.content.slice(0, 60)}…</div>
                      <div className="text-[11px] text-saf-muted">{p.author}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex -space-x-1.5 rtl:space-x-reverse">
                    {p.platforms.map((pi, i) => (
                      <span key={pi} className="w-6 h-6 rounded-full grid place-items-center text-white ring-2 ring-white" style={{ background: PLATFORM_BY_ID[pi].color, zIndex: 10 - i }}>
                        <PlatformGlyph id={pi} size={11} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-saf-text tabular-nums">{fmt(p.metrics.reach)}</td>
                <td className="px-2 py-2.5">
                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                    <Icon name="TrendingUp" size={11} /> {p.metrics.rate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-2 py-2.5 text-saf-muted text-[12px]">{fmtTime(p.date, { withDate: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, active, onClick }) {
  return (
    <th onClick={onClick} className="text-start font-medium px-2 py-2 cursor-pointer hover:text-saf-primary transition select-none whitespace-nowrap">
      <span className={`inline-flex items-center gap-1 ${active ? 'text-saf-primary' : ''}`}>
        {label}
        <Icon name={active ? 'ArrowDown' : 'ArrowUpDown'} size={11} />
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
function SentimentChart() {
  const t = useT();
  return (
    <div className="space-y-3 mt-2">
      {ANALYTICS_SENTIMENT.map(row => {
        const total = row.pos + row.neu + row.neg;
        return (
          <div key={row.platform}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="inline-flex items-center gap-2 text-saf-text font-medium">
                <span className="w-5 h-5 rounded-full grid place-items-center text-white" style={{ background: PLATFORM_BY_ID[PLATFORM_ID_BY_NAME[row.platform]].color }}>
                  <PlatformGlyph id={PLATFORM_ID_BY_NAME[row.platform]} size={9} />
                </span>
                {row.platform}
              </span>
              <span className="text-saf-muted tabular-nums">{row.pos}% positive</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(row.pos/total)*100}%` }} title={`Positive ${row.pos}%`} />
              <div className="bg-amber-400  transition-all duration-700" style={{ width: `${(row.neu/total)*100}%` }} title={`Neutral ${row.neu}%`} />
              <div className="bg-rose-500   transition-all duration-700" style={{ width: `${(row.neg/total)*100}%` }} title={`Negative ${row.neg}%`} />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 text-[11px] text-saf-muted pt-2 border-t border-saf-border mt-3">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{t.analytics.sentiment.pos}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>{t.analytics.sentiment.neu}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>{t.analytics.sentiment.neg}</span>
      </div>
    </div>
  );
}

Object.assign(window, { AnalyticsPage, EngagementTooltip });
