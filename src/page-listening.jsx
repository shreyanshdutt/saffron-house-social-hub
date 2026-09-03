// Social Listening — page shell + screen router.
//
// Four sub-screens live in their own files; this shell holds:
//   - top-level state (tab, persisted state, focusedSignalId)
//   - the sub-tab strip (ListeningHeader)
//   - the routing switch that picks which screen to render
//
// Screen files (loaded by index.html before this one):
//   src/page-listening-signals.jsx      — SignalsScreen + cards + modals
//   src/page-listening-overview.jsx     — OverviewScreen + KPI cards + panels
//   src/page-listening-trends.jsx       — TrendsScreen + TrendCard
//   src/page-listening-competitors.jsx  — CompetitorsScreen + CompetitorsTable
//
// Persistence helpers live in src/mock.jsx (`listeningLoad` / `listeningSave`)
// keyed `saf-listening-v1-*` so we can bump the schema later without
// colliding with stale browser state.

// Sub-tab definitions — used only by the shell + ListeningHeader.
const LISTENING_SUBTABS = [
  { id: 'overview',    icon: 'LayoutDashboard', en: 'Overview'    },
  { id: 'menu',        icon: 'UtensilsCrossed', en: 'Menu Items'  },
  { id: 'trends',      icon: 'TrendingUp',      en: 'Trends'      },
  { id: 'competitors', icon: 'Building2',       en: 'Competitors' },
  { id: 'signals',     icon: 'Radar',           en: 'Signals'     },
];

function ListeningPage() {
  const { profile, theme } = React.useContext(AppCtx);
  const [tab, setTab] = React.useState('overview');
  const [state, setState] = React.useState(() => listeningLoad());
  // When the Overview panels route to a deeper screen with a specific
  // signal in focus, this carries the signal id across. SignalsScreen
  // reads it once on mount, scrolls/highlights, then clears.
  const [focusedSignalId, setFocusedSignalId] = React.useState(null);

  const update = React.useCallback((patch) => {
    setState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      listeningSave(next);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <ListeningHeader tab={tab} setTab={setTab} state={state} />
      {tab === 'signals' && (
        <SignalsScreen
          state={state}
          update={update}
          me={profile.id}
          theme={theme}
          focusedSignalId={focusedSignalId}
          onClearFocus={() => setFocusedSignalId(null)}
        />
      )}
      {tab === 'overview' && (
        <OverviewScreen
          state={state}
          theme={theme}
          onGoSignals={(id) => { setFocusedSignalId(id || null); setTab('signals'); }}
          onGoTrends={() => setTab('trends')}
          onGoCompetitors={() => setTab('competitors')}
        />
      )}
      {tab === 'menu' && (
        <MenuScreen theme={theme} />
      )}
      {tab === 'trends' && (
        <TrendsScreen theme={theme} />
      )}
      {tab === 'competitors' && (
        <CompetitorsScreen theme={theme} />
      )}
    </div>
  );
}

function ListeningHeader({ tab, setTab, state }) {
  const criticalCount = LISTENING_SIGNALS.filter(
    s => !state.dismissed.includes(s.id) && s.severity === 'critical'
  ).length;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-saf-text">Social Listening</h1>
        <p className="text-sm text-saf-muted mt-1">What Delhi is saying about Saffron House, our dishes, and the restaurants next door.</p>
      </div>
      <div className="border-b border-saf-border flex items-center gap-1" role="tablist" aria-label="Social Listening sections">
        {LISTENING_SUBTABS.map(s => {
          const isActive = tab === s.id;
          const label = s.en;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`listening-${s.id}`}
              onClick={() => setTab(s.id)}
              className={`relative h-10 px-3 inline-flex items-center gap-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 rounded ${isActive ? 'text-saf-primary' : 'text-saf-muted hover:text-saf-text'}`}
            >
              <Icon name={s.icon} size={16} />
              <span>{label}</span>
              {s.id === 'signals' && criticalCount > 0 ? (
                <span
                  aria-label={`${criticalCount} critical`}
                  className="ms-1 px-1.5 h-5 grid place-items-center text-[10px] rounded-full bg-rose-500 text-white font-medium"
                >{criticalCount}</span>
              ) : null}
              {isActive && (
                <span aria-hidden="true" className="absolute left-2 right-2 -bottom-px h-0.5 bg-saf-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

window.ListeningPage = ListeningPage;
