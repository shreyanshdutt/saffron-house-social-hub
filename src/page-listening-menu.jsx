// Listening → Menu Items.
//
// WHAT THIS SCREEN USED TO BE, AND WHY IT IS NOT THAT ANY MORE.
//
// It was a sentiment dashboard: `mentions7d: 412` for the Galouti Kebab, a
// [-1,+1] sentiment bar, a 7-day sparkline, a movement percentage, and two
// hero cards naming the "rising" and "slipping" dish. Every one of those
// numbers was invented in `mock.jsx`, and the guest opinion beneath them —
// "repeatedly called the best in Delhi" — was a sentence no guest ever wrote.
//
// The whole seeded guest corpus is 31 fragments and 3.5 KB. 412 cannot come
// from that, and neither can a trend, a delta or a sparkline: seven points of
// daily history do not exist to plot.
//
// So the screen now shows the two things that ARE true: how many times a guest
// named the dish, and THE SENTENCES THEY NAMED IT IN. A count you can check by
// reading is worth more than a precise-looking number you cannot. The most
// useful cell on this screen is a quote, not a figure.
//
// THERE IS NO SENTIMENT HERE, by owner decision (2026-09-09) and because the
// resource to do it honestly does not exist offline — the negative results are
// recorded in server/src/text-normalize.js.

function MenuScreen({ theme }) {
  return (
    <RequiresServerData what="dish mentions">
      {(data) => <MenuScreenInner data={data} />}
    </RequiresServerData>
  );
}

function MenuScreenInner({ data }) {
  const [category, setCategory] = React.useState('all');
  const items = data.menu;
  const corpus = data.menuCorpus;

  const categories = React.useMemo(
    () => ['all', ...Array.from(new Set(items.map(m => m.category).filter(Boolean)))],
    [items]
  );

  // Already ordered by the server, most-mentioned first. Filtering does not
  // reorder: the ranking is the server's answer, not this screen's.
  const rows = category === 'all' ? items : items.filter(m => m.category === category);

  const totalMentions = items.reduce((n, m) => n + m.mentionCount, 0);
  const namedDishes = items.filter(m => m.mentionCount > 0).length;

  return (
    <div className="space-y-4" id="listening-menu">
      {/* THE DENOMINATOR, STATED. A count of 2 means one thing over 31
          fragments and another over 31,000, and a reader cannot judge the
          number without it. This replaces the two invented hero cards. */}
      {corpus && (
        <Card padding="p-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-saf-light text-saf-primary grid place-items-center shrink-0">
              <Icon name="Quote" size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-saf-text">
                {totalMentions} dish {totalMentions === 1 ? 'mention' : 'mentions'} from {namedDishes} of {items.length} dishes
              </div>
              <p className="text-[12.5px] text-saf-muted mt-1 leading-relaxed">
                Counted across <strong className="text-saf-text">{corpus.fragments} pieces of guest text</strong> —
                {' '}{corpus.kinds.review || 0} reviews, {corpus.kinds.comment || 0} comments and {corpus.kinds.dm || 0} direct
                messages, {(corpus.characters / 1024).toFixed(1)} KB in total. Only what a guest wrote counts: our own
                replies and the app's own analytics summaries are excluded, because neither is a guest naming a dish.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card padding="p-0">
        <div className="p-4 flex items-center gap-3 flex-wrap border-b border-saf-border">
          <div>
            <h2 className="text-[15px] font-semibold text-saf-text">What guests said about each dish</h2>
            <p className="text-[12px] text-saf-muted mt-0.5">
              Every mention, in the guest's own words. No sentiment score — the count and the quote are the finding.
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

        <div className="divide-y divide-saf-border">
          {rows.map(m => <MenuRow key={m.id} item={m} />)}
          {rows.length === 0 && (
            <div className="p-6 text-[13px] text-saf-muted">No dishes in this category.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// One dish: the count, then the evidence for it, or the reason there is none.
function MenuRow({ item }) {
  const none = item.mentionCount === 0;
  return (
    <div className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-saf-text">{item.name}</div>
          <div className="text-[11.5px] text-saf-muted mt-0.5">{item.category} · ₹{item.price}</div>
        </div>
        <div className="text-end shrink-0">
          <div className={`text-[20px] font-semibold tabular-nums ${none ? 'text-saf-muted' : 'text-saf-text'}`}>
            {item.mentionCount}
          </div>
          <div className="text-[11px] text-saf-muted">{item.mentionCount === 1 ? 'mention' : 'mentions'}</div>
        </div>
      </div>

      {none ? (
        /* ZERO IS A FINDING, NOT A BLANK. Four of the eight dishes sit here,
           including the flagship that claimed 412. It is stated in a sentence
           rather than as a dash or a bare 0, because "measured at zero" and
           "nobody said anything" read identically as a numeral and are
           different facts — the trap CLAUDE.md §11 opens with. */
        <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-lg bg-saf-surface border border-saf-border">
          <Icon name="Info" size={13} className="text-saf-muted mt-0.5 shrink-0" />
          <p className="text-[11.5px] text-saf-muted leading-relaxed">
            No guest has named this dish in the text we can see. That is a finding about the
            conversation, not about the dish — it may still be selling well. It means nobody
            wrote its name in a review, a comment or a message we hold.
          </p>
        </div>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {item.mentions.map((m, i) => <MentionQuote key={i} mention={m} />)}
        </ul>
      )}
    </div>
  );
}

// The guest's sentence, with the matched words marked inside it so a reader
// can see exactly what was counted and disagree with it.
function MentionQuote({ mention }) {
  const { quote, start, end, source } = mention;
  const before = quote.slice(0, start);
  const hit = quote.slice(start, end);
  const after = quote.slice(end);
  const KIND = { review: 'Review', comment: 'Comment', dm: 'Direct message' };
  return (
    <li className="ps-3 border-s-2 border-saf-primary/40">
      <p className="text-[12.5px] text-saf-text leading-relaxed">
        “{before}<mark className="bg-saf-light text-saf-text font-semibold rounded px-0.5">{hit}</mark>{after}”
      </p>
      <div className="text-[11px] text-saf-muted mt-1 flex items-center gap-1.5 flex-wrap">
        <span className="font-medium text-saf-text">{source.author || 'A guest'}</span>
        <span aria-hidden="true">·</span>
        <span>{KIND[source.kind] || source.kind}</span>
        {source.channel && PLATFORM_BY_ID[source.channel] && (
          <>
            <span aria-hidden="true">·</span>
            <span>{PLATFORM_BY_ID[source.channel].name}</span>
          </>
        )}
        {source.saidAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>{fmtTime(source.saidAt, { withDate: true })}</span>
          </>
        )}
        {/* Where it came from, so the quote is traceable rather than floating. */}
        <span aria-hidden="true">·</span>
        <span className="font-mono text-[10.5px]">{source.sourceId}</span>
      </div>
    </li>
  );
}

window.MenuScreen = MenuScreen;
