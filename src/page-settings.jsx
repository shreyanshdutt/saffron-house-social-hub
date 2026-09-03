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

function AccountsTab() {
  const t = useT();
  const accounts = [
    { id: 'ig', handle: '@saffronhouse',            followers: '218K', status: 'expired',   last: '48 min ago' },
    { id: 'gg', handle: 'Saffron House · Sector 10 Dwarka', followers: '1.3K reviews', status: 'connected', last: 'just now' },
    { id: 'wa', handle: '+91 11 4160 2200',         followers: '6.4K contacts', status: 'connected', last: '1 min ago' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {accounts.map(a => {
        const p = PLATFORM_BY_ID[a.id];
        return (
          <Card padding="p-4" key={a.id} className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl grid place-items-center text-white shrink-0" style={{ background: p.color }}>
              <PlatformGlyph id={a.id} size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-saf-text">{p.name}</span>
                {a.status === 'connected'
                  ? <Pill tone="green"><Icon name="CheckCircle2" size={11} />{t.settings.connected}</Pill>
                  : <Pill tone="red"><Icon name="AlertTriangle" size={11} />Token expired</Pill>
                }
              </div>
              <div className="text-[12px] text-saf-muted mt-0.5">{a.handle} · {a.followers} followers · synced {a.last}</div>
            </div>
            {a.status === 'connected'
              ? <Button variant="ghost" size="sm">{t.settings.disconnect}</Button>
              : <Button variant="primary" size="sm">{t.settings.reconnect}</Button>
            }
          </Card>
        );
      })}
    </div>
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
        <p className="text-[12px] text-saf-muted mt-1">These instructions are passed to the AI assistant.</p>
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
