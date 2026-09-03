// New light-stub screens — Channel Health, Brand Kit, Users, Audit,
// Exports. Each is a single-route screen with real layout + mock data,
// gated by role at the menu level. In-screen actions that the spec
// reserves for one role are disabled-with-tooltip for everyone else.

// =============================================================================
// CHANNEL HEALTH — Admin only
// =============================================================================
const CHANNEL_HEALTH = [
  { id: 'ig', handle: '@saffronhouse',               followers: '218K',   state: 'down',     last: '48 min', incidents24h: 1 },
  { id: 'gg', handle: 'Saffron House · Sector 10 Dwarka',  followers: '1.3K',   state: 'ok',       last: 'just now', incidents24h: 0 },
  { id: 'wa', handle: '+91 11 4160 2200',             followers: '6.4K',   state: 'ok',       last: '1 min',  incidents24h: 0 },
];
const STATE_TONE = {
  ok:       { tone: 'green',  label: 'Healthy',  dot: 'bg-emerald-500' },
  degraded: { tone: 'amber',  label: 'Degraded', dot: 'bg-amber-500' },
  down:     { tone: 'red',    label: 'Down',     dot: 'bg-rose-500' },
};
const INCIDENTS = [
  { id: 'i1', t: '48 min ago', channel: 'ig', text: 'Instagram access token expired — the lunch-deal post failed to publish.', state: 'down' },
  { id: 'i2', t: '12 min ago', channel: 'gg', text: 'Business Profile review sync ran 40 minutes late — polling backlog cleared.', state: 'degraded' },
  { id: 'i3', t: 'Yesterday',  channel: 'wa', text: 'WhatsApp webhook reconnected automatically after a 6-minute drop.', state: 'ok' },
  { id: 'i4', t: '31 Aug',     channel: 'gg', text: 'Brief Google Business Profile outage (07:00–07:18 IST).', state: 'ok' },
];

function ChannelHealthPage() {
  const ok = CHANNEL_HEALTH.filter(c => c.state === 'ok').length;
  const degraded = CHANNEL_HEALTH.filter(c => c.state === 'degraded').length;
  const down = CHANNEL_HEALTH.filter(c => c.state === 'down').length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">Channel Health</h1>
        <p className="text-sm text-saf-muted mt-1">Connectivity, rate-limits and incidents across all linked accounts.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthKpi label="Healthy"   value={ok}       icon="CheckCircle2" tone="bg-emerald-50 text-emerald-700" />
        <HealthKpi label="Degraded"  value={degraded} icon="AlertTriangle"tone="bg-amber-50 text-amber-700" />
        <HealthKpi label="Down"      value={down}     icon="XCircle"      tone="bg-rose-50 text-rose-700" />
        <HealthKpi label="Incidents (24h)" value={INCIDENTS.length} icon="Activity" tone="bg-saf-light text-saf-primary" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-0" className="col-span-12 xl:col-span-7">
          <div className="px-5 h-12 border-b border-saf-border flex items-center justify-between">
            <div className="text-[14px] font-medium text-saf-text">Channels</div>
            <Button size="sm" variant="ghost" leadingIcon="RefreshCw">Re-check all</Button>
          </div>
          <div className="divide-y divide-saf-border">
            {CHANNEL_HEALTH.map(c => {
              const p = PLATFORM_BY_ID[c.id];
              const s = STATE_TONE[c.state];
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: p.color }}>
                    <PlatformGlyph id={c.id} size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-saf-text">{p.name}</div>
                    <div className="text-[12px] text-saf-muted">{c.handle} · {c.followers} followers · synced {c.last}</div>
                  </div>
                  <div className="hidden sm:block">
                    <Pill tone={s.tone}><span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</Pill>
                  </div>
                  <Button variant="ghost" size="sm" leadingIcon={c.state === 'ok' ? 'RefreshCw' : 'Wrench'}>
                    {c.state === 'ok' ? 'Re-check' : 'Reconnect'}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
        <Card padding="p-0" className="col-span-12 xl:col-span-5">
          <div className="px-5 h-12 border-b border-saf-border flex items-center justify-between">
            <div className="text-[14px] font-medium text-saf-text">Recent incidents</div>
            <span className="text-[11px] text-saf-muted">Last 7 days</span>
          </div>
          <div className="divide-y divide-saf-border">
            {INCIDENTS.map(i => {
              const s = STATE_TONE[i.state];
              return (
                <div key={i.id} className="flex items-start gap-3 px-5 py-3">
                  <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${s.dot}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-saf-text">{i.text}</div>
                    <div className="text-[11px] text-saf-muted mt-0.5">{i.t} · {PLATFORM_BY_ID[i.channel].name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HealthKpi({ label, value, icon, tone }) {
  return (
    <Card padding="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] text-saf-muted">{label}</div>
          <div className="text-[28px] font-bold text-saf-text mt-2 tabular-nums">{value}</div>
        </div>
        <span className={`w-10 h-10 rounded-xl grid place-items-center ${tone}`}><Icon name={icon} size={18} /></span>
      </div>
    </Card>
  );
}

// =============================================================================
// BRAND KIT — Admin only (in-screen actions all Admin-gated, but page
// itself is already gated at the menu level — so action buttons are
// shown active here. Kept consistent with the rest of the build.)
// =============================================================================
function BrandKitPage() {
  const toast = useToast();
  const [tab, setTab] = React.useState('logos');
  const colors = [
    { name: 'Primary',  hex: '#B4451F' },
    { name: 'Dark',     hex: '#6E2412' },
    { name: 'Accent',   hex: '#D99A16' },
    { name: 'Success',  hex: '#2E7D4F' },
    { name: 'Warning',  hex: '#B7791F' },
    { name: 'Danger',   hex: '#C0342B' },
  ];
  const copyBlocks = [
    { id: 'tag',      label: 'Master tagline',      body: 'Cooked the long way, in Sector 10 Market, Dwarka.' },
    { id: 'book-cta', label: 'Booking CTA',         body: 'Book a table on WhatsApp — we answer in minutes.' },
    { id: 'late-cta', label: 'Late kitchen CTA',    body: 'Kitchen open until 11:30pm, seven days.' },
    { id: 'hours',    label: 'Hours boilerplate',   body: 'Open seven days, 12pm to 11:30pm. Sector 10 Market, Dwarka.' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Brand Kit</h1>
          <p className="text-sm text-saf-muted mt-1">Logos, colours and approved copy passed to every composer + AI prompt.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon="Download">Export pack</Button>
          <Button variant="primary"   leadingIcon="Upload" onClick={() => toast.push({ title: 'Asset uploaded' })}>Upload asset</Button>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'logos', label: 'Logos & assets' },
        { id: 'palette', label: 'Colour palette' },
        { id: 'copy', label: 'Copy blocks' },
      ]} />
      {tab === 'logos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Primary lockup','Wordmark only','Menu header','Festive variant','Mono — dark bg','Mono — light bg'].map((label, i) => (
            <Card key={i} padding="p-0" className="overflow-hidden">
              <MockImage tone={i % 2 ? 'tech' : 'night'} kind="image" label={label} className="aspect-[4/3]" />
              <div className="p-3 flex items-center justify-between">
                <div className="text-[13px] font-medium text-saf-text">{label}</div>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light grid place-items-center" aria-label="Download"><Icon name="Download" size={14} /></button>
                  <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-rose-50 hover:text-saf-danger grid place-items-center" aria-label="Delete" onClick={() => toast.push({ title: 'Asset removed' })}><Icon name="Trash2" size={14} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {tab === 'palette' && (
        <Card padding="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {colors.map(c => (
              <div key={c.hex} className="text-center">
                <div className="aspect-square rounded-xl border border-saf-border" style={{ background: c.hex }} />
                <div className="mt-2 text-[13px] font-medium text-saf-text">{c.name}</div>
                <div className="text-[11px] text-saf-muted tabular-nums">{c.hex}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-saf-border flex items-center justify-end">
            <Button size="sm" variant="primary" leadingIcon="Plus" onClick={() => toast.push({ title: 'Color token added' })}>Add token</Button>
          </div>
        </Card>
      )}
      {tab === 'copy' && (
        <Card padding="p-0">
          <div className="divide-y divide-saf-border">
            {copyBlocks.map(b => (
              <div key={b.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">

                  <div className="text-[13px] font-medium text-saf-text">{b.label}</div>
                </div>
                <div className="text-[14px] text-saf-text">{b.body}</div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-saf-border flex justify-end">
            <Button size="sm" variant="primary" leadingIcon="Plus" onClick={() => toast.push({ title: 'Copy block added' })}>Add copy block</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// USERS — Admin only (gated at menu level). Create/Assign-Role are
// shown disabled-with-tooltip when somehow accessed by non-Admin (not
// possible from the menu, but defense-in-depth + demoes the gate).
// =============================================================================
const MOCK_USERS = [
  { id: 'u-1', name: 'Priya Menon',     email: 'priya@saffronhouse.in',   role: 'Marketing Manager',    status: 'active',  last: '2 min'  },
  { id: 'u-2', name: 'Rohit Malhotra',  email: 'rohit@saffronhouse.in',   role: 'Guest Relations Lead', status: 'active',  last: '5 min'  },
  { id: 'u-3', name: 'Ananya Rao',      email: 'ananya@saffronhouse.in',  role: 'Social Coordinator',   status: 'active',  last: '1 hr'   },
  { id: 'u-4', name: 'Vikram Suri',     email: 'vikram@saffronhouse.in',  role: 'Owner',                status: 'active',  last: 'just now' },
  { id: 'u-5', name: 'Farhan Qureshi',  email: 'farhan@saffronhouse.in',  role: 'Social Coordinator',   status: 'invited', last: '—' },
  { id: 'u-6', name: 'Meera Krishnan',  email: 'meera@saffronhouse.in',   role: 'Guest Relations Lead', status: 'active',  last: '3 hr'  },
  { id: 'u-7', name: 'Lina Habsi',       email: 'lina.habsi@saffronhouse.in',      role: 'Executive',        status: 'paused',  last: 'Yesterday' },
];
const ROLE_TONE = {
  Admin:               'red',
  Manager:             'blue',
  'Senior Executive':  'amber',
  Executive:           'green',
};

function UsersPage({ role }) {
  const toast = useToast();
  const canManage = hasPerm(role, 'user.manage');
  const canAssignRole = hasPerm(role, 'role.manage');

  function GatedButton({ enabled, label, leadingIcon, variant = 'primary', tooltip, onClick }) {
    if (enabled) return <Button variant={variant} leadingIcon={leadingIcon} onClick={onClick}>{label}</Button>;
    return (
      <Tooltip label={tooltip} side="top">
        <span className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg font-medium text-sm select-none whitespace-nowrap opacity-60 cursor-not-allowed
          ${variant === 'primary' ? 'bg-saf-primary text-white' : 'bg-white text-saf-text border border-saf-border'}`}
          aria-disabled="true">
          <Icon name={leadingIcon} size={16} />{label}
        </span>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Users</h1>
          <p className="text-sm text-saf-muted mt-1">Team members, roles and access. Admin manages people; Admin does not author content.</p>
        </div>
        <div className="flex items-center gap-2">
          <GatedButton
            enabled={canManage}
            label="Invite user"
            leadingIcon="UserPlus"
            variant="primary"
            tooltip="Inviting users requires the Admin role"
            onClick={() => toast.push({ title: 'Invitation sent' })}
          />
        </div>
      </div>

      <Card padding="p-0">
        <div className="px-5 h-12 border-b border-saf-border flex items-center gap-3">
          <div className="flex items-center bg-saf-surface border border-saf-border rounded-lg h-8 px-3 gap-2 flex-1 max-w-sm">
            <Icon name="Search" size={13} className="text-saf-muted" />
            <input placeholder="Search team…" className="flex-1 bg-transparent text-[12px]" />
          </div>
          <Button variant="ghost" size="sm" leadingIcon="Filter">All roles</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-saf-muted">
                <th className="text-start font-medium px-5 py-3">Member</th>
                <th className="text-start font-medium px-3 py-3">Role</th>
                <th className="text-start font-medium px-3 py-3">Status</th>
                <th className="text-start font-medium px-3 py-3">Last active</th>
                <th className="text-end font-medium px-5 py-3">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map(u => (
                <tr key={u.id} className="border-t border-saf-border hover:bg-saf-light/40 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={36} />
                      <div>
                        <div className="text-saf-text font-medium">{u.name}</div>
                        <div className="text-[11px] text-saf-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Pill tone={ROLE_TONE[u.role]}>{u.role}</Pill></td>
                  <td className="px-3 py-3">
                    <Pill tone={u.status === 'active' ? 'green' : u.status === 'invited' ? 'amber' : 'gray'}>
                      {u.status === 'active' ? 'Active' : u.status === 'invited' ? 'Invited' : 'Paused'}
                    </Pill>
                  </td>
                  <td className="px-3 py-3 text-saf-muted">{u.last}</td>
                  <td className="px-5 py-3 text-end">
                    <div className="inline-flex items-center gap-1">
                      {canAssignRole ? (
                        <Button variant="ghost" size="sm" leadingIcon="Shield" onClick={() => toast.push({ title: `Role change recorded for ${u.name}` })}>Assign role</Button>
                      ) : (
                        <Tooltip label="Assigning roles requires the Admin role" side="top">
                          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] opacity-60 cursor-not-allowed text-saf-muted" aria-disabled="true">
                            <Icon name="Shield" size={14} />Assign role
                          </span>
                        </Tooltip>
                      )}
                      <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light grid place-items-center" aria-label="More"><Icon name="MoreVertical" size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// =============================================================================
// AUDIT — Admin only
// =============================================================================
const AUDIT_ROWS = [
  { id: 'a-1', t: '09:42:11', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'post.publish',  entity: 'post:p2',        detail: 'Published the galouti reel to Instagram and District' },
  { id: 'a-2', t: '09:38:04', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'inbox.unmask',  entity: 'message:c4',     detail: 'Unmasked phone and order ID on the Swiggy missing-item complaint' },
  { id: 'a-3', t: '09:30:55', actor: 'Rohit Malhotra', role: 'Guest Relations Lead',action: 'review.reply',  entity: 'review:rv-3',    detail: 'Replied to a 5★ Google review from Meenakshi Reddy' },
  { id: 'a-4', t: '09:12:31', actor: 'Ananya Rao',     role: 'Social Coordinator',  action: 'draft.submit',  entity: 'draft:a-rev-1',  detail: 'Submitted the Diwali menu announcement for review' },
  { id: 'a-5', t: '08:58:17', actor: 'Vikram Suri',    role: 'Owner',               action: 'user.invite',   entity: 'user:u-5',       detail: 'Invited farhan@saffronhouse.in as Social Coordinator' },
  { id: 'a-6', t: '08:21:02', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'review.comp',   entity: 'review:rv-2',    detail: 'Issued a ₹1,000 credit with the reply to a 2★ Zomato review' },
  { id: 'a-7', t: '07:55:44', actor: 'Vikram Suri',    role: 'Owner',               action: 'brand.upload',  entity: 'asset:logo-v2',  detail: 'Uploaded primary lockup v2' },
  { id: 'a-8', t: '07:42:11', actor: 'system',         role: '—',                   action: 'connector.expired', entity: 'channel:ig', detail: 'Instagram OAuth token expired' },
];

function AuditPage() {
  const [actor, setActor] = React.useState('all');
  const [action, setAction] = React.useState('all');
  const filtered = AUDIT_ROWS
    .filter(r => actor === 'all' ? true : r.actor === actor)
    .filter(r => action === 'all' ? true : r.action.startsWith(action));
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Audit log</h1>
          <p className="text-sm text-saf-muted mt-1">Hash-chained, tamper-evident record of every state-changing action.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" leadingIcon="ShieldCheck">Verify chain</Button>
          <Button variant="secondary" leadingIcon="Download">Export</Button>
        </div>
      </div>
      <Card padding="p-3" className="flex items-center gap-2 flex-wrap">
        <div className="text-[11px] uppercase tracking-wider text-saf-muted ltr:mr-2 rtl:ml-2">Filters</div>
        <select value={actor} onChange={(e) => setActor(e.target.value)} className="h-8 px-2 rounded-lg border border-saf-border bg-white text-[13px]">
          <option value="all">All actors</option>
          {Array.from(new Set(AUDIT_ROWS.map(r => r.actor))).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="h-8 px-2 rounded-lg border border-saf-border bg-white text-[13px]">
          <option value="all">All actions</option>
          <option value="draft">Drafts</option>
          <option value="post">Posts</option>
          <option value="inbox">Inbox</option>
          <option value="review">Reviews</option>
          <option value="user">Users</option>
          <option value="brand">Brand</option>
          <option value="connector">Connector</option>
        </select>
        <span className="text-[11px] text-saf-muted ltr:ml-auto rtl:mr-auto">Showing {filtered.length} of {AUDIT_ROWS.length}</span>
      </Card>
      <Card padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-saf-muted">
                <th className="text-start font-medium px-5 py-3">Time</th>
                <th className="text-start font-medium px-3 py-3">Actor</th>
                <th className="text-start font-medium px-3 py-3">Action</th>
                <th className="text-start font-medium px-3 py-3">Entity</th>
                <th className="text-start font-medium px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-saf-border hover:bg-saf-light/40 transition">
                  <td className="px-5 py-3 text-saf-muted tabular-nums font-mono text-[12px]">{r.t}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {r.actor === 'system' ? (
                        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 grid place-items-center"><Icon name="Cpu" size={13} /></span>
                      ) : (
                        <Avatar name={r.actor} size={28} />
                      )}
                      <div>
                        <div className="text-saf-text">{r.actor}</div>
                        <div className="text-[10px] text-saf-muted">{r.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><span className="inline-flex items-center h-6 px-2 rounded font-mono text-[11px] bg-saf-light text-saf-primary">{r.action}</span></td>
                  <td className="px-3 py-3 font-mono text-[11px] text-saf-muted">{r.entity}</td>
                  <td className="px-5 py-3 text-saf-text">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// =============================================================================
// EXPORTS — gating split: Admin can export Audit log; Manager+SrExec
// can export Approvals; Manager+Admin can export SLA compliance.
// =============================================================================
function ExportsPage({ role }) {
  const toast = useToast();
  const cards = [
    { id: 'audit',     title: 'Audit log',        desc: 'Hash-chained export of every state change. CSV/PDF, last 30 days.', icon: 'ShieldCheck', perm: 'exports.audit',     tone: 'bg-rose-50 text-rose-700' },
    { id: 'approvals', title: 'Approvals',        desc: 'Every submit / review / approve / reject decision, with reasons.', icon: 'CheckCircle2', perm: 'exports.approvals', tone: 'bg-emerald-50 text-emerald-700' },
    { id: 'sla',       title: 'SLA compliance',   desc: 'Reply-time compliance per channel + breached conversations.',      icon: 'Clock',       perm: 'exports.sla',       tone: 'bg-amber-50 text-amber-700' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">Exports</h1>
        <p className="text-sm text-saf-muted mt-1">Download data the way your team needs it. Each export is scoped by role.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(c => {
          const allowed = hasPerm(role, c.perm);
          return (
            <Card key={c.id} padding="p-5">
              <span className={`w-10 h-10 rounded-xl grid place-items-center ${c.tone}`}><Icon name={c.icon} size={18} /></span>
              <div className="mt-3 text-[15px] font-semibold text-saf-text">{c.title}</div>
              <p className="text-[12px] text-saf-muted mt-1 min-h-[42px]">{c.desc}</p>
              <div className="mt-4 flex items-center gap-2">
                {allowed ? (
                  <>
                    <Button size="sm" variant="primary"   leadingIcon="Download" onClick={() => toast.push({ title: `${c.title} CSV downloaded` })}>CSV</Button>
                    <Button size="sm" variant="secondary" leadingIcon="FileText" onClick={() => toast.push({ title: `${c.title} PDF downloaded` })}>PDF</Button>
                  </>
                ) : (
                  <Tooltip label={`Restricted: this export is scoped to a different role.`} side="top">
                    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] bg-saf-surface text-saf-muted border border-saf-border opacity-70 cursor-not-allowed" aria-disabled="true">
                      <Icon name="Lock" size={13} />Not available for your role
                    </span>
                  </Tooltip>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// INTERNAL MESSAGES (Team) — light stub for internal team chat
// =============================================================================
function TeamPage() {
  const channels = [
    { id: 'c-mkt',  name: '# marketing',         unread: 3,  members: 12 },
    { id: 'c-ops',  name: '# social-ops',        unread: 0,  members: 8 },
    { id: 'c-app',  name: '# app-launch-q3',     unread: 7,  members: 21 },
    { id: 'c-eid',  name: '# eid-campaign',      unread: 0,  members: 6 },
    { id: 'c-pr',   name: '# pr-and-comms',      unread: 1,  members: 9 },
  ];
  const sample = [
    { who: 'Rohit Malhotra', t: '09:42', text: 'Diwali menu copy is ready for review — the price needs Vikram to confirm before it goes out.' },
    { who: 'Priya Menon',    t: '09:44', text: 'On it. Pulling up the brand voice doc.', me: true },
    { who: 'Ananya Rao',     t: '09:51', text: 'Posting Monday 09:00 IST. Should the terrace reopening go before or after?' },
  ];
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <Card padding="p-0" className="w-64 flex flex-col">
        <div className="px-4 h-12 flex items-center justify-between border-b border-saf-border">
          <div className="text-[14px] font-medium text-saf-text">Channels</div>
          <button className="w-7 h-7 rounded-md text-saf-muted hover:bg-saf-light grid place-items-center" aria-label="New channel"><Icon name="Plus" size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll">
          {channels.map((c, i) => (
            <button key={c.id} className={`w-full text-start flex items-center gap-2 ps-4 pe-3 h-10 border-l-2 transition ${i === 0 ? 'bg-saf-light/60 border-saf-primary text-saf-text' : 'border-transparent text-saf-text hover:bg-saf-light/40'}`}>
              <span className="flex-1 text-[13px] truncate">{c.name}</span>
              {c.unread > 0 && <span className="px-1.5 h-5 grid place-items-center text-[10px] rounded-full bg-saf-danger text-white font-medium">{c.unread}</span>}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-saf-border text-[11px] text-saf-muted">Direct messages · 4 people</div>
      </Card>
      <Card padding="p-0" className="flex-1 flex flex-col min-w-0">
        <div className="px-5 h-14 flex items-center gap-3 border-b border-saf-border">
          <Icon name="Hash" size={18} className="text-saf-muted" />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium text-saf-text">marketing</div>
            <div className="text-[11px] text-saf-muted">12 members · Internal team channel</div>
          </div>
          <Button size="sm" variant="ghost" leadingIcon="Users">Members</Button>
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll p-5 space-y-4">
          {sample.map((m, i) => (
            <div key={i} className="flex gap-3">
              <Avatar name={m.who} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-saf-text">{m.who}</span>
                  {m.me && <Pill tone="blue">You</Pill>}
                  <span className="text-[11px] text-saf-muted">{m.t}</span>
                </div>
                <div className="text-[14px] text-saf-text mt-0.5">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-saf-border">
          <div className="flex items-center gap-2 bg-saf-surface border border-saf-border rounded-lg h-11 px-3 focus-within:border-saf-primary focus-within:ring-4 focus-within:ring-saf-primary/10 transition">
            <Icon name="Plus" size={16} className="text-saf-muted" />
            <input placeholder="Message #marketing — use @name to mention" className="flex-1 bg-transparent text-[13px]" />
            <button className="w-8 h-8 rounded-md text-saf-muted hover:bg-saf-light grid place-items-center" aria-label="Send"><Icon name="Send" size={14} /></button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// SOCIAL LISTENING was previously stubbed here. It now lives as a real
// feature in src/page-listening.jsx (window.ListeningPage). Nothing else
// in this file should reference it.

// =============================================================================
// NOTIFICATIONS CENTER — light stub
// =============================================================================
function NotificationsCenterPage() {
  const [filter, setFilter] = React.useState('all');
  const rows = [
    { id: 'r-1', kind: 'admin',    icon: 'Megaphone',     tone: 'bg-rose-50 text-rose-700 border-rose-200',   title: 'Owner announcement: Diwali service plan', desc: 'One seating a night from 18 Oct. All leave requests through Vikram.', t: 'just now', isAdmin: true },
    { id: 'r-2', kind: 'approval', icon: 'CheckCircle2',  tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: 'Diwali menu post approved', desc: 'Now scheduled for 9 Sep · 11:00 IST', t: '8m' },
    { id: 'r-3', kind: 'inbox',    icon: 'MessageSquare', tone: 'bg-saf-light text-saf-primary border-saf-light',    title: 'New WhatsApp message from Rahul Khanna', desc: 'Anniversary booking, Saturday (BKG-2026-08421)', t: '14m' },
    { id: 'r-4', kind: 'channel',  icon: 'AlertTriangle', tone: 'bg-amber-50 text-amber-700 border-amber-200',       title: 'Instagram token expired',             desc: 'Reconnect to resume publishing', t: '32m' },
    { id: 'r-5', kind: 'mention',  icon: 'AtSign',        tone: 'bg-saf-accent/15 text-saf-accent border-saf-accent/30', title: 'You were mentioned in #marketing', desc: 'Rohit Malhotra: @priya — can you check the Diwali pricing?', t: '1h' },
    { id: 'r-6', kind: 'approval', icon: 'Undo2',         tone: 'bg-rose-50 text-rose-700 border-rose-200',          title: 'Draft sent back: free-dessert weekend', desc: 'Priya Menon: kitchen has not signed off on covering this.', t: '3h' },
  ];
  const filtered = filter === 'all' ? rows : rows.filter(r => r.kind === filter);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Notifications</h1>
          <p className="text-sm text-saf-muted mt-1">Everything happening across your channels, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leadingIcon="CheckCheck">Mark all read</Button>
          <Button variant="secondary" size="sm" leadingIcon="Settings">Preferences</Button>
        </div>
      </div>
      <Card padding="p-3" className="flex items-center gap-2 flex-wrap">
        {['all', 'admin', 'approval', 'inbox', 'channel', 'mention'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`h-8 px-3 rounded-full text-[12px] font-medium capitalize transition ${filter === f ? 'bg-saf-primary text-white' : 'bg-white border border-saf-border text-saf-muted hover:text-saf-text'}`}>{f}</button>
        ))}
      </Card>
      <Card padding="p-0">
        <div className="divide-y divide-saf-border">
          {filtered.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-4 transition ${n.isAdmin ? 'bg-rose-50/40 border-s-4 border-rose-500' : ''}`}>
              <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 border ${n.tone}`}>
                <Icon name={n.icon} size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.isAdmin && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 h-4 grid place-items-center rounded bg-rose-500 text-white">Admin</span>
                  )}
                  <span className="text-[13px] font-medium text-saf-text">{n.title}</span>
                </div>
                <div className="text-[12px] text-saf-muted mt-0.5">{n.desc}</div>
              </div>
              <span className="text-[11px] text-saf-muted shrink-0">{n.t}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.TeamPage = TeamPage;
// ListeningPage is exported from src/page-listening.jsx; the stub here
// was removed in the Commit 1 listening rebuild.
window.NotificationsCenterPage = NotificationsCenterPage;
