// Main app — wires everything together.

function App() {
  // English-only build. `lang` stays in context so useT() and every t.* call
  // site keep working unchanged; there is simply one locale to resolve to.
  const [lang] = React.useState('en');
  // Role state — persisted to localStorage so a demo viewer can refresh
  // and stay on the same role. Defaults to Manager because that's the
  // most action-rich seat (everything visible). The role drives which
  // menu items render, which in-screen actions are enabled, and which
  // mock identity surfaces in the sidebar/topbar.
  const [role, setRole] = React.useState(() => {
    try {
      const saved = localStorage.getItem('saf-role');
      return saved && ROLES.includes(saved) ? saved : 'manager';
    } catch (e) { return 'manager'; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('saf-role', role); } catch (e) {}
  }, [role]);

  const [page, setPage] = React.useState('dashboard');
  const [collapsed, setCollapsed] = React.useState(false);
  const [openedPost, setOpenedPost] = React.useState(null);

  // Theme: 'light' | 'dark'.
  const [theme, setTheme] = React.useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  React.useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('saf-theme', theme); } catch (e) {}
  }, [theme]);
  const toggleTheme = React.useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Sync html lang
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (!isTyping && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        setCollapsed(c => !c);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTheme]);

  const unreadCount = CONVERSATIONS.reduce((s, c) => s + c.unread, 0);
  const profile = PROFILES[role];

  // Auto-redirect when the current page is not accessible to the role.
  // We need a stable handle to the toast push, but the ToastProvider
  // mounts BELOW App, so we use a small inner component that owns the
  // redirect-on-role-change effect (see <RoleRedirector />).
  const go = (next) => {
    setPage(next);
  };

  const handleOpenPost = (post) => {
    setOpenedPost(post);
    setPage('approvals');
  };

  return (
    <AppCtx.Provider value={{
      lang, page, go, theme, toggleTheme,
      role, setRole, profile,
    }}>
      <ToastProvider>
        <RoleRedirector role={role} page={page} setPage={setPage} />
        <div className="h-full flex bg-saf-surface font-sans" style={{ transition: 'all 200ms ease-in-out' }}>
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(c => !c)}
            page={page}
            onNavigate={go}
            unreadCount={unreadCount}
            role={role}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar
              page={page}
              onNavigate={go}
              unreadCount={unreadCount}
              onToggleSidebar={() => setCollapsed(c => !c)}
              sidebarCollapsed={collapsed}
            />
            <main className="flex-1 overflow-y-auto nice-scroll p-6 relative">
              <PageRouter
                page={page}
                go={go}
                openedPost={openedPost}
                onOpenPost={handleOpenPost}
                onCloseDrawer={() => setOpenedPost(null)}
                role={role}
              />
            </main>
          </div>

        </div>
      </ToastProvider>
    </AppCtx.Provider>
  );
}

// Watches role + page; if the page is not accessible to the new role,
// redirect to the dashboard (always accessible) and surface a toast so
// the viewer understands the redirect. Mounted inside ToastProvider so
// useToast() works.
function RoleRedirector({ role, page, setPage }) {
  const toast = useToast();
  React.useEffect(() => {
    const required = PAGE_PERMS[page];
    if (!required || hasPerm(role, required)) return;
    setPage('dashboard');
    const need = PAGE_LABEL[page] || page;
    toast.push({
      title: 'Switched to Dashboard',
      desc: `${need} requires a different role.`,
      kind: 'info',
    });
  }, [role, page]);
  return null;
}

// Page route -> permission required. Used by the redirector + sidebar.
const PAGE_PERMS = {
  dashboard:      'dashboard',
  compose:        'draft.create',
  approvals:      'draft.create',
  analytics:      'notifications.read',
  reviews:        'review.read',
  actions:        'dashboard',
  messages:       'inbox.read',
  team:           'inbox.read',
  scheduled:      'draft.create',
  customers:      'inbox.read',
  'channel-health': 'social.manage',
  brand:          'brand.manage',
  users:          'user.manage',
  audit:          'audit.read',
  'data-sources': 'social.manage',
  exports:        'notifications.read',
  notifications:  'notifications.read',
  listening:      'notifications.read',
  establishments: 'notifications.read',
  settings:       'dashboard',
};
const PAGE_LABEL = {
  actions:        'Actions',
  'data-sources': 'Data & access',
  reviews:        'Reviews',
  approvals:      'Approvals',
  inbox:          'Inbox',
  compose:        'Composer',
  analytics:      'Analytics',
  messages:       'Inbox',
  team:           'Messages',
  scheduled:      'Calendar',
  customers:      'Customers',
  'channel-health': 'Channel Health',
  brand:          'Brand Kit',
  users:          'Users',
  audit:          'Audit',
  exports:        'Exports',
  notifications:  'Notifications',
  listening:      'Social Listening',
  establishments: 'Establishments',
};
window.PAGE_PERMS = PAGE_PERMS;
window.PAGE_LABEL = PAGE_LABEL;

function PageRouter({ page, go, openedPost, onOpenPost, onCloseDrawer, role }) {
  switch (page) {
    case 'dashboard':       return <DashboardPage onNavigate={go} onOpenPost={onOpenPost} />;
    case 'compose':         return <ComposePage />;
    case 'analytics':       return <AnalyticsPage onOpenPost={onOpenPost} />;
    case 'reviews':         return <ReviewsPage role={role} />;
    case 'actions':         return <RecommendationsPage role={role} onNavigate={go} />;
    case 'messages':        return <MessagesPage role={role} />;
    case 'team':            return <TeamPage />;
    case 'listening':       return <ListeningPage />;
    case 'establishments':  return <EstablishmentsPage onNavigate={go} />;
    case 'notifications':   return <NotificationsCenterPage />;
    case 'approvals':       return <ApprovalsPage role={role} openedPost={openedPost} onCloseDrawer={onCloseDrawer} />;
    case 'scheduled':       return <ScheduledPage />;
    case 'customers':       return <CustomersPage />;
    case 'channel-health':  return <ChannelHealthPage />;
    case 'brand':           return <BrandKitPage />;
    case 'users':           return <UsersPage role={role} />;
    case 'audit':           return <AuditPage />;
    case 'exports':         return <ExportsPage role={role} />;
    case 'data-sources':    return <DataSourcesPage />;
    case 'settings':        return <SettingsPage />;
    default:                return <DashboardPage onNavigate={go} onOpenPost={onOpenPost} />;
  }
}

window.App = App;
