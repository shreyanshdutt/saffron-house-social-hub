// Actions — the ranked output of the recommendation engine.
//
// The engine (src/recommend.jsx) computes these from the listening, review,
// menu and analytics data. This screen only renders and tracks them.
//
// Two deliberate choices worth defending:
//
//   1. Every card shows its evidence with the source of each number, badged by
//      whether that source is live-available, needs a partner integration, or
//      is derived in-house. A recommendation an owner cannot trace is a
//      recommendation they will not act on — and one built on data you cannot
//      actually get in production is worse than none at all.
//
//   2. Nothing here executes. The actions happen in a kitchen, on a partner
//      dashboard, in a menu meeting. The screen's job is to say what to do,
//      who owns it, where it happens, and to track whether it got done.

function RecommendationsPage({ role, onNavigate }) {
  const { theme } = React.useContext(AppCtx);
  const toast = useToast();

  // Keyed on the sync version so recommendations regenerate against freshly
  // pulled competitor data rather than a stale snapshot.
  const all = React.useMemo(() => generateRecommendations(), [SYNC_VERSION.value]);
  const syncState = syncStateLoad();
  const [state, setState] = React.useState(() => recsLoad());
  const [kind, setKind] = React.useState('all');
  const [status, setStatus] = React.useState('open');
  const [mine, setMine] = React.useState(false);
  const [expanded, setExpanded] = React.useState(() => new Set());

  const update = React.useCallback((patch) => {
    setState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      recsSave(next);
      return next;
    });
  }, []);

  const setRecStatus = (rec, value) => {
    update(prev => ({ ...prev, status: { ...prev.status, [rec.id]: value } }));
    const verb = { accepted: 'Accepted', done: 'Marked done', dismissed: 'Dismissed' }[value];
    toast.push({ title: `${verb}`, desc: rec.title, kind: value === 'dismissed' ? 'info' : 'success' });
  };

  const statusOf = (rec) => state.status[rec.id] || 'new';

  const filtered = React.useMemo(() => {
    return all.filter(r => {
      const st = statusOf(r);
      if (kind !== 'all' && r.kind !== kind) return false;
      if (status === 'open' && (st === 'done' || st === 'dismissed')) return false;
      if (status === 'done' && st !== 'done') return false;
      if (status === 'dismissed' && st !== 'dismissed') return false;
      if (mine && r.owner !== role) return false;
      return true;
    });
  }, [all, state, kind, status, mine, role]);

  const open = all.filter(r => !['done', 'dismissed'].includes(statusOf(r)));
  const kindCounts = React.useMemo(() => {
    const c = {};
    open.forEach(r => { c[r.kind] = (c[r.kind] || 0) + 1; });
    return c;
  }, [all, state]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-saf-text">Actions</h1>
          <p className="text-sm text-saf-muted mt-1">
            Computed from this week's reviews, menu conversation, listening signals and channel
            performance. Ranked by expected value. Nothing here posts for you — these get done in
            the kitchen, on the Google listing, or in the composer.
            {syncState.lastSyncedAt
              ? <> Competitor data last synced {relTime(syncState.lastSyncedAt)}.</>
              : <> Competitor data has never been synced — run a sync from the Competitors tab.</>}
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon="Download"
          onClick={() => {
            const csv = buildCsv([
              ['rank', 'score', 'kind', 'title', 'action', 'owner', 'where', 'window', 'status', 'impact', 'confidence', 'effort', 'evidence'],
              ...filtered.map((r, i) => ([
                i + 1, r.score, REC_KINDS[r.kind].label, r.title, r.action,
                PROFILES[r.owner].role, r.where, r.window, statusOf(r),
                r.impact, r.confidence, r.effort,
                r.evidence.map(e => `${e.label}: ${e.value}`).join(' | '),
              ])),
            ]);
            downloadCsv(`saffron-house-actions-${reviewDateSlug()}.csv`, csv);
            toast.push({ title: `${filtered.length} actions exported`, kind: 'success' });
          }}
        >
          Export CSV
        </Button>
      </div>

      <RecSummary open={open} kindCounts={kindCounts} />

      {/* Filters */}
      <Card padding="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[12px] text-saf-muted uppercase tracking-wider me-1">Filters</div>

          <button
            onClick={() => setKind('all')}
            className={`h-8 px-3 rounded-full text-[12px] font-medium transition ${kind === 'all' ? 'bg-saf-primary text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}
          >
            All ({open.length})
          </button>
          {Object.entries(REC_KINDS).map(([k, meta]) => {
            const n = kindCounts[k] || 0;
            if (!n) return null;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium transition ${kind === k ? 'bg-saf-primary text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}
              >
                <Icon name={meta.icon} size={13} />
                {meta.label} ({n})
              </button>
            );
          })}

          <div className="h-6 w-px bg-saf-border mx-1" />

          <label htmlFor="rec-status" className="sr-only">Status</label>
          <select
            id="rec-status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20 transition"
          >
            <option value="open">Open</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>

          <button
            onClick={() => setMine(m => !m)}
            aria-pressed={mine}
            className={`h-8 px-3 rounded-full text-[12px] font-medium transition border ${mine ? 'bg-saf-light border-saf-primary text-saf-primary' : 'bg-white border-saf-border text-saf-muted hover:text-saf-text'}`}
          >
            Mine only
          </button>

          <span className="ms-auto text-[12px] text-saf-muted">
            {filtered.length} shown
          </span>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card padding="p-10">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-700">
              <Icon name="Check" size={26} />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-saf-text">Nothing in this view</div>
            <div className="text-[13px] text-saf-muted mt-1">
              Either everything is handled, or the filters are hiding it.
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, i) => (
            <RecCard
              key={rec.id}
              rec={rec}
              rank={i + 1}
              status={statusOf(rec)}
              theme={theme}
              expanded={expanded.has(rec.id)}
              onToggle={() => toggleExpand(rec.id)}
              onStatus={(v) => setRecStatus(rec, v)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <MethodNote />
    </div>
  );
}

// --- Summary -----------------------------------------------------------------
function RecSummary({ open, kindCounts }) {
  const top = open[0];
  const urgent = open.filter(r => r.score >= 55).length;
  const quickWins = open.filter(r => r.effort <= 0.25 && r.score >= 40).length;

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 lg:col-span-5">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">If you do one thing</div>
        {top ? (
          <>
            <div className="mt-1.5 text-[17px] font-semibold text-saf-text leading-snug">{top.title}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[12px]">
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-saf-light text-saf-primary font-semibold">
                <Icon name={REC_KINDS[top.kind].icon} size={11} />
                {REC_KINDS[top.kind].label}
              </span>
              <span className="text-saf-muted">Score {top.score}</span>
              <span className="text-saf-muted">·</span>
              <span className="text-saf-muted">{PROFILES[top.owner].role}</span>
            </div>
          </>
        ) : (
          <div className="mt-2 text-[14px] text-saf-muted">Queue is clear.</div>
        )}
      </Card>

      <Card className="col-span-6 lg:col-span-2">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">Open</div>
        <div className="text-[32px] font-bold text-saf-text leading-none mt-2">{open.length}</div>
        <div className="text-[11.5px] text-saf-muted mt-1">across {Object.keys(kindCounts).length} categories</div>
      </Card>

      <Card className="col-span-6 lg:col-span-2">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">High value</div>
        <div className="text-[32px] font-bold text-saf-text leading-none mt-2">{urgent}</div>
        <div className="text-[11.5px] text-saf-muted mt-1">scoring 55 or above</div>
      </Card>

      <Card className="col-span-12 lg:col-span-3">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">Quick wins</div>
        <div className="text-[32px] font-bold text-saf-text leading-none mt-2">{quickWins}</div>
        <div className="text-[11.5px] text-saf-muted mt-1">
          Low effort, meaningful score — clear these first if the week is short.
        </div>
      </Card>
    </div>
  );
}

// --- Card --------------------------------------------------------------------
function RecCard({ rec, rank, status, theme, expanded, onToggle, onStatus, onNavigate }) {
  const meta = REC_KINDS[rec.kind];
  const owner = PROFILES[rec.owner];
  const done = status === 'done';
  const dismissed = status === 'dismissed';
  const muted = done || dismissed;

  return (
    <Card padding="p-4" className={muted ? 'opacity-60' : ''}>
      <div className="flex items-start gap-3">
        {/* Rank + score */}
        <div className="w-12 shrink-0 text-center">
          <div className="text-[11px] text-saf-muted">#{rank}</div>
          <div className="mt-0.5 h-9 rounded-lg bg-saf-light grid place-items-center">
            <span className="text-[15px] font-bold text-saf-primary tabular-nums">{rec.score}</span>
          </div>
          <div className="text-[9.5px] text-saf-muted mt-0.5 uppercase tracking-wide">score</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-saf-light text-saf-primary text-[11px] font-semibold">
              <Icon name={meta.icon} size={11} />
              {meta.label}
            </span>
            {rec.channels.map(c => (
              <span key={c} className="inline-flex items-center gap-1 text-[11px] text-saf-muted">
                <span style={{ color: platformColor(c, theme) }}><PlatformGlyph id={c} size={12} /></span>
                {PLATFORM_BY_ID[c].name}
              </span>
            ))}
            {done && <span className="px-2 h-6 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">Done</span>}
            {dismissed && <span className="px-2 h-6 inline-flex items-center rounded-full bg-slate-100 text-saf-muted text-[11px] font-semibold">Dismissed</span>}
            {status === 'accepted' && <span className="px-2 h-6 inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">In progress</span>}
          </div>

          <h3 className={`mt-1.5 text-[15.5px] font-semibold text-saf-text leading-snug ${done ? 'line-through' : ''}`}>
            {rec.title}
          </h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-saf-muted">{rec.detail}</p>

          {/* The action itself */}
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-saf-surface border border-saf-border">
            <Icon name="ArrowRight" size={15} className="text-saf-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-saf-text">{rec.action}</div>
              <div className="text-[11.5px] text-saf-muted mt-0.5">
                {owner.role} · {rec.where} · {rec.window}
              </div>
            </div>
            {rec.projected && (
              <div className="ms-auto text-end shrink-0 ps-2">
                <div className="text-[13px] font-semibold text-saf-text">{rec.projected}</div>
                <div className="text-[10.5px] text-saf-muted">projected</div>
              </div>
            )}
          </div>

          {/* Evidence */}
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-saf-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary rounded"
          >
            <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={13} />
            {expanded ? 'Hide' : 'Why this'} — {rec.evidence.length} inputs
          </button>

          {expanded && (
            <div className="mt-2 rounded-xl border border-saf-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12.5px]">
                  <caption className="sr-only">Evidence behind this recommendation, with the source of each figure</caption>
                  <thead>
                    <tr className="bg-saf-surface text-[11px] uppercase tracking-wider text-saf-muted">
                      <th scope="col" className="text-start font-medium px-3 py-2">Input</th>
                      <th scope="col" className="text-start font-medium px-3 py-2">Value</th>
                      <th scope="col" className="text-start font-medium px-3 py-2">Where it comes from</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-saf-border">
                    {rec.evidence.map((e, i) => {
                      const src = REC_SOURCES[e.source];
                      return (
                        <tr key={i}>
                          <th scope="row" className="text-start font-normal px-3 py-2 text-saf-muted">{e.label}</th>
                          <td className="px-3 py-2 text-saf-text font-medium">{e.value}</td>
                          <td className="px-3 py-2">
                            <SourceBadge src={src} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Score arithmetic — shown, not hidden behind a tooltip. */}
              <div className="border-t border-saf-border p-3 bg-saf-surface">
                <div className="text-[11px] uppercase tracking-wider text-saf-muted mb-2">How this scored {rec.score}</div>
                <div className="grid grid-cols-3 gap-3">
                  <ScoreBar label="Impact" value={rec.impact} />
                  <ScoreBar label="Confidence" value={rec.confidence} />
                  <ScoreBar label="Effort" value={rec.effort} invert />
                </div>
                <div className="mt-2 text-[11.5px] text-saf-muted font-mono">
                  {Math.round(rec.impact * 100)} × {Math.round(rec.confidence * 100)}% × {(1 - 0.45 * rec.effort).toFixed(2)} effort discount = {rec.score}
                </div>
                {rec.projectedBasis && (
                  <div className="mt-1.5 text-[11.5px] text-saf-muted">
                    Projection basis: {rec.projectedBasis}. This is a model, not a promise.
                  </div>
                )}
                <div className="mt-1.5 text-[11.5px] text-saf-muted">
                  Rule: <span className="font-medium text-saf-text">{rec.ruleTitle}</span> (<code>{rec.ruleId}</code>)
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          {!muted && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {status !== 'accepted' && (
                <Button size="sm" variant="secondary" leadingIcon="Check" onClick={() => onStatus('accepted')}>
                  I'm on it
                </Button>
              )}
              <Button size="sm" variant="primary" leadingIcon="CheckCircle2" onClick={() => onStatus('done')}>
                Mark done
              </Button>
              {rec.kind === 'reply' && (
                <Button size="sm" variant="ghost" leadingIcon="Star" onClick={() => onNavigate && onNavigate('reviews')}>
                  Open Reviews
                </Button>
              )}
              {(rec.kind === 'content' || rec.kind === 'promo') && (
                <Button size="sm" variant="ghost" leadingIcon="PenSquare" onClick={() => onNavigate && onNavigate('compose')}>
                  Open composer
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onStatus('dismissed')}>
                Not now
              </Button>
            </div>
          )}
          {muted && (
            <div className="mt-3">
              <Button size="sm" variant="ghost" leadingIcon="Undo2" onClick={() => onStatus('new')}>
                Reopen
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Source badge. Tier is carried in text as well as tone — an owner needs to
// know at a glance whether a number is live or needs a partner contract, and
// that distinction must survive greyscale printing.
function SourceBadge({ src }) {
  if (!src) return null;
  const tone = {
    api:     'bg-emerald-50 text-emerald-700 border-emerald-200',
    partner: 'bg-amber-50 text-amber-700 border-amber-200',
    derived: 'bg-saf-light text-saf-primary border-saf-light',
    own:     'bg-slate-100 text-saf-muted border-saf-border',
    partial: 'bg-rose-50 text-rose-700 border-rose-200',
  }[src.tier];
  return (
    <Tooltip label={`${REC_TIER_LABEL[src.tier]} — ${src.note}`} side="top">
      <span className={`inline-flex items-center gap-1 px-2 h-5.5 py-0.5 rounded-md border text-[11px] font-medium ${tone}`}>
        {src.label}
      </span>
    </Tooltip>
  );
}

function ScoreBar({ label, value, invert = false }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-saf-muted">
        <span>{label}</span>
        <span className="tabular-nums">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-saf-border overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: invert ? '#B7791F' : '#B4451F' }}
        />
      </div>
    </div>
  );
}

// --- Method note -------------------------------------------------------------
// Sits at the bottom of the screen rather than in a help centre nobody opens.
// If the engine's logic is not legible, the ranking is just an opinion with a
// number attached.
function MethodNote() {
  const [open, setOpen] = React.useState(false);
  return (
    <Card padding="p-4">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary rounded"
      >
        <Icon name="Info" size={16} className="text-saf-muted shrink-0" />
        <span className="text-[13px] font-medium text-saf-text">How these are generated</span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-saf-muted ms-auto" />
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-saf-border space-y-3 text-[13px] leading-relaxed text-saf-muted">
          <p>
            {REC_RULES.length} rules run over this week's reviews, menu conversation, listening
            signals, channel performance and publishing queue. Each rule produces zero or more
            actions with the evidence that triggered it. Nothing is hand-written — change the
            underlying data and the list changes.
          </p>
          <p>
            <span className="font-medium text-saf-text">Ranking.</span> Each action carries an
            impact weight, a confidence, and an effort estimate. Score is{' '}
            <code className="text-saf-text">impact × confidence × (1 − 0.45 × effort)</code> on a
            0–100 scale. Effort discounts rather than divides, so hard work that matters still
            outranks easy work that does not.
          </p>
          <p>
            <span className="font-medium text-saf-text">The engine never claims causality.</span>{' '}
            It will not tell you a post will raise your rating. It reports what is true, projects
            reach from your own median with the arithmetic shown, and leaves the judgement to you.
          </p>
          <p>
            <span className="font-medium text-saf-text">Sources.</span> Every figure is badged with
            where it would come from in production —{' '}
            <span className="text-emerald-700 font-medium">live via API</span>,{' '}
            <span className="text-amber-700 font-medium">needs a partner integration</span>,{' '}
            <span className="text-saf-primary font-medium">derived in-house</span>, or{' '}
            <span className="text-saf-text font-medium">your own systems</span>. Actions built
            mostly on green badges are shippable first; amber ones need a middleware contract
            before they are real.
          </p>
        </div>
      )}
    </Card>
  );
}

window.RecommendationsPage = RecommendationsPage;
