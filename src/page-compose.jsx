// Compose Post page.
//
// 760ec7b disabled all three actions because nothing stored a post. 849c3b7
// built `posts` + `post_targets` server-side, so they work now and the panel
// that explained their absence has gone with them — it would be a false
// statement of a different kind.
//
// WHAT THIS SCREEN MUST NOT DO IS FLATTEN THE RESULT. The server answers a
// publish attempt with one row PER CHANNEL, and those rows disagree: Instagram
// can fail because a sign-in lapsed while X fails because nobody ever
// authorised it. Both are "it didn't publish" and they are not the same
// problem. This screen renders every target, and takes its one-line headline
// from the server's own `summary.label` rather than deriving a second one.

// The offset AND the zone, because the server stores both and neither can be
// reconstructed from the other (+05:30 is Asia/Kolkata and Asia/Colombo, and a
// zone's offset moves across a DST boundary while "10am local" does not). The
// select renders from this table rather than the label being parsed back apart.
const COMPOSE_TIMEZONES = [
  { label: 'Asia/Kolkata — IST (+05:30)', zone: 'Asia/Kolkata', offset: '+05:30' },
  { label: 'Asia/Dubai — GST (+04:00)',   zone: 'Asia/Dubai',   offset: '+04:00' },
  { label: 'Asia/Riyadh — AST (+03:00)',  zone: 'Asia/Riyadh',  offset: '+03:00' },
  { label: 'UTC',                         zone: 'UTC',          offset: '+00:00' },
];

// WHAT HAPPENED, PER CHANNEL. The whole reason this commit exists.
//
// The headline is the SERVER's `summary.label` — "Published to 1, failed on 1"
// when the channels disagree — and is not recomputed here. Two implementations
// of one rule is the defect this repo has spent the most commits removing, and
// the rule lives in server/src/posts.js where it is tested.
//
// Below it, EVERY target, with its own reason. Instagram failing because a
// sign-in lapsed and X failing because nobody ever authorised it are different
// problems with different fixes, and "Publishing failed" would erase that.
function ComposeResult({ result, onDismiss, onRetry, busy }) {
  const { post, plan, kind } = result;
  const s = post.summary;
  // WRITTEN OUT, NOT INTERPOLATED. `bg-${tone}-50` is a class name that exists
  // only at runtime; the play CDN may or may not have generated it, and the
  // failure is an invisibly unstyled badge rather than an error (CLAUDE.md §11
  // trap 3 is the same shape for icon names). Full strings only.
  const TONE = {
    published:     'bg-emerald-50 text-emerald-700',
    failed:        'bg-rose-50 text-rose-700',
    mixed:         'bg-amber-50 text-amber-700',
    in_flight:     'bg-saf-light text-saf-primary',
    not_attempted: 'bg-saf-light text-saf-primary',
  }[s.outcome] || 'bg-saf-light text-saf-primary';
  const anyFailed = s.counts.failed > 0;

  return (
    <Card padding="p-4" className="mt-2">
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${TONE}`}>
          <Icon name={s.outcome === 'published' ? 'CheckCircle2' : s.outcome === 'not_attempted' ? 'FileText' : 'AlertTriangle'} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-saf-text">{s.label}</div>
          <p className="text-[12px] text-saf-muted mt-0.5">
            {kind === 'draft' && 'Saved as a draft. It is on the server, not in this browser, and it has not been sent anywhere.'}
            {kind === 'schedule' && `Stored for ${post.scheduledAt} (${post.scheduledTz}). Nothing runs a scheduled post yet — this records the intention.`}
            {kind === 'publish' && 'The attempt was recorded. Each channel answered for itself:'}
          </p>

          {kind === 'publish' && (
            <div className="mt-2.5 divide-y divide-saf-border border border-saf-border rounded-lg overflow-hidden">
              {post.targets.map(tg => {
                const meta = PLATFORM_BY_ID[tg.clientId];
                const ok = tg.status === 'published';
                return (
                  <div key={tg.platform} className="flex items-start gap-2.5 p-2.5 bg-saf-card">
                    <span className="w-6 h-6 rounded-full grid place-items-center text-white shrink-0 mt-px"
                          style={{ background: meta ? (meta.gradient || meta.color) : '#7A6A5F' }}>
                      <PlatformGlyph id={tg.clientId} size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-medium text-saf-text">{meta ? meta.name : tg.platform}</span>
                        <span className={`px-1.5 h-4 inline-flex items-center rounded text-[10.5px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {ok ? 'Published' : 'Not published'}
                        </span>
                      </div>
                      {/* The server's own sentence, verbatim. It already
                          distinguishes never_connected / expired / revoked /
                          not_implemented, and rewording it here would be a
                          second vocabulary for the same four facts. */}
                      {tg.reason && <p className="text-[11.5px] text-saf-muted mt-0.5 leading-relaxed">{tg.reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* What the attempt cost, from the server's plan — CONVENTIONS.md §10. */}
          {plan && (
            <p className="text-[11px] text-saf-muted mt-2">
              {plan.totalCalls === 0
                ? 'No channel was reachable, so no API call was made and nothing was billed.'
                : `${plan.totalCalls} API call${plan.totalCalls === 1 ? '' : 's'} would have been made${plan.billedCalls ? `, ${plan.billedCalls} of them billed (${plan.billedPlatforms.join(', ')})` : ', none of them billed'}.`}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            {kind === 'publish' && anyFailed && (
              <Button size="sm" variant="secondary" leadingIcon="RefreshCw" loading={busy} disabled={busy} onClick={onRetry}>
                Try the failed channels again
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDismiss}>Write another post</Button>
          </div>
          <p className="text-[11px] text-saf-muted mt-2">
            The composer above has been cleared so pressing a button twice cannot create two posts.
            This one is stored as <span className="font-mono">{post.id}</span>.
          </p>
        </div>
      </div>
    </Card>
  );
}

function ComposePage() {
  const t = useT();
  const toast = useToast();
  const { lang, profile } = React.useContext(AppCtx);

  // Selection of platforms
  const [selected, setSelected] = React.useState(['ig', 'gg']);
  const togglePlatform = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Content
  const [content, setContent] = React.useState('Tonight at Saffron House 🔥 — ');

  // Hashtags
  const [tags, setTags] = React.useState(['#SaffronHouse', '#Dwarka']);
  const [tagInput, setTagInput] = React.useState('');
  const [tagAutocomplete, setTagAutocomplete] = React.useState(false);

  // Media
  const [media, setMedia] = React.useState([
    // start with one mock attachment to show a real-looking state
    { id: 'm1', kind: 'image', label: 'Hero banner', tone: 'night' },
  ]);
  const [dragOver, setDragOver] = React.useState(false);
  const [lightbox, setLightbox] = React.useState(null);

  // Schedule
  const [scheduleMode, setScheduleMode] = React.useState('now'); // 'now' | 'later'
  const [scheduleDate, setScheduleDate] = React.useState('2026-09-05');
  const [scheduleTime, setScheduleTime] = React.useState('10:00');
  const [timezone, setTimezone] = React.useState('Asia/Kolkata — IST (+05:30)');

  // What the last action produced, straight from the server. Null until one
  // has run. This is the ONLY record of the outcome on this screen — nothing
  // is re-derived from it.
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(null);   // 'draft' | 'schedule' | 'publish'

  // Preview
  const [previewPlatform, setPreviewPlatform] = React.useState(selected[0] || 'ig');
  React.useEffect(() => {
    if (!selected.includes(previewPlatform) && selected[0]) setPreviewPlatform(selected[0]);
  }, [selected, previewPlatform]);

  // Add tag
  const addTag = (raw) => {
    let v = raw.trim();
    if (!v) return;
    if (!v.startsWith('#')) v = '#' + v;
    if (tags.includes(v)) return;
    setTags(prev => [...prev, v]);
    setTagInput('');
  };

  // Drag-and-drop
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) {
      setMedia(prev => [...prev, ...files.map((f, i) => ({
        id: 'm' + Date.now() + i,
        kind: f.type.startsWith('video') ? 'video' : f.type === 'application/pdf' ? 'pdf' : 'image',
        label: f.name,
        tone: ['warm', 'night', 'sand', 'tech'][(prev.length + i) % 4],
      }))]);
    } else {
      // simulate
      setMedia(prev => [...prev, { id: 'm' + Date.now(), kind: 'image', label: 'New upload.jpg', tone: 'sand' }]);
    }
  };

  // ---- server actions ------------------------------------------------------

  const tz = COMPOSE_TIMEZONES.find(z => z.label === timezone) || COMPOSE_TIMEZONES[0];
  const scheduledAt = `${scheduleDate}T${scheduleTime}:00${tz.offset}`;

  // The post's own shape, from what is attached. Not a server derivation — the
  // server has no opinion about it — just a name for the composer's content.
  const formatOf = () => {
    if (!media.length) return 'text';
    if (media.length > 1) return 'carousel';
    return media[0].kind === 'video' ? 'video' : 'image';
  };

  const payload = (extra = {}) => ({
    platforms: selected,
    content: content.trim(),
    tags,
    format: formatOf(),
    author: profile ? profile.name : null,
    // THE SERVER HOLDS ONE MEDIA OBJECT PER POST AND THE COMPOSER ALLOWS
    // SEVERAL. The first is sent and the rest are NOT silently dropped — the
    // toast says so, because losing an attachment quietly is the class of
    // defect this project keeps removing. See the commit report.
    media: media.length ? { kind: media[0].kind, label: media[0].label, tone: media[0].tone } : null,
    ...extra,
  });

  const extraMediaNote = media.length > 1
    ? `Only the first attachment (${media[0].label}) was stored — this build keeps one image per post, so the other ${media.length - 1} ${media.length - 1 === 1 ? 'was' : 'were'} not saved.`
    : undefined;

  // A shared runner: one busy flag, one failure path, and — the point of it —
  // the form is CLEARED on success. Pressing Save twice must not create two
  // drafts, and there is no update endpoint to re-save into (849c3b7 left PATCH
  // out deliberately), so the honest thing is to hand the post over to the
  // server, say what was created, and start a clean sheet. Nothing is lost:
  // what was written is now stored, which is more than was true before.
  const run = async (kind, fn) => {
    if (busy) return;
    if (!selected.length) {
      toast.push({ title: 'Choose at least one channel', kind: 'error' });
      return;
    }
    if (!content.trim()) {
      toast.push({ title: 'Write something first', desc: 'An empty post is not saved.', kind: 'error' });
      return;
    }
    setBusy(kind);
    try {
      const out = await fn();
      setResult(out);
      setContent('');
      setTags([]);
      setMedia([]);
    } catch (err) {
      // A TRANSPORT failure, which is a different thing from a channel
      // refusing the post. It must never read as "saved".
      setResult(null);
      toast.push({
        title: 'Nothing was saved',
        desc: `The data service could not be reached, so the post was not stored and nothing was sent. Your text is still on screen. ${err.message}`,
        kind: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const doSaveDraft = () => run('draft', async () => {
    const post = await createPost(payload());
    toast.push({ title: t.compose.drafted, desc: extraMediaNote, kind: 'success' });
    return { kind: 'draft', post };
  });

  const doSchedule = () => run('schedule', async () => {
    const post = await createPost(payload({ scheduledAt, scheduledTz: tz.zone }));
    toast.push({
      title: t.compose.scheduled.replace('{when}', `${scheduleDate} ${scheduleTime} ${tz.zone}`),
      desc: extraMediaNote,
      kind: 'success',
    });
    return { kind: 'schedule', post };
  });

  const doPublish = () => run('publish', async () => {
    const post = await createPost(payload());
    const { post: attempted, plan } = await publishPost(post.id);
    // READ the outcomes; never assume them. `published` here is the count the
    // server actually returned, not the number of channels that were selected.
    const n = attempted.summary.counts.published;
    toast.push({
      title: attempted.summary.label,
      desc: n === 0
        ? 'The attempt was recorded. No channel accepted the post — see the breakdown on screen.'
        : extraMediaNote,
      kind: n === 0 ? 'error' : attempted.summary.outcome === 'mixed' ? 'info' : 'success',
    });
    return { kind: 'publish', post: attempted, plan };
  });

  const retryPublish = async () => {
    if (busy || !result || !result.post) return;
    setBusy('publish');
    try {
      const { post: attempted, plan } = await publishPost(result.post.id);
      setResult({ kind: 'publish', post: attempted, plan });
      toast.push({ title: attempted.summary.label, kind: attempted.summary.counts.published ? 'success' : 'error' });
    } catch (err) {
      toast.push({ title: 'Could not reach the data service', desc: `Nothing changed. ${err.message}`, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* LEFT: Composer (cols 1-7) */}
      <div className="col-span-12 xl:col-span-7 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">{t.compose.title}</h1>
          <p className="text-sm text-saf-muted mt-1">{t.compose.subtitle}</p>
        </div>

        {/* Platform selector */}
        <Card padding="p-5">
          <SectionLabel icon="Share2" label={t.compose.platforms} />
          <div className="flex flex-wrap gap-2 mt-3">
            {POSTABLE.map(id => PLATFORM_BY_ID[id]).map(p => {
              const isOn = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`group h-10 px-3 inline-flex items-center gap-2 rounded-full border transition-all duration-200
                    ${isOn
                      ? 'text-white border-transparent shadow-card hover:brightness-105'
                      : 'bg-white text-saf-text border-saf-border hover:border-saf-primary/40 hover:bg-saf-light/50'
                    }`}
                  style={isOn ? { background: p.gradient || p.color } : {}}
                >
                  <PlatformGlyph id={p.id} size={14} />
                  <span className="text-[13px] font-medium">{p.name}</span>
                  {isOn && (
                    <span className="w-4 h-4 rounded-full bg-white/30 grid place-items-center transition-all animate-fadeScale">
                      <Icon name="Check" size={12} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Content editor */}
        <Card padding="p-5">
          <SectionLabel icon="PenLine" label={t.compose.content} />

          {/* Toolbar */}
          <div className="mt-3 flex items-center gap-1 border border-saf-border rounded-lg p-1 w-fit bg-saf-surface">
            {[
              { ic: 'Bold', t: 'Bold' },
              { ic: 'Italic', t: 'Italic' },
              { ic: 'Link', t: 'Link' },
              { ic: 'Smile', t: 'Emoji' },
              { ic: 'Hash', t: 'Hashtag' },
            ].map(b => (
              <Tooltip key={b.ic} label={b.t} side="bottom">
                <button className="w-8 h-8 rounded-md text-saf-muted hover:text-saf-primary hover:bg-white grid place-items-center transition">
                  <Icon name={b.ic} size={15} />
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.compose.contentPlaceholder}
            className={`w-full mt-3 min-h-[180px] p-4 rounded-xl border border-saf-border bg-white text-saf-text text-[15px] leading-relaxed
              focus:border-saf-primary focus:ring-4 focus:ring-saf-primary/10 transition-all resize-y`}
          />

          {/* Per-platform char bars */}
          {selected.length > 0 && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {selected.map(id => {
                const p = PLATFORM_BY_ID[id];
                const usage = content.length / p.limit;
                const tone = usage >= 0.95 ? 'bg-saf-danger' : usage >= 0.8 ? 'bg-amber-500' : 'bg-saf-primary';
                return (
                  <div key={id} className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full grid place-items-center text-white shrink-0" style={{ background: p.color }}>
                      <PlatformGlyph id={id} size={12} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-saf-muted">{p.name}</span>
                        <span className={usage >= 0.95 ? 'text-saf-danger font-medium' : usage >= 0.8 ? 'text-amber-600' : 'text-saf-muted'}>
                          {content.length.toLocaleString()} / {p.limit.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-saf-light rounded-full overflow-hidden mt-1">
                        <div className={`h-full transition-all duration-500 ${tone}`} style={{ width: `${Math.min(100, usage * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hashtags */}
          <div className="mt-5">
            <SectionLabel icon="Hash" label={t.compose.hashtags} small />
            <div className="mt-2 flex flex-wrap gap-2 items-center p-2 min-h-[44px] border border-saf-border rounded-lg bg-saf-surface focus-within:ring-4 focus-within:ring-saf-primary/10 focus-within:border-saf-primary transition relative">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-white border border-saf-border text-[12px] text-saf-primary font-medium">
                  {tag}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== tag))} className="text-saf-muted hover:text-saf-danger">
                    <Icon name="X" size={12} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onFocus={() => setTagAutocomplete(true)}
                onBlur={() => setTimeout(() => setTagAutocomplete(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === 'Backspace' && !tagInput) setTags(prev => prev.slice(0, -1));
                }}
                placeholder={t.compose.hashtagPh}
                className="flex-1 min-w-[140px] h-7 bg-transparent text-[13px] placeholder:text-saf-muted"
              />
              {tagAutocomplete && (
                <div className="absolute top-full mt-1 ltr:left-0 rtl:right-0 w-full bg-white border border-saf-border rounded-lg shadow-pop p-2 z-10 animate-slideDown">
                  <div className="text-[10px] text-saf-muted uppercase tracking-wider px-1.5 mb-1">{t.compose.trending}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TRENDING_TAGS.filter(x => !tags.includes(x) && (tagInput === '' || x.toLowerCase().includes(tagInput.toLowerCase().replace('#', '')))).map(tag => (
                      <button
                        key={tag}
                        onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                        className="h-7 px-2 rounded-full bg-saf-light text-saf-primary text-[12px] hover:bg-saf-primary hover:text-white transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Media upload */}
        <Card padding="p-5">
          <SectionLabel icon="ImagePlus" label={t.compose.mediaTitle} />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => onDrop({ preventDefault: () => {}, dataTransfer: { files: [] } })}
            className={`mt-3 cursor-pointer border-2 border-dashed rounded-xl p-6 grid place-items-center text-center transition-all
              ${dragOver ? 'border-saf-primary bg-saf-primary/5' : 'border-saf-border bg-saf-surface hover:border-saf-primary/40'}`}
          >
            <div className="w-12 h-12 rounded-full bg-saf-light text-saf-primary grid place-items-center">
              <Icon name="CloudUpload" size={22} />
            </div>
            <div className="mt-2 text-sm font-medium text-saf-text">{t.compose.mediaHint}</div>
            <div className="text-[12px] text-saf-muted mt-1">{t.compose.mediaTypes}</div>
          </div>

          {media.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {media.map(m => (
                <div key={m.id} className="relative group" onClick={() => setLightbox(m)}>
                  {m.kind === 'pdf' ? (
                    <div className="aspect-square rounded-lg bg-rose-50 border border-rose-100 grid place-items-center text-rose-600">
                      <Icon name="FileText" size={28} />
                      <div className="absolute bottom-1 ltr:left-1 rtl:right-1 text-[10px] text-rose-700 font-medium truncate max-w-[80%]">{m.label}</div>
                    </div>
                  ) : (
                    <MockImage tone={m.tone} kind={m.kind} label={m.label} className="aspect-square cursor-pointer" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMedia(prev => prev.filter(x => x.id !== m.id)); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/95 text-saf-danger opacity-0 group-hover:opacity-100 transition shadow-card grid place-items-center"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Schedule */}
        <Card padding="p-5">
          <SectionLabel icon="Clock" label={t.compose.scheduleTitle} />

          <div className="mt-3 inline-flex items-center bg-saf-surface border border-saf-border rounded-full p-0.5">
            <button
              onClick={() => setScheduleMode('now')}
              className={`h-9 px-4 rounded-full text-[13px] font-medium transition ${scheduleMode === 'now' ? 'bg-saf-primary text-white shadow-sm' : 'text-saf-muted hover:text-saf-text'}`}
            >{t.compose.now}</button>
            <button
              onClick={() => setScheduleMode('later')}
              className={`h-9 px-4 rounded-full text-[13px] font-medium transition ${scheduleMode === 'later' ? 'bg-saf-primary text-white shadow-sm' : 'text-saf-muted hover:text-saf-text'}`}
            >{t.compose.later}</button>
          </div>

          {scheduleMode === 'later' && (
            <div className="mt-4 grid sm:grid-cols-3 gap-3 animate-slideDown">
              <Field label="Date" icon="Calendar">
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full bg-transparent text-[13px] text-saf-text" />
              </Field>
              <Field label="Time" icon="Clock">
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-transparent text-[13px] text-saf-text" />
              </Field>
              <Field label={t.compose.timezone} icon="Globe">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-transparent text-[13px] text-saf-text">
                  {COMPOSE_TIMEZONES.map(z => <option key={z.zone}>{z.label}</option>)}
                </select>
              </Field>
            </div>
          )}

          <button className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-saf-primary hover:underline">
            <Icon name="Sparkles" size={14} />
            {t.compose.bestTime}
          </button>
        </Card>

        {/* Action buttons.

            ALL THREE ARE DISABLED, AND THE REASON IS BOTH ON HOVER AND IN THE
            PANEL BESIDE THEM. They used to fire a toast and nothing else:
            "Post published to 2 channels" over a post that went nowhere,
            "Draft saved" over a draft that was never written down. Following
            c0e54f1's ruling for the Settings connect buttons — a control that
            cannot act is disabled and says why, because a greyed button the
            user has to guess about is the same lie in a quieter voice.

            The panel leads with the draft warning rather than the missing
            connection, because that is the one that costs the user something:
            somebody can spend ten minutes writing this post, and the words are
            gone on reload. Everything else on this screen — writing, media,
            tags, the character counts, the previews — still works. */}
        {result && <ComposeResult result={result} onDismiss={() => setResult(null)} onRetry={retryPublish} busy={busy === 'publish'} />}

        <div className="sticky bottom-0 bg-saf-surface/80 backdrop-blur-md py-3 -mx-6 px-6 -mb-6 mt-2 border-t border-saf-border">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" leadingIcon="Save" loading={busy === 'draft'} disabled={!!busy} onClick={doSaveDraft}>
              {t.compose.saveDraft}
            </Button>
            <Button variant="secondary" leadingIcon="CalendarClock" loading={busy === 'schedule'} disabled={!!busy} onClick={doSchedule}>
              {t.compose.schedule}
            </Button>
            <Button variant="primary" loading={busy === 'publish'} disabled={!!busy} onClick={doPublish}>
              <span className="inline-flex items-center gap-2"><Icon name="Send" size={16} />{t.compose.publish}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT: Live preview (cols 8-12) */}
      <aside className="col-span-12 xl:col-span-5 xl:sticky xl:top-20 self-start">
        <Card padding="p-0" className="overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12 border-b border-saf-border">
            <div className="text-[12px] font-medium text-saf-muted uppercase tracking-wider">{t.compose.preview}</div>
            <div className="flex items-center gap-1">
              {selected.map(id => {
                const p = PLATFORM_BY_ID[id];
                const active = id === previewPlatform;
                return (
                  <button
                    key={id}
                    onClick={() => setPreviewPlatform(id)}
                    title={p.name}
                    className={`w-8 h-8 rounded-lg grid place-items-center transition ${active ? 'text-white' : 'text-saf-muted hover:bg-saf-light'}`}
                    style={active ? { background: p.color } : {}}
                  >
                    <PlatformGlyph id={id} size={14} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4 bg-saf-surface">
            {selected.length === 0 ? (
              <div className="p-10 text-center text-saf-muted text-sm">{t.compose.previewEmpty}</div>
            ) : (
              <PlatformPreview
                platform={previewPlatform}
                content={content}
                tags={tags}
                media={media}
              />
            )}
          </div>
        </Card>
      </aside>

      {/* Lightbox */}
      <Modal open={!!lightbox} onClose={() => setLightbox(null)} width={640}>
        {lightbox && lightbox.kind !== 'pdf' && (
          <MockImage tone={lightbox.tone} kind={lightbox.kind} label={lightbox.label} className="w-full aspect-video" />
        )}
        <div className="mt-3 text-sm text-saf-text font-medium">{lightbox?.label}</div>
      </Modal>
    </div>
  );
}

// ----- bits -----

function SectionLabel({ icon, label, small }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid place-items-center rounded-md bg-saf-light text-saf-primary ${small ? 'w-6 h-6' : 'w-7 h-7'}`}>
        <Icon name={icon} size={small ? 13 : 15} />
      </span>
      <span className={`font-medium text-saf-text ${small ? 'text-[13px]' : 'text-[15px]'}`}>{label}</span>
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <label className="flex flex-col gap-1 px-3 py-2 border border-saf-border rounded-lg bg-white focus-within:border-saf-primary focus-within:ring-4 focus-within:ring-saf-primary/10 transition">
      <span className="text-[10px] text-saf-muted uppercase tracking-wider flex items-center gap-1">
        <Icon name={icon} size={12} />{label}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Per-channel preview cards.
//
// These are deliberately not two variations on one card. A guest reads a
// Google post inside a business listing — next to the rating, the hours and
// a Book button — and an Instagram post inside a feed. The same 200
// characters land completely differently in each, and the composer shows that.
function PlatformPreview({ platform, content, tags, media, dir }) {
  const fullContent = (content ? content.trim() : '') + (tags.length ? '\n\n' + tags.join(' ') : '');
  const props = { content: fullContent, media, dir };
  switch (platform) {
    case 'ig': return <PreviewInstagram {...props} />;
    case 'gg': return <PreviewGoogle    {...props} />;
    default: return null;
  }
}

function BrandHeader({ subtitle, size = 36 }) {
  return (
    <div className="flex items-center gap-2.5">
      <SafLogoMark size={size} />
      <div>
        <div className="text-[13px] font-semibold text-saf-text">Saffron House</div>
        <div className="text-[10px] text-saf-muted">{subtitle}</div>
      </div>
    </div>
  );
}

function PreviewInstagram({ content, media, dir }) {
  return (
    <div className="bg-white rounded-xl border border-saf-border overflow-hidden">
      <div className="p-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)' }}>
          <div className="w-full h-full rounded-full bg-white grid place-items-center"><SafLogoMark size={26} /></div>
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-saf-text">saffronhouse</div>
          <div className="text-[10px] text-saf-muted">Sector 10 Market, Dwarka</div>
        </div>
        <Icon name="MoreHorizontal" size={18} className="text-saf-muted" />
      </div>
      {media[0] && media[0].kind !== 'pdf' ? (
        <MockImage tone={media[0].tone} kind={media[0].kind} label={media[0].label} className="aspect-square" />
      ) : (
        <MockImage tone="night" label="Add a photo or reel" className="aspect-square" />
      )}
      <div className="p-3 flex items-center gap-4 text-saf-text">
        <Icon name="Heart" size={20} />
        <Icon name="MessageCircle" size={20} />
        <Icon name="Send" size={20} />
        <Icon name="Bookmark" size={20} className="ml-auto" />
      </div>
      <div dir={dir} className="px-3 pb-3 text-[13px] text-saf-text whitespace-pre-wrap">
        <span className="font-semibold">saffronhouse </span>{content || '...'}
      </div>
    </div>
  );
}

// Google Business Profile posts appear beside the listing, under the rating
// and the Book/Directions buttons — which is why those are in the preview.
// A post that ignores that context reads as a stray social caption.
function PreviewGoogle({ content, media, dir }) {
  return (
    <div className="bg-white rounded-xl border border-saf-border overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <BrandHeader subtitle="Restaurant · Sector 10 Dwarka" />
        <Icon name="MoreHorizontal" size={18} className="text-saf-muted" />
      </div>
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[12px]">
        <StarRow value={4.3} size={13} />
        <span className="font-semibold text-saf-text">4.3</span>
        <span className="text-saf-muted">(1,284)</span>
        <span className="text-saf-muted">· ₹₹₹</span>
      </div>
      {media[0] && media[0].kind !== 'pdf' && <MockImage tone={media[0].tone} kind={media[0].kind} label={media[0].label} className="aspect-[1.91/1]" />}
      <div dir={dir} className="px-3 py-3 text-[14px] text-saf-text whitespace-pre-wrap">{content || '...'}</div>
      <div className="px-3 py-2 border-t border-saf-border flex items-center gap-2">
        <span className="px-3 h-8 grid place-items-center rounded-full border border-saf-border text-[12px] font-medium text-saf-primary">Book a table</span>
        <span className="px-3 h-8 grid place-items-center rounded-full border border-saf-border text-[12px] font-medium text-saf-primary">Directions</span>
      </div>
    </div>
  );
}

Object.assign(window, { ComposePage });
