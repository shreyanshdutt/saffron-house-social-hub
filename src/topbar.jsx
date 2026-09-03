// Top navigation bar.

function TopBar({ page, onNavigate, unreadCount, onToggleSidebar, sidebarCollapsed }) {
  const t = useT();
  const { theme, toggleTheme, role, setRole, profile } = React.useContext(AppCtx);
  const [focused, setFocused] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [roleOpen, setRoleOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const notifRef = React.useRef(null);
  const roleRef = React.useRef(null);

  React.useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (roleRef.current && !roleRef.current.contains(e.target)) setRoleOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const crumb = t.crumb[page] || page;
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-saf-border flex items-center px-6 gap-4">
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        aria-expanded={!sidebarCollapsed}
        title="Toggle sidebar"
        className="w-9 h-9 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2"
      >
        <Icon name={sidebarCollapsed ? 'Menu' : 'PanelLeftClose'} size={18} />
      </button>

      <nav className="flex items-center gap-1.5 min-w-0 shrink-0" aria-label="Breadcrumb">
        <span className="text-[13px] text-saf-muted hidden md:inline">{t.crumb.home}</span>
        <Icon name="ChevronRight" size={14} className="text-saf-muted hidden md:inline-block flip-x" />
        <span className="text-[13px] font-medium text-saf-text truncate" aria-current="page">{crumb}</span>
      </nav>

      <div className={`flex items-center flex-1 max-w-2xl mx-auto bg-saf-surface border rounded-xl h-10 px-3 gap-2 transition-all duration-200
        ${focused ? 'border-saf-primary ring-4 ring-saf-primary/10 bg-white' : 'border-saf-border'}`}>
        <Icon name="Search" size={16} className="text-saf-muted" />
        <input
          placeholder={t.search}
          aria-label={t.search}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-[13px] placeholder:text-saf-muted text-saf-text"
        />
        <kbd className="hidden md:inline text-[10px] text-saf-muted border border-saf-border rounded px-1.5 h-5 leading-5">⌘K</kbd>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Role switcher — demo-only, lets the audience preview each role's UI */}
        <div className="relative" ref={roleRef}>
          <button
            onClick={() => setRoleOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={roleOpen}
            aria-label={`Switch role, currently ${profile.role}`}
            title="Demo role switcher"
            className="h-9 px-3 inline-flex items-center gap-2 rounded-full bg-saf-light/50 text-saf-primary border border-saf-primary/30 hover:bg-saf-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2"
          >
            <Icon name="UserCog" size={14} />
            <span className="text-[12px] font-semibold tracking-tight">{profile.short}</span>
            <Icon name="ChevronDown" size={14} className={`transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
          </button>
          {roleOpen && (
            <div role="menu" className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-72 bg-white border border-saf-border rounded-xl shadow-pop py-1 z-50 animate-slideDown overflow-hidden">
              <div className="px-3 py-2 border-b border-saf-border bg-saf-light/40">
                <div className="text-[10px] uppercase tracking-wider text-saf-primary font-semibold">Demo · Switch role</div>
                <div className="text-[11px] text-saf-muted mt-0.5">Menu items and in-screen actions update per role.</div>
              </div>
              {ROLES.map(r => {
                const p = PROFILES[r];
                const active = r === role;
                return (
                  <button
                    key={r}
                    role="menuitem"
                    onClick={() => { setRole(r); setRoleOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-start transition ${active ? 'bg-saf-light/60' : 'hover:bg-saf-light/40'}`}
                  >
                    <Avatar name={p.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-saf-text truncate flex items-center gap-1.5">
                        {p.name}
                        {active && <Icon name="Check" size={12} className="text-saf-primary" strokeWidth={3} />}
                      </div>
                      <div className="text-[11px] text-saf-muted truncate">{p.role}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 h-5 grid place-items-center rounded-full font-semibold tracking-tight ${
                      r === 'admin'    ? 'bg-rose-50 text-rose-700'    :
                      r === 'manager'  ? 'bg-saf-primary/10 text-saf-primary' :
                      r === 'srexec'   ? 'bg-amber-50 text-amber-700' :
                                         'bg-emerald-50 text-emerald-700'
                    }`}>{p.short}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode (⌘\\)`}
          className="w-10 h-10 rounded-full grid place-items-center text-saf-text hover:bg-saf-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2"
        >
          <Icon name={isDark ? 'Sun' : 'Moon'} size={18} />
        </button>


        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            className="relative w-10 h-10 rounded-full grid place-items-center hover:bg-saf-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2"
          >
            <Icon name="Bell" size={18} className="text-saf-text" />
            <span aria-hidden="true" className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-saf-danger animate-pulseRing" />
          </button>
          {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} onNavigate={onNavigate} role={role} />}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 h-10 ltr:pl-1 ltr:pr-3 rtl:pr-1 rtl:pl-3 rounded-full hover:bg-saf-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2"
          >
            <Avatar name={profile.name} size={32} />
            <div className="hidden md:block text-start min-w-0">
              <div className="text-[12px] font-medium text-saf-text leading-tight truncate">{profile.name}</div>
              <div className="text-[10px] text-saf-muted truncate">{profile.role}</div>
            </div>
            <Icon name="ChevronDown" size={14} className="text-saf-muted" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-56 bg-white border border-saf-border rounded-xl shadow-pop py-2 z-50 animate-slideDown">
              <div className="px-3 py-2 border-b border-saf-border">
                <div className="text-[13px] font-medium text-saf-text">{profile.name}</div>
                <div className="text-[11px] text-saf-muted">{profile.email}</div>
              </div>
              <MenuItem icon="User" label={t.user.profile} />
              <MenuItem icon="Settings" label={t.user.prefs} onClick={() => onNavigate('settings')} />
              <div className="border-t border-saf-border my-1" />
              <MenuItem icon="LogOut" label={t.user.logout} danger />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 h-9 text-[13px] hover:bg-saf-light transition ${danger ? 'text-saf-danger' : 'text-saf-text'}`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

// Notification panel — admin.announcement entries get a distinct red
// treatment so the broadcast nature is visually obvious.
function NotificationsPanel({ onClose, onNavigate, role }) {
  const isAdmin = role === 'admin';
  // Admin announcements visible to non-admin viewers as well (they're
  // broadcasts from Admin). For Admin role itself, hide the "from Admin"
  // banner since they ARE the sender.
  const base = [
    { id: 'n0', kind: 'admin', icon: 'Megaphone', tone: 'bg-rose-50 text-rose-700 border-rose-200', title: '1★ Google review past SLA', time: 'now', desc: 'Ishaan Kapoor, 55-minute wait on a booked table. Unanswered for 4h.' },
    { id: 'n1', kind: 'msg',   icon: 'MessageSquare', tone: 'bg-saf-light text-saf-primary',  title: 'New WhatsApp booking enquiry', time: '5m', desc: 'Rahul Khanna — anniversary table, Saturday' },
    { id: 'n2', kind: 'trend', icon: 'TrendingUp',    tone: 'bg-emerald-50 text-emerald-600', title: 'Galouti reel is trending', time: '14m', desc: '+156K reach in the last hour' },
    { id: 'n3', kind: 'alert', icon: 'AlertTriangle', tone: 'bg-amber-50 text-amber-600',     title: 'Instagram account disconnected', time: '32m', desc: 'Reconnect to resume publishing' },
    { id: 'n4', kind: 'sched', icon: 'CalendarClock', tone: 'bg-saf-light text-saf-primary',  title: 'Scheduled post going live', time: '1h', desc: 'Quarterly results — May 28, 11:00' },
  ];
  const items = isAdmin ? base.filter(n => n.kind !== 'admin') : base;

  return (
    <div className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-[380px] bg-white border border-saf-border rounded-2xl shadow-pop overflow-hidden z-50 animate-slideDown">
      <div className="flex items-center justify-between px-4 h-12 border-b border-saf-border">
        <div className="text-sm font-medium text-saf-text">Notifications</div>
        <button className="text-[12px] text-saf-primary hover:underline">Mark all read</button>
      </div>
      <div className="max-h-[420px] overflow-y-auto nice-scroll">
        {items.map(n => {
          const isAnnouncement = n.kind === 'admin';
          return (
            <button
              key={n.id}
              className={`w-full text-start flex items-start gap-3 px-4 py-3 transition border-b border-saf-border last:border-0 ${
                isAnnouncement
                  ? 'bg-rose-50/60 hover:bg-rose-50 ltr:border-l-4 rtl:border-r-4 border-rose-500'
                  : 'hover:bg-saf-light/60'
              }`}
            >
              <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 border ${n.tone}`}>
                <Icon name={n.icon} size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isAnnouncement && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 h-4 grid place-items-center rounded bg-rose-500 text-white">
                      Admin
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-saf-text leading-snug">{n.title}</span>
                </div>
                <div className="text-[12px] text-saf-muted mt-0.5">{n.desc}</div>
              </div>
              <span className="text-[10px] text-saf-muted shrink-0">{n.time}</span>
            </button>
          );
        })}
      </div>
      <button onClick={() => { onClose(); onNavigate('messages'); }} className="w-full h-10 text-[12px] text-saf-primary font-medium hover:bg-saf-light/60 transition border-t border-saf-border">View all</button>
    </div>
  );
}

Object.assign(window, { TopBar });
