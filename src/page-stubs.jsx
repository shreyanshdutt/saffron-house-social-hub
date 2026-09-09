// New light-stub screens — Channel Health, Brand Kit, Users, Audit,
// Exports. Each is a single-route screen with real layout + mock data,
// gated by role at the menu level. In-screen actions that the spec
// reserves for one role are disabled-with-tooltip for everyone else.

// =============================================================================
// CHANNEL HEALTH — Admin only
// =============================================================================
// A channel's HEALTH is not the same vocabulary as its CONNECTION STATUS, and
// forcing one into the other is what produced the screen this replaces.
//
// The old array hardcoded `state: 'down'` and `incidents24h: 1` for Instagram.
// Nothing was down and no incident occurred — there is no incident history in
// the database at all. The three tones it offered (ok / degraded / down)
// cannot express the four states the data actually has, so the mapping below
// is explicit rather than implied:
//
//   connected        -> Healthy.       Working.
//   expired          -> Needs sign-in. NOT "down": nothing broke, our
//                       credential lapsed, and we fix it by signing in again.
//   revoked          -> Access removed. Also not "down", and NOT the same as
//                       expired: the provider withdrew it, so reconnecting may
//                       not be ours to do.
//   never_connected  -> Not set up.    NOT A HEALTH STATE AT ALL. A channel
//                       nobody connected cannot be unhealthy, and counting it
//                       as "down" would invent an outage. It is excluded from
//                       the health counts entirely.
const CONNECTION_HEALTH = {
  connected:       { label: 'Healthy',        tone: 'green', dot: 'bg-emerald-500', counts: 'healthy' },
  expired:         { label: 'Needs sign-in',  tone: 'amber', dot: 'bg-amber-500',   counts: 'attention' },
  revoked:         { label: 'Access removed', tone: 'red',   dot: 'bg-rose-500',    counts: 'attention' },
  never_connected: { label: 'Not set up',     tone: 'grey',  dot: 'bg-saf-border',  counts: 'unset' },
};

// Owner decision carried over from c0e54f1: no connect/reconnect control is
// clickable until real OAuth exists, and the reason is stated rather than left
// as a greyed button the user has to guess about.
const RECHECK_DISABLED_REASON =
  'Re-checking a channel means signing in to it, and this app has not been registered ' +
  'with the platforms yet. Your developer does that once, per channel.';

function ChannelHealthPage() {
  return (
    <RequiresServerData what="channel health">
      {(data) => <ChannelHealthInner connections={data.connections} />}
    </RequiresServerData>
  );
}

function ChannelHealthInner({ connections }) {
  const bucket = (c) => (CONNECTION_HEALTH[c.status] || CONNECTION_HEALTH.never_connected).counts;
  const healthy   = connections.filter(c => bucket(c) === 'healthy').length;
  const attention = connections.filter(c => bucket(c) === 'attention').length;
  const unset     = connections.filter(c => bucket(c) === 'unset').length;

  // The only problem signal the database actually holds. `last_error` is a
  // stored field on a connection — it is the CURRENT state, not a history of
  // events, and the panel below says so rather than calling it an incident log.
  const problems = connections.filter(c => c.lastError);
  const anySample = connections.some(c => c.isSample);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">Channel Health</h1>
        <p className="text-sm text-saf-muted mt-1">Connection state across every channel this restaurant can link.</p>
      </div>

      {anySample && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Icon name="AlertTriangle" size={15} className="text-amber-700 mt-px shrink-0" />
          <p className="text-[12.5px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Sample data.</span> No channel is really connected — these
            rows are seeded. Nothing here reflects a live account, and no sync time on this screen
            came from a platform.
          </p>
        </div>
      )}

      {/* Three counts, each derived from a status the database holds. There is
          no "Incidents (24h)" figure any more: nothing records incidents, so
          the number had no source and was invented. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthKpi label="Healthy"        value={healthy}   icon="CheckCircle2"  tone="bg-emerald-50 text-emerald-700" />
        <HealthKpi label="Needs attention" value={attention} icon="AlertTriangle" tone="bg-amber-50 text-amber-700" />
        <HealthKpi label="Not set up"     value={unset}     icon="Circle"        tone="bg-saf-light text-saf-muted" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card padding="p-0" className="col-span-12 xl:col-span-7">
          <div className="px-5 h-12 border-b border-saf-border flex items-center justify-between">
            <div className="text-[14px] font-medium text-saf-text">Channels</div>
            <Tooltip label={RECHECK_DISABLED_REASON} side="left">
              <span><Button size="sm" variant="ghost" leadingIcon="RefreshCw" disabled>Re-check all</Button></span>
            </Tooltip>
          </div>
          <div className="divide-y divide-saf-border">
            {connections.map(c => {
              const id = CONNECTION_PLATFORM_ID[c.platform];
              const p = id ? PLATFORM_BY_ID[id] : null;
              const h = CONNECTION_HEALTH[c.status] || CONNECTION_HEALTH.never_connected;
              const never = c.status === 'never_connected';
              return (
                <div key={c.platform} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: p ? p.color : '#7A6A5F' }}>
                    {id ? <PlatformGlyph id={id} size={18} /> : <Icon name="HelpCircle" size={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-saf-text">{p ? p.name : c.platform}</div>
                    {/* No follower count here. That was invented too, and a
                        connection record does not carry one. */}
                    <div className="text-[12px] text-saf-muted truncate">
                      {never
                        ? 'Never connected — nothing has been fetched from this channel'
                        : <>{c.accountRef}{c.lastSyncedAt ? <> · synced {relTime(c.lastSyncedAt)}</> : <> · never synced</>}</>}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <span className={`inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] font-medium border ${
                      h.tone === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : h.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : h.tone === 'red' ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-saf-surface text-saf-muted border-saf-border'}`}>
                      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${h.dot}`} />
                      {h.label}
                    </span>
                  </div>
                  <Tooltip label={RECHECK_DISABLED_REASON} side="left">
                    <span><Button variant="ghost" size="sm" leadingIcon={never ? 'Plus' : 'RefreshCw'} disabled>
                      {never ? 'Set up' : 'Re-check'}
                    </Button></span>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="p-0" className="col-span-12 xl:col-span-5">
          <div className="px-5 h-12 border-b border-saf-border flex items-center justify-between">
            <div className="text-[14px] font-medium text-saf-text">Current problems</div>
            <span className="text-[11px] text-saf-muted">Now, not a history</span>
          </div>
          {/* This panel used to list four incidents with timestamps — an
              expired token that failed a post, a late sync, a webhook drop, an
              outage. None of them happened. There is no incident table and this
              commit does not add one, so the panel shows the one problem signal
              the database DOES hold: the current `last_error` on a connection. */}
          {problems.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[13px] text-saf-text">No channel is reporting a problem</div>
              <p className="text-[12px] text-saf-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
                This is the current state of each connection, not a log. Incident history is not
                recorded yet, so nothing here can tell you what happened last week.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-saf-border">
                {problems.map(c => {
                  const id = CONNECTION_PLATFORM_ID[c.platform];
                  const p = id ? PLATFORM_BY_ID[id] : null;
                  const h = CONNECTION_HEALTH[c.status] || CONNECTION_HEALTH.never_connected;
                  return (
                    <div key={c.platform} className="flex items-start gap-3 px-5 py-3">
                      <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${h.dot}`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-saf-text">{c.lastError}</div>
                        <div className="text-[11px] text-saf-muted mt-0.5">{p ? p.name : c.platform} · {h.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="px-5 py-3 text-[11.5px] text-saf-muted border-t border-saf-border leading-relaxed">
                Current state only. Incident history is not recorded, so this cannot tell you how
                long a problem has been running or whether it has happened before.
              </p>
            </>
          )}
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
// THREE SCREENS IN THIS FILE CANNOT ACT, AND THEY CANNOT ACT FOR THREE
// DIFFERENT REASONS. One sentence pasted three times would be a lie by
// flattening: it would tell someone the same thing is missing in all three
// places, and each is fixed by different work. Same ruling and voice as
// c0e54f1 / 760ec7b / 0d65504 / f93a72b; different content.

const NO_BRAND_STORE_REASON =
  'Uploading, deleting and adding are switched off. There is nowhere to keep a brand asset, ' +
  'a colour token or a copy block — nothing stores them — so anything you added would be gone ' +
  'the moment you left the page, and anything you deleted would come back. The kit below is ' +
  'the current brand and is safe to read, copy and hand to whoever is writing. It is still ' +
  'being built.';
const NO_BRAND_STORE_TIP = 'Off: there is nowhere to store a brand asset yet.';

const NO_DIRECTORY_REASON =
  'Inviting people and changing roles are switched off. There is no user directory to write ' +
  'to and no mail path out of this app, so nobody would be created and no invitation would ' +
  'be emailed — and somebody could be left waiting for a message that was never sent. The ' +
  'team and roles below are the demo\u2019s, and reading them is honest. It is still being built.';
const NO_DIRECTORY_TIP = 'Off: there is no user directory to write to yet.';

// The clause about downloads elsewhere is LOAD-BEARING and is checked, not
// assumed: `downloadCsv` at csv-util.jsx:30 builds a real Blob and a real
// object URL, and it is genuinely called at page-reviews.jsx:209,
// page-recommendations.jsx:114 (the Actions screen) and
// page-listening-signals.jsx:172 and :182. Because pressing Download really
// does produce a file everywhere else, a user who presses it here and gets
// nothing will reasonably conclude the product is BROKEN. Saying which it is
// costs one sentence.
const NO_EXPORT_BUILDER_REASON =
  'These three exports are switched off: the report builders behind them have not been ' +
  'written, so pressing CSV or PDF would produce no file. Downloads elsewhere in the product ' +
  'are real — Reviews, Actions and Social Listening each build a file and really download it ' +
  '— so this is unbuilt rather than broken. It is still being built.';
const NO_EXPORT_BUILDER_TIP = 'Off: this report builder has not been written yet.';

function BrandKitPage() {
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
          <p className="text-sm text-saf-muted mt-1">Logos, colours and approved copy for whoever writes a post.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon="Download">Export pack</Button>
          <Tooltip label={NO_BRAND_STORE_TIP} side="top">
            <span><Button variant="primary" leadingIcon="Upload" disabled>Upload asset</Button></span>
          </Tooltip>
        </div>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">{NO_BRAND_STORE_REASON}</p>
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
                  <Tooltip label={NO_BRAND_STORE_TIP} side="top">
                    <button className="w-8 h-8 rounded-lg text-saf-muted grid place-items-center opacity-50 cursor-not-allowed" aria-label="Delete" disabled><Icon name="Trash2" size={14} /></button>
                  </Tooltip>
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
            <Tooltip label={NO_BRAND_STORE_TIP} side="top">
              <span><Button size="sm" variant="primary" leadingIcon="Plus" disabled>Add token</Button></span>
            </Tooltip>
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
            <Tooltip label={NO_BRAND_STORE_TIP} side="top">
              <span><Button size="sm" variant="primary" leadingIcon="Plus" disabled>Add copy block</Button></span>
            </Tooltip>
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
  const canManage = hasPerm(role, 'user.manage');
  const canAssignRole = hasPerm(role, 'role.manage');

  // Always the disabled form. `enabled` stays because the permission gate is
  // real and demoable; it now only chooses whether the role sentence is
  // appended. Build reason first — being granted `user.manage` would still
  // create nobody — the precedence channels.js and 8ce1c20 already use.
  function GatedButton({ enabled, label, leadingIcon, variant = 'primary', permissionReason }) {
    return (
      <Tooltip label={enabled ? NO_DIRECTORY_TIP : `${NO_DIRECTORY_TIP} ${permissionReason}`} side="top">
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
            permissionReason="Inviting users requires the Admin role"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">{NO_DIRECTORY_REASON}</p>
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
                      {/* No longer a ternary: neither branch could act, so both
                          collapse to the disabled form and `canAssignRole` only
                          decides whether the role sentence is appended. */}
                      <Tooltip label={canAssignRole ? NO_DIRECTORY_TIP : `${NO_DIRECTORY_TIP} Assigning roles requires the Admin role`} side="top">
                        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] opacity-60 cursor-not-allowed text-saf-muted" aria-disabled="true">
                          <Icon name="Shield" size={14} />Assign role
                        </span>
                      </Tooltip>
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
  { id: 'a-1', t: '09:42:11', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'post.publish',  entity: 'post:p2',        detail: 'Published the galouti reel to Instagram' },
  { id: 'a-2', t: '09:38:04', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'inbox.unmask',  entity: 'message:c3',     detail: 'Unmasked phone on the WhatsApp booking-wait complaint from Arjun Mehta' },
  { id: 'a-3', t: '09:30:55', actor: 'Rohit Malhotra', role: 'Guest Relations Lead',action: 'review.reply',  entity: 'review:rv-3',    detail: 'Replied to a 5★ Google review from Meenakshi Reddy' },
  { id: 'a-4', t: '09:12:31', actor: 'Ananya Rao',     role: 'Social Coordinator',  action: 'draft.submit',  entity: 'draft:a-rev-1',  detail: 'Submitted the Diwali menu announcement for review' },
  { id: 'a-5', t: '08:58:17', actor: 'Vikram Suri',    role: 'Owner',               action: 'user.invite',   entity: 'user:u-5',       detail: 'Invited farhan@saffronhouse.in as Social Coordinator' },
  { id: 'a-6', t: '08:21:02', actor: 'Priya Menon',    role: 'Marketing Manager',   action: 'review.comp',   entity: 'review:rv-2',    detail: 'Issued a ₹1,000 credit with the reply to a 2★ Google review' },
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
      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">{NO_EXPORT_BUILDER_REASON}</p>
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
                    <Tooltip label={NO_EXPORT_BUILDER_TIP} side="top">
                      <span><Button size="sm" variant="primary" leadingIcon="Download" disabled>CSV</Button></span>
                    </Tooltip>
                    <Tooltip label={NO_EXPORT_BUILDER_TIP} side="top">
                      <span><Button size="sm" variant="secondary" leadingIcon="FileText" disabled>PDF</Button></span>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip label={`${NO_EXPORT_BUILDER_TIP} It is also scoped to a different role.`} side="top">
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
