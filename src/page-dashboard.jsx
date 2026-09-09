// Dashboard (home view) — gives an overview before composer.

// GATED, as of part 3. The three post-shaped panels below read the server, so
// an unreachable service must show as unreachable rather than as a restaurant
// that published nothing — the same rule Establishments and Competitors follow.
function DashboardPage({ onNavigate, onOpenPost }) {
  return (
    <RequiresServerData what="posts and the schedule">
      <DashboardPageInner onNavigate={onNavigate} onOpenPost={onOpenPost} />
    </RequiresServerData>
  );
}

function DashboardPageInner({ onNavigate, onOpenPost }) {
  const t = useT();
  const { lang } = React.useContext(AppCtx);

  // KPI totals. The restaurant reordering matters: rating and unanswered
  // reviews lead, because those are the two numbers that move covers. Reach
  // is a marketing metric and sits third.
  const TODAY = '2026-09-03';
  const rating = REVIEW_STATS.avg;
  const unanswered = REVIEWS.filter(r => !r.replied).length;
  const coversBooked = 96;
  // Derived, not hand-written: this strip sits next to the Reviews screen and
  // the two must never disagree about how many reviews are past SLA.
  const pastSla = REVIEW_STATS.unansweredCritical;
  // REACH TODAY, AND WHAT IT ACTUALLY SUMS.
  //
  // It was never "the reach of everything published today": every seeded post
  // carries metricsFrom 'ig', so the figure has always been Instagram's alone,
  // and three of those posts also went to Google. Now that metrics live per
  // target, that is visible instead of implied — `postMetrics()` sums only the
  // targets that HAVE figures and reports which channels they cover.
  //
  // A published post with no measured target contributes nothing rather than a
  // zero, so `measuredOf` can be smaller than `publishedToday`. When it is, the
  // strip says so rather than presenting a partial total as a complete one.
  const publishedToday = publishedPosts().filter(p => p.date && p.date.startsWith(TODAY));
  const measuredToday = publishedToday.filter(p => p.metrics);
  const reachToday = measuredToday.reduce((s, p) => s + p.metrics.reach, 0);
  const reachChannels = [...new Set(measuredToday.flatMap(p => p.metrics.measuredOn))];
  const reachIsPartial = measuredToday.length < publishedToday.length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-saf-text">{t.dashboard.title}</h1>
          <p className="text-sm text-saf-muted mt-1">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon="Calendar">{(new Date('2026-09-04T09:00:00+05:30')).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Button>
          <Button variant="primary" leadingIcon="PenSquare" onClick={() => onNavigate('compose')}>{t.dashboard.qCompose}</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashKpi label={t.dashboard.todayPosts} value={rating}       icon="Star"           tone="bg-amber-50 text-amber-600"          delta={`${(REVIEW_STATS.avg - REVIEW_STATS.avgPrev).toFixed(1)} vs prev 90d`} format={(v) => v.toFixed(1)} />
        <DashKpi label={t.dashboard.pending}    value={unanswered}   icon="MessageSquare"  tone="bg-rose-50 text-rose-600"            delta={`${pastSla} critical past SLA`} format={(v) => Math.round(v).toString()} />
        {/* The delta line says WHAT WAS SUMMED rather than an invented "+12%".
            These figures cover only the channels that reported them, and when a
            post published today has no measured target the total is a floor,
            not a total — so it says that instead of quietly under-reporting. */}
        <DashKpi label={t.dashboard.reachToday} value={reachToday}   icon="Eye"            tone="bg-saf-primary/10 text-saf-primary"
          delta={publishedToday.length === 0
            ? 'nothing published today'
            : reachIsPartial
              ? `${measuredToday.length} of ${publishedToday.length} posts measured`
              : `from ${reachChannels.map(c => PLATFORM_BY_ID[c] ? PLATFORM_BY_ID[c].name : c).join(', ')}`} />
        <DashKpi label={t.dashboard.scheduledN} value={coversBooked} icon="CalendarClock"  tone="bg-emerald-50 text-emerald-600"      delta="of 140 seats" format={(v) => Math.round(v).toString()} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Live engagement */}
        <Card padding="p-5" className="col-span-12 xl:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-semibold text-saf-text">Engagement today</div>
              <div className="text-[12px] text-saf-muted">Hourly engagements across all channels</div>
            </div>
            <Button variant="ghost" size="sm" leadingIcon="BarChart3" onClick={() => onNavigate('analytics')}>{t.dashboard.qAnalytics}</Button>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <Recharts.ResponsiveContainer>
              <Recharts.AreaChart data={hourSeries()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#B4451F" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#B4451F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#FCEFE7" vertical={false} />
                <Recharts.XAxis dataKey="h" stroke="#7A6A5F" tick={{ fontSize: 11 }} />
                <Recharts.YAxis stroke="#7A6A5F" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                <Recharts.Tooltip content={<EngagementTooltip />} />
                <Recharts.Area type="monotone" dataKey="v" stroke="#B4451F" strokeWidth={2.5} fill="url(#dash-grad)" name="Engagements" />
              </Recharts.AreaChart>
            </Recharts.ResponsiveContainer>
          </div>
        </Card>

        {/* Quick actions */}
        <Card padding="p-5" className="col-span-12 xl:col-span-4">
          <div className="text-[15px] font-semibold text-saf-text mb-3">{t.dashboard.quick}</div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction icon="PenSquare"     label={t.dashboard.qCompose}   onClick={() => onNavigate('compose')}  tone="bg-saf-primary text-white hover:brightness-110" />
            <QuickAction icon="Star" label={t.dashboard.qReply}     onClick={() => onNavigate('reviews')} tone="bg-white border border-saf-border text-saf-text hover:bg-saf-light" />
            <QuickAction icon="CalendarClock" label={t.dashboard.qSchedule}  onClick={() => onNavigate('scheduled')} tone="bg-white border border-saf-border text-saf-text hover:bg-saf-light" />
            <QuickAction icon="BarChart3"     label={t.dashboard.qAnalytics} onClick={() => onNavigate('analytics')} tone="bg-white border border-saf-border text-saf-text hover:bg-saf-light" />
          </div>

          <div className="border-t border-saf-border my-4" />

          <div className="text-[13px] font-medium text-saf-text mb-2">{t.dashboard.activity}</div>
          <div className="space-y-2">
            {ACTIVITY.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                  a.icon === 'check' ? 'bg-emerald-50 text-emerald-600' :
                  a.icon === 'alert' ? 'bg-amber-50 text-amber-600' :
                  a.icon === 'message' ? 'bg-saf-light text-saf-primary' :
                  a.icon === 'calendar' ? 'bg-saf-accent/15 text-saf-accent' :
                  'bg-rose-50 text-rose-600'
                }`}>
                  <Icon name={
                    a.icon === 'check' ? 'CheckCircle2' :
                    a.icon === 'alert' ? 'AlertTriangle' :
                    a.icon === 'message' ? 'MessageSquare' :
                    a.icon === 'calendar' ? 'CalendarClock' :
                    'ThumbsUp'
                  } size={13} />
                </span>
                <div className="flex-1">
                  <div className="text-[12px] text-saf-text leading-snug">{a.text}</div>
                  <div className="text-[10px] text-saf-muted">{a.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Up next + Top posts */}
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-5" className="col-span-12 xl:col-span-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold text-saf-text">{t.dashboard.upcoming}</div>
            <Button variant="ghost" size="sm" trailingIcon="ChevronRight" onClick={() => onNavigate('scheduled')}>View all</Button>
          </div>
          <div className="space-y-2">
            {scheduledPosts().slice(0, 3).map(s => {
              const d = new Date(s.when);
              return (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-saf-border hover:border-saf-primary/30 hover:bg-saf-light/40 transition">
                  <div className="shrink-0 w-14 text-center">
                    <div className="text-[10px] uppercase text-saf-muted">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-[16px] font-bold text-saf-primary leading-tight">{d.getDate()}</div>
                    <div className="text-[10px] text-saf-muted">{String(d.getHours()).padStart(2,'0')}:{String(d.getMinutes()).padStart(2,'0')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      {s.platforms.map(pi => (
                        <span key={pi} className="w-4 h-4 rounded-full grid place-items-center text-white" style={{ background: PLATFORM_BY_ID[pi].color }}>
                          <PlatformGlyph id={pi} size={8} />
                        </span>
                      ))}
                    </div>
                    <div className="text-[13px] text-saf-text line-clamp-2">{s.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="p-5" className="col-span-12 xl:col-span-7">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold text-saf-text">Top performing posts</div>
            <Button variant="ghost" size="sm" trailingIcon="ChevronRight" onClick={() => onNavigate('history')}>See all</Button>
          </div>
          <div className="space-y-2">
            {/* Ranked on a rate that only a measured target has, so the list is
                drawn from posts WITH figures — asking for numbers, not for a
                status. `measuredPosts()` is that question; a post with no
                metrics cannot be ranked and is absent rather than last. */}
            {measuredPosts().filter(p => p.metrics && Number.isFinite(p.metrics.rate)).sort((a,b) => b.metrics.rate - a.metrics.rate).slice(0, 3).map(p => (
              <button
                key={p.id}
                onClick={() => onOpenPost(p)}
                className="w-full text-start flex items-center gap-3 p-2 rounded-lg hover:bg-saf-light/40 transition"
              >
                {p.media ? <MockImage tone={p.media.tone} kind={p.media.kind} label="" className="w-16 h-16 shrink-0" /> : <div className="w-16 h-16 rounded-lg bg-saf-light grid place-items-center text-saf-primary shrink-0"><Icon name="FileText" size={20} /></div>}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-saf-text line-clamp-2">{p.content}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-saf-muted">
                    <Stat icon="Eye" value={p.metrics.reach} />
                    <Stat icon="Heart" value={p.metrics.likes} />
                    <Stat icon="MessageCircle" value={p.metrics.comments} />
                    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                      <Icon name="TrendingUp" size={10} />{p.metrics.rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashKpi({ label, value, icon, tone, delta, format }) {
  const fmtFn = format || ((v) => fmt(v));
  return (
    <Card padding="p-5" className="hover:shadow-pop hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] text-saf-muted">{label}</div>
          <div className="text-[26px] font-bold text-saf-text leading-none mt-2 tabular-nums">
            <AnimatedNumber value={value} format={fmtFn} />
          </div>
          <div className="text-[11px] text-saf-muted mt-1.5">{delta}</div>
        </div>
        <span className={`w-10 h-10 rounded-xl grid place-items-center ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
    </Card>
  );
}

function QuickAction({ icon, label, onClick, tone }) {
  return (
    <button onClick={onClick} className={`h-20 rounded-xl flex flex-col items-center justify-center gap-1.5 transition ${tone}`}>
      <Icon name={icon} size={20} />
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}

function hourSeries() {
  // 8am..6pm hourly engagement
  const hours = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm'];
  const values = [820, 1240, 2410, 2980, 3120, 2540, 3340, 4120, 4810, 4220, 3640];
  return hours.map((h, i) => ({ h, v: values[i] }));
}

Object.assign(window, { DashboardPage });
