// Data & Access — the screen you hand the business owner.
//
// Two jobs:
//
//   1. Prove the product is honest. Every screen in this hub is backed by a
//      real endpoint, and this lists them field by field. If something cannot
//      be fetched, it is not in the product — and the "not obtainable" section
//      at the bottom says out loud what we deliberately do not show, so nobody
//      promises it in a meeting.
//
//   2. Tell you exactly what to ask for. Getting API access is not one
//      conversation: Instagram needs a Business account linked to a Facebook
//      Page plus app review, Google needs an allowlisting request that takes
//      time, WhatsApp needs a verified business and a phone number that is not
//      already on the consumer app. Each one has a different owner, a
//      different waiting period, and a different failure mode. They are listed
//      here in the order you should start them.
//
// Owner-only: this is a procurement and setup document, not a daily screen.

const ACCESS_STEPS = [
  {
    id: 'ig',
    channel: 'ig',
    api: 'Instagram Graph API',
    provider: 'Meta',
    lead: 'Days to a few weeks',
    owner: 'Business owner + whoever administers the Facebook Page',
    prereqs: [
      'The Instagram account must be a Business or Creator account, not personal',
      'It must be linked to a Facebook Page the owner controls',
      'A Meta developer app, with the business verified',
    ],
    scopes: [
      'instagram_basic',
      'instagram_manage_insights',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    unlocks: ['Posts + scheduling', 'Post metrics', 'Comments', 'DMs', 'Mentions', 'Audience', 'Competitor public data'],
    risk: 'App Review is required for the messaging and comment permissions before you can use them on an account you do not own. Budget for a review cycle and a rejection.',
  },
  {
    id: 'gg',
    channel: 'gg',
    api: 'Google Business Profile API',
    provider: 'Google',
    lead: 'Weeks — start this one first',
    owner: 'Business owner (must be a verified owner or manager of the listing)',
    prereqs: [
      'The listing must be claimed and verified by the business',
      'A Google Cloud project',
      'An access request submitted to Google for the Business Profile APIs',
    ],
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    unlocks: ['Reviews + replies', 'Q&A', 'Google posts', 'Performance metrics'],
    risk: 'The Business Profile APIs are not self-serve — you submit a request form and wait for allowlisting. This is the single longest pole in the build, which is why it goes first.',
  },
  {
    id: 'wa',
    channel: 'wa',
    api: 'WhatsApp Cloud API',
    provider: 'Meta',
    lead: 'Days',
    owner: 'Business owner (needs to control the phone number)',
    prereqs: [
      'A verified Meta Business account',
      'A phone number NOT currently registered on the consumer WhatsApp app',
      'A display name that passes Meta review',
    ],
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    unlocks: ['Guest messages', 'Delivery + read receipts', 'Template broadcasts', 'Conversation metrics'],
    risk: 'Moving the restaurant\'s existing WhatsApp number onto the API means losing the consumer app on that number. Most restaurants use a second line. Templates are billed per message and need prior opt-in.',
  },
];

// Field-level provenance. `status` is the honest verdict:
//   live    — the API returns this directly
//   derived — you compute it from text or numbers the API returns
//   own     — it comes from the restaurant's own systems, not a platform
const FIELD_MAP = [
  { screen: 'Reviews', field: 'Star rating, review text, author, timestamp', source: 'GBP Reviews API', status: 'live' },
  { screen: 'Reviews', field: 'Publishing a public reply',                  source: 'GBP Reviews API', status: 'live' },
  { screen: 'Reviews', field: 'Average rating + total review count',        source: 'GBP location',    status: 'live' },
  { screen: 'Reviews', field: 'Star distribution',                          source: 'Bucketed from pulled reviews', status: 'derived' },
  { screen: 'Reviews', field: 'Sentiment + themes',                         source: 'Your NLP over review text', status: 'derived' },
  { screen: 'Reviews', field: 'SLA clock, response rate, median reply time', source: 'This hub',       status: 'own' },

  { screen: 'Inbox',   field: 'Instagram DMs and comments',                 source: 'IG Messaging API (webhooks)', status: 'live' },
  { screen: 'Inbox',   field: 'WhatsApp messages + receipts',               source: 'WhatsApp Cloud API (webhooks)', status: 'live' },
  { screen: 'Inbox',   field: 'Guest phone number',                         source: 'WhatsApp only — IG and Google do not provide it', status: 'live' },
  { screen: 'Inbox',   field: 'Google questions and answers',               source: 'GBP Q&A API',     status: 'live' },
  { screen: 'Inbox',   field: 'Booking reference',                          source: 'Your booking system, joined on phone', status: 'own' },

  { screen: 'Compose', field: 'Publishing + scheduling to Instagram',       source: 'IG Content Publishing API', status: 'live' },
  { screen: 'Compose', field: 'Publishing Google posts',                    source: 'GBP localPosts',  status: 'live' },

  { screen: 'Analytics', field: 'Reach, views, interactions, saves, follows', source: 'IG insights',   status: 'live' },
  { screen: 'Analytics', field: 'Search + Maps impressions',                source: 'GBP Performance API', status: 'live' },
  { screen: 'Analytics', field: 'Direction requests, calls, website clicks, bookings', source: 'GBP Performance API', status: 'live' },
  { screen: 'Analytics', field: 'Conversations + message counts',           source: 'WhatsApp Cloud API', status: 'live' },
  { screen: 'Analytics', field: 'Audience age / gender / city',             source: 'IG follower demographics (thresholded)', status: 'live' },
  { screen: 'Analytics', field: 'Content-type split',                       source: 'Your own post tagging', status: 'own' },

  { screen: 'Menu Items', field: 'Dish list, category, price',              source: 'Your menu system', status: 'own' },
  { screen: 'Menu Items', field: 'Per-dish mentions + sentiment',           source: 'Your NLP over IG comments and Google reviews', status: 'derived' },

  { screen: 'Listening', field: 'Mentions, tags, story tags',               source: 'IG mentions + webhooks', status: 'live' },
  { screen: 'Listening', field: 'Hashtag activity',                         source: 'IG hashtag search — capped, no history', status: 'live' },
  { screen: 'Listening', field: 'Signal classification + severity',         source: 'Your rules over the above', status: 'derived' },

  { screen: 'Competitors', field: 'Followers, post count, likes + comments', source: 'IG Business Discovery (public)', status: 'live' },
  { screen: 'Competitors', field: 'Their Google rating + review count',      source: 'Google Places API (public)', status: 'live' },
  { screen: 'Competitors', field: 'Engagement rate',                         source: 'Interactions ÷ followers — approximate', status: 'derived' },
];

// What we deliberately do not show. Naming these is the point: it stops
// someone promising them in a pitch, and it explains gaps a viewer may notice.
const NOT_OBTAINABLE = [
  { thing: 'Zomato, Swiggy and District data', why: 'No public API. Merchant data sits in partner dashboards reachable only through paid POS middleware (UrbanPiper, Petpooja, Posist and similar). That is a commercial contract, not an integration task.' },
  { thing: 'Dine-in vs delivery split on a review', why: 'Google reviews carry no order context. There is no field for it and no reliable way to infer it.' },
  { thing: 'Competitor reach, impressions or ad spend', why: 'Private to them. Only public counts — followers, posts, likes, comments, rating — are visible.' },
  { thing: 'Historical hashtag data', why: 'Instagram returns recent media only. Any long-range mention trend requires that you have been collecting since day one, so start collecting before promising trends.' },
  { thing: 'Share of voice as an absolute number', why: 'Only computable within a corpus you can see, against a competitor set you chose. Stating it without the denominator is meaningless.' },
  { thing: 'Linking a guest across channels', why: 'The person who reviewed on Google and messaged on WhatsApp cannot be matched without a shared phone number. Only WhatsApp and your booking system supply one.' },
  { thing: 'Covers, revenue and table turns', why: 'Your POS and booking system hold these. No social API knows whether anyone actually turned up.' },
];

const STATUS_META = {
  live:    { label: 'Live via API', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircle2' },
  derived: { label: 'Derived',      tone: 'bg-saf-light text-saf-primary border-saf-light',    icon: 'Sigma' },
  own:     { label: 'Your systems', tone: 'bg-slate-100 text-saf-muted border-saf-border',     icon: 'Database' },
};

function DataSourcesPage() {
  const { theme } = React.useContext(AppCtx);
  const [screen, setScreen] = React.useState('all');

  const screens = ['all', ...Array.from(new Set(FIELD_MAP.map(f => f.screen)))];
  const rows = screen === 'all' ? FIELD_MAP : FIELD_MAP.filter(f => f.screen === screen);

  const counts = FIELD_MAP.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-saf-text">Data &amp; access</h1>
        <p className="text-sm text-saf-muted mt-1">
          Every field this product shows, and the endpoint that delivers it. Nothing is displayed
          that an API cannot supply — and what cannot be obtained is listed at the bottom so nobody
          promises it by accident.
        </p>
      </div>

      {/* Coverage summary */}
      <div className="grid grid-cols-3 gap-4">
        {['live', 'derived', 'own'].map(k => (
          <Card key={k} padding="p-4">
            <div className="flex items-center gap-2">
              <Icon name={STATUS_META[k].icon} size={15} className="text-saf-muted" />
              <span className="text-[12px] text-saf-muted uppercase tracking-wider">{STATUS_META[k].label}</span>
            </div>
            <div className="text-[28px] font-bold text-saf-text leading-none mt-2 tabular-nums">{counts[k] || 0}</div>
            <div className="text-[11.5px] text-saf-muted mt-1">
              {k === 'live'    && 'Fetched directly from a platform API'}
              {k === 'derived' && 'Computed from data the APIs return'}
              {k === 'own'     && 'From your menu, POS or booking system'}
            </div>
          </Card>
        ))}
      </div>

      {/* Access checklist */}
      <div>
        <h2 className="text-[17px] font-semibold text-saf-text">What to request, in this order</h2>
        <p className="text-[13px] text-saf-muted mt-1 mb-4">
          Google is first because its access request is the one with a queue. The other two can run
          in parallel once the accounts exist.
        </p>
        <div className="space-y-3">
          {ACCESS_STEPS
            .slice()
            .sort((a, b) => (a.id === 'gg' ? -1 : b.id === 'gg' ? 1 : 0))
            .map((step, i) => (
              <AccessCard key={step.id} step={step} index={i + 1} theme={theme} />
            ))}
        </div>
      </div>

      {/* Field map */}
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-[17px] font-semibold text-saf-text">Field map</h2>
            <p className="text-[13px] text-saf-muted mt-1">Every number on every screen, and where it comes from.</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ds-screen" className="sr-only">Filter by screen</label>
            <select
              id="ds-screen"
              value={screen}
              onChange={e => setScreen(e.target.value)}
              className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20 transition"
            >
              {screens.map(sc => <option key={sc} value={sc}>{sc === 'all' ? 'All screens' : sc}</option>)}
            </select>
          </div>
        </div>

        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <caption className="sr-only">Every displayed field mapped to its data source and availability</caption>
              <thead>
                <tr className="bg-saf-surface text-[11px] uppercase tracking-wider text-saf-muted border-b border-saf-border">
                  <th scope="col" className="text-start font-medium px-4 py-2.5 w-[110px]">Screen</th>
                  <th scope="col" className="text-start font-medium px-4 py-2.5">Field</th>
                  <th scope="col" className="text-start font-medium px-4 py-2.5">Source</th>
                  <th scope="col" className="text-start font-medium px-4 py-2.5 w-[130px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-saf-border">
                {rows.map((f, i) => (
                  <tr key={i} className="hover:bg-saf-light/30 transition-colors">
                    <td className="px-4 py-2.5 text-saf-muted">{f.screen}</td>
                    <th scope="row" className="text-start font-normal px-4 py-2.5 text-saf-text">{f.field}</th>
                    <td className="px-4 py-2.5 text-saf-muted">{f.source}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[11px] font-medium ${STATUS_META[f.status].tone}`}>
                        <Icon name={STATUS_META[f.status].icon} size={11} />
                        {STATUS_META[f.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Not obtainable */}
      <div>
        <h2 className="text-[17px] font-semibold text-saf-text">What we deliberately do not show</h2>
        <p className="text-[13px] text-saf-muted mt-1 mb-3">
          These are not missing features. They are things no API delivers, and showing them would
          mean inventing numbers.
        </p>
        <div className="space-y-2">
          {NOT_OBTAINABLE.map((n, i) => (
            <Card key={i} padding="p-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 grid place-items-center shrink-0">
                  <Icon name="X" size={14} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-saf-text">{n.thing}</div>
                  <p className="text-[12.5px] text-saf-muted mt-0.5 leading-relaxed">{n.why}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessCard({ step, index, theme }) {
  const [open, setOpen] = React.useState(index === 1);
  const p = PLATFORM_BY_ID[step.channel];
  return (
    <Card padding="p-4">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary rounded"
      >
        <span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: p.color }}>
          <PlatformGlyph id={step.channel} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-saf-text">
            {index}. {step.api}
          </div>
          <div className="text-[11.5px] text-saf-muted">
            {step.provider} · {step.lead} · {step.scopes.length} scope{step.scopes.length > 1 ? 's' : ''}
          </div>
        </div>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-saf-muted shrink-0" />
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-saf-border grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <SubHead>Before you can start</SubHead>
            <ul className="mt-1.5 space-y-1">
              {step.prereqs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-saf-muted">
                  <Icon name="Dot" size={14} className="mt-0.5 shrink-0 text-saf-primary" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            <SubHead className="mt-4">Who has to do it</SubHead>
            <p className="mt-1 text-[12.5px] text-saf-muted">{step.owner}</p>
          </div>

          <div className="col-span-12 md:col-span-6">
            <SubHead>Scopes to request</SubHead>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {step.scopes.map(sc => (
                <code key={sc} className="px-2 py-1 rounded-md bg-saf-surface border border-saf-border text-[11.5px] text-saf-text break-all">
                  {sc}
                </code>
              ))}
            </div>

            <SubHead className="mt-4">What it unlocks</SubHead>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {step.unlocks.map(u => (
                <span key={u} className="px-2 h-6 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium">
                  {u}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-12">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Icon name="AlertTriangle" size={15} className="text-amber-700 mt-px shrink-0" />
              <p className="text-[12.5px] text-amber-700 leading-relaxed">{step.risk}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function SubHead({ children, className = '' }) {
  return (
    <div className={`text-[11px] uppercase tracking-wider text-saf-muted font-medium ${className}`}>
      {children}
    </div>
  );
}

window.DataSourcesPage = DataSourcesPage;
window.ACCESS_STEPS = ACCESS_STEPS;
window.FIELD_MAP = FIELD_MAP;
