// Scheduled posts page.

// GATED. The calendar is now the server's `posts` in state 'scheduled', so an
// unreachable service must not render as an empty queue.
function ScheduledPage() {
  return (
    <RequiresServerData what="the scheduled queue">
      <ScheduledPageInner />
    </RequiresServerData>
  );
}

function ScheduledPageInner() {
  const t = useT();
  const { lang } = React.useContext(AppCtx);
  const scheduled = scheduledPosts();

  // Group by week relative to "now" = 2026-09-04
  const now = new Date('2026-09-04T12:00:00+05:30');
  const oneWeek = 7 * 86400000;
  const buckets = { this: [], next: [], later: [] };
  scheduled.forEach(s => {
    const d = new Date(s.when);
    const diff = d - now;
    if (diff < oneWeek) buckets.this.push(s);
    else if (diff < 2 * oneWeek) buckets.next.push(s);
    else buckets.later.push(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">{t.scheduled.title}</h1>
          <p className="text-sm text-saf-muted mt-1">{t.scheduled.subtitle}</p>
        </div>
        <Button variant="primary" leadingIcon="Plus">New scheduled post</Button>
      </div>

      {/* Calendar strip */}
      <Card padding="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-medium text-saf-text">May 2026</h3>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light grid place-items-center"><Icon name="ChevronLeft" size={16} className="flip-x" /></button>
            <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light grid place-items-center"><Icon name="ChevronRight" size={16} className="flip-x" /></button>
          </div>
        </div>
        <CalendarStrip scheduled={scheduled} />
      </Card>

      {[
        { id: 'this',  label: t.scheduled.this,  items: buckets.this  },
        { id: 'next',  label: t.scheduled.next,  items: buckets.next  },
        { id: 'later', label: t.scheduled.later, items: buckets.later },
      ].map(group => (
        <section key={group.id}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-saf-muted mb-3">{group.label}</div>
          {group.items.length === 0 ? (
            <div className="text-[12px] text-saf-muted p-4 border border-dashed border-saf-border rounded-xl">{t.scheduled.empty}</div>
          ) : (
            <div className="space-y-2">
              {group.items.map(s => <ScheduledItem key={s.id} item={s} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ScheduledItem({ item }) {
  const t = useT();
  const date = new Date(item.when);
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const hh = date.getHours().toString().padStart(2,'0');
  const mm = date.getMinutes().toString().padStart(2,'0');
  return (
    <Card padding="p-3" className="flex items-center gap-4 hover:shadow-pop hover:-translate-y-px transition-all">
      <div className="shrink-0 w-20 text-center">
        <div className="text-[10px] uppercase tracking-wider text-saf-muted">{dayLabel}</div>
        <div className="text-[20px] font-bold text-saf-primary tabular-nums">{hh}:{mm}</div>
      </div>
      <div className="w-px self-stretch bg-saf-border" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {item.platforms.map(pi => (
            <span key={pi} className="w-5 h-5 rounded-full grid place-items-center text-white" style={{ background: PLATFORM_BY_ID[pi].color }}>
              <PlatformGlyph id={pi} size={9} />
            </span>
          ))}
          <Pill tone="blue"><Icon name="Clock" size={11} />Scheduled</Pill>
        </div>
        <div className="text-[13px] text-saf-text line-clamp-2">{item.content}</div>
        {item.tags?.length ? <div className="text-[11px] text-saf-primary mt-1">{item.tags.join(' ')}</div> : null}
      </div>
      <div className="hidden md:flex items-center gap-1 shrink-0">
        <Tooltip label="Edit" side="top"><button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="Pencil" size={15} /></button></Tooltip>
        <Tooltip label="Reschedule" side="top"><button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="CalendarClock" size={15} /></button></Tooltip>
        <Tooltip label="Cancel" side="top"><button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-rose-50 hover:text-saf-danger grid place-items-center"><Icon name="X" size={15} /></button></Tooltip>
      </div>
    </Card>
  );
}

function CalendarStrip({ scheduled }) {
  // Render 14 days from May 22..Jun 4
  const start = new Date('2026-08-31T00:00:00+05:30'); // start on Mon for nicer look
  const days = Array.from({ length: 14 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const todayStr = '2026-09-04';
  const byDay = {};
  scheduled.forEach(s => {
    const key = new Date(s.when).toISOString().slice(0, 10);
    (byDay[key] ||= []).push(s);
  });
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map(d => {
        const key = d.toISOString().slice(0, 10);
        const isToday = key === todayStr;
        const items = byDay[key] || [];
        return (
          <div key={key} className={`rounded-lg border min-h-[88px] p-2 transition ${isToday ? 'border-saf-primary bg-saf-primary/5' : 'border-saf-border bg-white hover:border-saf-primary/30'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-saf-primary font-semibold' : 'text-saf-muted'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className={`text-[13px] font-semibold ${isToday ? 'text-saf-primary' : 'text-saf-text'}`}>{d.getDate()}</span>
            </div>
            <div className="mt-1.5 space-y-1">
              {items.slice(0,2).map(it => (
                <div key={it.id} className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-saf-primary" />
                  <span className="text-saf-text truncate">{it.content.slice(0, 24)}</span>
                </div>
              ))}
              {items.length > 2 && <div className="text-[10px] text-saf-muted">+{items.length - 2} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { ScheduledPage });
