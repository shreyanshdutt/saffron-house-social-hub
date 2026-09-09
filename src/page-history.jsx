// Shared helpers — Stat / Metric / SentimentPill / Dropdown /
// EmptyState / PostDetailDrawer / statusTone. Originally lived alongside
// the History page; History was replaced by Approvals but these helpers
// are referenced from page-approvals.jsx (PostDetailDrawer) and
// page-dashboard.jsx + page-analytics.jsx (Stat). Keep them in one
// module so the bundle still resolves them.

function statusTone(status) {
  return {
    published: { tone: 'green', label: 'Published' },
    scheduled: { tone: 'blue',  label: 'Scheduled' },
    draft:     { tone: 'gray',  label: 'Draft' },
    in_review: { tone: 'amber', label: 'In review' },
    sent_back: { tone: 'red',   label: 'Sent back' },
    rejected:  { tone: 'red',   label: 'Rejected' },
    failed:    { tone: 'red',   label: 'Failed' },
  }[status] || { tone: 'gray', label: status };
}

function Stat({ icon, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-saf-muted text-[12px]">
      <Icon name={icon} size={13} />
      <span className="tabular-nums">{fmt(value)}</span>
    </span>
  );
}

function Dropdown({ label, icon, options, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-3 inline-flex items-center gap-2 rounded-lg bg-white border border-saf-border text-[13px] text-saf-text hover:bg-saf-light transition"
      >
        <Icon name={icon} size={14} className="text-saf-muted" />
        {label}
        <Icon name="ChevronDown" size={14} className="text-saf-muted" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 ltr:left-0 rtl:right-0 min-w-[180px] bg-white border border-saf-border rounded-lg shadow-pop py-1 z-30 animate-slideDown">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
              className="w-full text-start px-3 h-8 text-[13px] text-saf-text hover:bg-saf-light transition"
            >{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-saf-light grid place-items-center text-saf-primary">
        <Icon name={icon} size={28} />
      </div>
      <div className="mt-3 text-[15px] font-medium text-saf-text">{title}</div>
      {subtitle && <div className="text-[13px] text-saf-muted mt-1">{subtitle}</div>}
    </div>
  );
}

function SentimentPill({ kind }) {
  const map = {
    pos: { tone: 'green', label: 'Positive', glyph: '👍' },
    neu: { tone: 'gray',  label: 'Neutral',  glyph: '😐' },
    neg: { tone: 'red',   label: 'Negative', glyph: '👎' },
  };
  const m = map[kind] || map.neu;
  return <Pill tone={m.tone}><span aria-hidden="true">{m.glyph}</span>{m.label}</Pill>;
}

function Metric({ label, value, suffix = '', highlight }) {
  const formatted = suffix === '%' ? value.toFixed(1) + '%' : fmt(value);
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-saf-primary/5 border-saf-primary/20' : 'bg-white border-saf-border'}`}>
      <div className="text-[10px] text-saf-muted uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-[18px] font-semibold tabular-nums ${highlight ? 'text-saf-primary' : 'text-saf-text'}`}>{formatted}</div>
    </div>
  );
}

function PostDetailDrawer({ post, onClose }) {
  const t = useT();
  const { lang } = React.useContext(AppCtx);
  const [reply, setReply] = React.useState('');
  const [replyTo, setReplyTo] = React.useState(null);
  const toast = useToast();
  if (!post) return null;
  const st = statusTone(post.status);
  return (
    <Drawer open={!!post} onClose={onClose} title={t.history.details} width={600}>
      <div className="p-5 space-y-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Pill tone={st.tone}>{st.label}</Pill>
            <div className="flex -space-x-1.5 rtl:space-x-reverse">
              {post.platforms.map((pi, i) => (
                <span key={pi} className="w-6 h-6 rounded-full grid place-items-center text-white ring-2 ring-white" style={{ background: PLATFORM_BY_ID[pi].color, zIndex: 10 - i }}>
                  <PlatformGlyph id={pi} size={10} />
                </span>
              ))}
            </div>
            <span className="text-[12px] text-saf-muted">{fmtTime(post.date, { withDate: true })} · {post.author}</span>
          </div>
          {post.media ? <MockImage tone={post.media.tone} kind={post.media.kind} label={post.media.label} className="w-full aspect-[16/9]" /> : null}
          <div className="text-[14px] text-saf-text leading-relaxed whitespace-pre-wrap mt-3">{post.content}</div>
          {post.tags?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.map(tg => <span key={tg} className="text-[12px] text-saf-primary">{tg}</span>)}
            </div>
          ) : null}
        </div>

        {post.error ? (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-[12px] text-rose-700 flex items-start gap-2">
            <Icon name="AlertTriangle" size={14} className="mt-0.5" />
            <div>
              <div className="font-medium">Publishing failed</div>
              <div>{post.error}</div>
            </div>
          </div>
        ) : null}

        <section>
          <h4 className="text-[13px] font-medium text-saf-text mb-3">{t.history.metrics}</h4>
          {/* Post-level performance is Instagram's — Google local posts report
              only views and CTA clicks, which live on the Analytics screen.
              Saying so beats implying these numbers are blended. */}
          <p className="text-[11.5px] text-saf-muted -mt-2 mb-3">
            From {PLATFORM_BY_ID[post.metricsFrom || 'ig'].api}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Metric label={t.history.m.views}    value={post.metrics.views} />
            <Metric label={t.history.m.reach}    value={post.metrics.reach} />
            <Metric label={t.history.m.likes}    value={post.metrics.likes} />
            <Metric label={t.history.m.comments} value={post.metrics.comments} />
            <Metric label={t.history.m.shares}   value={post.metrics.shares} />
            <Metric label={t.history.m.saves}    value={post.metrics.saves} />
            <Metric label={t.history.m.rate}     value={post.metrics.rate} suffix="%" highlight />
          </div>
        </section>

        <section>
          <h4 className="text-[13px] font-medium text-saf-text mb-3 flex items-center gap-2">
            {t.history.comments} <Pill tone="blue">{POST_COMMENTS.length}</Pill>
          </h4>
          <div className="space-y-3">
            {POST_COMMENTS.map(c => (
              <div key={c.id} className={`flex gap-3 p-3 rounded-lg border ${c.isArc ? 'bg-saf-light/50 border-saf-light' : 'bg-white border-saf-border'}`}>
                <Avatar name={c.user} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="font-medium text-saf-text">{c.user}</span>
                    {c.isBrand && <Pill tone="blue">Saffron House</Pill>}
                    <SentimentPill kind={c.sentiment} />
                    <span className="text-saf-muted">{relTime(c.t, lang)}</span>
                  </div>
                  <div className="text-[13px] text-saf-text mt-1">{c.text}</div>
                  {!c.isArc && (
                    <button
                      onClick={() => setReplyTo(c)}
                      className="mt-2 inline-flex items-center gap-1 text-[12px] text-saf-primary hover:underline"
                    >
                      <Icon name="CornerDownLeft" size={12} />
                      {t.history.reply}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-white border border-saf-border rounded-xl p-3">
            {replyTo && (
              <div className="flex items-center justify-between mb-2 text-[12px] text-saf-muted bg-saf-light rounded p-2">
                <span>Replying to <b className="text-saf-text">{replyTo.user}</b></span>
                <button onClick={() => setReplyTo(null)} className="text-saf-muted hover:text-saf-text"><Icon name="X" size={12} /></button>
              </div>
            )}
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={replyTo ? t.history.replyPh.replace('{name}', replyTo.user) : 'Add a public reply…'}
              className="w-full min-h-[70px] resize-none text-[13px] bg-transparent text-saf-text"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="primary" size="sm" leadingIcon="Send" disabled={!reply.trim()} onClick={() => { toast.push({ title: 'Reply sent' }); setReply(''); setReplyTo(null); }}>{t.history.send}</Button>
            </div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

Object.assign(window, { statusTone, Stat, Dropdown, EmptyState, SentimentPill, Metric, PostDetailDrawer });
