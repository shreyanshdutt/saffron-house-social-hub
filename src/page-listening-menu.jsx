// Listening → Menu Items.
//
// The dimension a generic social tool cannot give a restaurant. Hashtag and
// channel trends tell you *where* conversation is happening; this tells you
// *what it is about*, in the only vocabulary a kitchen can act on — dishes.
//
// The reading order is deliberate:
//   - Two callout cards first, because the actionable insight is almost never
//     "which dish is most talked about" (that is the bestseller, and you knew).
//     It is "which dish is moving" — up, so you push it, or down, so you fix it.
//   - Then the full table, sortable, with a sentiment bar per row.
//
// Sentiment is shown on a [-1, +1] scale as a diverging bar from a centre
// line rather than a percentage, because "62% positive" hides whether the
// remaining 38% is neutral or furious.

const MENU_SORTS = [
  { id: 'mentions',  label: 'Mentions',  get: m => m.mentions7d },
  { id: 'movement',  label: 'Movement',  get: m => m.mentionsChange7dPct },
  { id: 'sentiment', label: 'Sentiment', get: m => m.sentiment },
  { id: 'shift',     label: 'Shift',     get: m => m.sentimentDelta },
];

function MenuScreen({ theme }) {
  const [sort, setSort] = React.useState('mentions');
  const [dir, setDir] = React.useState('desc');
  const [category, setCategory] = React.useState('all');

  const categories = React.useMemo(
    () => ['all', ...Array.from(new Set(MENU_ITEMS.map(m => m.category)))],
    []
  );

  const rows = React.useMemo(() => {
    const get = MENU_SORTS.find(s => s.id === sort).get;
    const list = category === 'all' ? MENU_ITEMS : MENU_ITEMS.filter(m => m.category === category);
    return [...list].sort((a, b) => (dir === 'desc' ? get(b) - get(a) : get(a) - get(b)));
  }, [sort, dir, category]);

  // The two callouts: biggest positive mover and the dish losing ground
  // fastest. Both are computed rather than hand-picked so the screen stays
  // honest if the seed data changes.
  const rising = React.useMemo(
    () => [...MENU_ITEMS].sort((a, b) => b.mentionsChange7dPct - a.mentionsChange7dPct)[0],
    []
  );
  const slipping = React.useMemo(
    () => [...MENU_ITEMS].sort((a, b) => a.sentimentDelta - b.sentimentDelta)[0],
    []
  );

  const toggleSort = (id) => {
    if (sort === id) setDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSort(id); setDir('desc'); }
  };

  return (
    <div className="space-y-4" id="listening-menu">
      <div className="grid grid-cols-12 gap-4">
        <MenuCallout
          className="col-span-12 lg:col-span-6"
          tone="positive"
          eyebrow="Rising fastest"
          item={rising}
          theme={theme}
          note={`Mentions up ${rising.mentionsChange7dPct}% in 7 days. ${rising.topPraise}`}
          action="Worth a post while the interest is live."
        />
        <MenuCallout
          className="col-span-12 lg:col-span-6"
          tone="negative"
          eyebrow="Losing ground"
          item={slipping}
          theme={theme}
          note={`Sentiment down ${Math.abs(slipping.sentimentDelta).toFixed(2)} in 7 days. ${slipping.topComplaint}`}
          action="This is a kitchen or pricing conversation, not a marketing one."
        />
      </div>

      <Card padding="p-0">
        <div className="p-4 flex items-center gap-3 flex-wrap border-b border-saf-border">
          <div>
            <h2 className="text-[15px] font-semibold text-saf-text">Menu conversation</h2>
            <p className="text-[12px] text-saf-muted mt-0.5">
              Mentions and sentiment per dish across every channel, trailing 7 days.
            </p>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <label htmlFor="menu-category" className="sr-only">Filter by category</label>
            <select
              id="menu-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20 transition"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <caption className="sr-only">
              Menu items by mention volume and sentiment over the trailing seven days
            </caption>
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wider text-saf-muted border-b border-saf-border">
                <th scope="col" className="text-start font-medium px-4 py-2.5">Dish</th>
                {MENU_SORTS.map(s => (
                  <th key={s.id} scope="col" className="text-end font-medium px-4 py-2.5" aria-sort={sort === s.id ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                    <button
                      onClick={() => toggleSort(s.id)}
                      aria-label={`Sort by ${s.label}`}
                      className={`inline-flex items-center gap-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent rounded px-1 ${sort === s.id ? 'text-saf-primary' : 'hover:text-saf-text'}`}
                    >
                      {s.label}
                      {sort === s.id && <Icon name={dir === 'desc' ? 'ArrowDown' : 'ArrowUp'} size={12} />}
                    </button>
                  </th>
                ))}
                <th scope="col" className="text-start font-medium px-4 py-2.5 w-[180px]">7-day trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-saf-border">
              {rows.map(m => (
                <tr key={m.id} className="hover:bg-saf-light/30 transition-colors">
                  <th scope="row" className="text-start font-normal px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-saf-text">{m.name}</span>
                      {m.isMoment && (
                        <Tooltip label="Moved more than 50% this week — check Signals" side="top">
                          <span className="w-1.5 h-1.5 rounded-full bg-saf-accent" aria-label="Notable movement" />
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-[11.5px] text-saf-muted mt-0.5">
                      {m.category} · ₹{m.price}
                    </div>
                  </th>

                  <td className="px-4 py-3 text-end tabular-nums text-saf-text">{fmt(m.mentions7d)}</td>

                  <td className="px-4 py-3 text-end">
                    <DeltaText value={m.mentionsChange7dPct} suffix="%" />
                  </td>

                  <td className="px-4 py-3">
                    <SentimentBar value={m.sentiment} />
                  </td>

                  <td className="px-4 py-3 text-end">
                    <DeltaText value={m.sentimentDelta} decimals={2} />
                  </td>

                  <td className="px-4 py-3">
                    <Sparkline
                      data={m.spark}
                      width={150}
                      height={30}
                      stroke={m.sentiment < 0.2 ? '#C0342B' : theme === 'dark' ? '#F0A07A' : '#B4451F'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Callout card for the two dishes that actually need a decision this week.
function MenuCallout({ item, tone, eyebrow, note, action, theme, className = '' }) {
  const positive = tone === 'positive';
  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <Icon name={positive ? 'TrendingUp' : 'TrendingDown'} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] uppercase tracking-wider text-saf-muted">{eyebrow}</div>
          <div className="text-[16px] font-semibold text-saf-text mt-0.5">{item.name}</div>
          <p className="text-[12.5px] text-saf-muted mt-1.5 leading-relaxed">{note}</p>
          <p className="text-[12.5px] text-saf-text mt-2 font-medium">{action}</p>
        </div>
        <Sparkline
          data={item.spark}
          width={72}
          height={34}
          stroke={positive ? '#2E7D4F' : '#C0342B'}
        />
      </div>
    </Card>
  );
}

// Diverging sentiment bar on a [-1, +1] scale. The centre line is zero, so a
// dish sitting just below neutral reads visibly differently from one that is
// genuinely disliked — which a 0-100% bar would flatten.
function SentimentBar({ value }) {
  const v = Math.max(-1, Math.min(1, value));
  const pct = Math.abs(v) * 50;
  const positive = v >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 min-w-[80px] h-2.5 rounded-full bg-saf-light" role="img" aria-label={`Sentiment ${v.toFixed(2)} on a scale of minus one to one`}>
        <span className="absolute inset-y-0 left-1/2 w-px bg-saf-border" aria-hidden="true" />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: positive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            background: positive ? '#2E7D4F' : '#C0342B',
          }}
          aria-hidden="true"
        />
      </div>
      <span className="w-10 text-end text-[12px] tabular-nums text-saf-text">{v.toFixed(2)}</span>
    </div>
  );
}

// Signed change, with an arrow glyph as well as colour so direction never
// depends on hue alone.
function DeltaText({ value, decimals = 0, suffix = '' }) {
  const v = Number(value) || 0;
  const flat = Math.abs(v) < (decimals ? 0.005 : 0.5);
  const tone = flat ? 'text-saf-muted' : v > 0 ? 'text-emerald-700' : 'text-rose-700';
  return (
    <span className={`inline-flex items-center gap-0.5 justify-end tabular-nums text-[12.5px] font-medium ${tone}`}>
      {!flat && <Icon name={v > 0 ? 'ArrowUp' : 'ArrowDown'} size={12} />}
      {v > 0 ? '+' : ''}{v.toFixed(decimals)}{suffix}
    </span>
  );
}

window.MenuScreen = MenuScreen;
