// Settings page.

function SettingsPage() {
  const t = useT();
  const [tab, setTab] = React.useState('accounts');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">{t.settings.title}</h1>
        <p className="text-sm text-saf-muted mt-1">{t.settings.subtitle}</p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'accounts', label: t.settings.accounts },
          { id: 'team',     label: t.settings.team },
          { id: 'brand',    label: t.settings.brand },
          { id: 'notifs',   label: t.settings.notifs },
        ]}
      />

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'team'     && <TeamTab />}
      {tab === 'brand'    && <BrandTab />}
      {tab === 'notifs'   && <NotifsTab />}
    </div>
  );
}

// Our own channel connections, served from the `connections` table.
//
// This tab used to hardcode three accounts — "@saffronhouse · 218K followers ·
// synced 48 min ago" and a red "Token expired" pill — with no token, no expiry
// and no connection record anywhere in the system. Every figure was invented,
// and it survived every audit because nobody opened Settings. The array is
// deleted; what follows renders whatever the server actually holds.
function AccountsTab() {
  return (
    <RequiresServerData what="your channel connections">
      {(data) => <AccountsTabInner connections={data.connections} />}
    </RequiresServerData>
  );
}

// Which channel a connection row belongs to. The `connections` table names
// channels in full (`google_business`) because it describes what WE connect
// to; PLATFORMS uses two-letter client ids. This is the join, and it is a
// lookup rather than string surgery so an unmapped value shows up as a gap
// instead of silently producing a wrong glyph.
const CONNECTION_PLATFORM_ID = {
  instagram: 'ig',
  google_business: 'gg',
  whatsapp: 'wa',
  x: 'x',
  youtube: 'yt',
};

// Every state gets its own words. `never_connected` and `expired` are the two
// that used to be one red pill, and they are different problems: one is "set
// this up", the other is "sign in again".
const CONNECTION_STATE = {
  connected:       { tone: 'green', icon: 'CheckCircle2', label: 'Connected' },
  expired:         { tone: 'amber', icon: 'AlertTriangle', label: 'Sign-in expired' },
  revoked:         { tone: 'red',   icon: 'Ban',           label: 'Access withdrawn' },
  never_connected: { tone: 'grey',  icon: 'Circle',        label: 'Not connected' },
};

// Why every button on this tab is disabled. Written for a restaurant manager:
// it says what is missing and who fixes it, not which environment variable is
// unset.
const NO_CREDENTIALS_REASON =
  'Connecting a channel needs this app to be registered with Instagram, Google, ' +
  'WhatsApp, X or YouTube first. That has not been set up yet, so there is nothing ' +
  'to sign in to. Your developer does this once, per channel.';

function AccountsTabInner({ connections }) {
  const anySample = connections.some(c => c.isSample);
  return (
    <div className="space-y-3">
      {/* Same amber marker the Establishments and Competitors screens use for
          invented data, rather than a fourth way of saying it. */}
      {anySample && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Icon name="AlertTriangle" size={15} className="text-amber-700 mt-px shrink-0" />
          <p className="text-[12.5px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Sample data.</span> No channel is really connected —
            these rows are seeded so the screen has something to show. Nothing here reflects a live
            account, and no figure on this tab came from a platform.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {connections.map(c => <ConnectionCard key={c.platform} c={c} />)}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">{NO_CREDENTIALS_REASON}</p>
      </div>
    </div>
  );
}

function ConnectionCard({ c }) {
  const id = CONNECTION_PLATFORM_ID[c.platform];
  const p = id ? PLATFORM_BY_ID[id] : null;
  const state = CONNECTION_STATE[c.status] || CONNECTION_STATE.never_connected;
  const never = c.status === 'never_connected';

  return (
    <Card padding="p-4" className="flex items-start gap-3">
      <span
        className="w-12 h-12 rounded-xl grid place-items-center text-white shrink-0"
        style={{ background: p ? p.color : '#7A6A5F' }}
      >
        {id ? <PlatformGlyph id={id} size={20} /> : <Icon name="HelpCircle" size={20} />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-saf-text">{p ? p.name : c.platform}</span>
          <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10.5px] font-semibold border ${
            state.tone === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : state.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
            : state.tone === 'red' ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-saf-surface text-saf-muted border-saf-border'}`}>
            <Icon name={state.icon} size={10} />
            {state.label}
          </span>
        </div>

        {/* A never-connected channel has no account, no sync time and no
            expiry. It says that, rather than rendering blanks that read as
            zero (CLAUDE.md §11 trap 1). */}
        <div className="text-[12px] text-saf-muted mt-1 leading-relaxed">
          {never ? (
            <>No account linked yet. Nothing has been fetched from this channel.</>
          ) : (
            <>
              <span className="text-saf-text">{c.accountRef}</span>
              {c.accountLabel ? <span className="text-saf-muted"> · {c.accountLabel}</span> : null}
              <br />
              {c.lastSyncedAt
                ? <>Last synced {relTime(c.lastSyncedAt)}</>
                : <>Connected, but nothing has synced yet</>}
              {c.expiresAt && (
                <> · {Date.parse(c.expiresAt) < Date.now()
                  ? <span className="text-amber-700">sign-in expired {relTime(c.expiresAt)}</span>
                  : <>sign-in valid until {fmtTime(c.expiresAt, { withDate: true })}</>}</>
              )}
            </>
          )}
        </div>

        {c.lastError && (
          <p className="text-[11.5px] text-amber-700 mt-1.5 leading-relaxed">{c.lastError}</p>
        )}
      </div>

      {/* DISABLED, WITH THE REASON ON HOVER AND IN THE PANEL BELOW. A greyed
          control the user has to guess about is the same lie in a quieter
          voice, so the tooltip carries the same sentence the footer does. */}
      <Tooltip label={NO_CREDENTIALS_REASON} side="left">
        <span className="shrink-0">
          <Button variant={never ? 'secondary' : 'primary'} size="sm" disabled>
            {never ? 'Connect' : 'Reconnect'}
          </Button>
        </span>
      </Tooltip>
    </Card>
  );
}

function TeamTab() {
  const team = [
    { name: 'Priya Menon', role: 'Marketing Manager', email: 'priya@saffronhouse.in' },
    { name: 'Ananya Rao', role: 'Social Coordinator', email: 'ananya@saffronhouse.in' },
    { name: 'Lina Habsi',       role: 'Community Manager', email: 'lina.habsi@saffronhouse.in' },
    { name: 'Farhan Qureshi',   role: 'Floor Manager', email: 'farhan@saffronhouse.in' },
  ];
  return (
    <Card padding="p-0">
      <div className="flex items-center justify-between p-4 border-b border-saf-border">
        <div className="text-[15px] font-semibold text-saf-text">Team members</div>
        <Button variant="primary" size="sm" leadingIcon="UserPlus">Invite member</Button>
      </div>
      <div className="divide-y divide-saf-border">
        {team.map(m => (
          <div key={m.email} className="flex items-center gap-3 p-4">
            <Avatar name={m.name} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-saf-text">{m.name}</div>
              <div className="text-[12px] text-saf-muted">{m.email}</div>
            </div>
            <Pill tone="blue">{m.role}</Pill>
            <button className="w-8 h-8 rounded-lg text-saf-muted hover:bg-saf-light hover:text-saf-text grid place-items-center"><Icon name="MoreVertical" size={16} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BrandTab() {
  const [voice, setVoice] = React.useState(
    'Write like a host, not a marketer. Name the dish, name the person, say what actually happens in the kitchen. '
    + 'Never use empty superlatives ("best in Delhi", "culinary journey") and never claim an award we have not won. '
    + 'Prices in rupees, always inclusive of taxes. For complaints: acknowledge plainly, give a concrete next step, '
    + 'and never promise a refund or comp — that is the Marketing Manager\'s call. We are open 12pm–11:30pm, seven days, Sector 10 Market, Dwarka.'
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card padding="p-5" className="md:col-span-2">
        <h3 className="text-[15px] font-semibold text-saf-text">Brand voice guidelines</h3>
        <p className="text-[12px] text-saf-muted mt-1">A written reference for whoever drafts a post. Nothing reads it automatically.</p>
        <textarea
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="mt-3 w-full min-h-[140px] p-3 rounded-lg border border-saf-border text-[13px] focus:border-saf-primary focus:ring-4 focus:ring-saf-primary/10 transition"
        />
        <div className="flex justify-end mt-3">
          <Button variant="primary" size="sm">Save changes</Button>
        </div>
      </Card>
      <Card padding="p-5">
        <h3 className="text-[15px] font-semibold text-saf-text">Brand palette</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['#B4451F','#6E2412','#D99A16','#2E7D4F','#B7791F','#C0342B'].map(c => (
            <div key={c} className="text-center">
              <div className="aspect-square rounded-lg" style={{ background: c }} />
              <div className="text-[10px] text-saf-muted mt-1 tabular-nums">{c}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NotifsTab() {
  const [s, setS] = React.useState({ email: true, push: true, daily: true, mentions: true, sched: false, failed: true });
  const toggle = (k) => setS(prev => ({ ...prev, [k]: !prev[k] }));
  return (
    <Card padding="p-0">
      <div className="divide-y divide-saf-border">
        {[
          { k: 'email',    label: 'Email notifications',         sub: 'Daily summary at 9am to your work email.' },
          { k: 'push',     label: 'Browser push',                 sub: 'New messages and mentions appear instantly.' },
          { k: 'daily',    label: 'Daily digest',                 sub: 'A 9am roundup of activity across channels.' },
          { k: 'mentions', label: 'Mentions and tags',            sub: 'Notify me when Saffron House is tagged anywhere.' },
          { k: 'sched',    label: 'Scheduled post reminders',     sub: 'Remind me 30 minutes before a scheduled post.' },
          { k: 'failed',   label: 'Failed publishing alerts',     sub: 'Critical — always notify on errors.' },
        ].map(row => (
          <div key={row.k} className="p-4">
            <Switch checked={s[row.k]} onChange={() => toggle(row.k)} label={row.label} sub={row.sub} />
          </div>
        ))}
      </div>
    </Card>
  );
}

Object.assign(window, { SettingsPage });
