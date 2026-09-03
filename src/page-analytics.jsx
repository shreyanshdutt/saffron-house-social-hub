// Analytics page.

function AnalyticsPage({ onOpenPost }) {
  const t = useT();
  const [range, setRange] = React.useState('7');
  const [platformFilter, setPlatformFilter] = React.useState('all');

  // Filter platform data
  const platformOrder = PLATFORMS.map(p => p.id);
  const visiblePlatforms = platformFilter === 'all' ? platformOrder : [platformFilter];

  // KPI totals
  const totals = React.useMemo(() => {
    const totalReach = ANALYTICS_TIME.reduce((sum, d) =>
      sum + visiblePlatforms.reduce((s, p) => s + (d[p] || 0), 0), 0) * (range === '30' ? 4 : range === '90' ? 12 : 1);
    const totalEng = ANALYTICS_PLATFORM.reduce((sum, row) => {
      const p = PLATFORM_BY_ID[visiblePlatforms[0]].name;
      if (platformFilter !== 'all' && row.p !== p) return sum;
      return sum + row.likes + row.comments + row.shares;
    }, 0);
    return {
      reach: totalReach,
      eng:   totalEng,
      posts: 84 * (range === '30' ? 4 : range === '90' ? 12 : 1),
      rate:  5.4,
    };
  }, [range, platformFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">{t.analytics.title}</h1>
        <p className="text-sm text-saf-muted mt-1">{t.analytics.subtitle}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t.analytics.kpis.reach}
          value={totals.reach} delta={+12.4} sparkColor="#B4451F"
          data={ANALYTICS_TIME.map(d => ({ x: d.d, v: visiblePlatforms.reduce((s,p) => s + (d[p]||0), 0) }))} />
        <KpiCard label={t.analytics.kpis.eng}
          value={totals.eng} delta={+8.1} sparkColor="#D99A16"
          data={ANALYTICS_TIME.map((d, i) => ({ x: d.d, v: 8000 + i * 950 + (i % 2 ? 800 : 0) }))} />
        <KpiCard label={t.analytics.kpis.posts}
          value={totals.posts} delta={-2.6} sparkColor="#6E2412"
          data={ANALYTICS_TIME.map((d, i) => ({ x: d.d, v: 8 + i * 1.5 }))} />
        <KpiCard label={t.analytics.kpis.rate}
          value={totals.rate} suffix="%" format={(v) => v.toFixed(1) + '%'} delta={+0.6} sparkColor="#2E7D4F"
          data={ANALYTICS_TIME.map((d, i) => ({ x: d.d, v: 4 + Math.sin(i) * 1.4 + 1 }))} />
      </div>

      {/* Filters */}
      <Card padding="p-4" className="flex flex-wrap items-center gap-3">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider ltr:mr-2 rtl:ml-2">Filters</div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: '7',   label: t.analytics.filters.last7 },
            { value: '30',  label: t.analytics.filters.last30 },
            { value: '90',  label: t.analytics.filters.last90 },
            { value: 'cu',  label: t.analytics.filters.custom },
          ]}
        />
        <div className="h-6 w-px bg-saf-border mx-1" />
        <button
          onClick={() => setPlatformFilter('all')}
          className={`h-8 px-3 rounded-full text-[12px] font-medium transition ${platformFilter === 'all' ? 'bg-saf-primary text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}
        >{t.analytics.filters.all}</button>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatformFilter(p.id)}
            className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium transition ${platformFilter === p.id ? 'text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}
            style={platformFilter === p.id ? { background: p.color } : {}}
          >
            <PlatformGlyph id={p.id} size={12} />
            {p.name}
          </button>
        ))}
      </Card>

      {/* Charts row 1 */}
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-5" className="col-span-12 xl:col-span-8">
          <ChartHeader title={t.analytics.ch.overTime} subtitle="Engagements per channel" />
          <EngagementChart data={ANALYTICS_TIME} visible={visiblePlatforms} />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-4">
          <ChartHeader title={t.analytics.ch.breakdown} subtitle="Posts by format" />
          <BreakdownChart />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-5" className="col-span-12 xl:col-span-7">
          <ChartHeader title={t.analytics.ch.platforms} subtitle="Likes · Comments · Shares" />
          <PlatformBarChart />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-5">
          <DemographicsCard />
        </Card>
      </div>

      {/* Top posts + sentiment */}
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-5" className="col-span-12 xl:col-span-7">
          <ChartHeader title={t.analytics.ch.top} subtitle="By engagement rate" />
          <TopPostsTable onOpen={onOpenPost} />
        </Card>
        <Card padding="p-5" className="col-span-12 xl:col-span-5">
          <ChartHeader title={t.analytics.ch.sentiment} subtitle="Comment classification" />
          <SentimentChart />
        </Card>
      </div>
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
function KpiCard({ label, value, delta, suffix = '', sparkColor, data, format }) {
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
function EngagementChart({ data, visible }) {
  const palette = { fb: '#1877F2', ig: '#E1306C', tw: '#0F1419', li: '#0A66C2', yt: '#FF0000' };
  return (
    <div style={{ width: '100%', height: 280 }}>
      <Recharts.ResponsiveContainer>
        <Recharts.LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#FCEFE7" />
          <Recharts.XAxis dataKey="d" stroke="#7A6A5F" tick={{ fontSize: 12 }} />
          <Recharts.YAxis stroke="#7A6A5F" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
          <Recharts.Tooltip content={<EngagementTooltip />} />
          <Recharts.Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
          {visible.map(p => (
            <Recharts.Line key={p} type="monotone" dataKey={p} stroke={palette[p]} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} animationDuration={900} name={PLATFORM_BY_ID[p].name} />
          ))}
        </Recharts.LineChart>
      </Recharts.ResponsiveContainer>
    </div>
  );
}

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
function PlatformBarChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <Recharts.ResponsiveContainer>
        <Recharts.BarChart data={ANALYTICS_PLATFORM} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barCategoryGap={24}>
          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#FCEFE7" vertical={false} />
          <Recharts.XAxis dataKey="p" stroke="#7A6A5F" tick={{ fontSize: 12 }} />
          <Recharts.YAxis stroke="#7A6A5F" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
          <Recharts.Tooltip cursor={{ fill: '#FCEFE7' }} content={<EngagementTooltip />} />
          <Recharts.Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
          <Recharts.Bar dataKey="likes"    name="Likes"    fill="#B4451F" radius={[6,6,0,0]} animationDuration={900} />
          <Recharts.Bar dataKey="comments" name="Comments" fill="#D99A16" radius={[6,6,0,0]} animationDuration={1100} />
          <Recharts.Bar dataKey="shares"   name="Shares"   fill="#6E2412" radius={[6,6,0,0]} animationDuration={1300} />
        </Recharts.BarChart>
      </Recharts.ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DemographicsCard() {
  const t = useT();
  const [tab, setTab] = React.useState('age');
  const data = ANALYTICS_DEMO[tab];
  return (
    <>
      <ChartHeader title={t.analytics.ch.demo} subtitle="Audience composition" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'age',       label: t.analytics.demoTabs.age },
          { id: 'gender',    label: t.analytics.demoTabs.gender },
          { id: 'locations', label: t.analytics.demoTabs.locations },
        ]}
      />
      <div className="mt-4 space-y-3">
        {data.map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-saf-text">{d.label}</span>
              <span className="text-saf-muted tabular-nums">{d.value}%</span>
            </div>
            <div className="h-2 bg-saf-light rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-saf-primary to-saf-accent rounded-full transition-all duration-700"
                style={{ width: `${d.value * 2}%`, maxWidth: '100%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

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

Object.assign(window, { AnalyticsPage });
