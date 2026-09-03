// Mock data for Saffron House Social Hub — every section is wired to this.
//
// Saffron House is a single flagship modern-Indian restaurant in Khan Market,
// New Delhi. One location, so there is no location dimension anywhere in the
// data — the org axis is *role*, and the content axis is *channel*.

// PII mask helpers used by the Inbox demo (Marketing Manager-only Unmask).
// Guest phone numbers and delivery-platform order IDs both arrive attached to
// complaints, and both are personal data under the DPDP Act — masked until
// someone with the permission deliberately reveals them.
function maskedPhone(p) { return p ? p.replace(/\d(?=\d{2})/g, '•') : p; }
function maskedAccount(a) { return a ? a.replace(/\d(?=\d{4})/g, '•') : a; }
const maskedOrder = maskedAccount;
window.maskedPhone = maskedPhone;
window.maskedAccount = maskedAccount;
window.maskedOrder = maskedOrder;

// --- Roles + per-role profiles --------------------------------------------
// Each role carries its own mock identity so the demo audience sees the
// avatar / name / role tag change as the switcher flips. Permissions are
// kept as a Set; helper hasPerm() and PERMS table keep gating consistent
// between the sidebar nav and per-screen action gates.
//
// The role *ids* are deliberately generic ('admin' / 'executive' / 'srexec' /
// 'manager') because they are internal keys referenced across every screen.
// What the demo audience sees is the `role` label below:
//   admin     → Owner                (channels, users, audit, brand kit)
//   executive → Social Coordinator    (drafts + replies, no publish)
//   srexec    → Guest Relations Lead  (reviews drafts, flags, comments)
//   manager   → Marketing Manager     (approves, publishes, unmasks PII)
const ROLES = ['admin', 'executive', 'srexec', 'manager'];

const PROFILES = {
  admin:     { id: 'u-admin',  name: 'Vikram Suri',    email: 'vikram@saffronhouse.in',  role: 'Owner',               short: 'Owner' },
  executive: { id: 'u-exec',   name: 'Ananya Rao',     email: 'ananya@saffronhouse.in',  role: 'Social Coordinator',  short: 'Coordinator' },
  srexec:    { id: 'u-srexec', name: 'Rohit Malhotra', email: 'rohit@saffronhouse.in',   role: 'Guest Relations Lead', short: 'Guest Rel.' },
  manager:   { id: 'u-mgr',    name: 'Priya Menon',    email: 'priya@saffronhouse.in',   role: 'Marketing Manager',   short: 'Marketing' },
};

// Permission -> set of roles that hold it. The keys mirror the canonical
// permission names a real backend would gate on (draft.create / draft.approve
// / inbox.unmask / review.reply) so the design demo and the production gates
// stay aligned.
const PERMS = {
  // menu visibility
  'dashboard':            new Set(['admin', 'executive', 'srexec', 'manager']),
  'inbox.read':           new Set(['executive', 'srexec', 'manager']),
  'draft.create':         new Set(['executive', 'srexec', 'manager']),
  'social.manage':        new Set(['admin']),
  'notifications.read':   new Set(['admin', 'executive', 'srexec', 'manager']),
  'brand.manage':         new Set(['admin']),
  'user.manage':          new Set(['admin']),
  'audit.read':           new Set(['admin']),
  'exports.audit':        new Set(['admin']),
  'exports.approvals':    new Set(['manager', 'srexec']),
  'exports.sla':          new Set(['manager', 'admin']),
  // in-screen actions
  'inbox.reply':          new Set(['executive', 'srexec', 'manager']),
  'inbox.assign':         new Set(['executive', 'srexec', 'manager']),
  'inbox.unmask':         new Set(['manager']),
  'draft.edit':           new Set(['executive', 'srexec', 'manager']),
  'draft.submit':         new Set(['executive', 'srexec', 'manager']),
  'draft.review':         new Set(['srexec', 'manager']),
  'draft.flag':           new Set(['srexec', 'manager']),
  'draft.comment':        new Set(['srexec', 'manager']),
  'draft.approve':        new Set(['manager']),
  'post.publish':         new Set(['manager']),
  'role.manage':          new Set(['admin']),
  // reviews — public replies carry the restaurant's voice, so drafting is
  // open to the floor team but publishing a reply to a 1★ is not.
  'review.read':          new Set(['admin', 'executive', 'srexec', 'manager']),
  'review.reply':         new Set(['srexec', 'manager']),
  'review.escalate':      new Set(['srexec', 'manager']),
  'review.comp':          new Set(['manager']),
};

function hasPerm(role, perm) {
  return !!PERMS[perm] && PERMS[perm].has(role);
}

// PROFILES is keyed by role for the role-switcher pattern, but in user-
// referencing data (notes.author, assignments[signalId]) we store the
// canonical user id (e.g. 'u-srexec') because user identity is the stable
// reference, not the role they happened to hold at write time. This lookup
// table resolves a saved user id back to a profile.
const PROFILE_BY_ID = Object.fromEntries(Object.values(PROFILES).map(p => [p.id, p]));

window.ROLES = ROLES;
window.PROFILES = PROFILES;
window.PROFILE_BY_ID = PROFILE_BY_ID;
window.PERMS = PERMS;
window.hasPerm = hasPerm;

// --- Channels ----------------------------------------------------------------
// The six surfaces a Delhi restaurant actually lives on. Two are social
// (ig, wa), three are marketplaces that carry both orders and public reviews
// (zo, sw, di), and one is the single highest-stakes review surface (gg).
//
// `kind` drives which screens a channel appears on:
//   social    → Compose / Scheduled / Analytics
//   review    → Reviews / Analytics
//   messaging → Inbox only (no feed to post to)
//
// colorDark = visual treatment under html.dark. Most brand colors are already
// legible on the dark page (#17110D) and card (#221913). District's mark is
// near-black (#1D1D1F → 1.1:1 on the dark card, effectively invisible) so it
// lifts to a warm mid-grey that reads as "the dark channel" without washing out.
const PLATFORMS = [
  { id: 'ig', name: 'Instagram',  short: 'IG', kind: 'social',    color: '#E1306C', colorDark: '#E1306C', limit: 2200, dmLimit: 1000, gradient: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)' },
  { id: 'gg', name: 'Google',     short: 'GG', kind: 'review',    color: '#1A73E8', colorDark: '#7FB0F5', limit: 1500, dmLimit: 4096 },
  { id: 'zo', name: 'Zomato',     short: 'ZO', kind: 'review',    color: '#E23744', colorDark: '#F0616C', limit: 1000, dmLimit: 1000 },
  { id: 'sw', name: 'Swiggy',     short: 'SW', kind: 'review',    color: '#FC8019', colorDark: '#FC8019', limit: 1000, dmLimit: 1000 },
  { id: 'di', name: 'District',   short: 'DI', kind: 'social',    color: '#1D1D1F', colorDark: '#BFB4A9', limit: 1200, dmLimit: 1000 },
  { id: 'wa', name: 'WhatsApp',   short: 'WA', kind: 'messaging', color: '#25D366', colorDark: '#25D366', limit: 4096, dmLimit: 4096 },
];
const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map(p => [p.id, p]));
// Reverse lookup for datasets keyed by display name (the analytics tables).
const PLATFORM_ID_BY_NAME = Object.fromEntries(PLATFORMS.map(p => [p.name, p.id]));

// Channels that accept a scheduled outbound post. WhatsApp is excluded — a
// broadcast there is a different object with its own opt-in rules, and the
// composer would be lying if it implied a WhatsApp "post".
const POSTABLE = PLATFORMS.filter(p => p.kind !== 'messaging').map(p => p.id);

// Channels that carry public star ratings.
const REVIEW_CHANNELS = PLATFORMS.filter(p => p.kind === 'review').map(p => p.id);

// Theme-aware channel color. Caller passes the current theme ('light' | 'dark'),
// usually read from AppCtx. Defaults to light if omitted so existing call sites
// continue to behave unchanged.
function platformColor(idOrPlatform, theme = 'light') {
  const p = typeof idOrPlatform === 'string' ? PLATFORM_BY_ID[idOrPlatform] : idOrPlatform;
  if (!p) return '#000';
  return theme === 'dark' ? (p.colorDark || p.color) : p.color;
}

// --- Inline channel glyphs ---------------------------------------------------
// Instagram and WhatsApp get their real marks (freely reproduced, simple
// geometry). Google Business Profile gets a pin-and-star — the reviews
// surface, not the Google wordmark. The Indian delivery marketplaces get
// honest lettermarks rather than approximations of trademarked logos, which
// would be both a legal problem and visually wrong at 16px.
function ChannelLetter({ s, ch, className }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill="currentColor" />
      <text
        x="12" y="16.75" textAnchor="middle"
        fontSize="12.5" fontWeight="700" fill="#FFFFFF"
        fontFamily="Inter, system-ui, sans-serif"
      >{ch}</text>
    </svg>
  );
}

function PlatformGlyph({ id, size = 16, className = '' }) {
  const s = size;
  switch (id) {
    case 'ig':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.06 1.8.25 2.23.42.56.21.95.47 1.37.89.42.42.68.81.89 1.37.17.43.36 1.06.42 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.06 1.17-.25 1.8-.42 2.23-.21.56-.47.95-.89 1.37-.42.42-.81.68-1.37.89-.43.17-1.06.36-2.23.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.06-1.8-.25-2.23-.42a3.7 3.7 0 0 1-1.37-.89 3.7 3.7 0 0 1-.89-1.37c-.17-.43-.36-1.06-.42-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.06-1.17.25-1.8.42-2.23.21-.56.47-.95.89-1.37.42-.42.81-.68 1.37-.89.43-.17 1.06-.36 2.23-.42C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.77.13 4.9.33 4.14.63a5.86 5.86 0 0 0-2.13 1.38A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.77.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91a5.86 5.86 0 0 0 1.38 2.13 5.86 5.86 0 0 0 2.13 1.38c.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.13-1.38 5.86 5.86 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.13A5.86 5.86 0 0 0 19.86.63C19.1.33 18.23.13 16.95.07 15.67.01 15.26 0 12 0Z"/>
          <path fill="currentColor" d="M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>
          <circle fill="currentColor" cx="18.41" cy="5.59" r="1.44"/>
        </svg>
      );
    case 'wa':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path fill="currentColor" d="M.06 24l1.69-6.16a11.87 11.87 0 0 1-1.6-5.95C.15 5.33 5.5 0 12.06 0a11.8 11.8 0 0 1 8.41 3.49 11.8 11.8 0 0 1 3.48 8.41c0 6.55-5.34 11.89-11.9 11.89a11.9 11.9 0 0 1-5.68-1.45L.06 24ZM6.6 20.2c1.68 1 3.28 1.6 5.4 1.6 5.45 0 9.89-4.43 9.9-9.89A9.88 9.88 0 0 0 12.06 2C6.6 2 2.16 6.44 2.16 11.9c0 2.22.65 3.89 1.75 5.63l-1 3.66 3.7-.98Zm11.4-5.47c-.07-.12-.27-.2-.56-.34-.3-.15-1.75-.87-2.02-.96-.27-.1-.47-.15-.67.15-.2.29-.76.95-.93 1.15-.17.2-.35.22-.64.07-.3-.14-1.25-.46-2.38-1.47a8.9 8.9 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.09-.19.04-.36-.03-.5-.07-.15-.66-1.6-.91-2.19-.24-.57-.48-.5-.66-.5l-.57-.02c-.2 0-.51.08-.78.37-.27.3-1.02 1-1.02 2.43 0 1.44 1.05 2.82 1.2 3.02.14.2 2.06 3.14 4.98 4.4.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.12.56-.09 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38Z"/>
        </svg>
      );
    case 'gg':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path fill="currentColor" d="M12 1.5c-4.14 0-7.5 3.28-7.5 7.33 0 5.5 7.5 14.17 7.5 14.17s7.5-8.67 7.5-14.17c0-4.05-3.36-7.33-7.5-7.33Z" opacity=".28"/>
          <path fill="currentColor" d="m12 4.4 1.53 3.13 3.47.5-2.5 2.44.59 3.44L12 12.29 8.91 13.9l.59-3.44L7 8.03l3.47-.5L12 4.4Z"/>
        </svg>
      );
    case 'zo': return <ChannelLetter s={s} ch="Z" className={className} />;
    case 'sw': return <ChannelLetter s={s} ch="S" className={className} />;
    case 'di': return <ChannelLetter s={s} ch="D" className={className} />;
    default: return null;
  }
}

// --- Avatar generator (no images — use initials + tinted bg) -----------------
function Avatar({ name, size = 36, className = '' }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // hash name → hue
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const bg = `hsl(${h}, 60%, 90%)`;
  const fg = `hsl(${h}, 55%, 32%)`;
  return (
    <div
      className={'inline-flex items-center justify-center font-medium select-none ' + className}
      style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

// --- Posts -------------------------------------------------------------------
const POSTS = [
  {
    id: 'p1',
    platforms: ['ig','gg','di'],
    status: 'published',
    date: '2026-09-03T12:30:00+05:30',
    author: 'Priya Menon',
    content: 'The monsoon menu is here. Twelve plates built around what Delhi actually eats when it rains — corn and chilli pakoras with saffron chutney, Kashmiri morel pulao, and a ginger-jaggery kheer worth the walk in the wet. Available all week, lunch and dinner. Khan Market.',
    media: { kind: 'image', label: 'Monsoon thali overhead, rain on the window', tone: 'warm' },
    tags: ['#SaffronHouse', '#MonsoonMenu', '#KhanMarket', '#DelhiFood'],
    metrics: { impressions: 84320, reach: 61850, likes: 4820, comments: 312, shares: 612, saves: 1188, clicks: 1820, visits: 410, rate: 6.2 },
  },
  {
    id: 'p2',
    platforms: ['ig','di'],
    status: 'published',
    date: '2026-09-02T18:10:00+05:30',
    author: 'Priya Menon',
    content: 'Chef Meera spent three months in Lucknow to get this one right. The galouti is now made the way it was meant to be — 27 spices, ground fresh every morning, cooked on the tawa to order. On the menu from tonight. 🔥',
    media: { kind: 'video', label: 'Galouti kebab on the tawa, close crop', tone: 'night' },
    tags: ['#Galouti', '#SaffronHouse', '#ChefsTable'],
    metrics: { impressions: 212800, reach: 156410, likes: 18230, comments: 920, shares: 2104, saves: 4712, clicks: 880, visits: 1290, rate: 9.1 },
  },
  {
    id: 'p3',
    platforms: ['gg','di'],
    status: 'published',
    date: '2026-09-01T11:00:00+05:30',
    author: 'Vikram Suri',
    content: 'Saffron House has been listed in the Delhi Top 50 for the third year running. Thank you to every guest who walked up those stairs in Khan Market and gave us a table to cook for. We are open seven days, 12pm to 11:30pm.',
    media: null,
    tags: ['#SaffronHouse', '#DelhiTop50', '#KhanMarket'],
    metrics: { impressions: 42140, reach: 31050, likes: 2104, comments: 142, shares: 318, saves: 264, clicks: 510, visits: 920, rate: 5.6 },
  },
  {
    id: 'p4',
    platforms: ['ig'],
    status: 'failed',
    date: '2026-09-01T08:00:00+05:30',
    author: 'Ananya Rao',
    content: 'Weekday lunch, sorted. Two courses and a cooler for ₹899, 12 to 4pm. Walk in or book on WhatsApp.',
    tags: ['#SaffronHouse', '#LunchDeal', '#KhanMarket'],
    metrics: { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, visits: 0, rate: 0 },
    error: 'Instagram access token expired. Please reconnect the account.',
  },
  {
    id: 'p5',
    platforms: ['ig','gg','di'],
    status: 'published',
    date: '2026-08-31T16:45:00+05:30',
    author: 'Vikram Suri',
    content: 'Every Sunday our kitchen cooks 200 extra meals for the Nizamuddin community kitchen. No campaign, no hashtag needed — just what a restaurant with a working stove should do. If you want to help, the door is open.',
    media: { kind: 'image', label: 'Kitchen team packing meal boxes', tone: 'sand' },
    tags: ['#SaffronHouse', '#DelhiCommunity'],
    metrics: { impressions: 96800, reach: 71430, likes: 6042, comments: 488, shares: 1024, saves: 640, clicks: 320, visits: 712, rate: 7.4 },
  },
  {
    id: 'p6',
    platforms: ['ig'],
    status: 'published',
    date: '2026-08-29T20:00:00+05:30',
    author: 'Ananya Rao',
    content: '60 seconds inside a Saffron House dinner service. Sound on — that clatter is 140 covers going out in ninety minutes.',
    media: { kind: 'video', label: 'Kitchen pass, dinner service', tone: 'tech' },
    tags: ['#SaffronHouse', '#BehindTheScenes', '#DelhiFood'],
    metrics: { impressions: 128200, reach: 94580, likes: 8840, comments: 396, shares: 1240, saves: 2130, clicks: 780, visits: 190, rate: 8.1 },
  },
  {
    id: 'p7',
    platforms: ['ig'],
    status: 'draft',
    date: '2026-09-05T00:00:00+05:30',
    author: 'Ananya Rao',
    content: 'Diwali menu drops Monday. Six courses, one seating a night, 24 seats. You will want to be quick. ✨',
    tags: ['#Diwali', '#SaffronHouse'],
    metrics: { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, visits: 0, rate: 0 },
  },
];

// --- Scheduled queue ---------------------------------------------------------
const SCHEDULED = [
  { id: 's1', platforms: ['ig','di'], when: '2026-09-05T11:00:00+05:30', content: 'Weekend brunch is back. Unlimited chai, five small plates, and the terrace open from 11am. Carousel below →', tags: ['#SaffronHouse','#DelhiBrunch'] },
  { id: 's2', platforms: ['gg'],      when: '2026-09-05T15:30:00+05:30', content: 'Updated hours for the festive season: we are open till 12:30am from 5 October through Diwali week.', tags: ['#KhanMarket'] },
  { id: 's3', platforms: ['ig','zo','sw'], when: '2026-09-06T13:00:00+05:30', content: 'Saturday special — the Awadhi biryani is back on the delivery menu, limited to 40 portions a day.', tags: ['#Biryani','#SaffronHouse'] },
  { id: 's4', platforms: ['ig'],      when: '2026-09-07T19:00:00+05:30', content: 'Meet Ramesh, who has been rolling our rotis for eleven years. He does 600 on a Saturday and has never once dropped one.', tags: ['#SaffronHouse','#TeamStories'] },
  { id: 's5', platforms: ['ig','di'], when: '2026-09-09T11:00:00+05:30', content: 'Diwali menu, six courses, one seating a night from 18 October. Bookings open Monday 9am on WhatsApp.', tags: ['#Diwali','#SaffronHouse'] },
  { id: 's6', platforms: ['ig','gg'], when: '2026-09-12T09:00:00+05:30', content: 'The terrace reopens for the season this weekend — 30 covers, first come, no bookings.', tags: ['#SaffronHouse','#KhanMarket'] },
];

// --- Conversations / Inbox ---------------------------------------------------
// Restaurant inbox reality: bookings on WhatsApp, discovery questions on
// Instagram, and complaints arriving through the delivery marketplaces with an
// order ID attached. The PII payloads are what the Unmask permission gates.
const CONVERSATIONS = [
  {
    id: 'c1', user: 'Rahul Khanna', platform: 'wa', unread: 2, online: true,
    preview: 'Hi, booking for our anniversary on Saturday — is the terrace open?',
    pii: { phone: '+91 98110 44213', account: 'BKG-2026-08421' },
    messages: [
      { from: 'user', text: 'Hi, I have a booking for Saturday 8pm under Khanna, reference BKG-2026-08421. It is our anniversary — is the terrace open that night?', t: '2026-09-04T09:14:00+05:30' },
      { from: 'user', text: 'Also can you do something for dessert? She loves the kheer.', t: '2026-09-04T09:15:00+05:30' },
      { from: 'saf',  text: 'Congratulations Rahul! Terrace is open Saturday and I have moved you to table 12 by the railing. I have noted the kheer — the kitchen will send it out with a candle.', t: '2026-09-04T09:18:00+05:30', status: 'read' },
      { from: 'user', text: 'Perfect, thank you so much 🙏', t: '2026-09-04T09:19:00+05:30' },
      { from: 'user', text: 'One more thing — is there parking at Khan Market on a Saturday?', t: '2026-09-04T09:42:00+05:30' },
    ],
  },
  {
    id: 'c2', user: 'Sneha Iyer', platform: 'ig', unread: 1, online: false,
    preview: 'Is the galouti available in a vegetarian version?',
    messages: [
      { from: 'user', text: 'Saw the galouti reel and now I need it, but I am vegetarian. Do you do a veg version?', t: '2026-09-04T08:51:00+05:30' },
      { from: 'saf',  text: 'We do — the kathal (jackfruit) galouti uses the same 27-spice mix and the same tawa. Most people cannot tell them apart. Ask for it by name when you sit down.', t: '2026-09-04T08:55:00+05:30', status: 'delivered' },
    ],
  },
  {
    id: 'c3', user: 'Arjun Mehta', platform: 'zo', unread: 0, online: true,
    preview: 'Order arrived cold and 40 minutes late…',
    pii: { phone: '+91 99715 88102', account: 'ZO-4471-99823' },
    messages: [
      { from: 'user', text: 'Order ZO-4471-99823 arrived 40 minutes past the ETA and the biryani was stone cold. Third time this month from your kitchen.', t: '2026-09-03T21:32:00+05:30' },
      { from: 'saf',  text: 'Arjun, that is genuinely not acceptable and I am sorry. I have pulled the order — it left our pass at 20:48 hot, so this sat with the rider. Full refund is processed and there is a credit on your next order. I am also raising it with Zomato on the rider delay.', t: '2026-09-03T21:48:00+05:30', status: 'read' },
      { from: 'user', text: 'Appreciate the quick response, thank you.', t: '2026-09-03T21:51:00+05:30' },
    ],
  },
  {
    id: 'c4', user: 'Divya Nair', platform: 'sw', unread: 3, online: false,
    preview: 'Missing item in my order — paid for it and it never came',
    pii: { phone: '+91 98187 61188', account: 'SW-2210-45119' },
    messages: [
      { from: 'user', text: 'Order SW-2210-45119. I paid for two galouti and got one. This is the second time.', t: '2026-09-04T07:02:00+05:30' },
      { from: 'user', text: 'Swiggy support is going in circles. Can you just sort it out?', t: '2026-09-04T07:05:00+05:30' },
      { from: 'user', text: 'Hello?', t: '2026-09-04T08:01:00+05:30' },
    ],
  },
  {
    id: 'c5', user: 'Meenakshi Reddy', platform: 'gg', unread: 0, online: false,
    preview: 'Wanted to say your floor team was wonderful last night.',
    messages: [
      { from: 'user', text: 'Wanted to say your floor team was wonderful last night — we came in with a toddler at 9pm and nobody made us feel like a problem. Farhan in particular was lovely.', t: '2026-09-02T19:14:00+05:30' },
      { from: 'saf',  text: 'Thank you Meenakshi, this made the whole team\'s evening. I have passed it to Farhan and to the floor manager. Bring the little one back any time — we keep a stash of plain parathas for exactly that.', t: '2026-09-02T19:20:00+05:30', status: 'read' },
    ],
  },
  {
    id: 'c6', user: 'Delhi Food Diaries', platform: 'ig', unread: 0, online: true,
    preview: 'Would love to feature the monsoon menu — collab?',
    messages: [
      { from: 'user', text: 'Hi team! 240k followers, Delhi food page. Would love to shoot the monsoon menu this week — happy to do a reel + carousel. Are you open to collabs?', t: '2026-09-01T12:10:00+05:30' },
      { from: 'saf',  text: 'Hi! Yes — we host press and creators on Tuesday and Wednesday lunches so the kitchen can give you proper attention. Priya will send dates and the one thing we ask: please shoot the food as it arrives, no restaging.', t: '2026-09-01T12:14:00+05:30', status: 'read' },
      { from: 'user', text: 'Completely fair. Tuesday works!', t: '2026-09-01T12:15:00+05:30' },
    ],
  },
  {
    id: 'c7', user: 'Kabir Sethi', platform: 'wa', unread: 0, online: false,
    preview: 'Corporate dinner for 30 in October — do you do a private area?',
    pii: { phone: '+91 97110 22540' },
    messages: [
      { from: 'user', text: 'Looking at a corporate dinner for 30 in mid-October. Do you have a private dining area, and what is the per-head on a set menu?', t: '2026-09-01T15:00:00+05:30' },
    ],
  },
];

// --- Comments on a post (for the drawer view) --------------------------------
const POST_COMMENTS = [
  { id: 'cm1', user: 'Rahul Khanna',    text: 'Booked for Saturday the moment I saw this. The kheer alone is worth it.', t: '2026-09-03T14:02:00+05:30', sentiment: 'pos' },
  { id: 'cm2', user: 'Sneha Iyer',      text: 'Is the monsoon menu vegetarian-friendly? Half of us do not eat meat.', t: '2026-09-03T14:15:00+05:30', sentiment: 'neu' },
  { id: 'cm3', user: 'Arjun Mehta',     text: 'Food is great but the delivery keeps arriving cold 😕 fix the packaging please', t: '2026-09-03T14:42:00+05:30', sentiment: 'neg' },
  { id: 'cm4', user: 'Saffron House',   isBrand: true, text: '@Sneha Iyer seven of the twelve plates are vegetarian, and the morel pulao is the one to order. See you soon!', t: '2026-09-03T15:08:00+05:30', sentiment: 'pos' },
  { id: 'cm5', user: 'Nikhil Bansal',   text: 'Went last night. Corn pakoras were the best thing I have eaten this month. 👌', t: '2026-09-03T17:21:00+05:30', sentiment: 'pos' },
  { id: 'cm6', user: 'Aditi Chaudhary', text: 'Do you take walk-ins on a weekday or is it bookings only?', t: '2026-09-03T18:55:00+05:30', sentiment: 'neu' },
];

// --- Reviews -----------------------------------------------------------------
// The screen that does not exist in a generic social tool and that a
// restaurant lives or dies by. Reviews carry a star rating, an order context
// (dine-in vs delivery), and an SLA clock — an unanswered 1★ on Google is a
// standing advertisement against you.
const REVIEWS = [
  {
    id: 'rv-1', channel: 'gg', author: 'Ishaan Kapoor', rating: 1, age: '7h',
    context: 'dine-in', sentiment: -0.82, replied: false, escalated: true,
    text: 'Waited 55 minutes for a table we had booked for 8pm. When we finally sat, two of the four dishes we ordered were unavailable. Nobody apologised. For these prices in Khan Market, this is not acceptable.',
    themes: ['wait time', 'availability', 'service'],
  },
  {
    id: 'rv-2', channel: 'zo', author: 'Arjun Mehta', rating: 2, age: '14h',
    context: 'delivery', sentiment: -0.54, replied: true,
    text: 'Biryani arrived cold and 40 minutes late. Taste is genuinely excellent when hot — that is the frustrating part. Packaging does not hold heat at all.',
    reply: { by: 'Priya Menon', age: '13h', text: 'Arjun — refund processed and we are switching to insulated containers from next week. The delay was on the rider side and we have raised it. Please give us one more try.' },
    themes: ['delivery temperature', 'packaging', 'late'],
  },
  {
    id: 'rv-3', channel: 'gg', author: 'Meenakshi Reddy', rating: 5, age: '26h',
    context: 'dine-in', sentiment: 0.91, replied: true,
    text: 'Came in at 9pm with a toddler expecting to be tolerated, and instead got a warm welcome, a high chair before we asked, and plain parathas for her. Farhan on the floor was outstanding. The galouti is as good as everyone says.',
    reply: { by: 'Rohit Malhotra', age: '25h', text: 'Thank you Meenakshi — passed straight to Farhan and the floor team. The paratha stash is permanent policy. See you soon.' },
    themes: ['service', 'family friendly', 'galouti'],
  },
  {
    id: 'rv-4', channel: 'sw', author: 'Divya Nair', rating: 1, age: '5h',
    context: 'delivery', sentiment: -0.76, replied: false,
    text: 'Second time an item is missing from my order. Paid for two galouti, received one. Support is useless. Sort out your packing station.',
    themes: ['missing item', 'packing', 'repeat issue'],
  },
  {
    id: 'rv-5', channel: 'gg', author: 'Nikhil Bansal', rating: 5, age: '2h',
    context: 'dine-in', sentiment: 0.88, replied: false,
    text: 'The monsoon menu is the best thing happening in Khan Market right now. Corn and chilli pakoras with that saffron chutney — I would walk here in the rain for them, which is exactly the point I suppose.',
    themes: ['monsoon menu', 'pakora', 'value'],
  },
  {
    id: 'rv-6', channel: 'zo', author: 'Farah Qureshi', rating: 4, age: '30h',
    context: 'delivery', sentiment: 0.44, replied: true,
    text: 'Food excellent, portions generous, delivery on time. Docking one star because the raita spilled — needs a better seal. Would order again.',
    reply: { by: 'Priya Menon', age: '29h', text: 'Thank you Farah — the raita lids are being replaced this week, you were not the first to flag it. Glad the rest landed well.' },
    themes: ['packaging', 'portions', 'on time'],
  },
  {
    id: 'rv-7', channel: 'gg', author: 'Aditi Chaudhary', rating: 3, age: '28h',
    context: 'dine-in', sentiment: 0.02, replied: false,
    text: 'Food is genuinely very good. But it is loud — we could not hold a conversation at the table on a Saturday night, and the acoustics upstairs make it worse. Come for the food, not for a catch-up.',
    themes: ['noise', 'ambience'],
  },
  {
    id: 'rv-8', channel: 'sw', author: 'Rohan Grover', rating: 5, age: '47h',
    context: 'delivery', sentiment: 0.85, replied: true,
    text: 'Ordered the Awadhi biryani on a whim at 11pm and it turned up in 28 minutes, hot, and better than most sit-down places in Delhi. Genuinely impressed.',
    reply: { by: 'Rohit Malhotra', age: '46h', text: 'Thank you Rohan! The late kitchen runs till 11:30pm — the biryani is capped at 40 portions a day so you got a good one.' },
    themes: ['biryani', 'delivery speed'],
  },
  {
    id: 'rv-9', channel: 'gg', author: 'Sameer Vohra', rating: 2, age: '3d',
    context: 'dine-in', sentiment: -0.48, replied: false,
    text: 'Booked a table for 8, seated at 8:50. The food when it arrived was very good but the front of house is clearly under-staffed on weekends.',
    themes: ['wait time', 'service', 'staffing'],
  },
  {
    id: 'rv-10', channel: 'zo', author: 'Priyanka Sood', rating: 5, age: '3d',
    context: 'delivery', sentiment: 0.79, replied: false,
    text: 'The kathal galouti is a genuine achievement. I have fed it to three meat-eaters who did not notice. Please never take it off the menu.',
    themes: ['kathal galouti', 'vegetarian'],
  },
  {
    id: 'rv-11', channel: 'gg', author: 'Tarun Bhatia', rating: 4, age: '4d',
    context: 'dine-in', sentiment: 0.51, replied: true,
    text: 'Excellent food, thoughtful wine list, slightly cramped seating downstairs. Ask for a table upstairs if you can.',
    reply: { by: 'Rohit Malhotra', age: '95h', text: 'Noted on the downstairs seating, Tarun — we are re-spacing that room in October. Thank you for the wine list note, that is our sommelier\'s doing.' },
    themes: ['seating', 'wine', 'ambience'],
  },
  {
    id: 'rv-12', channel: 'sw', author: 'Kavya Menon', rating: 3, age: '4d',
    context: 'delivery', sentiment: 0.08, replied: false,
    text: 'Good food but the delivery menu is a fraction of the dine-in menu. Half the things I wanted from Instagram were not orderable.',
    themes: ['menu parity', 'delivery'],
  },
];

// Aggregate review stats for the Reviews screen header + Dashboard KPI.
// distribution is [1★, 2★, 3★, 4★, 5★] counts over the trailing 90 days.
const REVIEW_STATS = {
  avg: 4.3,
  avgPrev: 4.5,
  total90d: 1284,
  distribution: [42, 61, 118, 349, 714],
  responseRate: 0.68,
  responseRateTarget: 0.90,
  medianResponseMins: 214,
  slaMins: 240,
  // Derived below from REVIEWS so the header can never contradict the list.
  unanswered: 0,
  unansweredCritical: 0,      // ≤2★ and past SLA
  byChannel: [
    { channel: 'gg', avg: 4.4, count: 612, change: -0.2, responseRate: 0.71 },
    { channel: 'zo', avg: 4.2, count: 428, change: -0.1, responseRate: 0.66 },
    { channel: 'sw', avg: 4.1, count: 244, change: -0.3, responseRate: 0.61 },
  ],
  // 12-week rolling average, oldest → newest. The visible slide from 4.6 to
  // 4.3 is the demo's slow-burn story: delivery temperature complaints
  // accumulating while dine-in stays strong.
  trend12w: [4.6, 4.6, 4.5, 4.6, 4.5, 4.5, 4.4, 4.5, 4.4, 4.3, 4.3, 4.3],
};

// --- Menu item sentiment -----------------------------------------------------
// The restaurant-specific listening dimension. Generic social tools track
// hashtags; a restaurant needs to know that the biryani is carrying the brand
// and the paneer tikka is quietly dragging it down.
const MENU_ITEMS = [
  {
    id: 'mi-1', name: 'Galouti Kebab', category: 'Small plates', price: 685,
    mentions7d: 412, mentionsChange7dPct: 68, sentiment: 0.81, sentimentDelta: 0.06,
    spark: [140, 165, 188, 210, 268, 344, 412],
    topPraise: 'Texture and spice balance — repeatedly called the best in Delhi',
    topComplaint: 'Portion size at ₹685 questioned by a minority',
    isMoment: true,
  },
  {
    id: 'mi-2', name: 'Awadhi Biryani', category: 'Mains', price: 890,
    mentions7d: 318, mentionsChange7dPct: 22, sentiment: 0.74, sentimentDelta: 0.02,
    spark: [240, 252, 261, 274, 288, 302, 318],
    topPraise: 'Arrives hot even on late-night delivery; 40-a-day cap reads as quality',
    topComplaint: 'Sells out before 9pm on weekends',
    isMoment: false,
  },
  {
    id: 'mi-3', name: 'Kathal Galouti', category: 'Small plates', price: 545,
    mentions7d: 196, mentionsChange7dPct: 118, sentiment: 0.86, sentimentDelta: 0.11,
    spark: [42, 58, 71, 96, 128, 162, 196],
    topPraise: 'Vegetarians reporting meat-eaters cannot tell the difference',
    topComplaint: 'Not listed clearly on the delivery menu',
    isMoment: true,
  },
  {
    id: 'mi-4', name: 'Corn & Chilli Pakora', category: 'Monsoon menu', price: 395,
    mentions7d: 174, mentionsChange7dPct: 240, sentiment: 0.78, sentimentDelta: 0.14,
    spark: [12, 18, 31, 58, 94, 138, 174],
    topPraise: 'The saffron chutney is doing most of the work and people know it',
    topComplaint: 'Goes soggy in delivery packaging',
    isMoment: true,
  },
  {
    id: 'mi-5', name: 'Paneer Tikka Masala', category: 'Mains', price: 720,
    mentions7d: 148, mentionsChange7dPct: -8, sentiment: 0.12, sentimentDelta: -0.19,
    spark: [188, 181, 174, 170, 162, 154, 148],
    topPraise: 'Consistent, safe order for mixed tables',
    topComplaint: 'Repeatedly called "hotel standard" and over-priced for what it is',
    isMoment: true,
  },
  {
    id: 'mi-6', name: 'Ginger-Jaggery Kheer', category: 'Desserts', price: 340,
    mentions7d: 132, mentionsChange7dPct: 84, sentiment: 0.83, sentimentDelta: 0.08,
    spark: [38, 46, 58, 72, 94, 112, 132],
    topPraise: 'Named unprompted in anniversary and celebration bookings',
    topComplaint: 'Only available with the monsoon menu',
    isMoment: false,
  },
  {
    id: 'mi-7', name: 'Kashmiri Morel Pulao', category: 'Monsoon menu', price: 1150,
    mentions7d: 88, mentionsChange7dPct: 46, sentiment: 0.58, sentimentDelta: 0.03,
    spark: [32, 38, 44, 51, 62, 74, 88],
    topPraise: 'Treated as the "occasion" dish; strong photo performance',
    topComplaint: 'Price resistance at ₹1150 in comments',
    isMoment: false,
  },
  {
    id: 'mi-8', name: 'Butter Chicken', category: 'Mains', price: 780,
    mentions7d: 84, mentionsChange7dPct: -22, sentiment: -0.14, sentimentDelta: -0.26,
    spark: [142, 132, 124, 112, 102, 92, 84],
    topPraise: 'Regulars defend it as deliberately less sweet than the Delhi norm',
    topComplaint: 'New guests expecting the sweeter standard are disappointed',
    isMoment: true,
  },
];

// --- Analytics time series ---------------------------------------------------
// Reach per channel per day. Friday/Saturday spike is the weekend dining
// cycle — the shape a restaurant should expect and the one that makes a
// flat Tuesday post look like a mistake.
const ANALYTICS_TIME = [
  { d: 'Mon', ig: 18200, gg: 12400, zo: 6400, sw: 5100, di: 3100, wa: 2100 },
  { d: 'Tue', ig: 21000, gg: 14100, zo: 7100, sw: 5900, di: 3500, wa: 2500 },
  { d: 'Wed', ig: 19800, gg: 13200, zo: 6800, sw: 6400, di: 3200, wa: 2200 },
  { d: 'Thu', ig: 24500, gg: 15800, zo: 7600, sw: 7100, di: 4100, wa: 3100 },
  { d: 'Fri', ig: 38200, gg: 17200, zo: 12400, sw: 10800, di: 5800, wa: 4800 },
  { d: 'Sat', ig: 46200, gg: 21400, zo: 15100, sw: 13100, di: 6400, wa: 5400 },
  { d: 'Sun', ig: 31400, gg: 19200, zo: 11200, sw: 9800, di: 4100, wa: 3100 },
];

const ANALYTICS_PLATFORM = [
  { p: 'Instagram', likes: 54210, comments: 5840, shares: 4120 },
  { p: 'Google',    likes: 12400, comments: 3120, shares:  840 },
  { p: 'Zomato',    likes: 18420, comments: 2210, shares: 1100 },
  { p: 'Swiggy',    likes: 11820, comments: 1280, shares:  620 },
  { p: 'District',  likes:  6210, comments:  710, shares:  410 },
  { p: 'WhatsApp',  likes:     0, comments: 2840, shares: 1240 },
];

const ANALYTICS_BREAKDOWN = [
  { name: 'Food photo', value: 46, color: '#B4451F' },
  { name: 'Reel',       value: 31, color: '#D99A16' },
  { name: 'Team/BTS',   value: 14, color: '#6E2412' },
  { name: 'Text/offer', value:  9, color: '#E0B36A' },
];

const ANALYTICS_DEMO = {
  age: [
    { label: '18–24', value: 14 },
    { label: '25–34', value: 41 },
    { label: '35–44', value: 26 },
    { label: '45–54', value: 12 },
    { label: '55+',   value:  7 },
  ],
  gender: [
    { label: 'Male',   value: 46 },
    { label: 'Female', value: 53 },
    { label: 'Other',  value:  1 },
  ],
  // Delivery radius is what matters for a single Khan Market restaurant —
  // these are the neighbourhoods orders and bookings actually come from.
  locations: [
    { label: 'Khan Market / Lodhi',  value: 22 },
    { label: 'South Delhi',          value: 28 },
    { label: 'Central Delhi',        value: 16 },
    { label: 'Gurugram',             value: 12 },
    { label: 'Noida',                value:  8 },
    { label: 'Outside NCR',          value:  9 },
    { label: 'International',        value:  5 },
  ],
};

const ANALYTICS_SENTIMENT = [
  { platform: 'Instagram', pos: 82, neu: 14, neg:  4 },
  { platform: 'Google',    pos: 71, neu: 17, neg: 12 },
  { platform: 'Zomato',    pos: 64, neu: 21, neg: 15 },
  { platform: 'Swiggy',    pos: 58, neu: 24, neg: 18 },
  { platform: 'District',  pos: 76, neu: 20, neg:  4 },
  { platform: 'WhatsApp',  pos: 79, neu: 18, neg:  3 },
];

// --- Trending hashtags --------------------------------------------------------
const TRENDING_TAGS = ['#SaffronHouse', '#KhanMarket', '#DelhiFood', '#MonsoonMenu', '#Galouti', '#DelhiTop50', '#DelhiBrunch', '#Biryani'];

// --- Reply templates ----------------------------------------------------------
// Split by surface: a public review reply and a private DM are different
// registers, and using the wrong one is the classic restaurant social mistake.
const TEMPLATES = {
  en: [
    { id: 't1', title: 'Booking confirmation', body: 'Thank you for booking with Saffron House. You are confirmed — please let us know if anything changes so we can release the table.' },
    { id: 't2', title: 'Waitlist / full house', body: 'We are fully committed for that evening, but we hold a few walk-in seats at the bar from 9pm. Happy to add you to the waitlist and call if a table opens.' },
    { id: 't3', title: 'Delivery complaint',   body: 'That is not the standard we cook to, and I am sorry. Could you share your order number? We will process a refund and look at what went wrong on our side.' },
    { id: 't4', title: 'Dietary question',     body: 'Happy to help — please tell us about any allergies when you book and the kitchen will flag your ticket. Most dishes can be adapted, and we will be honest about the ones that cannot.' },
    { id: 't5', title: 'Positive review reply', body: 'Thank you so much — I have passed this to the kitchen and the floor team, which genuinely makes their week. We hope to see you again soon.' },
    { id: 't6', title: 'Creator / press',      body: 'Thanks for reaching out! We host creators on Tuesday and Wednesday lunches so the kitchen can do it properly. Priya will follow up with dates.' },
  ],
};

// --- Activity feed (dashboard) -----------------------------------------------
const ACTIVITY = [
  { id: 'a1', icon: 'alert',   t: '2 min ago',  text: '1★ Google review from Ishaan Kapoor is past the 4-hour reply SLA.' },
  { id: 'a2', icon: 'message', t: '9 min ago',  text: 'New WhatsApp booking enquiry from Rahul Khanna — anniversary, Saturday.' },
  { id: 'a3', icon: 'check',   t: '22 min ago', text: 'Galouti reel passed 150k views on Instagram.' },
  { id: 'a4', icon: 'alert',   t: '48 min ago', text: 'Instagram access token expired — the lunch-deal post failed to publish.' },
  { id: 'a5', icon: 'calendar',t: '1 hr ago',   text: 'Scheduled: Diwali menu announcement — 9 September, 11:00.' },
  { id: 'a6', icon: 'thumbs',  t: '3 hr ago',   text: 'Menu sentiment: Paneer Tikka Masala down 0.19 over 7 days.' },
];

// --- Social Listening dataset ------------------------------------------------
// Adapted to a single Delhi restaurant. Competitor names are deliberately
// fictional — anything resembling a real Delhi restaurant is coincidental.
//
// 3-act story baked into the seed data (per the design spec):
//   Act 1 — volume spike (positive, warn) drives the "the product tells
//           me when traffic moves" moment.
//   Act 2 — competitor move (warn) drives the "the product tells me what
//           competitors are doing" moment.
//   Act 3 — crisis cluster (critical) is the demo crescendo: three negative
//           incidents on the same theme (delivery temperature) within 4h.
// Plus background signals across all kinds/channels/severities so the
// feed reads as real, not curated.

const LISTENING_KINDS = ['volume_spike', 'competitor_move', 'crisis_cluster', 'mention_burst', 'sentiment_shift'];
const LISTENING_SEVERITIES = ['info', 'warn', 'critical'];

const LISTENING_SIGNALS = [
  // ACT 1 — volume spike
  { id: 'sig-001', t: '2h',  channel: 'ig', kind: 'volume_spike',    severity: 'warn',
    title: 'Instagram mentions up 340% in the last 6 hours',
    body:  'Driven by the galouti reel — largest single-day surge in 90 days. Saves are running at 2.2%, well above the 0.9% baseline.',
    metrics: { mentions: 1240, reach: 84000,  sentiment:  0.72, changePct: 340 } },
  // ACT 2 — competitor move
  { id: 'sig-002', t: '5h',  channel: 'di', kind: 'competitor_move', severity: 'warn',
    title: 'Dilli Darbar launched a monsoon menu; engagement 4× ours',
    body:  'Their launch reel hit 218k views in 12 hours against 53k on our comparable post. Same week, same category, and they went first.',
    metrics: { mentions: 482, reach: 218000, sentiment:  0.48, changePct: 312 } },
  // ACT 3 — crisis cluster
  { id: 'sig-003', t: '1h',  channel: 'zo', kind: 'crisis_cluster',  severity: 'critical',
    title: 'Delivery temperature complaints clustering across three platforms',
    body:  'Three high-volume negative threads on cold food and missing items within a 4-hour window. All delivery, none dine-in — this is a packing and handover problem, not a kitchen one.',
    metrics: { mentions: 612, reach: 124000, sentiment: -0.71, changePct: 540 },
    children: [
      { channel: 'zo', text: 'Biryani stone cold, 40 min past ETA. Third time this month.', t: '12m' },
      { channel: 'sw', text: 'Missing item again — paid for two galouti, got one.', t: '34m' },
      { channel: 'gg', text: 'Ordered twice this week, both arrived lukewarm. Dine-in is excellent though.', t: '52m' },
    ] },

  // Background signals — varied kinds/severities/channels.
  { id: 'sig-010', t: '15m', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Mentions tagged from Khan Market up sharply',
    body:  '42 organic story tags in 15 minutes, mostly Saturday-evening geotags — event-driven, not campaign-driven.',
    metrics: { mentions: 42, reach: 8200, sentiment: 0.61, changePct: 88 } },
  { id: 'sig-011', t: '28m', channel: 'gg', kind: 'sentiment_shift', severity: 'info',
    title: 'Dine-in sentiment trending positive (+0.18 vs 7d)',
    body:  'Last three weeks of dine-in reviews averaging 0.64, up from a 0.46 baseline. Delivery is moving the opposite way.',
    metrics: { mentions: 187, reach: 24000, sentiment: 0.64, changePct: 28 } },
  { id: 'sig-012', t: '42m', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Delhi Food Diaries post drove 18k impressions in 30 min',
    body:  'Reel from a 240k-follower page tagging the monsoon menu. 1.2k saves, no paid spend behind it.',
    metrics: { mentions: 96, reach: 18000, sentiment: 0.66, changePct: 140 } },
  { id: 'sig-013', t: '1h',  channel: 'sw', kind: 'sentiment_shift', severity: 'warn',
    title: 'Swiggy rating slipping on the trailing 30 days',
    body:  'Net sentiment 0.04 over the last 7 days — down from 0.27 the week prior. Missing-item reports are the single largest driver.',
    metrics: { mentions: 312, reach: 41000, sentiment: 0.04, changePct: -22 } },
  { id: 'sig-014', t: '1h',  channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Google Q&A activity surge after the Top 50 listing',
    body:  '74 new questions in the last hour, mostly on booking policy and parking. Worth answering in bulk.',
    metrics: { mentions: 74, reach: 31000, sentiment: 0.52, changePct: 110 } },
  { id: 'sig-020', t: '2h',  channel: 'zo', kind: 'competitor_move', severity: 'warn',
    title: 'Copper Chimney Co. dropped delivery fees to zero',
    body:  'Announced at 06:40; 1.4k shares and the Delhi food press has picked it up. Directly targets our delivery radius.',
    metrics: { mentions: 1420, reach: 312000, sentiment: 0.41, changePct: 180 } },
  { id: 'sig-021', t: '3h',  channel: 'ig', kind: 'volume_spike',    severity: 'warn',
    title: 'Comments on the monsoon-menu post up 220%',
    body:  '288 net-new comments since 09:00. Sentiment positive but the moderation queue is backlogged and questions are going unanswered.',
    metrics: { mentions: 288, reach: 56000, sentiment: 0.58, changePct: 220 } },
  { id: 'sig-022', t: '3h',  channel: 'ig', kind: 'sentiment_shift', severity: 'info',
    title: 'Kathal galouti sentiment back above 0.8',
    body:  'Vegetarian guests driving the lift — repeated "cannot tell the difference" framing in comments.',
    metrics: { mentions: 144, reach: 22000, sentiment: 0.86, changePct: 12 } },
  { id: 'sig-023', t: '4h',  channel: 'di', kind: 'mention_burst',   severity: 'info',
    title: 'District listing reshared by a Delhi dining curator',
    body: 'Reshare put the Diwali seating in front of a booking-intent audience. 41 profile views per minute since.',
    metrics: { mentions: 61, reach: 28000, sentiment: 0.62, changePct: 90 } },
  { id: 'sig-024', t: '5h',  channel: 'gg', kind: 'volume_spike',    severity: 'info',
    title: 'Searches for "Saffron House Khan Market" doubling vs a typical Tuesday',
    body:  'Mostly discovery traffic following the Top 50 listing. Direction requests up 68%.',
    metrics: { mentions: 218, reach: 44000, sentiment: 0.49, changePct: 102 } },
  { id: 'sig-025', t: '6h',  channel: 'gg', kind: 'sentiment_shift', severity: 'warn',
    title: 'Weekend wait-time complaints climbing',
    body:  '23 net-negative reviews since the Top 50 listing. Subject: booked tables not ready on arrival. Demand is outrunning the floor.',
    metrics: { mentions: 47, reach: 9100, sentiment: -0.31, changePct: 64 } },
  { id: 'sig-030', t: '7h',  channel: 'ig', kind: 'competitor_move', severity: 'info',
    title: 'Baoli Kitchen seeded a new food-influencer campaign',
    body:  'Four mid-tier Delhi creators posted within a 2-hour window. Identical brief, identical framing — clearly paid.',
    metrics: { mentions: 88, reach: 64000, sentiment: 0.22, changePct: 76 } },
  { id: 'sig-031', t: '8h',  channel: 'zo', kind: 'sentiment_shift', severity: 'info',
    title: 'Biryani reviews trending positive',
    body:  '0.74 sentiment over the last 50 reviews, up from 0.61 baseline. The 40-a-day cap is being read as a quality signal.',
    metrics: { mentions: 118, reach: 38000, sentiment: 0.74, changePct: 22 } },
  { id: 'sig-032', t: '9h',  channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Hiring story drove 320 profile visits',
    body:  'Commis chef opening. Mostly Delhi-based profiles, majority with hotel-kitchen experience.',
    metrics: { mentions: 41, reach: 12000, sentiment: 0.34, changePct: 84 } },
  { id: 'sig-033', t: '10h', channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Positive cluster around the terrace reopening',
    body:  '12 organic mentions of the terrace in 90 minutes. Sentiment 0.71.',
    metrics: { mentions: 12, reach: 4400, sentiment: 0.71, changePct: 50 } },
  { id: 'sig-040', t: '12h', channel: 'sw', kind: 'sentiment_shift', severity: 'warn',
    title: 'Missing-item reports climbing again',
    body:  '16 reports in the last 6 hours, all on multi-item orders. Linked to the delivery crisis cluster.',
    metrics: { mentions: 16, reach: 5200, sentiment: -0.52, changePct: 120 } },
  { id: 'sig-041', t: '14h', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Kitchen-service reel passing 100k views',
    body:  'Save rate 4.1% — well above the 1.8% average on food posts. Behind-the-scenes outperforms plated food again.',
    metrics: { mentions: 222, reach: 102000, sentiment: 0.76, changePct: 40 } },
  { id: 'sig-042', t: '16h', channel: 'zo', kind: 'competitor_move', severity: 'info',
    title: 'The Curry Room posted an aggressive lunch-deal price',
    body:  '₹699 two-course against our ₹899. Comment thread mostly skeptical about portion size.',
    metrics: { mentions: 64, reach: 18000, sentiment: -0.04, changePct: 24 } },
  { id: 'sig-043', t: '18h', channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Old pakora post getting fresh life from regional food pages',
    body:  'Original post 42h old, resurfacing through reshares as the rain continues.',
    metrics: { mentions: 188, reach: 67000, sentiment: 0.68, changePct: 60 } },
  { id: 'sig-050', t: '20h', channel: 'di', kind: 'mention_burst',   severity: 'info',
    title: 'District saves on the Diwali seating crossing 50k views',
    body:  'Question-heavy comments — opportunity for a pinned FAQ on the set menu and seating times.',
    metrics: { mentions: 89, reach: 50000, sentiment: 0.38, changePct: 30 } },
  { id: 'sig-051', t: '1d',  channel: 'gg', kind: 'sentiment_shift', severity: 'info',
    title: 'Dine-in rating steady at 4.6+',
    body:  '7-day rolling dine-in rating stable while the blended rating falls. Delivery is the whole gap.',
    metrics: { mentions: 412, reach: 72000, sentiment: 0.61, changePct: 4 } },
  { id: 'sig-052', t: '1d',  channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Story poll on "next menu addition" drove 1.8k responses',
    body:  'Top vote: return of the Sunday roast-style thali (42%). Then dessert tasting (28%) and a bar menu (18%).',
    metrics: { mentions: 1800, reach: 22000, sentiment: 0.64, changePct: 95 } },
  { id: 'sig-053', t: '1d',  channel: 'sw', kind: 'sentiment_shift', severity: 'info',
    title: 'Swiggy sentiment recovering after last week\'s dip',
    body:  '+0.22 vs the Friday trough, following the packaging change.',
    metrics: { mentions: 198, reach: 32000, sentiment: 0.26, changePct: 18 } },
  { id: 'sig-054', t: '1d',  channel: 'wa', kind: 'mention_burst',   severity: 'info',
    title: 'WhatsApp booking enquiries up 60%',
    body:  'Mostly weekend tables for four or more. Response time is holding under 6 minutes.',
    metrics: { mentions: 76, reach: 14000, sentiment: 0.58, changePct: 60 } },
  { id: 'sig-055', t: '1d',  channel: 'ig', kind: 'competitor_move', severity: 'info',
    title: 'Dilli Darbar paid spend visibly up',
    body: 'Six distinct creatives observed in 24h against the usual one or two. They are buying the monsoon window.',
    metrics: { mentions: 12, reach: 88000, sentiment: 0.12, changePct: 130 } },
  { id: 'sig-060', t: '2d',  channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Floor-team shoutout review going organic',
    body:  'Guest praising Farhan on the floor. 410 helpful votes, 22 comments — all positive.',
    metrics: { mentions: 22, reach: 16000, sentiment: 0.88, changePct: 40 } },
  { id: 'sig-061', t: '2d',  channel: 'ig', kind: 'sentiment_shift', severity: 'info',
    title: 'Sentiment ticking up on dessert content',
    body:  '+0.14 over 7 days. Driver: a single highly-saved kheer carousel.',
    metrics: { mentions: 134, reach: 28000, sentiment: 0.67, changePct: 14 } },
  { id: 'sig-062', t: '3d',  channel: 'di', kind: 'volume_spike',    severity: 'info',
    title: 'Diwali seating listing drove 412 saves',
    body:  '3× the typical save rate on event listings. Only 24 seats a night against that demand.',
    metrics: { mentions: 412, reach: 38000, sentiment: 0.71, changePct: 200 } },
];

// Nearby Delhi restaurants competing for the same table. All names are
// deliberately fictional. avatarColor gives each row a distinct identifier
// swatch in the table (Avatar's hash-to-pastel approach is too muted for a
// 6-row table where at-a-glance row identification matters).
//
// isMoment marks rows where any metric moved >50% in the 7d window — these
// surface a visual hint that the row deserves attention and that a matching
// Signal likely exists in the feed. Currently set by hand (Dilli Darbar is
// the demo "competitor moment" matching the sig-002 monsoon-menu narrative).
const LISTENING_COMPETITORS = [
  {
    id: 'cmp-1',
    name: 'Dilli Darbar',        handle: '@dillidarbar',     channel: 'ig',
    avatarColor: '#7C3AED',
    followers: 184500,           followersChange7dPct:  2.4,
    engagementRate: 0.087,       engagementChange7dPct: 56,
    mentions7d: 1820,            mentionsChange7dPct:   94,
    sentiment7d: 0.52,
    rating: 4.5,
    sparkEngagement: [0.058, 0.062, 0.066, 0.071, 0.078, 0.083, 0.087],
    isMoment: true,
  },
  {
    id: 'cmp-2',
    name: 'Copper Chimney Co.',  handle: '@copperchimneyco', channel: 'zo',
    avatarColor: '#0EA5E9',
    followers: 92000,            followersChange7dPct:  1.2,
    engagementRate: 0.041,       engagementChange7dPct:  9,
    mentions7d: 287,             mentionsChange7dPct:   14,
    sentiment7d: 0.41,
    rating: 4.2,
    sparkEngagement: [0.037, 0.038, 0.039, 0.040, 0.040, 0.041, 0.041],
    isMoment: false,
  },
  {
    id: 'cmp-3',
    name: 'Baoli Kitchen',       handle: '@baolikitchen',    channel: 'ig',
    avatarColor: '#10B981',
    followers: 68000,            followersChange7dPct:  3.1,
    engagementRate: 0.061,       engagementChange7dPct:  4,
    mentions7d: 412,             mentionsChange7dPct:   -2,
    sentiment7d: 0.44,
    rating: 4.4,
    sparkEngagement: [0.058, 0.060, 0.059, 0.061, 0.060, 0.061, 0.061],
    isMoment: false,
  },
  {
    id: 'cmp-4',
    name: 'The Curry Room',      handle: '@thecurryroom',    channel: 'sw',
    avatarColor: '#F59E0B',
    followers: 47000,            followersChange7dPct: -0.4,
    engagementRate: 0.019,       engagementChange7dPct: -12,
    mentions7d: 84,              mentionsChange7dPct:   -8,
    sentiment7d: -0.04,
    rating: 3.8,
    sparkEngagement: [0.024, 0.022, 0.021, 0.020, 0.020, 0.019, 0.019],
    isMoment: false,
  },
  {
    id: 'cmp-5',
    name: 'Nawab & Sons',        handle: '@nawabandsons',    channel: 'di',
    avatarColor: '#EC4899',
    followers: 31000,            followersChange7dPct:  4.8,
    engagementRate: 0.052,       engagementChange7dPct: 18,
    mentions7d: 198,             mentionsChange7dPct:   28,
    sentiment7d: 0.36,
    rating: 4.3,
    sparkEngagement: [0.043, 0.045, 0.047, 0.048, 0.050, 0.051, 0.052],
    isMoment: false,
  },
  {
    id: 'cmp-6',
    name: 'Chowk 21',            handle: '@chowk21',         channel: 'gg',
    avatarColor: '#64748B',
    followers: 76000,            followersChange7dPct:  0.0,
    engagementRate: 0.034,       engagementChange7dPct: -1,
    mentions7d: 318,             mentionsChange7dPct:    3,
    sentiment7d: 0.28,
    rating: 4.0,
    sparkEngagement: [0.034, 0.035, 0.034, 0.033, 0.034, 0.034, 0.034],
    isMoment: false,
  },
];

// Per-channel 7-day trend data for the Trends screen. Hand-tuned so the
// demo narrative holds:
//   ig — big positive spike (Act 1 galouti reel)
//   zo — moderate volume + sentiment crashing (Act 3 delivery cluster)
//   gg — stable volume, sentiment slipping on wait times
//   sw — the worst of the delivery problem
//   di — steady growth on the Diwali listing
//   wa — booking enquiries climbing, sentiment high
//
// Mentions/reach changes are stored as percent deltas vs the prior 7d
// window. Sentiment uses an absolute delta on the [-1, +1] scale rather
// than a percent — percent change on a near-zero baseline is misleading,
// same logic we applied to the Overview KPI strip.
const LISTENING_TRENDS = {
  ig: {
    sparkMentions:  [180, 220, 260, 310, 720, 980, 1240],
    sparkReach:     [12000, 15000, 18000, 22000, 48000, 71000, 84000],
    sparkSentiment: [0.51, 0.54, 0.52, 0.58, 0.68, 0.72, 0.75],
    totalMentions7d: 3910,
    totalReach7d:    270000,
    avgSentiment7d:  0.61,
    changeMentionsPct:     340,
    changeReachPct:        285,
    changeSentimentDelta:  0.18,
  },
  gg: {
    sparkMentions:  [410, 380, 430, 450, 425, 460, 490],
    sparkReach:     [42000, 38000, 44000, 47000, 45000, 49000, 53000],
    sparkSentiment: [0.48, 0.51, 0.47, 0.44, 0.40, 0.38, 0.35],
    totalMentions7d: 3045,
    totalReach7d:    318000,
    avgSentiment7d:  0.43,
    changeMentionsPct:     14,
    changeReachPct:        18,
    changeSentimentDelta:  -0.13,
  },
  zo: {
    sparkMentions:  [180, 210, 245, 240, 380, 510, 612],
    sparkReach:     [22000, 25000, 28000, 27000, 65000, 98000, 124000],
    sparkSentiment: [0.42, 0.38, 0.28, 0.10, -0.15, -0.42, -0.71],
    totalMentions7d: 2377,
    totalReach7d:    389000,
    avgSentiment7d:  -0.06,
    changeMentionsPct:     195,
    changeReachPct:        245,
    changeSentimentDelta:  -0.42,
  },
  sw: {
    sparkMentions:  [120, 145, 168, 190, 240, 288, 312],
    sparkReach:     [11000, 14000, 17000, 21000, 28000, 35000, 41000],
    sparkSentiment: [0.32, 0.28, 0.22, 0.18, 0.12, 0.08, 0.04],
    totalMentions7d: 1463,
    totalReach7d:    167000,
    avgSentiment7d:  0.18,
    changeMentionsPct:     88,
    changeReachPct:        145,
    changeSentimentDelta:  -0.23,
  },
  di: {
    sparkMentions:  [38, 42, 51, 48, 56, 64, 71],
    sparkReach:     [22000, 24000, 28000, 26000, 31000, 36000, 42000],
    sparkSentiment: [0.48, 0.51, 0.49, 0.53, 0.55, 0.58, 0.60],
    totalMentions7d: 370,
    totalReach7d:    209000,
    avgSentiment7d:  0.53,
    changeMentionsPct:     28,
    changeReachPct:        44,
    changeSentimentDelta:  0.10,
  },
  wa: {
    sparkMentions:  [42, 48, 54, 51, 62, 70, 76],
    sparkReach:     [6000, 7000, 8200, 7800, 10000, 12000, 14000],
    sparkSentiment: [0.51, 0.52, 0.55, 0.54, 0.56, 0.57, 0.58],
    totalMentions7d: 403,
    totalReach7d:    65000,
    avgSentiment7d:  0.55,
    changeMentionsPct:     60,
    changeReachPct:        72,
    changeSentimentDelta:  0.06,
  },
};

// Saffron House's own handle. Demo only — same root across all channels.
const SAF_HANDLE = '@saffronhouse';

// Saffron House's own stats — pinned reference row at the top of the
// Competitors table so viewers have an "us" anchor against the peer
// benchmarks. Hand-tuned to sit mid-pack: ahead on rating and sentiment,
// behind Dilli Darbar's engagement spike (preserves the competitor-moment
// narrative), with a slight sentiment drag consistent with the delivery
// crisis cluster the demo seeds. Primary channel = ig so engagement is
// apples-to-apples against Dilli Darbar (also ig).
const SAF_SELF_STATS = {
  id: 'saf-self',
  name: 'Saffron House',
  handle: SAF_HANDLE,
  channel: 'ig',
  avatarInitials: 'SH',
  avatarColor: '#B4451F',
  followers: 215000,
  followersChange7dPct:  1.4,
  engagementRate: 0.058,
  engagementChange7dPct: 3.2,
  mentions7d: 1340,
  mentionsChange7dPct:   8.5,
  sentiment7d: 0.58,
  rating: 4.3,
  sparkEngagement: [0.052, 0.054, 0.053, 0.055, 0.057, 0.058, 0.058],
  isSelf: true,
};

// KPI sparkline + baseline data for the Overview screen. 7 daily samples
// per metric — small enough that drawing inline SVG is trivial; long
// enough to read as a trend. Hand-picked so the demo story matches: all
// four metrics trend upward, mentions and reach with a noticeable
// inflection mid-week (consistent with the Act 1 galouti-reel signal
// seeded earlier).
//
// `current` is the most recent day; `baseline` is the comparison-window
// value used to compute the change %. Keeping baseline explicit (rather
// than 'first sample' or 'mean of N-1') so the rendered % is stable +
// matches what a viewer expects from the demo narrative.
const LISTENING_KPIS = {
  mentions: {
    sparkline: [820, 950, 1010, 880, 1180, 1320, 1450],
    current:  7610,   // sum across 7d
    baseline: 5800,   // prior 7d
  },
  reach: {
    sparkline: [42000, 55000, 61000, 49000, 78000, 92000, 110000],
    current:  487000,
    baseline: 380000,
  },
  netSentiment: {
    // Sentiment is reported as an absolute delta, not a % change, because
    // a percent change on a [-1, 1] scale isn't meaningful (sentiment
    // moving from +0.10 to +0.20 is a 100% change but a 0.10 absolute
    // shift; the latter is what readers care about).
    sparkline: [0.42, 0.48, 0.39, 0.51, 0.34, 0.56, 0.62],
    current:  0.47,   // 7d avg
    baseline: 0.31,
  },
  shareOfVoice: {
    // Stored as 0-1 fraction; rendered as %.
    sparkline: [0.38, 0.40, 0.39, 0.41, 0.42, 0.42, 0.44],
    current:  0.44,
    baseline: 0.38,
  },
};

// Hydrate each signal with a stable createdAtISO at module load. Without
// this, anything that needs an absolute timestamp (CSV export, future
// real-time sorts) would recompute against Date.now() at every call and
// drift between back-to-back exports of the same signal. Frozen here
// once, read everywhere.
function relativeTimeToISO(rel, now) {
  const m = /^(\d+)([mhd])$/.exec(rel || '');
  if (!m) return new Date(now).toISOString();
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const ms = unit === 'm' ? n * 60_000
           : unit === 'h' ? n * 3_600_000
           :                 n * 86_400_000;
  return new Date(now - ms).toISOString();
}
(function hydrateSignalTimestamps() {
  const now = Date.now();
  for (const s of LISTENING_SIGNALS) {
    s.createdAtISO = relativeTimeToISO(s.t, now);
  }
})();

// Reviews carry a relative `age` in the seed data and get an absolute ISO
// timestamp here, for the same reason the signals do: the Reviews screen runs
// a live SLA clock against Date.now(), so a hard-coded date would drift and the
// demo would start contradicting itself ("past SLA" in the activity feed while
// the badge says 39 minutes left). Frozen once at load, read everywhere.
(function hydrateReviewTimestamps() {
  const now = Date.now();
  for (const r of REVIEWS) {
    r.t = relativeTimeToISO(r.age, now);
    if (r.reply) r.reply.t = relativeTimeToISO(r.reply.age, now);
  }
  // Header counts are derived, never hand-maintained.
  const slaMs = REVIEW_STATS.slaMins * 60_000;
  const unanswered = REVIEWS.filter(r => !r.replied);
  REVIEW_STATS.unanswered = unanswered.length;
  REVIEW_STATS.unansweredCritical = unanswered.filter(
    r => r.rating <= 2 && (now - new Date(r.t).getTime()) > slaMs
  ).length;
})();

// Persistence (per-user state that survives a reload) ------------------------
// Keyed `saf-listening-v1-*` so we can bump the schema later without colliding
// with stale browser state. Stale v0 (none currently exists) would be treated
// as fresh — no migration in a prototype.
const LISTENING_KEY = 'saf-listening-v1';
const LISTENING_DEFAULT = { dismissed: [], assignments: {}, read: [], notes: {}, tags: {}, filter: null };

function listeningLoad() {
  try {
    const raw = localStorage.getItem(LISTENING_KEY);
    if (!raw) return { ...LISTENING_DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.dismissed)) {
      return { ...LISTENING_DEFAULT };
    }
    return { ...LISTENING_DEFAULT, ...parsed };
  } catch (e) {
    return { ...LISTENING_DEFAULT };
  }
}
function listeningSave(state) {
  try { localStorage.setItem(LISTENING_KEY, JSON.stringify(state)); } catch (e) {}
}

window.PLATFORMS = PLATFORMS;
window.PLATFORM_BY_ID = PLATFORM_BY_ID;
window.PLATFORM_ID_BY_NAME = PLATFORM_ID_BY_NAME;
window.POSTABLE = POSTABLE;
window.REVIEW_CHANNELS = REVIEW_CHANNELS;
window.platformColor = platformColor;
window.LISTENING_SIGNALS = LISTENING_SIGNALS;
window.LISTENING_COMPETITORS = LISTENING_COMPETITORS;
window.LISTENING_TRENDS = LISTENING_TRENDS;
window.LISTENING_KPIS = LISTENING_KPIS;
window.SAF_HANDLE = SAF_HANDLE;
window.SAF_SELF_STATS = SAF_SELF_STATS;
window.LISTENING_KINDS = LISTENING_KINDS;
window.LISTENING_SEVERITIES = LISTENING_SEVERITIES;
window.listeningLoad = listeningLoad;
window.listeningSave = listeningSave;
window.PlatformGlyph = PlatformGlyph;
window.Avatar = Avatar;
window.POSTS = POSTS;
window.SCHEDULED = SCHEDULED;
window.CONVERSATIONS = CONVERSATIONS;
window.POST_COMMENTS = POST_COMMENTS;
window.REVIEWS = REVIEWS;
window.REVIEW_STATS = REVIEW_STATS;
window.MENU_ITEMS = MENU_ITEMS;
window.ANALYTICS_TIME = ANALYTICS_TIME;
window.ANALYTICS_PLATFORM = ANALYTICS_PLATFORM;
window.ANALYTICS_BREAKDOWN = ANALYTICS_BREAKDOWN;
window.ANALYTICS_DEMO = ANALYTICS_DEMO;
window.ANALYTICS_SENTIMENT = ANALYTICS_SENTIMENT;
window.TRENDING_TAGS = TRENDING_TAGS;
window.TEMPLATES = TEMPLATES;
window.ACTIVITY = ACTIVITY;
