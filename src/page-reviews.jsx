// Reviews — the screen a restaurant is actually judged on.
//
// This is the largest structural departure from a generic social hub. A post
// is something you choose to publish; a review is something that happens to
// you, in public, on a clock. So the screen is built around three things a
// social feed does not have:
//
//   1. A rating, not an engagement count. The header leads with the Google
//      average and its 12-week direction, because that number is what a guest
//      sees before they see anything else you have ever published.
//   2. An SLA. An unanswered 1★ is a standing advertisement against you, so
//      every unanswered review carries a countdown and the list defaults to
//      sorting by urgency rather than recency.
//   3. A reply that is public and permanent. Drafting is open to the floor
//      team ('review.reply' is held by the Guest Relations Lead and Marketing
//      Manager); a comp is Marketing-Manager-only, because it costs money.
//
// Roles: read is universal, reply/escalate are gated, comp is manager-only.
// The gates are visible-but-disabled rather than hidden, so a coordinator
// understands the workflow exists and who to hand off to.

const REVIEW_SLA_MINS = REVIEW_STATS.slaMins;

const REVIEW_EXPORT_COLUMNS = [
  'id', 'channel', 'author', 'rating', 'received_at',
  'replied', 'sla_state', 'themes', 'review_text', 'replied_by', 'reply_text',
];

function reviewDateSlug() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// Minutes since a review landed. Reviews carry absolute ISO timestamps, so
// this is computed once per render against the wall clock rather than baked
// into the seed data — the SLA badge should keep moving while the demo sits
// open on a screen.
function minsSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function slaState(review) {
  if (review.replied) return 'answered';
  const age = minsSince(review.t);
  if (age > REVIEW_SLA_MINS) return 'breached';
  if (age > REVIEW_SLA_MINS * 0.75) return 'due';
  return 'open';
}

// Urgency ranking: unanswered and past SLA first, then unanswered by rising
// star rating (a 1★ outranks a 3★), then everything answered by recency.
// This is the default sort because "newest first" would bury the review that
// is actively costing covers.
function urgencyScore(r) {
  const st = slaState(r);
  if (st === 'answered') return 1000 + minsSince(r.t) / 1000;
  const base = st === 'breached' ? 0 : st === 'due' ? 100 : 200;
  return base + r.rating * 10;
}

// Aggregate themes across all reviews, with the average rating of the reviews
// carrying each — so "wait time" reads as a 1.5★ problem rather than just a
// frequent word. Derived from the classification, not from Google.
function topThemes(limit = 6) {
  const acc = {};
  REVIEWS.forEach(r => {
    (r.themes || []).forEach(t => {
      if (!acc[t]) acc[t] = { n: 0, sum: 0 };
      acc[t].n += 1;
      acc[t].sum += r.rating;
    });
  });
  return Object.entries(acc)
    .map(([t, v]) => [t, { n: v.n, avg: v.sum / v.n }])
    .sort((a, b) => b[1].n - a[1].n || a[1].avg - b[1].avg)
    .slice(0, limit);
}

function ReviewsPage({ role }) {
  const { theme } = React.useContext(AppCtx);
  const toast = useToast();

  const canReply = hasPerm(role, 'review.reply');
  const canEscalate = hasPerm(role, 'review.escalate');
  const canComp = hasPerm(role, 'review.comp');

  const [channel, setChannel] = React.useState('all');
  const [rating, setRating] = React.useState('all');       // 'all' | 'low' | 'high'
  const [status, setStatus] = React.useState('unanswered'); // 'all' | 'unanswered' | 'answered'
  const [sort, setSort] = React.useState('urgency');        // 'urgency' | 'recent' | 'lowest'
  const [open, setOpen] = React.useState(null);             // review being replied to

  // Local reply state, so the demo persists a reply for the session without
  // pretending to write to a backend.
  const [replies, setReplies] = React.useState({});

  const withLocal = React.useMemo(
    () => REVIEWS.map(r => (replies[r.id] ? { ...r, replied: true, reply: replies[r.id] } : r)),
    [replies]
  );

  const filtered = React.useMemo(() => {
    let rows = withLocal;
    if (channel !== 'all') rows = rows.filter(r => r.channel === channel);
    if (rating === 'low')  rows = rows.filter(r => r.rating <= 2);
    if (rating === 'high') rows = rows.filter(r => r.rating >= 4);
    if (status === 'unanswered') rows = rows.filter(r => !r.replied);
    if (status === 'answered')   rows = rows.filter(r => r.replied);
    const sorted = [...rows];
    if (sort === 'urgency') sorted.sort((a, b) => urgencyScore(a) - urgencyScore(b));
    if (sort === 'recent')  sorted.sort((a, b) => new Date(b.t) - new Date(a.t));
    if (sort === 'lowest')  sorted.sort((a, b) => a.rating - b.rating || new Date(b.t) - new Date(a.t));
    return sorted;
  }, [withLocal, channel, rating, status, sort]);

  const breached = withLocal.filter(r => slaState(r) === 'breached').length;

  const submitReply = (review, text, comp) => {
    setReplies(prev => ({
      ...prev,
      [review.id]: { by: PROFILES[role].name, t: new Date().toISOString(), text, comp },
    }));
    setOpen(null);
    toast.push({
      title: 'Reply published',
      desc: `Your reply to ${review.author} is live on ${PLATFORM_BY_ID[review.channel].name}.`,
      kind: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Reviews</h1>
          <p className="text-sm text-saf-muted mt-1">
            Every Google review, with the reply clock running.
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon="Download"
          onClick={() => {
            const csv = buildCsv([
              REVIEW_EXPORT_COLUMNS,
              ...filtered.map(r => ([
                r.id,
                PLATFORM_BY_ID[r.channel].name,
                r.author,
                r.rating,
                r.t,
                r.replied ? 'yes' : 'no',
                slaState(r),
                (r.themes || []).join('; '),
                r.text,
                r.reply ? r.reply.by : '',
                r.reply ? r.reply.text : '',
              ])),
            ]);
            downloadCsv(`saffron-house-reviews-${reviewDateSlug()}.csv`, csv);
            toast.push({ title: `${filtered.length} reviews exported`, kind: 'success' });
          }}
        >
          Export CSV
        </Button>
      </div>

      <ReviewSummary breached={breached} theme={theme} />

      {/* Filters */}
      <Card padding="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[12px] text-saf-muted uppercase tracking-wider me-2">Filters</div>

          <FilterGroup label="Rating" value={rating} onChange={setRating} options={[
            { v: 'all',  l: 'Any rating' },
            { v: 'low',  l: '1–2 ★' },
            { v: 'high', l: '4–5 ★' },
          ]} />

          <FilterGroup label="Status" value={status} onChange={setStatus} options={[
            { v: 'unanswered', l: 'Needs reply' },
            { v: 'answered',   l: 'Answered' },
            { v: 'all',        l: 'All' },
          ]} />

          <FilterGroup label="Sort" value={sort} onChange={setSort} options={[
            { v: 'urgency', l: 'Most urgent' },
            { v: 'recent',  l: 'Most recent' },
            { v: 'lowest',  l: 'Lowest rated' },
          ]} />

          <span className="ms-auto text-[12px] text-saf-muted">
            {filtered.length} of {withLocal.length} reviews
          </span>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card padding="p-10">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-700">
              <Icon name="Check" size={26} />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-saf-text">Nothing waiting</div>
            <div className="text-[13px] text-saf-muted mt-1">
              No reviews match these filters. Every review in this view has been answered.
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReviewCard
              key={r.id}
              review={r}
              theme={theme}
              canReply={canReply}
              canEscalate={canEscalate}
              onReply={() => setOpen(r)}
              onEscalate={() => toast.push({
                title: 'Escalated to the floor',
                desc: `${r.author}'s review was sent to the duty manager's WhatsApp.`,
                kind: 'info',
              })}
            />
          ))}
        </div>
      )}

      {open && (
        <ReplyModal
          review={open}
          role={role}
          canComp={canComp}
          onClose={() => setOpen(null)}
          onSubmit={submitReply}
        />
      )}
    </div>
  );
}

// --- Summary strip -----------------------------------------------------------
// Four numbers an owner would want before anything else: what the rating is,
// which way it is moving, how much of the queue is unanswered, and how fast
// the team is actually replying against the promise it made.
function ReviewSummary({ breached, theme }) {
  const s = REVIEW_STATS;
  const delta = +(s.avg - s.avgPrev).toFixed(2);
  const maxBar = Math.max(...s.distribution);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Rating + distribution */}
      <Card className="col-span-12 lg:col-span-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-saf-muted uppercase tracking-wider">Google rating</div>
            <div className="flex items-end gap-2 mt-1">
              <div className="text-[44px] leading-none font-bold text-saf-text font-display">{s.avg.toFixed(1)}</div>
              <div className="pb-1.5">
                <StarRow value={s.avg} size={16} />
                <div className="text-[11px] text-saf-muted mt-0.5">{fmt(s.total90d)} reviews · 90 days</div>
              </div>
            </div>
            {/* Direction is stated in words as well as colour + arrow —
                never signalled by colour alone. */}
            <div className={`mt-2 inline-flex items-center gap-1 text-[12px] font-medium ${delta < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              <Icon name={delta < 0 ? 'TrendingDown' : 'TrendingUp'} size={14} />
              {delta > 0 ? '+' : ''}{delta.toFixed(1)} vs previous 90 days
            </div>
          </div>
          <Sparkline
            data={s.trend12w}
            width={110}
            height={44}
            stroke={theme === 'dark' ? '#F0A07A' : '#B4451F'}
          />
        </div>

        <div className="mt-4 space-y-1">
          {[5, 4, 3, 2, 1].map(star => {
            const count = s.distribution[star - 1];
            const pct = Math.round((count / s.total90d) * 100);
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-8 text-[11px] text-saf-muted tabular-nums">{star} ★</span>
                <div className="flex-1 h-2 rounded-full bg-saf-light overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / maxBar) * 100}%`, background: star >= 4 ? '#2E7D4F' : star === 3 ? '#D99A16' : '#C0342B' }}
                  />
                </div>
                <span className="w-16 text-[11px] text-saf-muted tabular-nums text-end">{fmt(count)} · {pct}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Themes — derived, and the only cross-cut available on a single channel */}
      <Card className="col-span-12 lg:col-span-4">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">What reviews are about</div>
        <div className="mt-3 space-y-2.5">
          {topThemes().map(([theme, stat]) => (
            <div key={theme} className="flex items-center gap-3">
              <span className="w-28 text-[12.5px] text-saf-text truncate">{theme}</span>
              <div className="flex-1 h-2 rounded-full bg-saf-light overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(stat.n / topThemes()[0][1].n) * 100}%`, background: stat.avg >= 4 ? '#2E7D4F' : stat.avg >= 3 ? '#D99A16' : '#C0342B' }}
                />
              </div>
              <span className="w-16 text-end text-[11.5px] text-saf-muted tabular-nums">{stat.n} · {stat.avg.toFixed(1)}★</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-saf-muted mt-3 pt-2.5 border-t border-saf-border leading-relaxed">
          Derived by classifying review text — Google returns the words, not the themes.
        </p>
      </Card>

      {/* Response performance */}
      <Card className="col-span-12 lg:col-span-3">
        <div className="text-[12px] text-saf-muted uppercase tracking-wider">Reply performance</div>

        <div className="mt-3">
          <div className="flex items-end justify-between">
            <div className="text-[28px] font-bold text-saf-text leading-none">{Math.round(s.responseRate * 100)}%</div>
            <div className="text-[11px] text-saf-muted pb-1">target {Math.round(s.responseRateTarget * 100)}%</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-saf-light overflow-hidden relative">
            <div className="h-full rounded-full bg-saf-primary" style={{ width: `${s.responseRate * 100}%` }} />
            <span
              className="absolute top-0 bottom-0 w-px bg-saf-text/50"
              style={{ left: `${s.responseRateTarget * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="text-[11px] text-saf-muted mt-1">Reviews answered within {REVIEW_SLA_MINS / 60}h</div>
        </div>

        <div className="mt-4 pt-3 border-t border-saf-border space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-saf-muted">Median reply time</span>
            <span className="font-semibold text-saf-text tabular-nums">
              {Math.floor(s.medianResponseMins / 60)}h {s.medianResponseMins % 60}m
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-saf-muted">Past SLA now</span>
            <span className={`font-semibold tabular-nums ${breached > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {breached}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Review card -------------------------------------------------------------
function ReviewCard({ review, theme, canReply, canEscalate, onReply, onEscalate }) {
  const p = PLATFORM_BY_ID[review.channel];
  const st = slaState(review);
  const age = minsSince(review.t);

  return (
    <Card padding="p-4" className={st === 'breached' ? 'border-rose-300' : ''}>
      <div className="flex items-start gap-3">
        <Avatar name={review.author} size={40} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-saf-text">{review.author}</span>
            <StarRow value={review.rating} size={13} />
            <span className="text-saf-muted text-[12px]">·</span>
            <span className="inline-flex items-center gap-1 text-[12px] text-saf-muted">
              <span style={{ color: platformColor(review.channel, theme) }}><PlatformGlyph id={review.channel} size={13} /></span>
              {p.name}
            </span>
            <span className="text-saf-muted text-[12px]">·</span>
            <span className="text-[12px] text-saf-muted">{relTime(review.t)}</span>
            <SlaBadge state={st} age={age} className="ms-auto" />
          </div>

          <p className="mt-2 text-[13.5px] leading-relaxed text-saf-text">{review.text}</p>

          {review.themes && review.themes.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {review.themes.map(t => (
                <span key={t} className="px-2 h-6 inline-flex items-center rounded-full bg-saf-light text-saf-primary text-[11px] font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}

          {review.reply ? (
            <div className="mt-3 ps-3 border-s-2 border-saf-primary/40 bg-saf-light/30 rounded-e-lg p-3">
              <div className="flex items-center gap-2 text-[12px]">
                <SafLogoMark size={18} />
                <span className="font-semibold text-saf-text">Saffron House</span>
                <span className="text-saf-muted">replied by {review.reply.by} · {relTime(review.reply.t)}</span>
                {review.reply.comp && (
                  <span className="ms-auto px-2 h-5 inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                    Comp issued
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-saf-text">{review.reply.text}</p>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant={review.rating <= 2 ? 'primary' : 'secondary'}
                leadingIcon="Reply"
                onClick={onReply}
                disabled={!canReply}
                title={canReply ? undefined : 'Requires Guest Relations Lead or Marketing Manager'}
              >
                Reply publicly
              </Button>
              {review.rating <= 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon="Siren"
                  onClick={onEscalate}
                  disabled={!canEscalate}
                  title={canEscalate ? undefined : 'Requires Guest Relations Lead or Marketing Manager'}
                >
                  Escalate to duty manager
                </Button>
              )}
              {!canReply && (
                <span className="text-[11.5px] text-saf-muted">
                  Your role can read reviews but not reply — hand off to Guest Relations.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// SLA badge. Carries an icon and a word alongside the tone colour so the
// state survives both greyscale and colour-blind viewing.
function SlaBadge({ state, age, className = '' }) {
  const hrs = (m) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);
  const map = {
    answered: { tone: 'bg-emerald-50 text-emerald-700', icon: 'Check',      label: 'Answered' },
    open:     { tone: 'bg-saf-light text-saf-primary',  icon: 'Clock',      label: `${hrs(REVIEW_SLA_MINS - age)} left` },
    due:      { tone: 'bg-amber-50 text-amber-700',     icon: 'Clock',      label: `Due in ${hrs(Math.max(0, REVIEW_SLA_MINS - age))}` },
    breached: { tone: 'bg-rose-50 text-rose-700',       icon: 'AlertTriangle', label: `${hrs(age - REVIEW_SLA_MINS)} past SLA` },
  }[state];
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-semibold ${map.tone} ${className}`}>
      <Icon name={map.icon} size={11} />
      {map.label}
    </span>
  );
}

// --- Reply modal -------------------------------------------------------------
// A public reply is permanent and is read by everyone considering a booking,
// not just by the person who complained. The modal therefore shows the review
// alongside the draft at all times, and offers tone-appropriate starters
// rather than a blank box.
function ReplyModal({ review, role, canComp, onClose, onSubmit }) {
  const p = PLATFORM_BY_ID[review.channel];
  const limit = p.limit;
  const negative = review.rating <= 2;

  const starters = negative
    ? [
        { id: 'apology', label: 'Own it', text: `${review.author.split(' ')[0]}, that is not the standard we cook to and I am sorry. ` },
        { id: 'invite',  label: 'Invite back', text: `Thank you for telling us — I would like to put this right in person. ` },
      ]
    : [
        { id: 'thanks',  label: 'Thank the team', text: `Thank you so much — I have passed this to the kitchen and floor team. ` },
        { id: 'specific',label: 'Name the dish',   text: `Delighted this landed well — I will tell Chef Meera you said so. ` },
      ];

  const [text, setText] = React.useState('');
  const [comp, setComp] = React.useState(false);
  const over = text.length > limit;

  return (
    <Modal open onClose={onClose} title={`Reply on ${p.name}`} width={720}>
      <div className="space-y-4">
        {/* The review being answered, always visible while drafting. */}
        <div className="p-3 rounded-xl bg-saf-surface border border-saf-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Avatar name={review.author} size={28} />
            <span className="text-[13px] font-semibold text-saf-text">{review.author}</span>
            <StarRow value={review.rating} size={12} />
            <span className="text-[12px] text-saf-muted">· {relTime(review.t)}</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-saf-text">{review.text}</p>
        </div>

        {negative && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12.5px] text-amber-700">
            <Icon name="Info" size={15} className="mt-px shrink-0" />
            <p>
              This reply is public and permanent. Future guests will read it before they read the complaint —
              answer the person, not the rating, and never argue the facts in public.
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-[12px] text-saf-muted uppercase tracking-wider">Starters</span>
            {starters.map(s => (
              <button
                key={s.id}
                onClick={() => setText(t => (t ? t : s.text))}
                className="px-2.5 h-7 rounded-full border border-saf-border text-[12px] text-saf-text hover:bg-saf-light hover:border-saf-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary"
              >
                {s.label}
              </button>
            ))}
          </div>

          <label htmlFor="review-reply" className="sr-only">Your public reply</label>
          <textarea
            id="review-reply"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Reply to ${review.author} as Saffron House…`}
            className="w-full min-h-[140px] p-3 rounded-xl border border-saf-border bg-white text-saf-text text-[14px] leading-relaxed focus:border-saf-primary focus:ring-4 focus:ring-saf-primary/10 transition-all resize-y"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11.5px] text-saf-muted">
              Publishing as {PROFILES[role].name} · {PROFILES[role].role}
            </span>
            <span className={`text-[11.5px] tabular-nums ${over ? 'text-rose-700 font-semibold' : 'text-saf-muted'}`}>
              {text.length} / {fmt(limit)}
            </span>
          </div>
        </div>

        {negative && (
          <div className="p-3 rounded-xl border border-saf-border">
            <Switch
              checked={comp}
              onChange={setComp}
              disabled={!canComp}
              label="Issue a comp with this reply"
              sub={canComp
                ? 'Sends a ₹1,000 credit against the guest’s next visit and logs it to the audit trail.'
                : 'Only the Marketing Manager can issue a comp — it costs money and is logged.'}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            leadingIcon="Send"
            disabled={!text.trim() || over}
            onClick={() => onSubmit(review, text.trim(), comp)}
          >
            Publish reply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Small filter control ----------------------------------------------------
function FilterGroup({ label, value, onChange, options }) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20 transition"
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </span>
  );
}

window.ReviewsPage = ReviewsPage;
window.reviewSlaState = slaState;
window.reviewMinsSince = minsSince;
