// Sectioned, role-gated sidebar.
//
// Three sections in order — Workflow / Insights / Admin — each with an
// uppercase header. Items hide when the role lacks the permission; if a
// section has zero visible items for the current role, the section
// header + divider hide too. RTL uses logical props (ps-/pe-/border-s/
// text-start) throughout so the layout mirrors automatically.
//
// Active state: 2px sapphire rail on the inline-start edge + white/15
// fill, semibold text. Tooltips on collapsed mode + on the edge toggle.

function SafLogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="saf-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FCEFE7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#saf-grad)" />
      <path d="M12 28 L20 12 L28 28 M15.2 21.4 H24.8" fill="none" stroke="#6E2412" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="13" r="2.4" fill="#B4451F" />
    </svg>
  );
}

// Sectioned nav model. Each item's `perm` controls visibility.
// `route` is the page key in app.jsx — kept lowercase, with hyphens for
// multi-word keys.
const SIDEBAR_SECTIONS = [
  {
    id: 'workflow',
    label: { en: 'Workflow' },
    items: [
      { route: 'dashboard',  icon: 'BarChart3',     perm: 'dashboard',      labelKey: 'dashboard' },
      { route: 'messages',   icon: 'Inbox',         perm: 'inbox.read',     labelKey: 'messages', badged: true },
      { route: 'reviews',    icon: 'Star',          perm: 'review.read',    labelKey: 'reviews', reviewBadged: true },
      { route: 'compose',    icon: 'PenSquare',     perm: 'draft.create',   labelKey: 'compose', primary: true },
      { route: 'approvals',  icon: 'ClipboardList', perm: 'draft.create',   labelKey: 'approvals' },
      { route: 'scheduled',  icon: 'CalendarDays',  perm: 'draft.create',   labelKey: 'scheduled' },
      { route: 'team',       icon: 'MessageSquare', perm: 'inbox.read',     labelKey: 'team' },
    ],
  },
  {
    id: 'insights',
    label: { en: 'Insights' },
    items: [
      { route: 'channel-health', icon: 'Activity',   perm: 'social.manage',      labelKey: 'channel-health' },
      { route: 'analytics',      icon: 'TrendingUp', perm: 'notifications.read', labelKey: 'analytics' },
      { route: 'listening',      icon: 'Megaphone',  perm: 'notifications.read', labelKey: 'listening' },
    ],
  },
  {
    id: 'admin',
    label: { en: 'Admin' },
    items: [
      { route: 'brand',         icon: 'Palette',  perm: 'brand.manage',       labelKey: 'brand' },
      { route: 'users',         icon: 'Users',    perm: 'user.manage',        labelKey: 'users' },
      { route: 'audit',         icon: 'Shield',   perm: 'audit.read',         labelKey: 'audit' },
      { route: 'notifications', icon: 'Bell',     perm: 'notifications.read', labelKey: 'notifications' },
      { route: 'exports',       icon: 'Download', perm: 'notifications.read', labelKey: 'exports' },
    ],
  },
];

function Sidebar({ collapsed, onToggle, page, onNavigate, unreadCount, role }) {
  const t = useT();
  const { profile } = React.useContext(AppCtx);

  // Unanswered reviews get their own badge. Deliberately counts *unanswered*
  // rather than *unread*: a review you have read and not replied to is still
  // sitting in public with no response, which is the state that costs covers.
  const unansweredReviews = REVIEWS.filter(r => !r.replied).length;

  // Apply role gate; drop sections that end up empty.
  const visibleSections = SIDEBAR_SECTIONS
    .map(s => ({
      ...s,
      items: s.items
        .filter(i => hasPerm(role, i.perm))
        .map(i => ({
          ...i,
          label: t.nav[i.labelKey] || i.labelKey,
          badge: i.badged ? unreadCount : i.reviewBadged ? unansweredReviews : 0,
        })),
    }))
    .filter(s => s.items.length > 0);

  const w = collapsed ? 72 : 260;
  return (
    <aside
      role="navigation"
      aria-label="Primary"
      className="relative shrink-0 flex flex-col text-white"
      style={{
        width: w,
        transition: 'width 300ms cubic-bezier(.4,0,.2,1)',
        background: 'linear-gradient(180deg, #6E2412 0%, #4A2216 60%, #2E140C 100%)',
      }}
    >
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="group absolute top-20 ltr:-right-3 rtl:-left-3 z-30 w-7 h-14 rounded-full bg-white border border-saf-border text-saf-muted hover:text-saf-primary hover:border-saf-primary hover:bg-saf-light shadow-card grid place-items-center transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#4A2216] focus-visible:ring-saf-accent"
      >
        <Icon
          name="ChevronLeft"
          size={14}
          className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
        <span className="pointer-events-none absolute ltr:left-full rtl:right-full top-1/2 -translate-y-1/2 ltr:ml-2 rtl:mr-2 px-2 py-1 rounded-md bg-saf-dark text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-pop">
          {collapsed ? 'Expand' : 'Collapse'}
          <kbd className="ltr:ml-1.5 rtl:mr-1.5 px-1 py-0.5 bg-white/20 rounded text-[9px]">[</kbd>
        </span>
      </button>

      {/* Brand */}
      <div
        className={`flex items-center gap-3 h-16 ${collapsed ? 'px-3 justify-center' : 'px-4'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        <button
          onClick={collapsed ? onToggle : undefined}
          className={`shrink-0 transition-transform rounded-lg ${collapsed ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#6E2412]`}
          aria-label={collapsed ? 'Expand sidebar' : 'Saffron House Social Hub'}
        >
          <SafLogoMark size={36} />
        </button>
        <div className={`min-w-0 transition-all duration-200 ${collapsed ? 'opacity-0 -translate-x-2 w-0 overflow-hidden' : 'opacity-100'}`}>
          <div className="text-[15px] font-bold leading-tight text-white whitespace-nowrap text-start">Saffron House Social Hub</div>
          <div className="text-[11px] text-white/70 whitespace-nowrap text-start">Khan Market, New Delhi</div>
        </div>
      </div>

      {/* Sectioned nav */}
      <nav
        className="flex-1 overflow-y-auto nice-scroll py-3 px-2"
        aria-label="Sections"
      >
        {visibleSections.map((section, idx) => (
          <div
            key={section.id}
            className={idx > 0 ? 'border-t border-white/10 mt-4 pt-3' : ''}
          >
            {/* Section header — hidden in collapsed mode (icon-only rail) */}
            {!collapsed && (
              <div
                role="heading"
                aria-level="3"
                className="ps-3 mb-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-white/55 text-start"
              >
                {section.label.en}
              </div>
            )}
            {collapsed && idx > 0 && (
              // In collapsed mode we still need a visible divider so the
              // icon rail reads as grouped — the section header is hidden
              // but the dividing line stays.
              <div aria-hidden="true" className="h-px mx-2 mb-2 bg-white/10" />
            )}

            <ul className="space-y-1" role="list">
              {section.items.map(item => {
                const active = page === item.route;
                const isCompose = item.primary && !active;
                return (
                  <li key={item.route}>
                    <button
                      onClick={() => onNavigate(item.route)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : ''}
                      className={`relative group w-full flex items-center gap-3 ps-3 pe-2.5 h-11 rounded-lg transition-all
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#4A2216]
                        ${active
                          ? 'bg-white/15 text-white font-semibold'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'}
                        ${isCompose ? 'ring-1 ring-saf-accent/40 bg-white/[0.06]' : ''}
                      `}
                    >
                      {/* Active inline-start rail */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute start-0 top-2 bottom-2 w-1 rounded-e-full bg-saf-accent"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`grid place-items-center w-7 h-7 rounded-md shrink-0 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5
                          ${active ? 'text-white' : isCompose ? 'text-saf-accent' : 'text-white/75 group-hover:text-white'}`}
                      >
                        <Icon name={item.icon} size={18} />
                      </span>
                      <span className={`flex-1 text-start text-[14px] truncate transition-all ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{item.label}</span>

                      {!collapsed && item.badge ? (
                        <span
                          className="px-1.5 h-5 min-w-[20px] grid place-items-center text-[11px] rounded-full bg-saf-danger text-white font-medium ring-2 ring-[#4A2216]"
                          aria-label={`${item.badge} unread`}
                        >{item.badge}</span>
                      ) : null}
                      {collapsed && item.badge ? (
                        <span
                          className="absolute top-1.5 ltr:right-1.5 rtl:left-1.5 w-2 h-2 rounded-full bg-saf-danger animate-pulseRing ring-2 ring-[#4A2216]"
                          aria-label={`${item.badge} unread`}
                        />
                      ) : null}

                      {collapsed && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute ltr:left-full rtl:right-full top-1/2 -translate-y-1/2 ltr:ml-3 rtl:mr-3 whitespace-nowrap px-2 py-1 rounded-md bg-saf-dark text-white text-[11px] opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-pop"
                        >
                          {item.label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: user */}
      <div
        className="p-3 space-y-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className={`flex items-center gap-3 p-2 rounded-lg ${collapsed ? '' : 'bg-white/[0.08]'}`}>
          <Avatar name={profile.name} size={collapsed ? 32 : 36} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white truncate text-start">{profile.name}</div>
              <div className="text-[11px] text-white/70 truncate text-start">{profile.role}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar, SafLogoMark });
