// Social Listening — Signals screen.
// The one ACTION surface in Listening (Overview, Trends, Competitors are
// informational; Signals carries dismiss / assign / note / tag / export).
//
// File hosts everything that's Signals-specific: the screen + filter bar +
// the two card variants + three modals (Assign / Note / Tag) + the CSV
// export helpers + the shared useModalFocusCheck telemetry hook.

// ---------------------------------------------------------------------------
// Severity treatment. Don't rely on color alone — every chip also carries
// an icon + label so colorblind users + screen readers get the same
// information.
const SEVERITY_META = {
  info:     { icon: 'Info',          chip: 'bg-saf-light text-saf-primary border-saf-light',
              rail: 'bg-saf-primary',  label: 'Info' },
  warn:     { icon: 'AlertTriangle', chip: 'bg-amber-50 text-amber-700 border-amber-200',
              rail: 'bg-amber-500',    label: 'Warning' },
  critical: { icon: 'AlertOctagon',  chip: 'bg-rose-50 text-rose-700 border-rose-200',
              rail: 'bg-rose-500',     label: 'Critical' },
};

const KIND_LABEL = {
  volume_spike:    'Volume spike',
  competitor_move: 'Competitor move',
  crisis_cluster:  'Crisis cluster',
  mention_burst:   'Mention burst',
  sentiment_shift: 'Sentiment shift',
};

// ---------------------------------------------------------------------------
// CSV export helpers

// Column order is fixed by spec so appending per-signal exports to a view-
// level export downstream doesn't column-mismatch.
const EXPORT_COLUMNS = [
  'id', 'createdAt', 'channel', 'kind', 'severity', 'title', 'body',
  'mentions', 'reach', 'sentiment', 'changePct', 'state', 'assignedTo',
  'tags', 'notes_count',
];

// state column derives from the persisted state shape rather than the
// signal itself: dismissed wins, then assigned, then read, else unread.
function deriveSignalState(signal, state) {
  if (state.dismissed.includes(signal.id))      return 'dismissed';
  if (state.assignments[signal.id])             return 'assigned';
  if (state.read.includes(signal.id))           return 'read';
  return 'unread';
}

function buildSignalRow(signal, state) {
  return [
    signal.id,
    signal.createdAtISO,
    signal.channel,
    signal.kind,
    signal.severity,
    signal.title,
    signal.body,
    String(signal.metrics.mentions),
    String(signal.metrics.reach),
    String(signal.metrics.sentiment),
    String(signal.metrics.changePct),
    deriveSignalState(signal, state),
    state.assignments[signal.id] || '',
    (state.tags[signal.id] || []).join(';'),
    String((state.notes[signal.id] || []).length),
  ];
}

// Filter-summary slug for the view-level export filename. Order: status,
// channel (omitted on 'all'), kind (omitted on 'all'). Underscores in
// kind ids become dashes ('volume_spike' → 'volume-spike') so the slug
// reads as a single dash-separated token.
//
// STATUS_SLUG_MAP isolates the internal-state-value -> filename-token
// remap for status pills whose internal name doesn't read well as a
// filename. If someone renames 'assigned-me' in the filter pill code
// without grepping the slug builder, the slug just falls through to the
// raw value instead of silently producing the wrong filename.
const STATUS_SLUG_MAP = {
  'assigned-me': 'assigned-to-me',
};

function filterSummarySlug(tabFilter, channelFilter, kindFilter) {
  const parts = [];
  parts.push(STATUS_SLUG_MAP[tabFilter] || tabFilter);
  if (channelFilter !== 'all') parts.push(channelFilter);
  if (kindFilter !== 'all')    parts.push(kindFilter.replace(/_/g, '-'));
  return parts.filter(Boolean).join('-');
}

function todayDateSlug() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Signals screen — the one action surface

function SignalsScreen({ state, update, me, theme, focusedSignalId, onClearFocus }) {
  const t = useT();
  const toast = useToast();
  const [tabFilter, setTabFilter] = React.useState('all');
  const [channelFilter, setChannelFilter] = React.useState('all');
  const [kindFilter, setKindFilter] = React.useState('all');
  const [assigning, setAssigning] = React.useState(null);
  const [noting, setNoting] = React.useState(null);
  const [tagging, setTagging] = React.useState(null);

  const filtered = React.useMemo(() => {
    return LISTENING_SIGNALS.filter(s => {
      const isDismissed = state.dismissed.includes(s.id);
      if (tabFilter === 'dismissed') {
        if (!isDismissed) return false;
      } else if (isDismissed) {
        return false;
      }
      if (tabFilter === 'unread' && state.read.includes(s.id)) return false;
      if (tabFilter === 'critical' && s.severity !== 'critical') return false;
      if (tabFilter === 'assigned-me' && state.assignments[s.id] !== me) return false;
      if (channelFilter !== 'all' && s.channel !== channelFilter) return false;
      if (kindFilter !== 'all' && s.kind !== kindFilter) return false;
      return true;
    });
  }, [state, tabFilter, channelFilter, kindFilter, me]);

  const dismiss = (id) =>
    update(prev => ({ ...prev, dismissed: Array.from(new Set([...prev.dismissed, id])) }));
  const undismiss = (id) =>
    update(prev => ({ ...prev, dismissed: prev.dismissed.filter(x => x !== id) }));
  const assign = (id, userId) =>
    update(prev => ({ ...prev, assignments: { ...prev.assignments, [id]: userId } }));

  // Notes are append-only. Tags are dedupe'd + lowercased on save; removing
  // a tag is a single-click on the chip X (no confirmation — reversible
  // single-click cost). Both shapes already declared in LISTENING_DEFAULT.
  const addNote = (id, body) => {
    const entry = { author: me, body, ts: new Date().toISOString() };
    update(prev => ({
      ...prev,
      notes: { ...prev.notes, [id]: [...(prev.notes[id] || []), entry] },
    }));
  };
  const addTag = (id, raw) => {
    const tag = (raw || '').trim().toLowerCase();
    if (!tag) return false;
    const existing = state.tags[id] || [];
    if (existing.includes(tag)) return false;
    update(prev => ({
      ...prev,
      tags: { ...prev.tags, [id]: [...(prev.tags[id] || []), tag] },
    }));
    return true;
  };
  const removeTag = (id, tag) => {
    update(prev => ({
      ...prev,
      tags: { ...prev.tags, [id]: (prev.tags[id] || []).filter(x => x !== tag) },
    }));
  };

  // All tags across all signals, deduped, for suggestion chips.
  const allTags = React.useMemo(() => {
    const set = new Set();
    Object.values(state.tags || {}).forEach(list => (list || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [state.tags]);

  // Exports — pure browser, no modal. Per-signal: one-row CSV. View-level:
  // every signal matching the current filter set. Toasts after download.
  const exportSingle = (signal) => {
    const csv = buildCsv([EXPORT_COLUMNS, buildSignalRow(signal, state)]);
    downloadCsv(`signal-${signal.id}-${todayDateSlug()}.csv`, csv);
    toast.push({ title: t.listening.signalExported, kind: 'ok' });
  };
  const exportFiltered = () => {
    if (filtered.length === 0) return;
    const csv = buildCsv([
      EXPORT_COLUMNS,
      ...filtered.map(s => buildSignalRow(s, state)),
    ]);
    const slug = filterSummarySlug(tabFilter, channelFilter, kindFilter);
    downloadCsv(`signals-${slug}-${todayDateSlug()}.csv`, csv);
    toast.push({
      title: t.listening.signalsExported.replace('{count}', String(filtered.length)),
      kind: 'ok',
    });
  };

  // When the Overview screen routes here with a specific signal in focus,
  // scroll that card into view + apply a 2-second spotlight ring so the
  // user knows where they landed. Clear the parent's focusedSignalId
  // immediately so a subsequent tab-switch back-and-forth doesn't re-fire.
  const listRef = React.useRef(null);
  React.useEffect(() => {
    if (!focusedSignalId) return;
    const el = listRef.current?.querySelector(`[data-signal-id="${focusedSignalId}"]`);
    if (!el) { onClearFocus?.(); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('animate-spotlight');
    const t = setTimeout(() => el.classList.remove('animate-spotlight'), 2200);
    onClearFocus?.();
    return () => clearTimeout(t);
  }, [focusedSignalId]);

  // Keyboard nav inside the feed:
  //   ArrowDown / ArrowUp — move focus between cards
  //   Home / End          — jump to first / last card
  // If focus is on an inner action button (Assign, Dismiss, assignee
  // avatar), we still want arrows to navigate cards — find the nearest
  // [data-signal-card] ancestor and step from there. Tab is left alone so
  // it still moves into the focused card's action row naturally.
  const onFeedKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const els = Array.from(listRef.current?.querySelectorAll('[data-signal-card]') || []);
    if (els.length === 0) return;
    const active = document.activeElement;
    let idx = els.indexOf(active);
    if (idx < 0) {
      const containing = active?.closest?.('[data-signal-card]');
      idx = containing ? els.indexOf(containing) : -1;
    }
    let target;
    if (e.key === 'Home') target = els[0];
    else if (e.key === 'End') target = els[els.length - 1];
    else if (idx < 0) target = els[0];
    else if (e.key === 'ArrowDown') target = els[Math.min(idx + 1, els.length - 1)];
    else target = els[Math.max(idx - 1, 0)];
    if (target) { e.preventDefault(); target.focus(); }
  };

  return (
    <div id="listening-signals" role="tabpanel" className="space-y-4">
      <SignalsFilterBar
        tabFilter={tabFilter} setTabFilter={setTabFilter}
        channelFilter={channelFilter} setChannelFilter={setChannelFilter}
        kindFilter={kindFilter} setKindFilter={setKindFilter}
        theme={theme}
        onExportView={exportFiltered}
        canExportView={filtered.length > 0}
      />

      {filtered.length === 0 ? (
        <Card>
          <div className="py-16 text-center text-[13px] text-saf-muted">
            No signals match the current view.
          </div>
        </Card>
      ) : (
        <div
          ref={listRef}
          onKeyDown={onFeedKeyDown}
          role="list"
          aria-label="Signals feed"
          className="space-y-3"
        >
          {filtered.map(s => (
            <SignalCard
              key={s.id}
              signal={s}
              theme={theme}
              isDismissed={state.dismissed.includes(s.id)}
              assignedTo={state.assignments[s.id]}
              notes={state.notes[s.id] || []}
              tags={state.tags[s.id] || []}
              onDismiss={() => dismiss(s.id)}
              onUndismiss={() => undismiss(s.id)}
              onAssign={() => setAssigning(s)}
              onNote={() => setNoting(s)}
              onTag={() => setTagging(s)}
              onRemoveTag={(tag) => removeTag(s.id, tag)}
              onExport={() => exportSingle(s)}
            />
          ))}
        </div>
      )}

      <AssignModal
        signal={assigning}
        currentAssignee={assigning ? state.assignments[assigning.id] : null}
        onClose={() => setAssigning(null)}
        onPick={(userId) => { assign(assigning.id, userId); setAssigning(null); }}
      />

      <NoteModal
        signal={noting}
        notes={noting ? (state.notes[noting.id] || []) : []}
        onClose={() => setNoting(null)}
        onSave={(body) => {
          addNote(noting.id, body);
          toast.push({ title: t.listening.noteSaved, kind: 'ok' });
        }}
      />

      <TagModal
        signal={tagging}
        currentTags={tagging ? (state.tags[tagging.id] || []) : []}
        suggestions={allTags}
        onClose={() => setTagging(null)}
        onAdd={(raw) => {
          const ok = addTag(tagging.id, raw);
          if (ok) toast.push({ title: t.listening.tagSaved, kind: 'ok' });
          return ok;
        }}
        onRemove={(tag) => removeTag(tagging.id, tag)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar

function SignalsFilterBar({ tabFilter, setTabFilter, channelFilter, setChannelFilter, kindFilter, setKindFilter, theme, onExportView, canExportView }) {
  const t = useT();
  const tabs = [
    { id: 'all',          label: 'All' },
    { id: 'unread',       label: 'Unread' },
    { id: 'critical',     label: 'Critical' },
    { id: 'assigned-me',  label: 'Assigned to me' },
    { id: 'dismissed',    label: 'Dismissed' },
  ];
  return (
    <Card padding="p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter by status" className="flex items-center gap-1 flex-wrap">
          {tabs.map(t => {
            const isActive = tabFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabFilter(t.id)}
                aria-pressed={isActive}
                className={`h-7 px-3 rounded-full text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 ${isActive ? 'bg-saf-primary text-white' : 'bg-saf-surface text-saf-muted hover:text-saf-text border border-saf-border'}`}
              >{t.label}</button>
            );
          })}
        </div>
        <div className="h-5 w-px bg-saf-border" aria-hidden="true" />
        <div role="group" aria-label="Filter by channel" className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setChannelFilter('all')}
            aria-pressed={channelFilter === 'all'}
            className={`h-7 px-3 rounded-full text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 ${channelFilter === 'all' ? 'bg-saf-primary text-white' : 'bg-saf-surface text-saf-muted hover:text-saf-text border border-saf-border'}`}
          >All channels</button>
          {PLATFORMS.map(p => {
            const isActive = channelFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setChannelFilter(p.id)}
                aria-label={`Filter by ${p.name}`}
                aria-pressed={isActive}
                className={`h-7 w-7 grid place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 ${isActive ? 'ring-2 ring-saf-primary ring-offset-2 ring-offset-saf-card' : 'hover:opacity-80'}`}
                style={{ background: platformColor(p, theme), color: '#fff' }}
                title={p.name}
              >
                <PlatformGlyph id={p.id} size={12} />
              </button>
            );
          })}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[12px] text-saf-muted">
            <span className="sr-only">Filter by kind</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label="Filter by signal kind"
              className="h-8 px-2 rounded-lg border border-saf-border bg-white text-[13px] text-saf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent"
            >
              <option value="all">All kinds</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          {canExportView ? (
            <Button
              size="sm"
              variant="secondary"
              leadingIcon="Download"
              onClick={onExportView}
              aria-label={t.listening.exportView}
            >{t.listening.exportView}</Button>
          ) : (
            <Tooltip label={t.listening.exportViewEmptyTooltip} side="top">
              <Button
                size="sm"
                variant="secondary"
                leadingIcon="Download"
                disabled
                aria-label={`${t.listening.exportView} — ${t.listening.exportViewEmptyTooltip}`}
              >{t.listening.exportView}</Button>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Signal card — standard + crisis-cluster variants

function SignalCard({ signal, theme, isDismissed, assignedTo, notes, tags, onDismiss, onUndismiss, onAssign, onNote, onTag, onRemoveTag, onExport }) {
  if (signal.kind === 'crisis_cluster') {
    return (
      <CrisisClusterCard
        signal={signal}
        theme={theme}
        isDismissed={isDismissed}
        assignedTo={assignedTo}
        notes={notes}
        tags={tags}
        onDismiss={onDismiss}
        onUndismiss={onUndismiss}
        onAssign={onAssign}
        onNote={onNote}
        onTag={onTag}
        onRemoveTag={onRemoveTag}
        onExport={onExport}
      />
    );
  }
  const t = useT();
  const sev = SEVERITY_META[signal.severity];
  const p = PLATFORM_BY_ID[signal.channel];
  const assignee = assignedTo ? PROFILE_BY_ID[assignedTo] : null;
  const changeUp = signal.metrics.changePct >= 0;
  const noteCount = notes?.length || 0;
  const latestNote = noteCount > 0 ? notes[noteCount - 1] : null;
  return (
    <div
      role="listitem"
      tabIndex={0}
      data-signal-card
      data-signal-id={signal.id}
      aria-label={`${sev.label} signal: ${signal.title}`}
      className="bg-white border border-saf-border rounded-2xl shadow-card transition-shadow focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-saf-surface focus-visible:shadow-pop"
    >
      <div className="flex">
        <div aria-hidden="true" className={`w-1.5 rounded-s-2xl ${sev.rail}`} />
        <div className="flex-1 p-4">
          <div className="flex items-start gap-3">
            <span
              className="w-9 h-9 rounded-full grid place-items-center text-white shrink-0"
              style={{ background: platformColor(p, theme) }}
              aria-label={p.name}
            >
              <PlatformGlyph id={signal.channel} size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 h-5 text-[10px] font-medium uppercase tracking-wider rounded-full border ${sev.chip}`}>
                  <Icon name={sev.icon} size={10} />
                  <span>{sev.label}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-medium text-saf-muted">{KIND_LABEL[signal.kind]}</span>
                <span className="text-[11px] text-saf-muted">· {signal.t}</span>
              </div>
              <div className="text-[14px] font-medium text-saf-text mb-0.5">{signal.title}</div>
              <div className="text-[13px] text-saf-muted">{signal.body}</div>
              <div className="mt-2 flex items-center gap-4 flex-wrap text-[12px] text-saf-muted">
                <span><strong className="text-saf-text font-medium">{fmtCompact(signal.metrics.mentions)}</strong> mentions</span>
                <span className={changeUp ? 'text-emerald-700' : 'text-rose-700'}>
                  {changeUp ? '+' : ''}{signal.metrics.changePct}%
                </span>
                <span>Reach <strong className="text-saf-text font-medium">{fmtCompact(signal.metrics.reach)}</strong></span>
                <span>Sentiment <strong className="text-saf-text font-medium">{signal.metrics.sentiment >= 0 ? '+' : ''}{signal.metrics.sentiment.toFixed(2)}</strong></span>
              </div>
              <SignalChipRow
                noteCount={noteCount}
                latestNote={latestNote}
                tags={tags}
                onNoteChip={onNote}
                onRemoveTag={onRemoveTag}
                t={t}
              />
            </div>
            <div className="flex flex-col gap-1.5 items-end shrink-0">
              {assignee && !isDismissed && (
                <button
                  onClick={onAssign}
                  className="flex items-center gap-1.5 text-[11px] text-saf-muted hover:text-saf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded"
                  aria-label={`Assigned to ${assignee.name}, click to reassign`}
                >
                  <Avatar name={assignee.name} size={20} />
                  <span className="hidden md:inline">{assignee.short}</span>
                </button>
              )}
              <SignalActions
                isDismissed={isDismissed}
                hasAssignee={!!assignee}
                onAssign={onAssign}
                onDismiss={onDismiss}
                onUndismiss={onUndismiss}
                onNote={onNote}
                onTag={onTag}
                onExport={onExport}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared action-button row. Five actions on a non-dismissed card; the
// row gets crowded if all five carry labels, so secondary actions
// (Note / Tag / Export) demote to icon-only with a hover Tooltip and an
// aria-label. Assign + Dismiss stay labeled — they're the most-clicked
// and the row's hierarchy improves when those two carry the visual
// weight. On the dismissed branch, only Restore is shown.
function IconActionButton({ icon, label, onClick, tone = 'default' }) {
  const toneCls = tone === 'rose'
    ? 'text-rose-700 hover:bg-rose-100'
    : 'text-saf-muted hover:text-saf-text hover:bg-saf-light';
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`w-8 h-8 grid place-items-center rounded-lg transition ${toneCls} focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
      >
        <Icon name={icon} size={15} />
      </button>
    </Tooltip>
  );
}

function SignalActions({ isDismissed, hasAssignee, onAssign, onDismiss, onUndismiss, onNote, onTag, onExport, t, primaryAssign, iconTone }) {
  if (isDismissed) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" leadingIcon="Undo2" onClick={onUndismiss} aria-label="Restore signal">Restore</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap justify-end">
      <Button
        size="sm"
        variant={primaryAssign ? 'primary' : 'ghost'}
        leadingIcon="UserPlus"
        onClick={onAssign}
        aria-label={hasAssignee ? 'Reassign signal' : 'Assign signal'}
      >{hasAssignee ? 'Reassign' : 'Assign'}</Button>
      <IconActionButton icon="StickyNote" label={t.listening.note}          onClick={onNote}   tone={iconTone} />
      <IconActionButton icon="Tag"        label={t.listening.tag}           onClick={onTag}    tone={iconTone} />
      <IconActionButton icon="Download"   label={t.listening.exportTooltip} onClick={onExport} tone={iconTone} />
      <Button
        size="sm"
        variant="ghost"
        leadingIcon="X"
        onClick={onDismiss}
        aria-label="Dismiss signal"
      >Dismiss</Button>
    </div>
  );
}

// Render strip — note count chip + tag chips. Only renders when there's
// something to show; nothing below the metrics row otherwise.
function SignalChipRow({ noteCount, latestNote, tags, onNoteChip, onRemoveTag, t }) {
  if (noteCount === 0 && (!tags || tags.length === 0)) return null;
  const latestPreview = latestNote
    ? `${PROFILE_BY_ID[latestNote.author]?.short || 'Someone'}: ${latestNote.body.slice(0, 80)}${latestNote.body.length > 80 ? '…' : ''}`
    : '';
  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      {noteCount > 0 && (
        <Tooltip label={latestPreview} side="top">
          <button
            onClick={onNoteChip}
            aria-label={`${t.listening.noteCountLabel} (${noteCount})`}
            className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-medium rounded-full bg-saf-surface text-saf-text border border-saf-border hover:bg-saf-light hover:text-saf-primary focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Icon name="StickyNote" size={12} />
            <span>{noteCount}</span>
          </button>
        </Tooltip>
      )}
      {(tags || []).map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 ps-2 pe-1 h-6 text-[11px] font-medium rounded-full bg-saf-light text-saf-primary border border-saf-border"
        >
          <span>#{tag}</span>
          <button
            onClick={() => onRemoveTag(tag)}
            aria-label={`${t.listening.tagRemove}: ${tag}`}
            className="w-4 h-4 grid place-items-center rounded-full hover:bg-saf-primary hover:text-white focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary"
          >
            <Icon name="X" size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

function CrisisClusterCard({ signal, theme, isDismissed, assignedTo, notes, tags, onDismiss, onUndismiss, onAssign, onNote, onTag, onRemoveTag, onExport }) {
  const t = useT();
  const assignee = assignedTo ? PROFILE_BY_ID[assignedTo] : null;
  const noteCount = notes?.length || 0;
  const latestNote = noteCount > 0 ? notes[noteCount - 1] : null;
  return (
    <div
      role="listitem"
      tabIndex={0}
      data-signal-card
      data-signal-id={signal.id}
      aria-label={`Critical crisis cluster: ${signal.title}`}
      className="rounded-2xl border-2 border-rose-200 dark:border-rose-300/40 ring-1 ring-rose-200/60 shadow-card focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-saf-surface focus-visible:shadow-pop overflow-hidden bg-white"
    >
      <div className="flex">
        <div aria-hidden="true" className="w-2 bg-rose-500" />
        <div className="flex-1 p-4 bg-rose-50/60 dark:bg-[#330003]">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="relative w-10 h-10 rounded-full grid place-items-center bg-rose-500 text-white shrink-0 animate-pulseRingSubtle"
            >
              <Icon name="AlertOctagon" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 h-5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-rose-500 text-white">
                  <Icon name="AlertOctagon" size={10} />
                  <span>Crisis cluster</span>
                </span>
                <span className="text-[11px] text-rose-700">
                  {signal.children?.length || 0} related incidents · {signal.t}
                </span>
              </div>
              <div className="text-[15px] font-semibold text-rose-700 mb-1">{signal.title}</div>
              <div className="text-[13px] text-saf-text mb-2">{signal.body}</div>
              {signal.children && signal.children.length > 0 && (
                <ul className="space-y-1.5 mb-3 pl-0">
                  {signal.children.map((c, i) => {
                    const p = PLATFORM_BY_ID[c.channel];
                    return (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-saf-text">
                        <span
                          className="w-5 h-5 rounded-full grid place-items-center text-white shrink-0 mt-px"
                          style={{ background: platformColor(p, theme) }}
                          aria-label={p.name}
                        >
                          <PlatformGlyph id={c.channel} size={10} />
                        </span>
                        <span className="flex-1">{c.text}</span>
                        <span className="text-saf-muted shrink-0">{c.t}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center gap-4 flex-wrap text-[12px] text-rose-700 font-medium">
                <span>{fmtCompact(signal.metrics.mentions)} mentions</span>
                <span>+{signal.metrics.changePct}%</span>
                <span>Reach {fmtCompact(signal.metrics.reach)}</span>
                <span>Sentiment {signal.metrics.sentiment.toFixed(2)}</span>
              </div>
              <SignalChipRow
                noteCount={noteCount}
                latestNote={latestNote}
                tags={tags}
                onNoteChip={onNote}
                onRemoveTag={onRemoveTag}
                t={t}
              />
            </div>
            <div className="flex flex-col gap-1.5 items-end shrink-0">
              {assignee && !isDismissed && (
                <button
                  onClick={onAssign}
                  className="flex items-center gap-1.5 text-[11px] text-rose-700 hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded"
                  aria-label={`Assigned to ${assignee.name}, click to reassign`}
                >
                  <Avatar name={assignee.name} size={20} />
                  <span className="hidden md:inline">{assignee.short}</span>
                </button>
              )}
              <SignalActions
                isDismissed={isDismissed}
                hasAssignee={!!assignee}
                onAssign={onAssign}
                onDismiss={onDismiss}
                onUndismiss={onUndismiss}
                onNote={onNote}
                onTag={onTag}
                onExport={onExport}
                t={t}
                primaryAssign
                iconTone="rose"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign modal — pick a teammate. Single-assignee per signal; reassigning
// replaces. No confirmation prompt: assignment is reversible.

function AssignModal({ signal, currentAssignee, onClose, onPick }) {
  // Self-check: primary control is one of the teammate <button>s. The
  // helper logs OK if any BUTTON is in the focusables (which is always
  // true here unless the trap query regresses), or an error with the
  // focusables array if not.
  useModalFocusCheck(signal?.id || null, '[AssignModal]', { expectedCount: ROLES.length + 2 });

  return (
    <Modal
      open={!!signal}
      onClose={onClose}
      title={signal ? `Assign · ${signal.title}` : ''}
    >
      {signal ? (
        <div className="space-y-3">
          <p className="text-[13px] text-saf-muted">Pick a teammate to take this signal.</p>
          <ul className="space-y-1" role="list" aria-label="Teammates">
            {ROLES.map(r => PROFILES[r]).map(p => {
              const isCurrent = currentAssignee === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id)}
                    aria-label={isCurrent ? `Already assigned to ${p.name}` : `Assign to ${p.name}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-start transition border focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isCurrent ? 'border-saf-primary bg-saf-light' : 'border-transparent hover:bg-saf-surface'}`}
                  >
                    <Avatar name={p.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-saf-text">{p.name}</div>
                      <div className="text-[11px] text-saf-muted">{p.role}</div>
                    </div>
                    {isCurrent && <Icon name="Check" size={16} className="text-saf-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end pt-1">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Self-check telemetry (shared by Assign / Note / Tag modals). Runs ~50ms
// after the modal opens; prints OK or an error with the focusables array.
// Two assertion modes:
//   - { expectedCount: N }   — used by Assign (fixed teammate count + X + Cancel)
//   - { primaryTagNames: [] } — used by Note/Tag (primary input must be in the trap)
// Catches future modal-shape regressions early without per-modal duplication.
function useModalFocusCheck(open, prefix, { expectedCount, primaryTagNames } = {}) {
  const ranRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) { ranRef.current = null; return; }
    if (ranRef.current === open) return;
    const t = setTimeout(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      const summary = focusables.map(el => ({ tag: el.tagName, label: el.getAttribute('aria-label') }));
      let ok = true;
      let detail = '';
      if (typeof expectedCount === 'number') {
        ok = focusables.length >= expectedCount;
        detail = `(expected ${expectedCount}, got ${focusables.length})`;
      } else if (primaryTagNames && primaryTagNames.length) {
        ok = focusables.some(el => primaryTagNames.includes(el.tagName));
        detail = `(needs ${primaryTagNames.join('/')}, got ${focusables.length} focusables)`;
      }
      if (!ok) {
        // eslint-disable-next-line no-console
        console.error(`${prefix} focus-trap regression ${detail}`, summary);
      } else {
        // eslint-disable-next-line no-console
        console.log(`${prefix} focus-trap OK ${detail}.`);
      }
      ranRef.current = open;
    }, 50);
    return () => clearTimeout(t);
  }, [open, prefix]);
}

// ---------------------------------------------------------------------------
// Note modal — single textarea, Save appends. If the signal already has
// notes, lists them above the textarea (read-only history; append-only
// MVP). One modal serves both the "add a new note" action button click
// and the count-chip-on-card click; the difference is whether prior notes
// exist, not which modal opens.

function NoteModal({ signal, notes, onClose, onSave }) {
  const t = useT();
  const { profile } = React.useContext(AppCtx);
  const [body, setBody] = React.useState('');
  const inputRef = React.useRef(null);

  // Reset draft each time we open on a different signal.
  React.useEffect(() => { if (signal) setBody(''); }, [signal?.id]);

  // Focus the textarea on open, *after* the Modal's auto-focus-on-first-
  // focusable has run (it would otherwise land on X close). React effect
  // ordering plus a setTimeout(0) puts this strictly after.
  React.useEffect(() => {
    if (!signal) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [signal?.id]);

  useModalFocusCheck(signal?.id || null, '[NoteModal]', { primaryTagNames: ['TEXTAREA'] });

  const canSave = body.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave(body.trim());
    setBody('');
    onClose();
  };

  return (
    <Modal
      open={!!signal}
      onClose={onClose}
      title={signal ? `${t.listening.noteHistoryTitle} · ${signal.title}` : ''}
    >
      {signal ? (
        <div className="space-y-3">
          {(notes && notes.length > 0) ? (
            <ul className="space-y-2 max-h-48 overflow-auto nice-scroll pe-1" aria-label={t.listening.noteHistoryTitle}>
              {notes.map((n, i) => {
                const author = PROFILE_BY_ID[n.author] || { name: 'Unknown', short: '?' };
                return (
                  <li key={i} className="p-2.5 rounded-lg bg-saf-surface border border-saf-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar name={author.name} size={20} />
                      <span className="text-[12px] font-medium text-saf-text">{author.name}</span>
                      <span className="text-[11px] text-saf-muted ms-auto">{relTime(n.ts)}</span>
                    </div>
                    <div className="text-[13px] text-saf-text whitespace-pre-wrap">{n.body}</div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={t.listening.noteAddPlaceholder}
            className="w-full rounded-lg border border-saf-border bg-white px-3 py-2 text-[13px] text-saf-text placeholder:text-saf-muted focus:border-saf-primary focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label={t.listening.noteAddPlaceholder}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>{t.common.save}</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tag modal — input + suggestion chips. Saving lowercases + trims +
// dedupes silently. Removing is single-click on a chip X (no
// confirmation — reversible single-click cost).

function TagModal({ signal, currentTags, suggestions, onClose, onAdd, onRemove }) {
  const t = useT();
  const [draft, setDraft] = React.useState('');
  const [hint, setHint] = React.useState('');
  const inputRef = React.useRef(null);
  const hintTimerRef = React.useRef(null);

  React.useEffect(() => { if (signal) { setDraft(''); setHint(''); } }, [signal?.id]);

  React.useEffect(() => {
    if (!signal) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [signal?.id]);

  // Clear any pending hint timer when the modal closes / unmounts.
  React.useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  useModalFocusCheck(signal?.id || null, '[TagModal]', { primaryTagNames: ['INPUT'] });

  // Show a transient inline hint below the input. Replaces any existing
  // hint (don't queue) and auto-dismisses after 2s. Spec: silent on data
  // (no toast), visible enough on the input that users get feedback.
  const showHint = (text) => {
    setHint(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(''), 2000);
  };
  const clearHint = () => {
    setHint('');
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
  };

  const handleSubmit = (raw) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) { showHint(t.listening.tagHintEmpty); return; }
    const lower = trimmed.toLowerCase();
    // currentTags are already stored lowercase by addTag; case-insensitive
    // compare anyway as belt-and-braces.
    if (currentTags.some(x => x.toLowerCase() === lower)) {
      showHint(t.listening.tagHintDupe);
      return;
    }
    const ok = onAdd(raw);
    if (ok) { setDraft(''); clearHint(); }
  };

  // Suggestions: existing tags across all signals that aren't already on
  // this signal, filtered to the draft text if any.
  const filteredSuggestions = React.useMemo(() => {
    const lower = (draft || '').trim().toLowerCase();
    return (suggestions || [])
      .filter(s => !currentTags.includes(s))
      .filter(s => !lower || s.includes(lower))
      .slice(0, 12);
  }, [suggestions, currentTags, draft]);

  return (
    <Modal
      open={!!signal}
      onClose={onClose}
      title={signal ? `${t.listening.tag} · ${signal.title}` : ''}
    >
      {signal ? (
        <div className="space-y-3">
          {currentTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap" aria-label="Current tags">
              {currentTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 ps-2 pe-1 h-7 text-[12px] font-medium rounded-full bg-saf-light text-saf-primary border border-saf-border"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => onRemove(tag)}
                    aria-label={`${t.listening.tagRemove}: ${tag}`}
                    className="w-5 h-5 grid place-items-center rounded-full hover:bg-saf-primary hover:text-white focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary"
                  >
                    <Icon name="X" size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (hint) clearHint(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(draft); } }}
                placeholder={t.listening.tagAddPlaceholder}
                aria-label={t.listening.tagAddPlaceholder}
                aria-describedby={hint ? 'tag-input-hint' : undefined}
                aria-invalid={hint ? 'true' : undefined}
                className="flex-1 h-9 rounded-lg border border-saf-border bg-white px-3 text-[13px] text-saf-text placeholder:text-saf-muted focus:border-saf-primary focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              />
              <Button variant="primary" onClick={() => handleSubmit(draft)} disabled={!draft.trim()}>{t.common.save}</Button>
            </div>
            <div
              id="tag-input-hint"
              role="status"
              aria-live="polite"
              className={`mt-1 text-[11px] text-saf-muted transition-opacity duration-200 ${hint ? 'opacity-100' : 'opacity-0'}`}
              // height holder so suggestions section doesn't jump when hint
              // appears / disappears
              style={{ minHeight: '14px' }}
            >
              {hint}
            </div>
          </div>
          {filteredSuggestions.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-medium text-saf-muted mb-1.5">{t.listening.tagSuggestions}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {filteredSuggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    aria-label={`Add tag ${s}`}
                    className="inline-flex items-center px-2 h-7 text-[12px] font-medium rounded-full bg-saf-surface text-saf-text border border-saf-border hover:bg-saf-light hover:text-saf-primary focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >#{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <Button variant="ghost" onClick={onClose}>{t.common.close}</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

window.SignalsScreen = SignalsScreen;
