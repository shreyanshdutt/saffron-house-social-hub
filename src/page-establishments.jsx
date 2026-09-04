// Establishments — the candidate pool the competitor set is chosen from.
//
// Google Places Nearby Search returns every restaurant in the catchment. Most
// of them are not your competition, and some of them cannot be analysed at
// all. This screen is where a human turns that raw list into a tracked set.
//
// The central idea: **an establishment can only be tracked if public data
// exists for it**, and the screen says which door is closed when it does not.
// The three doors:
//
//   Google  — Places gives rating and review count for essentially anything
//             with a storefront. This is the baseline; without it there is
//             nothing at all.
//   Instagram — Business Discovery reads public Business and Creator accounts
//             only. A personal or private account is invisible to the API,
//             full stop. This is the real filter, and it is invisible from
//             the outside until you check.
//   X       — shown where a handle exists, but never counts toward
//             availability: reading posts requires a paid API tier that costs
//             more than a single restaurant spends on software, and almost no
//             neighbourhood restaurant here posts there.
//
// Marking an establishment here changes what appears on the Competitors screen
// and what the recommendation engine compares against.

const TIER_META = {
  full: {
    label: 'Full comparison',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'CheckCircle2',
    blurb: 'Rating, reviews, posting cadence, engagement and their actual posts.',
  },
  ratings: {
    label: 'Ratings only',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'Star',
    blurb: 'Rating, review count and review velocity. No content comparison.',
  },
  none: {
    label: 'Cannot track',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: 'X',
    blurb: 'No public data reachable by any API you can use.',
  },
};

// Tracking costs an API call per establishment per refresh, against a shared
// rate limit. Past roughly this many the refresh cycle gets slow and the
// comparison stops being readable anyway.
const TRACK_SOFT_CAP = 8;

// The establishment list, the availability tiers and the tracked set all come
// from the server now. The gate does the awaiting so everything below it stays
// synchronous — and so an unreachable service shows as an unreachable service
// rather than as a screen with no restaurants in it.
function EstablishmentsPage({ onNavigate }) {
  return (
    <RequiresServerData what="the establishment list">
      {(data) => <EstablishmentsScreenInner onNavigate={onNavigate} data={data} />}
    </RequiresServerData>
  );
}

function EstablishmentsScreenInner({ onNavigate, data }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(null);
  const [tier, setTier] = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);

  // Straight from the server. The availability tier arrives already derived —
  // there is no second implementation in the browser to disagree with it.
  const rows = data.establishments;
  const tracked = new Set(rows.filter(r => r.tracked).map(r => r.placeId));

  const categories = ['all', ...Array.from(new Set(rows.map(r => r.category)))];

  const filtered = React.useMemo(() => {
    return rows
      .filter(r => tier === 'all' || (tier === 'tracked' ? r.tracked : r.availability.tier === tier))
      .filter(r => category === 'all' || r.category === category)
      // Trackable first, then by distance — the nearest usable rival is the
      // one that matters most. `distanceKm` is served, not recomputed here;
      // see the column comment in the server schema for why it is stored.
      .sort((a, b) => {
        const rank = { full: 0, ratings: 1, none: 2 };
        return rank[a.availability.tier] - rank[b.availability.tier] || a.distanceKm - b.distanceKm;
      });
  }, [rows, tier, category]);

  // Tracking is a per-restaurant decision, so it is written to the server, not
  // to this browser. A failure says so instead of leaving the row looking
  // toggled — an optimistic flip that silently did not persist is exactly the
  // kind of quiet lie this project fights.
  const toggle = async (row) => {
    if (row.availability.tier === 'none') return;
    const wasTracked = row.tracked;
    setBusy(row.placeId);
    try {
      if (wasTracked) {
        await untrackEstablishment(row.placeId);
        toast.push({ title: `Stopped tracking ${row.name}`, kind: 'info' });
      } else {
        await trackEstablishment(row.placeId, 'admin');
        toast.push({
          title: `Tracking ${row.name}`,
          desc: row.availability.tier === 'ratings'
            ? 'Ratings and review velocity only — no content comparison available.'
            : 'Full comparison available.',
          kind: 'success',
        });
      }
    } catch (err) {
      toast.push({
        title: `Could not ${wasTracked ? 'untrack' : 'track'} ${row.name}`,
        desc: `The data service rejected the change: ${err.message}. Nothing was saved.`,
        kind: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const counts = {
    full:    rows.filter(r => r.availability.tier === 'full').length,
    ratings: rows.filter(r => r.availability.tier === 'ratings').length,
    none:    rows.filter(r => r.availability.tier === 'none').length,
  };
  const trackedRows = rows.filter(r => r.tracked);
  const withFeeds = trackedRows.filter(r => r.competitorRef).length;
  const overCap = trackedRows.length > TRACK_SOFT_CAP;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-saf-text">Establishments</h1>
          <p className="text-sm text-saf-muted mt-1">
            Every restaurant Google Places returns within {COMPETITOR_CATCHMENT.radiusKm} km of{' '}
            {COMPETITOR_CATCHMENT.label}. Mark the ones you actually compete with — but only where
            public data exists to compare against.
          </p>
        </div>
        <Button variant="secondary" leadingIcon="RefreshCw" onClick={() => toast.push({ title: 'Nearby search would re-run here', desc: 'Places returns the storefronts; handles are matched by hand once.', kind: 'info' })}>
          Re-run nearby search
        </Button>
      </div>

      {COMPETITOR_CATCHMENT.isSampleData && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Icon name="AlertTriangle" size={15} className="text-amber-700 mt-px shrink-0" />
          <p className="text-[12.5px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Sample data.</span> None of these establishments is real
            and the handles resolve to nothing. Replace this list with an actual Places Nearby Search
            before showing it to anyone outside the team.
          </p>
        </div>
      )}

      {/* Availability summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['full', 'ratings', 'none'].map(k => (
          <Card key={k} padding="p-4">
            <div className="flex items-center gap-1.5">
              <Icon name={TIER_META[k].icon} size={13} className="text-saf-muted" />
              <span className="text-[11.5px] uppercase tracking-wider text-saf-muted">{TIER_META[k].label}</span>
            </div>
            <div className="text-[28px] font-bold text-saf-text leading-none mt-2 tabular-nums">{counts[k]}</div>
            <p className="text-[11.5px] text-saf-muted mt-1.5 leading-relaxed">{TIER_META[k].blurb}</p>
          </Card>
        ))}
        <Card padding="p-4" className={overCap ? 'border-amber-300' : ''}>
          <div className="flex items-center gap-1.5">
            <Icon name="Eye" size={13} className="text-saf-muted" />
            <span className="text-[11.5px] uppercase tracking-wider text-saf-muted">Tracked</span>
          </div>
          <div className="text-[28px] font-bold text-saf-text leading-none mt-2 tabular-nums">{trackedRows.length}</div>
          <p className="text-[11.5px] text-saf-muted mt-1.5 leading-relaxed">
            {withFeeds} with full content data.{' '}
            {overCap
              ? `Above the ${TRACK_SOFT_CAP} suggested — each one costs an API call per refresh.`
              : `Soft cap ${TRACK_SOFT_CAP}.`}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[12px] text-saf-muted uppercase tracking-wider me-1">Filters</div>
          {[
            { v: 'all',     l: `All (${rows.length})` },
            { v: 'tracked', l: `Tracked (${trackedRows.length})` },
            { v: 'full',    l: `Full (${counts.full})` },
            { v: 'ratings', l: `Ratings only (${counts.ratings})` },
            { v: 'none',    l: `Cannot track (${counts.none})` },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setTier(o.v)}
              aria-pressed={tier === o.v}
              className={`h-8 px-3 rounded-full text-[12px] font-medium transition ${tier === o.v ? 'bg-saf-primary text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}
            >
              {o.l}
            </button>
          ))}

          <div className="h-6 w-px bg-saf-border mx-1" />

          <label htmlFor="est-cat" className="sr-only">Filter by category</label>
          <select
            id="est-cat"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20 transition"
          >
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>

          <span className="ms-auto text-[12px] text-saf-muted">{filtered.length} shown</span>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(row => (
          <EstablishmentRow
            key={row.placeId}
            row={row}
            tracked={row.tracked}
            busy={busy === row.placeId}
            expanded={openId === row.placeId}
            onToggleExpand={() => setOpenId(prev => (prev === row.placeId ? null : row.placeId))}
            onToggleTrack={() => toggle(row)}
          />
        ))}
      </div>

      <Card padding="p-4">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={15} className="text-saf-muted mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-saf-muted leading-relaxed space-y-2">
            <p>
              <span className="font-medium text-saf-text">Why some cannot be tracked.</span>{' '}
              Instagram's Business Discovery reads public Business and Creator accounts only. A
              personal or private account returns nothing at all — not partial data, nothing — and
              you cannot tell which it is from the outside without checking. Plenty of good
              neighbourhood restaurants run a personal account, so expect to lose a few.
            </p>
            <p>
              <span className="font-medium text-saf-text">Ratings-only is still worth tracking.</span>{' '}
              Google gives rating, review count and — once you store the count over time — review
              velocity. That is enough to see a rival's trajectory, which is often the thing that
              matters. You just cannot see what they are posting.
            </p>
            <p>
              <span className="font-medium text-saf-text">X is not counted.</span> Reading another
              account's posts requires a paid API tier; the free tier is effectively write-only. The
              entry price exceeds what a single-outlet restaurant spends on software, pricing has
              changed repeatedly, and almost no restaurant in this catchment posts there. A handle is
              shown where one exists, but it never affects availability.
            </p>
            <p>
              <span className="font-medium text-saf-text">Places does not give you handles.</span>{' '}
              No API maps a Google place to an Instagram account. The handle is matched by hand once
              per establishment, then stored — which is why this is a curated list and not a live feed.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EstablishmentRow({ row, tracked, busy, expanded, onToggleExpand, onToggleTrack }) {
  const avail = row.availability;
  // The social rows arrive as a list; the screen reads two of them by name.
  const ig = row.social.find(x => x.platform === 'instagram' && x.handle) || null;
  const xr = row.social.find(x => x.platform === 'x' && x.handle) || null;
  const meta = TIER_META[avail.tier];
  const canTrack = avail.tier !== 'none';

  return (
    <Card padding="p-4" className={tracked ? 'border-saf-primary/50 bg-saf-light/20' : ''}>
      <div className="flex items-start gap-3">
        <CompetitorMark name={row.name} color={tracked ? '#B4451F' : '#7A6A5F'} size={36} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-semibold text-saf-text">{row.name}</span>
            <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-md border text-[10.5px] font-semibold ${meta.tone}`}>
              <Icon name={meta.icon} size={10} />
              {meta.label}
            </span>
            {tracked && (
              <span className="px-2 h-5 inline-flex items-center rounded-full bg-saf-primary text-white text-[10.5px] font-semibold uppercase tracking-wide">
                Tracked
              </span>
            )}
          </div>

          <div className="text-[12px] text-saf-muted mt-0.5">
            {row.category} · {row.distanceKm} km away
          </div>

          {/* Per-channel availability, at a glance */}
          <div className="mt-2.5 flex items-center gap-4 flex-wrap">
            <ChannelChip
              id="gg"
              ok={avail.hasGoogle}
              label={avail.hasGoogle ? `${Number(row.rating).toFixed(1)}★ · ${fmtCompact(row.userRatingsTotal)}` : 'No listing'}
            />
            <ChannelChip
              id="ig"
              // A dormant business account is readable but has nothing to
              // compare on, so the server's availability() downgrades it to
              // ratings-only. The chip must agree with that tier — a green
              // tick beside an amber "Ratings only" badge read as a bug.
              ok={avail.igReadable && !avail.stale}
              label={ig ? `${ig.handle} · ${ig.accountType}` : 'None found'}
            />
            <ChannelChip
              id="x"
              ok={false}
              muted
              label={xr ? `${xr.handle} · paid tier` : 'None found'}
            />
          </div>

          <button
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-saf-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary rounded"
          >
            <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={13} />
            {expanded ? 'Hide' : 'What we can and cannot read'}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {avail.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]">
                  <Icon
                    name={r.ok ? 'Check' : 'X'}
                    size={13}
                    className={`mt-0.5 shrink-0 ${r.ok ? 'text-emerald-700' : 'text-rose-700'}`}
                  />
                  <span className={r.ok ? 'text-saf-text' : 'text-saf-muted'}>{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0">
          <Button
            size="sm"
            variant={tracked ? 'secondary' : 'primary'}
            leadingIcon={tracked ? 'Check' : 'Plus'}
            onClick={onToggleTrack}
            disabled={!canTrack || busy}
            title={canTrack ? undefined : 'No public data available to compare against'}
          >
            {busy ? 'Saving…' : tracked ? 'Tracking' : 'Track'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Per-channel availability chip. Carries the channel glyph, a state icon and
// the detail text — never state by colour alone.
function ChannelChip({ id, ok, label, muted }) {
  const name = id === 'x' ? 'X' : PLATFORM_BY_ID[id] ? PLATFORM_BY_ID[id].name : id;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px]">
      <span className={`w-4 h-4 rounded grid place-items-center ${ok ? 'text-saf-text' : 'text-saf-muted'}`}>
        {id === 'x'
          ? <span className="text-[11px] font-bold">𝕏</span>
          : <PlatformGlyph id={id} size={13} />}
      </span>
      <span className="text-saf-muted">{name}</span>
      <Icon
        name={ok ? 'Check' : 'X'}
        size={11}
        className={ok ? 'text-emerald-700' : muted ? 'text-saf-muted' : 'text-rose-700'}
      />
      <span className={ok ? 'text-saf-text font-medium' : 'text-saf-muted'}>{label}</span>
    </span>
  );
}

window.EstablishmentsPage = EstablishmentsPage;
