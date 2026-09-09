// Unified inbox.

function MessagesPage({ role }) {
  const t = useT();
  const toast = useToast();
  const { lang } = React.useContext(AppCtx);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [activeId, setActiveId] = React.useState('c1');
  const [conversations, setConversations] = React.useState(CONVERSATIONS);
  const [reply, setReply] = React.useState('');
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [unmaskedFor, setUnmaskedFor] = React.useState({}); // { [convId]: true }
  const threadEndRef = React.useRef(null);

  const canUnmask = hasPerm(role || 'manager', 'inbox.unmask');

  const filtered = conversations
    .filter(c => filter === 'all' ? true : c.platform === filter)
    .filter(c => !search || c.user.toLowerCase().includes(search.toLowerCase()) || c.preview.toLowerCase().includes(search.toLowerCase()));

  const active = conversations.find(c => c.id === activeId) || filtered[0];

  // Mark read on open
  React.useEffect(() => {
    if (!active) return;
    if (active.unread > 0) {
      setConversations(prev => prev.map(c => c.id === active.id ? { ...c, unread: 0 } : c));
    }
    requestAnimationFrame(() => threadEndRef.current && threadEndRef.current.scrollIntoView && (threadEndRef.current.parentElement.scrollTop = threadEndRef.current.parentElement.scrollHeight));
  }, [activeId]);

  // Unread totals
  const totals = React.useMemo(() => {
    const t = { all: 0 };
    conversations.forEach(c => { t.all += c.unread; t[c.platform] = (t[c.platform] || 0) + c.unread; });
    return t;
  }, [conversations]);

  // Send reply
  const sendReply = () => {
    if (!reply.trim() || !active) return;
    setConversations(prev => prev.map(c => c.id !== active.id ? c : {
      ...c,
      messages: [...c.messages, { from: 'saf', text: reply.trim(), t: new Date().toISOString(), status: 'sent' }],
    }));
    setReply('');
    toast.push({ title: 'Reply sent' });
  };

  return (
    <div className="-mx-6 -my-6 grid h-[calc(100vh-4rem)]" style={{ gridTemplateColumns: '240px 340px 1fr' }}>
      {/* LEFT — Platform filter */}
      <div className="border-saf-border ltr:border-r rtl:border-l bg-white flex flex-col">
        <div className="px-4 h-14 flex items-center font-medium text-saf-text border-b border-saf-border">{t.messages.filter}</div>
        <div className="p-2 space-y-1">
          <FilterRow id="all" icon="Inbox" label={t.messages.all} active={filter === 'all'} count={totals.all} onClick={() => setFilter('all')} />
          {PLATFORMS.map(p => (
            <FilterRow
              key={p.id}
              id={p.id}
              icon={null}
              label={p.name + ({ ig: ' DMs', wa: ' messages', gg: ' Q&A', zo: ' order issues', sw: ' order issues', di: ' enquiries' }[p.id] || '')}
              active={filter === p.id}
              count={totals[p.id] || 0}
              accent={p.color}
              platform={p.id}
              onClick={() => setFilter(p.id)}
            />
          ))}
        </div>
        <div className="mt-auto p-3">
          <Card padding="p-3" className="bg-saf-light/60 border-saf-light">
            <div className="text-[12px] font-medium text-saf-text">Quick replies</div>
            <div className="text-[11px] text-saf-muted mt-1">Save common responses for faster replies.</div>
            <button className="mt-2 text-[12px] text-saf-primary hover:underline inline-flex items-center gap-1"><Icon name="Plus" size={12} />Add template</button>
          </Card>
        </div>
      </div>

      {/* MIDDLE — Conversation list */}
      <div className="border-saf-border ltr:border-r rtl:border-l bg-white flex flex-col min-h-0">
        <div className="p-3 border-b border-saf-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-saf-text">{t.messages.title}</h2>
            <span className="text-[11px] text-saf-muted">{filtered.length} conversations</span>
          </div>
          <div className="flex items-center bg-saf-surface border border-saf-border rounded-lg h-9 px-3 gap-2 focus-within:border-saf-primary focus-within:ring-4 focus-within:ring-saf-primary/10 transition">
            <Icon name="Search" size={14} className="text-saf-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.messages.search} className="flex-1 bg-transparent text-[13px]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-saf-muted">No conversations match.</div>
          ) : filtered.map(c => (
            <ConvoRow key={c.id} c={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} lang={lang} />
          ))}
          {/* Loading skeleton */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Thread */}
      <div className="bg-saf-surface flex flex-col min-h-0">
        {!active ? (
          <div className="flex-1 grid place-items-center text-saf-muted text-[13px]">{t.messages.empty}</div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 h-14 bg-white border-b border-saf-border flex items-center gap-3">
              <Avatar name={active.user} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-saf-text truncate">{active.user}</span>
                  <PlatformBadge id={active.platform} withName={false} size={12} />
                </div>
                <div className="text-[11px] text-saf-muted flex items-center gap-1.5">
                  {active.online ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t.messages.online}</> : t.messages.offline}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Unmask PII — Manager only. Disabled with tooltip for
                    other roles. The actual phone/account on the
                    conversation reveal in the thread banner below. */}
                {active.pii ? (
                  canUnmask ? (
                    <button
                      onClick={() => setUnmaskedFor(p => ({ ...p, [active.id]: !p[active.id] }))}
                      aria-pressed={!!unmaskedFor[active.id]}
                      title={unmaskedFor[active.id] ? 'Hide PII' : 'Unmask PII'}
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 ${
                        unmaskedFor[active.id]
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'text-saf-muted hover:bg-saf-light hover:text-saf-text'
                      }`}
                    >
                      <Icon name={unmaskedFor[active.id] ? 'EyeOff' : 'Eye'} size={14} />
                      {unmaskedFor[active.id] ? 'Hide PII' : 'Unmask PII'}
                    </button>
                  ) : (
                    <Tooltip label="Unmask PII requires the Manager role" side="bottom">
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] text-saf-muted opacity-60 cursor-not-allowed"
                      >
                        <Icon name="Lock" size={14} />Unmask PII
                      </span>
                    </Tooltip>
                  )
                ) : null}
                <Tooltip label="Call"><button className="w-9 h-9 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="Phone" size={16} /></button></Tooltip>
                <Tooltip label="Info"><button className="w-9 h-9 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="Info" size={16} /></button></Tooltip>
                <Tooltip label="More"><button className="w-9 h-9 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="MoreVertical" size={16} /></button></Tooltip>
              </div>
            </div>

            {/* PII banner — masked by default, reveals when Manager
                toggles Unmask. Visceral demo moment per spec. */}
            {active.pii && (
              <div className={`mx-6 mt-3 px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 border transition-colors ${
                unmaskedFor[active.id]
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-saf-light/40 border-saf-light text-saf-muted'
              }`}>
                <Icon name={unmaskedFor[active.id] ? 'EyeOff' : 'Lock'} size={13} />
                <div className="flex items-center gap-3 flex-wrap">
                  {active.pii.phone && (
                    <span>Phone: <span className="font-mono font-medium text-saf-text">{unmaskedFor[active.id] ? active.pii.phone : maskedPhone(active.pii.phone)}</span></span>
                  )}
                  {active.pii.account && (
                    <span>Ref: <span className="font-mono font-medium text-saf-text">{unmaskedFor[active.id] ? active.pii.account : maskedAccount(active.pii.account)}</span></span>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto nice-scroll px-6 py-4">
              <MessageList messages={active.messages} lang={lang} />
              <div ref={threadEndRef} />
            </div>

            {/* Reply composer */}
            <div className="p-3 bg-white border-t border-saf-border">
              {templatesOpen && (
                <div className="mb-2 p-2 bg-saf-surface border border-saf-border rounded-lg animate-slideDown">
                  <div className="text-[10px] uppercase tracking-wider text-saf-muted mb-1.5 px-1">Quick reply templates</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.en.map(tp => (
                      <button
                        key={tp.id}
                        onClick={() => { setReply(tp.body); setTemplatesOpen(false); }}
                        className="text-[12px] px-2 h-7 rounded-full bg-white border border-saf-border text-saf-text hover:border-saf-primary hover:bg-saf-light transition"
                      >{tp.title}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="border border-saf-border rounded-xl bg-white focus-within:border-saf-primary focus-within:ring-4 focus-within:ring-saf-primary/10 transition">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                  placeholder={t.messages.typePh}
                  dir={active.langHint === 'ar' ? 'rtl' : 'ltr'}
                  className="w-full min-h-[64px] p-3 bg-transparent text-[14px] text-saf-text resize-none"
                />
                <div className="flex items-center gap-1 px-2 pb-2">
                  <Tooltip label={t.messages.emoji} side="top"><button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="Smile" size={16} /></button></Tooltip>
                  <Tooltip label={t.messages.attach} side="top"><button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="Paperclip" size={16} /></button></Tooltip>
                  <button onClick={() => setTemplatesOpen(o => !o)} className={`h-8 px-2 inline-flex items-center gap-1 rounded-lg text-[12px] transition ${templatesOpen ? 'bg-saf-light text-saf-primary' : 'text-saf-muted hover:bg-saf-light hover:text-saf-text'}`}>
                    <Icon name="ClipboardList" size={14} />{t.messages.templates}
                  </button>
                  <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-2">
                    <span className="text-[11px] text-saf-muted tabular-nums">{reply.length}/{PLATFORM_BY_ID[active.platform].dmLimit}</span>
                    <Button variant="primary" size="sm" leadingIcon="Send" disabled={!reply.trim()} onClick={sendReply}>{t.messages.send}</Button>
                  </div>
                </div>
              </div>
              <div className="px-1 mt-1 text-[10px] text-saf-muted">Tip: press ⌘/Ctrl + Enter to send.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterRow({ id, icon, label, count, active, onClick, accent, platform }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2.5 h-10 rounded-lg transition text-start ${active ? 'bg-saf-light text-saf-primary font-medium' : 'text-saf-text hover:bg-saf-light/60'}`}
    >
      <span className="w-7 h-7 rounded-md grid place-items-center" style={accent ? { background: accent, color: 'white' } : { background: '#FCEFE7', color: '#B4451F' }}>
        {platform ? <PlatformGlyph id={platform} size={13} /> : <Icon name={icon} size={15} />}
      </span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
      {count > 0 && <span className="px-1.5 h-5 grid place-items-center text-[11px] font-medium rounded-full bg-saf-danger text-white">{count}</span>}
    </button>
  );
}

function ConvoRow({ c, active, onClick, lang }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start flex items-start gap-3 px-3 py-3 border-b border-saf-border transition relative ${active ? 'bg-saf-light' : c.unread ? 'bg-saf-light/30 hover:bg-saf-light/60' : 'hover:bg-saf-light/40'}`}
    >
      <div className="relative shrink-0">
        <Avatar name={c.user} size={40} />
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center ring-2 ring-white text-white" style={{ background: PLATFORM_BY_ID[c.platform].color }}>
          <PlatformGlyph id={c.platform} size={9} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[13px] truncate ${c.unread ? 'font-semibold text-saf-text' : 'text-saf-text'}`} dir={c.langHint === 'ar' ? 'rtl' : 'ltr'}>{c.user}</span>
          <span className="text-[10px] text-saf-muted shrink-0">{relTime(c.messages[c.messages.length - 1].t, lang)}</span>
        </div>
        <div className={`text-[12px] truncate mt-0.5 ${c.unread ? 'text-saf-text font-medium' : 'text-saf-muted'}`} dir={c.langHint === 'ar' ? 'rtl' : 'ltr'}>{c.preview}</div>
      </div>
      {c.unread > 0 && <span className="w-2 h-2 rounded-full bg-saf-primary mt-1.5 shrink-0" />}
    </button>
  );
}

function MessageList({ messages, lang }) {
  // group consecutive messages from same sender into clusters
  const clusters = [];
  messages.forEach(m => {
    const last = clusters[clusters.length - 1];
    if (last && last.from === m.from && (new Date(m.t) - new Date(last.messages[last.messages.length-1].t)) < 5 * 60 * 1000) {
      last.messages.push(m);
    } else {
      clusters.push({ from: m.from, messages: [m] });
    }
  });
  return (
    <div className="space-y-3">
      {clusters.map((cl, i) => (
        <div key={i} className={`flex ${cl.from === 'saf' ? 'justify-end rtl:justify-start' : 'justify-start rtl:justify-end'}`}>
          <div className="max-w-[70%]">
            <div className="space-y-1">
              {cl.messages.map((m, j) => (
                <div
                  key={j}
                  className={`px-4 py-2.5 text-[14px] leading-relaxed ${cl.from === 'saf'
                    ? 'bg-saf-primary text-white rounded-2xl ltr:rounded-br-md rtl:rounded-bl-md'
                    : 'bg-white border border-saf-border text-saf-text rounded-2xl ltr:rounded-bl-md rtl:rounded-br-md'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className={`flex items-center gap-1 mt-1 text-[10px] text-saf-muted ${cl.from === 'saf' ? 'justify-end rtl:justify-start' : 'justify-start rtl:justify-end'}`}>
              <span>{fmtTime(cl.messages[cl.messages.length - 1].t)}</span>
              {cl.from === 'saf' && (
                <span className="inline-flex items-center">
                  {(() => {
                    const s = cl.messages[cl.messages.length-1].status;
                    if (s === 'read')      return <Icon name="CheckCheck" size={12} className="text-saf-accent" />;
                    if (s === 'delivered') return <Icon name="CheckCheck" size={12} />;
                    return <Icon name="Check" size={12} />;
                  })()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { MessagesPage });
