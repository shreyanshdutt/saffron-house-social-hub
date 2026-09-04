// Social Listening — Overview screen.
// Informational only. Five-KPI strip + three feature panels. Panels are
// clickable; KPI cards are not (insights-vs-action asymmetry — same
// principle that makes Signals the one action surface).
//
// This file is loaded by index.html alongside the other per-screen files
// and the shell (src/page-listening.jsx). Everything assigned to `window`
// at the bottom; the shell references OverviewScreen by bare name in JSX.

function OverviewScreen({ state, theme, onGoSignals, onGoTrends, onGoCompetitors }) {
  const t = useT();

  const visibleSignals = LISTENING_SIGNALS.filter(s => !state.dismissed.includes(s.id));
  const unreadCount = visibleSignals.filter(s => !state.read.includes(s.id)).length;
  const criticalCount = visibleSignals.filter(s => s.severity === 'critical').length;

  // Panel sources, derived rather than hardcoded — if the seed changes,
  // the panels follow without code edits.
  const topTrend = visibleSignals.find(s => s.kind === 'volume_spike' && s.severity === 'warn')
                || visibleSignals.find(s => s.kind === 'volume_spike');
  const topCompetitor = visibleSignals.find(s => s.kind === 'competitor_move' && s.severity === 'warn')
                     || visibleSignals.find(s => s.kind === 'competitor_move');
  const topCritical = visibleSignals.find(s => s.kind === 'crisis_cluster')
                   || visibleSignals.find(s => s.severity === 'critical');

  const kp = LISTENING_KPIS;
  // Mentions / Reach are integer counts — % change is the natural metric.
  const mentionsChangePct = pctChange(kp.mentions.current, kp.mentions.baseline);
  const reachChangePct    = pctChange(kp.reach.current,    kp.reach.baseline);
  // Sentiment uses an absolute delta on the [-1,1] scale (a % change on
  // sentiment is misleading — moving 0.10 -> 0.20 is "100%" but actually
  // a small absolute shift; the reader cares about the absolute number).
  const sentimentDelta = kp.netSentiment.current - kp.netSentiment.baseline;
  // Direction requests are an integer count, like mentions and reach — so a
  // % change against the prior window is the natural metric here too.
  const dirChangePct = Math.round(((kp.directionRequests.current - kp.directionRequests.baseline) / kp.directionRequests.baseline) * 100);

  return (
    <div id="listening-overview" role="tabpanel" className="space-y-6">
      {/* KPI strip — 2 columns on mobile, 5 on lg+. flex-wrap would also
          work; grid gives more predictable column widths. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <ListeningKpiCard
          label={t.listening.overview.kpi.totalMentions}
          value={kp.mentions.current}
          deltaText={fmtPctChange(mentionsChangePct)}
          deltaUp={mentionsChangePct >= 0}
          subLabel={t.listening.overview.kpi.vsPrior}
          sparkline={kp.mentions.sparkline}
          sparkColor="#B4451F"
        />
        <ListeningKpiCard
          label={t.listening.overview.kpi.reach}
          value={fmtCompact(kp.reach.current)}
          deltaText={fmtPctChange(reachChangePct)}
          deltaUp={reachChangePct >= 0}
          subLabel={t.listening.overview.kpi.vsPrior}
          sparkline={kp.reach.sparkline}
          sparkColor="#D99A16"
        />
        <ListeningKpiCard
          label={t.listening.overview.kpi.netSentiment}
          value={(kp.netSentiment.current >= 0 ? '+' : '') + kp.netSentiment.current.toFixed(2)}
          deltaText={(sentimentDelta >= 0 ? '+' : '') + sentimentDelta.toFixed(2)}
          deltaUp={sentimentDelta >= 0}
          subLabel={t.listening.overview.kpi.vsPrior}
          sparkline={kp.netSentiment.sparkline}
          sparkColor="#2E7D4F"
        />
        <ListeningKpiCard
          label={t.listening.overview.kpi.directionRequests}
          value={fmt(kp.directionRequests.current)}
          deltaText={(dirChangePct >= 0 ? '+' : '') + dirChangePct + '%'}
          deltaUp={dirChangePct >= 0}
          subLabel={t.listening.overview.kpi.vsPrior}
          sparkline={kp.directionRequests.sparkline}
          sparkColor="#B7791F"
        />
        <ActiveSignalsKpi
          label={t.listening.overview.kpi.activeSignals}
          unread={unreadCount}
          critical={criticalCount}
          breakdownTemplate={t.listening.overview.kpi.activeSignalsBreakdown}
        />
      </div>

      {/* Three feature panels. Each routes to its deeper screen on click. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelTopTrend     signal={topTrend}      onClick={onGoTrends}      t={t} />
        <PanelTopCompetitor signal={topCompetitor} onClick={onGoCompetitors} t={t} />
        <PanelTopCritical  signal={topCritical}    theme={theme} onClick={(id) => onGoSignals(id)} t={t} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI helpers — Overview-only.

function pctChange(current, baseline) {
  if (!baseline) return 0;
  return Math.round(((current - baseline) / baseline) * 100);
}
function fmtPctChange(pct) {
  return (pct >= 0 ? '+' : '') + pct + '%';
}

function ListeningKpiCard({ label, value, deltaText, deltaUp, subLabel, sparkline, sparkColor }) {
  return (
    <Card padding="p-4" className="relative overflow-hidden">
      <div className="text-[11px] uppercase tracking-wider font-medium text-saf-muted">{label}</div>
      <div className="mt-1.5 flex items-end gap-2" dir="ltr">
        <div className="text-[22px] font-bold text-saf-text leading-none tabular-nums">
          {typeof value === 'number' ? fmt(value) : value}
        </div>
        {deltaText && (
          <Pill tone={deltaUp ? 'green' : 'red'} className="mb-0.5">
            <Icon name={deltaUp ? 'TrendingUp' : 'TrendingDown'} size={10} />
            <span>{deltaText}</span>
          </Pill>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-saf-muted">{subLabel}</div>
      {sparkline && (
        <div className="mt-2" dir="ltr">
          <Sparkline data={sparkline} width={180} height={28} stroke={sparkColor} className="w-full h-7" />
        </div>
      )}
    </Card>
  );
}

function ActiveSignalsKpi({ label, unread, critical, breakdownTemplate }) {
  const breakdown = breakdownTemplate
    .replace('{unread}', String(unread))
    .replace('{critical}', String(critical));
  return (
    <Card padding="p-4" className="relative overflow-hidden">
      <div className="text-[11px] uppercase tracking-wider font-medium text-saf-muted">{label}</div>
      <div className="mt-1.5 flex items-end gap-3" dir="ltr">
        <div className="leading-none">
          <div className="text-[22px] font-bold text-saf-text tabular-nums">{unread}</div>
          <div className="text-[10px] uppercase tracking-wider font-medium text-saf-muted mt-1">unread</div>
        </div>
        <div className="leading-none">
          <div className={`text-[22px] font-bold tabular-nums ${critical > 0 ? 'text-rose-600' : 'text-saf-text'}`}>{critical}</div>
          <div className="text-[10px] uppercase tracking-wider font-medium text-saf-muted mt-1">critical</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-saf-muted">{breakdown}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Three feature panels. Each panel is rendered as a <button> so it's
// keyboard-focusable and announces as an interactive element. Click
// routes to the deeper screen.

function PanelShell({ title, ctaLabel, onClick, ariaLabel, children, tone = 'default' }) {
  const toneCls = tone === 'rose'
    ? 'border-rose-200 hover:border-rose-300 dark:border-rose-300/40'
    : 'border-saf-border hover:border-saf-primary/60';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`group text-start bg-white rounded-2xl border ${toneCls} shadow-card hover:shadow-pop transition-all p-4 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-saf-surface`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider font-medium text-saf-muted">{title}</div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-saf-primary opacity-70 group-hover:opacity-100 transition-opacity">
          {ctaLabel}
          <Icon name="ArrowRight" size={12} className="rtl:flip-x" />
        </span>
      </div>
      {children}
    </button>
  );
}

function PanelTopTrend({ signal, onClick, t }) {
  if (!signal) return null;
  return (
    <PanelShell
      title={t.listening.overview.panel.topTrendTitle}
      ctaLabel={t.listening.overview.panel.topTrendCta}
      onClick={onClick}
      ariaLabel={`${t.listening.overview.panel.topTrendTitle}: ${signal.title}. ${t.listening.overview.panel.topTrendCta}.`}
    >
      <div className="text-[14px] font-semibold text-saf-text mb-0.5">{signal.title}</div>
      <div className="text-[12px] text-saf-muted mb-2">{signal.body}</div>
      <div dir="ltr">
        <Sparkline data={LISTENING_KPIS.mentions.sparkline} width={220} height={36} stroke="#B4451F" className="w-full h-9" />
      </div>
    </PanelShell>
  );
}

function PanelTopCompetitor({ signal, onClick, t }) {
  if (!signal) return null;
  return (
    <PanelShell
      title={t.listening.overview.panel.topCompetitorTitle}
      ctaLabel={t.listening.overview.panel.topCompetitorCta}
      onClick={onClick}
      ariaLabel={`${t.listening.overview.panel.topCompetitorTitle}: ${signal.title}. ${t.listening.overview.panel.topCompetitorCta}.`}
    >
      <div className="text-[14px] font-semibold text-saf-text mb-0.5">{signal.title}</div>
      <div className="text-[12px] text-saf-muted mb-3">{signal.body}</div>
      <div className="flex items-center gap-4 text-[12px] text-saf-muted">
        <span><strong className="text-saf-text font-medium">{fmtCompact(signal.metrics.reach)}</strong> reach</span>
        <span className="text-emerald-700">+{signal.metrics.changePct}%</span>
      </div>
    </PanelShell>
  );
}

// Panel 3 reuses the visual primitives but is not a SignalCard — the spec
// asks for read-only (no action row, no chip row, whole card clickable),
// and folding a variant prop into SignalCard would introduce 4 branches
// in an already-long component. A small sibling renderer is cleaner.
function PanelTopCritical({ signal, theme, onClick, t }) {
  if (!signal) return null;
  const p = PLATFORM_BY_ID[signal.channel];
  return (
    <PanelShell
      title={t.listening.overview.panel.topCriticalTitle}
      ctaLabel={t.listening.overview.panel.topCriticalCta}
      onClick={() => onClick(signal.id)}
      ariaLabel={`${t.listening.overview.panel.topCriticalTitle}: ${signal.title}. ${t.listening.overview.panel.topCriticalCta}.`}
      tone="rose"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-full grid place-items-center bg-rose-500 text-white shrink-0"
        >
          <Icon name="AlertOctagon" size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 h-5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-rose-500 text-white">
              <Icon name="AlertOctagon" size={10} />
              <span>Crisis cluster</span>
            </span>
            <span className="text-[11px] text-rose-700">{signal.children?.length || 0} incidents · {signal.t}</span>
          </div>
          <div className="text-[14px] font-semibold text-rose-700 mb-0.5">{signal.title}</div>
          <div className="text-[12px] text-saf-text">{signal.body}</div>
          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-rose-700 font-medium">
            <span>{fmtCompact(signal.metrics.mentions)} mentions</span>
            <span>+{signal.metrics.changePct}%</span>
            <span>Sentiment {signal.metrics.sentiment.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

window.OverviewScreen = OverviewScreen;
