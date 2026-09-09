// Social Listening — Trends screen.
// Read-only pattern-spotting surface. One card per channel, sorted +
// filterable. No actions (informational only, same insights-vs-action
// discipline as Overview and Competitors).

const TREND_SORTS = [
  { id: 'volume',    field: 'totalMentions7d',   en: 'Volume' },
  { id: 'change',    field: 'changeMentionsPct', en: 'Change %' },
  { id: 'sentiment', field: 'avgSentiment7d',    en: 'Sentiment' },
];

function TrendsScreen({ theme }) {
  const t = useT();
  const [sortBy, setSortBy] = React.useState('volume');
  const [channel, setChannel] = React.useState('all');

  const channels = channel === 'all' ? PLATFORMS.map(p => p.id) : [channel];

  const selectedName = channel === 'all' ? null : (PLATFORM_BY_ID[channel] || {}).name;
  const sortField = TREND_SORTS.find(s => s.id === sortBy)?.field || 'totalMentions7d';
  const cards = React.useMemo(() => {
    return channels
      .map(id => ({ id, data: LISTENING_TRENDS[id] }))
      .filter(c => c.data)
      .sort((a, b) => (b.data[sortField] ?? 0) - (a.data[sortField] ?? 0));
  }, [channels.join(','), sortField]);

  return (
    <div id="listening-trends" role="tabpanel" className="space-y-4">
      <Card padding="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <PillRadioGroup
            ariaLabel={t.listening.trends.sortBy.label}
            options={TREND_SORTS.map(s => ({ id: s.id, label: t.listening.trends.sortBy[s.id] }))}
            value={sortBy}
            onChange={setSortBy}
          />
          <div className="h-5 w-px bg-saf-border" aria-hidden="true" />
          <ChannelPillGroup
            value={channel}
            onChange={setChannel}
            theme={theme}
            allLabel={t.listening.trends.allChannels}
          />
        </div>
      </Card>

      {/* PLATFORMS now carries read-only channels that have no listening
          trends of their own, and `cards` filters those out — so selecting one
          previously left an EMPTY GRID with nothing to explain it, which is
          §11's silent-empty-region. Signals and the Inbox already say why when
          a filter matches nothing; this says the same thing in the same voice. */}
      {cards.length === 0 ? (
        <Card padding="p-8">
          <div className="text-center">
            <div className="text-[13px] font-medium text-saf-text">No listening trends for this channel</div>
            <p className="text-[12px] text-saf-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              {selectedName
                ? `${selectedName} is read for competitor comparison, not for our own mention volume — there is no trend series to show here.`
                : 'No channel in this view reports mention volume.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(({ id, data }) => (
            <TrendCard
              key={id}
              channelId={id}
              data={data}
              theme={theme}
              takeaway={t.listening.trends.takeaway[id]}
              tLabels={t.listening.trends}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Radio-group pill row with ArrowLeft/ArrowRight focus nav, Home/End,
// and proper role/aria-checked semantics. Single-select.
function PillRadioGroup({ ariaLabel, options, value, onChange }) {
  const ref = React.useRef(null);
  const onKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const all = Array.from(ref.current?.querySelectorAll('[role="radio"]') || []);
    if (all.length === 0) return;
    const i = all.indexOf(document.activeElement);
    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else if (i < 0) next = 0;
    else if (e.key === 'ArrowRight') next = (i + 1) % all.length;
    else next = (i - 1 + all.length) % all.length;
    e.preventDefault();
    all[next].focus();
  };
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="flex items-center gap-1 flex-wrap"
    >
      {options.map(o => {
        const checked = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={`h-7 px-3 rounded-full text-[12px] font-medium transition focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white ${checked ? 'bg-saf-primary text-white' : 'bg-saf-surface text-saf-muted hover:text-saf-text border border-saf-border'}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// Channel filter — All + 5 channel glyphs. Mirrors PillRadioGroup's
// keyboard semantics but renders glyph circles for the per-channel pills.
function ChannelPillGroup({ value, onChange, theme, allLabel }) {
  const ref = React.useRef(null);
  const onKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const all = Array.from(ref.current?.querySelectorAll('[role="radio"]') || []);
    if (all.length === 0) return;
    const i = all.indexOf(document.activeElement);
    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else if (i < 0) next = 0;
    else if (e.key === 'ArrowRight') next = (i + 1) % all.length;
    else next = (i - 1 + all.length) % all.length;
    e.preventDefault();
    all[next].focus();
  };
  const allChecked = value === 'all';
  return (
    <div ref={ref} role="radiogroup" aria-label="Filter by channel" onKeyDown={onKeyDown} className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        role="radio"
        aria-checked={allChecked}
        tabIndex={allChecked ? 0 : -1}
        onClick={() => onChange('all')}
        className={`h-7 px-3 rounded-full text-[12px] font-medium transition focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white ${allChecked ? 'bg-saf-primary text-white' : 'bg-saf-surface text-saf-muted hover:text-saf-text border border-saf-border'}`}
      >{allLabel}</button>
      {PLATFORMS.map(p => {
        const isActive = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(p.id)}
            aria-label={`Filter by ${p.name}`}
            className={`h-7 w-7 grid place-items-center rounded-full transition focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isActive ? 'ring-2 ring-saf-primary ring-offset-2 ring-offset-saf-card' : 'hover:opacity-80'}`}
            style={{ background: platformColor(p, theme), color: '#fff' }}
            title={p.name}
          >
            <PlatformGlyph id={p.id} size={12} />
          </button>
        );
      })}
    </div>
  );
}

// Single trend card. Read-only div (not a button — no click-through this
// commit per spec). Channel-color top stripe carries the brand identity.
function TrendCard({ channelId, data, theme, takeaway, tLabels }) {
  const p = PLATFORM_BY_ID[channelId];
  const accent = platformColor(p, theme);
  const mentionsUp = data.changeMentionsPct >= 0;
  const reachUp = data.changeReachPct >= 0;
  const sentUp = data.changeSentimentDelta >= 0;
  return (
    <div
      role="article"
      aria-label={`${p.name} trend card`}
      className="bg-white rounded-2xl border border-saf-border shadow-card overflow-hidden"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-full grid place-items-center text-white shrink-0"
              style={{ background: accent }}
              aria-hidden="true"
            >
              <PlatformGlyph id={channelId} size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-saf-text">{p.name}</div>
              <div className="text-[11px] text-saf-muted" dir="ltr">{SAF_HANDLE}</div>
            </div>
          </div>
          <div className="text-right shrink-0" dir="ltr">
            <Pill tone={mentionsUp ? 'green' : 'red'}>
              <Icon name={mentionsUp ? 'TrendingUp' : 'TrendingDown'} size={10} />
              <span>{mentionsUp ? '+' : ''}{data.changeMentionsPct}%</span>
            </Pill>
          </div>
        </div>

        <div className="space-y-2.5">
          <SparkRow
            label={tLabels.mentions7d}
            value={fmtCompact(data.totalMentions7d)}
            data={data.sparkMentions}
            color={accent}
            changeText={`${mentionsUp ? '+' : ''}${data.changeMentionsPct}%`}
            up={mentionsUp}
          />
          <SparkRow
            label={tLabels.reach7d}
            value={fmtCompact(data.totalReach7d)}
            data={data.sparkReach}
            color={accent}
            changeText={`${reachUp ? '+' : ''}${data.changeReachPct}%`}
            up={reachUp}
          />
          <SparkRow
            label={tLabels.sentiment7d}
            value={(data.avgSentiment7d >= 0 ? '+' : '') + data.avgSentiment7d.toFixed(2)}
            data={data.sparkSentiment}
            color={sentUp ? '#2E7D4F' : '#C0342B'}
            changeText={(sentUp ? '+' : '') + data.changeSentimentDelta.toFixed(2)}
            up={sentUp}
          />
        </div>

        <p className="mt-3 text-[12px] text-saf-muted leading-snug">{takeaway}</p>
      </div>
    </div>
  );
}

function SparkRow({ label, value, data, color, changeText, up }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0">
        <div className="text-[10px] uppercase tracking-wider font-medium text-saf-muted">{label}</div>
        <div className="text-[14px] font-semibold text-saf-text tabular-nums" dir="ltr">{value}</div>
      </div>
      <div className="flex-1 min-w-0" dir="ltr">
        <Sparkline data={data} width={200} height={32} stroke={color} className="w-full h-8" />
      </div>
      <div className={`shrink-0 text-[11px] font-medium tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">{changeText}</div>
    </div>
  );
}

window.TrendsScreen = TrendsScreen;
