// Mock data for Saffron House Social Hub — every section is wired to this.
//
// Saffron House is a single flagship modern-Indian restaurant in Sector 10 Market, Dwarka,
// New Delhi. One location, so there is no location dimension anywhere in the
// data — the org axis is *role*, and the content axis is *channel*.
//
// ─────────────────────────────────────────────────────────────────────────
// EVERY FIELD HERE MUST BE DELIVERABLE BY A REAL API.
//
// Three channels, three first-party APIs: Instagram Graph, Google Business
// Profile, WhatsApp Cloud. If a field cannot be fetched from one of those (or
// derived from text they return, or read from the restaurant's own systems),
// it does not belong in this file — because it will not exist on launch day
// and the screen showing it would be a promise we cannot keep.
//
// Each dataset below names its source. See DATA-SOURCES.md for the endpoint
// map and the exact OAuth scopes to request from the business owner.
//
// Deliberately removed, and why:
//   · Zomato / Swiggy / District — no public API. Merchant data lives in
//     partner dashboards reachable only via paid POS middleware.
//   · Review "dine-in vs delivery" context — Google reviews carry no order
//     context. There is no field for it and no reliable way to infer it.
//   · Post "impressions" — deprecated by Meta for media in favour of `views`.
//   · Post clicks / profile visits per post — not reported per-media.
//   · Competitor reach, impressions, mention volume and sentiment — private
//     to them. Only public counts are obtainable.
//   · Share of voice — not computable without a listening corpus we do not
//     have. Replaced with direction requests, which is real and more useful.
// ─────────────────────────────────────────────────────────────────────────

// PII mask helper used by the Inbox demo (Marketing Manager-only Unmask).
// WhatsApp is the ONLY channel that hands you a guest's phone number —
// Instagram gives a username, Google gives a display name. That asymmetry is
// modelled here rather than papered over.
function maskedPhone(p) { return p ? p.replace(/\d(?=\d{2})/g, '•') : p; }
function maskedAccount(a) { return a ? a.replace(/\d(?=\d{4})/g, '•') : a; }
window.maskedPhone = maskedPhone;
window.maskedAccount = maskedAccount;

// --- Roles + per-role profiles --------------------------------------------
// Source: your own user table. Nothing here comes from a platform.
const ROLES = ['admin', 'executive', 'srexec', 'manager'];

const PROFILES = {
  admin:     { id: 'u-admin',  name: 'Vikram Suri',    email: 'vikram@saffronhouse.in',  role: 'Owner',                short: 'Owner' },
  executive: { id: 'u-exec',   name: 'Ananya Rao',     email: 'ananya@saffronhouse.in',  role: 'Social Coordinator',   short: 'Coordinator' },
  srexec:    { id: 'u-srexec', name: 'Rohit Malhotra', email: 'rohit@saffronhouse.in',   role: 'Guest Relations Lead', short: 'Guest Rel.' },
  manager:   { id: 'u-mgr',    name: 'Priya Menon',    email: 'priya@saffronhouse.in',   role: 'Marketing Manager',    short: 'Marketing' },
};

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
  // reviews
  'review.read':          new Set(['admin', 'executive', 'srexec', 'manager']),
  'review.reply':         new Set(['srexec', 'manager']),
  'review.escalate':      new Set(['srexec', 'manager']),
  'review.comp':          new Set(['manager']),
};

function hasPerm(role, perm) {
  return !!PERMS[perm] && PERMS[perm].has(role);
}

const PROFILE_BY_ID = Object.fromEntries(Object.values(PROFILES).map(p => [p.id, p]));

window.ROLES = ROLES;
window.PROFILES = PROFILES;
window.PROFILE_BY_ID = PROFILE_BY_ID;
window.PERMS = PERMS;
window.hasPerm = hasPerm;

// --- Channels ----------------------------------------------------------------
// Three channels, each with a first-party API the restaurant can be granted
// access to. `caps` lists what that API actually supports, and the UI uses it
// to decide what to render — a channel without `publish` never appears in the
// composer, one without `metrics` never appears in a performance chart.
//
// This is the mechanism that keeps the product honest as channels change:
// add a capability only when the API genuinely provides it.
const PLATFORMS = [
  {
    id: 'ig', name: 'Instagram', short: 'IG',
    kind: 'social',
    api: 'Instagram Graph API',
    caps: ['publish', 'schedule', 'metrics', 'comments', 'dm', 'mentions', 'audience', 'competitor'],
    limit: 2200, dmLimit: 1000,
    color: '#E1306C', colorDark: '#E1306C',
    gradient: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)',
  },
  {
    id: 'gg', name: 'Google', short: 'GG',
    kind: 'review',
    api: 'Google Business Profile API',
    caps: ['publish', 'metrics', 'reviews', 'qanda', 'competitor'],
    limit: 1500, dmLimit: 0,
    color: '#1A73E8', colorDark: '#7FB0F5',
  },
  {
    id: 'wa', name: 'WhatsApp', short: 'WA',
    kind: 'messaging',
    api: 'WhatsApp Cloud API',
    caps: ['dm', 'metrics', 'templates'],
    limit: 4096, dmLimit: 4096,
    color: '#25D366', colorDark: '#25D366',
  },
];
const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map(p => [p.id, p]));
const PLATFORM_ID_BY_NAME = Object.fromEntries(PLATFORMS.map(p => [p.name, p.id]));

function hasCap(id, cap) {
  const p = PLATFORM_BY_ID[id];
  return !!p && p.caps.includes(cap);
}

// Channels that accept an outbound post. WhatsApp is excluded — a broadcast
// there is a template message with its own opt-in rules and per-message cost,
// not a "post".
const POSTABLE = PLATFORMS.filter(p => p.caps.includes('publish')).map(p => p.id);

// Channels carrying public star ratings. Google only.
const REVIEW_CHANNELS = PLATFORMS.filter(p => p.caps.includes('reviews')).map(p => p.id);

// Channels that can appear in the Inbox.
const INBOX_CHANNELS = PLATFORMS.filter(p => p.caps.includes('dm') || p.caps.includes('qanda')).map(p => p.id);

function platformColor(idOrPlatform, theme = 'light') {
  const p = typeof idOrPlatform === 'string' ? PLATFORM_BY_ID[idOrPlatform] : idOrPlatform;
  if (!p) return '#000';
  return theme === 'dark' ? (p.colorDark || p.color) : p.color;
}

// --- Inline channel glyphs ---------------------------------------------------
// Instagram and WhatsApp get their real marks. Google Business Profile gets a
// pin-and-star — the reviews surface, not the Google wordmark.
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
    default: return null;
  }
}

// --- Avatar generator (no images — use initials + tinted bg) -----------------
function Avatar({ name, size = 36, className = '' }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
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
// Source: Instagram Graph API `/media` + `/insights`, Google `localPosts`.
//
// Post-level metrics come from Instagram — it is the only one of the three
// that reports per-post performance in these terms. `metricsFrom` records
// that, and the UI states it rather than implying the numbers are blended.
// Google local posts report views and CTA clicks only; those live in the
// Google section of Analytics rather than being forced into this shape.
//
// Metric names track current Instagram media insights: views, reach, likes,
// comments, shares, saves. `impressions` is gone — Meta deprecated it for
// media in favour of `views`.
const POSTS = [
  {
    id: 'p1',
    format: 'carousel',
    platforms: ['ig','gg'],
    metricsFrom: 'ig',
    status: 'published',
    date: '2026-09-03T12:30:00+05:30',
    author: 'Priya Menon',
    content: 'The monsoon menu is here. Twelve plates built around what Delhi actually eats when it rains — corn and chilli pakoras with saffron chutney, Kashmiri morel pulao, and a ginger-jaggery kheer worth the walk in the wet. Available all week, lunch and dinner. Sector 10 Market, Dwarka.',
    media: { kind: 'image', label: 'Monsoon thali overhead, rain on the window', tone: 'warm' },
    tags: ['#SaffronHouse', '#MonsoonMenu', '#Dwarka', '#DelhiFood'],
    metrics: { views: 21200, reach: 16400, likes: 490, comments: 88, shares: 142, saves: 296, rate: 6.2 },
  },
  {
    id: 'p2',
    format: 'reel',
    platforms: ['ig'],
    metricsFrom: 'ig',
    status: 'published',
    date: '2026-09-02T18:10:00+05:30',
    author: 'Priya Menon',
    content: 'Chef Meera spent three months in Lucknow to get this one right. The galouti is now made the way it was meant to be — 27 spices, ground fresh every morning, cooked on the tawa to order. On the menu from tonight. 🔥',
    media: { kind: 'video', label: 'Galouti kebab on the tawa, close crop', tone: 'night' },
    tags: ['#Galouti', '#SaffronHouse', '#ChefsTable'],
    metrics: { views: 58000, reach: 42000, likes: 2010, comments: 214, shares: 486, saves: 1120, rate: 9.1 },
  },
  {
    id: 'p3',
    format: 'image',
    platforms: ['gg','ig'],
    metricsFrom: 'ig',
    status: 'published',
    date: '2026-09-01T11:00:00+05:30',
    author: 'Vikram Suri',
    content: 'Saffron House has been listed in the Delhi Top 50 for the third year running. Thank you to every guest who walked up those stairs in Sector 10 Market, Dwarka and gave us a table to cook for. We are open seven days, 12pm to 11:30pm.',
    media: null,
    tags: ['#SaffronHouse', '#DelhiTop50', '#Dwarka'],
    metrics: { views: 11400, reach: 9100, likes: 343, comments: 34, shares: 71, saves: 62, rate: 5.6 },
  },
  {
    id: 'p4',
    format: 'image',
    platforms: ['ig'],
    metricsFrom: 'ig',
    status: 'failed',
    date: '2026-09-01T08:00:00+05:30',
    author: 'Ananya Rao',
    content: 'Weekday lunch, sorted. Two courses and a cooler for ₹649, 12 to 4pm. Walk in or book on WhatsApp.',
    tags: ['#SaffronHouse', '#LunchDeal', '#Dwarka'],
    metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 },
    error: 'Instagram access token expired. Please reconnect the account.',
  },
  {
    id: 'p5',
    format: 'image',
    platforms: ['ig','gg'],
    metricsFrom: 'ig',
    status: 'published',
    date: '2026-08-31T16:45:00+05:30',
    author: 'Vikram Suri',
    content: 'Every Sunday our kitchen cooks 200 extra meals for the Nizamuddin community kitchen. No campaign, no hashtag needed — just what a restaurant with a working stove should do. If you want to help, the door is open.',
    media: { kind: 'image', label: 'Kitchen team packing meal boxes', tone: 'sand' },
    tags: ['#SaffronHouse', '#DelhiCommunity'],
    metrics: { views: 23400, reach: 18200, likes: 849, comments: 112, shares: 238, saves: 148, rate: 7.4 },
  },
  {
    id: 'p6',
    format: 'reel',
    platforms: ['ig'],
    metricsFrom: 'ig',
    status: 'published',
    date: '2026-08-29T20:00:00+05:30',
    author: 'Ananya Rao',
    content: '60 seconds inside a Saffron House dinner service. Sound on — that clatter is 140 covers going out in ninety minutes.',
    media: { kind: 'video', label: 'Kitchen pass, dinner service', tone: 'tech' },
    tags: ['#SaffronHouse', '#BehindTheScenes', '#DelhiFood'],
    metrics: { views: 32800, reach: 24600, likes: 1095, comments: 96, shares: 284, saves: 518, rate: 8.1 },
  },
  {
    id: 'p7',
    format: 'image',
    platforms: ['ig'],
    metricsFrom: 'ig',
    status: 'draft',
    date: '2026-09-05T00:00:00+05:30',
    author: 'Ananya Rao',
    content: 'Diwali menu drops Monday. Six courses, one seating a night, 24 seats. You will want to be quick. ✨',
    tags: ['#Diwali', '#SaffronHouse'],
    metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 },
  },
];

// --- Scheduled queue ---------------------------------------------------------
// Source: this hub. Instagram scheduling goes out via the Content Publishing
// API; Google via localPosts. Both are real.
const SCHEDULED = [
  { id: 's1', platforms: ['ig'],      when: '2026-09-05T11:00:00+05:30', content: 'Weekend brunch is back. Unlimited chai, five small plates, and the terrace open from 11am. Carousel below →', tags: ['#SaffronHouse','#DelhiBrunch'] },
  { id: 's2', platforms: ['gg'],      when: '2026-09-05T15:30:00+05:30', content: 'Updated hours for the festive season: we are open till 12:30am from 5 October through Diwali week.', tags: ['#Dwarka'] },
  { id: 's3', platforms: ['ig','gg'], when: '2026-09-06T13:00:00+05:30', content: 'Saturday special — the Awadhi biryani is back, limited to 40 portions a day.', tags: ['#Biryani','#SaffronHouse'] },
  { id: 's4', platforms: ['ig'],      when: '2026-09-07T19:00:00+05:30', content: 'Meet Ramesh, who has been rolling our rotis for eleven years. He does 600 on a Saturday and has never once dropped one.', tags: ['#SaffronHouse','#TeamStories'] },
  { id: 's5', platforms: ['ig','gg'], when: '2026-09-09T11:00:00+05:30', content: 'Diwali menu, six courses, one seating a night from 18 October. Bookings open Monday 9am on WhatsApp.', tags: ['#Diwali','#SaffronHouse'] },
  { id: 's6', platforms: ['ig','gg'], when: '2026-09-12T09:00:00+05:30', content: 'The terrace reopens for the season this weekend — 30 covers, first come, no bookings.', tags: ['#SaffronHouse','#Dwarka'] },
];

// --- Conversations / Inbox ---------------------------------------------------
// Sources:
//   wa → WhatsApp Cloud API (webhooks; real-time; gives you the phone number)
//   ig → Instagram Messaging API (webhooks; username only, no phone)
//   gg → Google Business Profile Q&A (public questions, polled — NOT chat.
//        Google Business Messages was discontinued in 2024, so there is no
//        private messaging channel on Google at all.)
const CONVERSATIONS = [
  {
    id: 'c1', user: 'Rahul Khanna', platform: 'wa', unread: 2, online: true, lastInboundAge: '3h',
    preview: 'Hi, booking for our anniversary on Saturday — is the terrace open?',
    // Phone comes from WhatsApp; the booking reference is from your own
    // booking system, joined on the phone number.
    pii: { phone: '+91 98110 44213', account: 'BKG-2026-08421' },
    messages: [
      { from: 'user', text: 'Hi, I have a booking for Saturday 8pm under Khanna, reference BKG-2026-08421. It is our anniversary — is the terrace open that night?', t: '2026-09-04T09:14:00+05:30' },
      { from: 'user', text: 'Also can you do something for dessert? She loves the kheer.', t: '2026-09-04T09:15:00+05:30' },
      { from: 'saf',  text: 'Congratulations Rahul! Terrace is open Saturday and I have moved you to table 12 by the railing. I have noted the kheer — the kitchen will send it out with a candle.', t: '2026-09-04T09:18:00+05:30', status: 'read' },
      { from: 'user', text: 'Perfect, thank you so much 🙏', t: '2026-09-04T09:19:00+05:30' },
      { from: 'user', text: 'One more thing — is there parking at Sector 10 Market, Dwarka on a Saturday?', t: '2026-09-04T09:42:00+05:30' },
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
    id: 'c3', user: 'Arjun Mehta', platform: 'wa', unread: 3, online: false, lastInboundAge: '21h',
    preview: 'Booked for 8pm, waited 50 minutes for the table…',
    pii: { phone: '+91 99715 88102', account: 'BKG-2026-08109' },
    messages: [
      { from: 'user', text: 'We had a table booked for 8pm on Saturday and were not seated until 8:50. Nobody told us anything. Third time this has happened.', t: '2026-09-03T21:32:00+05:30' },
      { from: 'user', text: 'The food was excellent as always, which makes it more frustrating.', t: '2026-09-03T21:34:00+05:30' },
      { from: 'user', text: 'Is anyone there?', t: '2026-09-04T08:10:00+05:30' },
    ],
  },
  {
    id: 'c4', user: 'Divya Nair', platform: 'ig', unread: 2, online: false,
    preview: 'Do you take bookings for a group of 12?',
    messages: [
      { from: 'user', text: 'Do you take bookings for a group of 12 on a weeknight? And is there a set menu for groups?', t: '2026-09-04T07:02:00+05:30' },
      { from: 'user', text: 'Hoping for the 18th if possible.', t: '2026-09-04T07:05:00+05:30' },
    ],
  },
  {
    id: 'c5', user: 'Meenakshi Reddy', platform: 'gg', unread: 0, online: false,
    preview: 'Q: Do you have high chairs and a kids menu?',
    messages: [
      { from: 'user', text: 'Do you have high chairs and anything on the menu for a two-year-old?', t: '2026-09-02T19:14:00+05:30' },
      { from: 'saf',  text: 'Yes to both — high chairs are always available and the kitchen keeps plain parathas and curd rice off-menu for exactly this. Just mention it when you arrive.', t: '2026-09-02T19:20:00+05:30', status: 'read' },
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
    id: 'c7', user: 'Kabir Sethi', platform: 'wa', unread: 0, online: false, lastInboundAge: '23h',
    preview: 'Corporate dinner for 30 in October — do you do a private area?',
    pii: { phone: '+91 97110 22540' },
    messages: [
      { from: 'user', text: 'Looking at a corporate dinner for 30 in mid-October. Do you have a private dining area, and what is the per-head on a set menu?', t: '2026-09-01T15:00:00+05:30' },
    ],
  },
];

// --- Comments on a post ------------------------------------------------------
// Source: Instagram Graph API `/comments` — read and reply, both supported.
const POST_COMMENTS = [
  { id: 'cm1', user: 'Rahul Khanna',    text: 'Booked for Saturday the moment I saw this. The kheer alone is worth it.', t: '2026-09-03T14:02:00+05:30', sentiment: 'pos' },
  { id: 'cm2', user: 'Sneha Iyer',      text: 'Is the monsoon menu vegetarian-friendly? Half of us do not eat meat.', t: '2026-09-03T14:15:00+05:30', sentiment: 'neu' },
  { id: 'cm3', user: 'Arjun Mehta',     text: 'Food is great but we waited nearly an hour for a booked table on Saturday 😕', t: '2026-09-03T14:42:00+05:30', sentiment: 'neg' },
  { id: 'cm4', user: 'Saffron House',   isBrand: true, text: '@Sneha Iyer seven of the twelve plates are vegetarian, and the morel pulao is the one to order. See you soon!', t: '2026-09-03T15:08:00+05:30', sentiment: 'pos' },
  { id: 'cm5', user: 'Nikhil Bansal',   text: 'Went last night. Corn pakoras were the best thing I have eaten this month. 👌', t: '2026-09-03T17:21:00+05:30', sentiment: 'pos' },
  { id: 'cm6', user: 'Aditi Chaudhary', text: 'Do you take walk-ins on a weekday or is it bookings only?', t: '2026-09-03T18:55:00+05:30', sentiment: 'neu' },
];

// --- Reviews -----------------------------------------------------------------
// Source: Google Business Profile Reviews API.
//
// The API delivers: reviewer display name, star rating, comment text, create
// time, and any existing reply. That is the whole payload — there is NO order
// context ("dine-in" vs "delivery"), no verified-visit flag, and no contact
// details. An earlier version of this prototype showed a dine-in/delivery
// split that no API can supply; it has been removed rather than faked.
//
// `sentiment` and `themes` are DERIVED by running your own classification over
// the comment text the API returns. That is legitimate — the input is real —
// but they are your computation, not Google's data, and the UI badges them so.
//
// There is no review webhook: you poll. Sub-hour freshness is achievable,
// which is what makes the 4-hour reply SLA below a promise you can keep.
const REVIEWS = [
  {
    id: 'rv-1', channel: 'gg', author: 'Ishaan Kapoor', rating: 1, age: '7h',
    sentiment: -0.82, replied: false, escalated: true,
    text: 'Waited 55 minutes for a table we had booked for 8pm. When we finally sat, two of the four dishes we ordered were unavailable. Nobody apologised. For these prices in Sector 10 Market, Dwarka, this is not acceptable.',
    themes: ['wait time', 'availability', 'service'],
  },
  {
    id: 'rv-2', channel: 'gg', author: 'Sameer Vohra', rating: 2, age: '14h',
    sentiment: -0.54, replied: true,
    text: 'Booked a table for 8, seated at 8:50. The food when it arrived was very good but the front of house is clearly under-staffed on weekends.',
    reply: { by: 'Priya Menon', age: '13h', text: 'Sameer — you are right and I am sorry. We have added two floor staff on Friday and Saturday from this week, and we are holding booked tables properly rather than releasing them. Please give us another try.' },
    themes: ['wait time', 'service', 'staffing'],
  },
  {
    id: 'rv-3', channel: 'gg', author: 'Meenakshi Reddy', rating: 5, age: '26h',
    sentiment: 0.91, replied: true,
    text: 'Came in at 9pm with a toddler expecting to be tolerated, and instead got a warm welcome, a high chair before we asked, and plain parathas for her. Farhan on the floor was outstanding. The galouti is as good as everyone says.',
    reply: { by: 'Rohit Malhotra', age: '25h', text: 'Thank you Meenakshi — passed straight to Farhan and the floor team. The paratha stash is permanent policy. See you soon.' },
    themes: ['service', 'family friendly', 'galouti'],
  },
  {
    id: 'rv-4', channel: 'gg', author: 'Divya Nair', rating: 1, age: '5h',
    sentiment: -0.76, replied: false,
    text: 'Second Saturday running that our booking meant nothing. Turned up at 8:30, told it would be "ten minutes", stood at the bar for forty. If you cannot hold the tables, stop taking the bookings.',
    themes: ['wait time', 'booking', 'repeat issue'],
  },
  {
    id: 'rv-5', channel: 'gg', author: 'Nikhil Bansal', rating: 5, age: '2h',
    sentiment: 0.88, replied: false,
    text: 'The monsoon menu is the best thing happening in Sector 10 Market, Dwarka right now. Corn and chilli pakoras with that saffron chutney — I would walk here in the rain for them, which is exactly the point I suppose.',
    themes: ['monsoon menu', 'pakora', 'value'],
  },
  {
    id: 'rv-6', channel: 'gg', author: 'Farah Qureshi', rating: 4, age: '30h',
    sentiment: 0.44, replied: true,
    text: 'Excellent food, generous portions, attentive staff on a quiet Tuesday. Docking one star because it is very loud once the room fills up.',
    reply: { by: 'Priya Menon', age: '29h', text: 'Thank you Farah — the acoustics upstairs are being treated in October, you are not the first to flag it. Glad the rest landed well.' },
    themes: ['noise', 'portions', 'service'],
  },
  {
    id: 'rv-7', channel: 'gg', author: 'Aditi Chaudhary', rating: 3, age: '28h',
    sentiment: 0.02, replied: false,
    text: 'Food is genuinely very good. But it is loud — we could not hold a conversation at the table on a Saturday night, and the acoustics upstairs make it worse. Come for the food, not for a catch-up.',
    themes: ['noise', 'ambience'],
  },
  {
    id: 'rv-8', channel: 'gg', author: 'Rohan Grover', rating: 5, age: '47h',
    sentiment: 0.85, replied: true,
    text: 'Walked in at 10:45pm on a whim expecting to be turned away and instead got the full menu and a genuinely warm welcome. The Awadhi biryani at that hour was better than most sit-down places in Delhi manage at 8pm.',
    reply: { by: 'Rohit Malhotra', age: '46h', text: 'Thank you Rohan! The kitchen runs till 11:30pm — the biryani is capped at 40 portions a day so you got a good one.' },
    themes: ['biryani', 'late kitchen', 'service'],
  },
  {
    id: 'rv-9', channel: 'gg', author: 'Priyanka Sood', rating: 5, age: '3d',
    sentiment: 0.79, replied: false,
    text: 'The kathal galouti is a genuine achievement. I have fed it to three meat-eaters who did not notice. Please never take it off the menu.',
    themes: ['kathal galouti', 'vegetarian'],
  },
  {
    id: 'rv-10', channel: 'gg', author: 'Tarun Bhatia', rating: 4, age: '4d',
    sentiment: 0.51, replied: true,
    text: 'Excellent food, thoughtful wine list, slightly cramped seating downstairs. Ask for a table upstairs if you can.',
    reply: { by: 'Rohit Malhotra', age: '95h', text: 'Noted on the downstairs seating, Tarun — we are re-spacing that room in October. Thank you for the wine list note, that is our sommelier\'s doing.' },
    themes: ['seating', 'wine', 'ambience'],
  },
  {
    id: 'rv-11', channel: 'gg', author: 'Kavya Menon', rating: 3, age: '4d',
    sentiment: 0.08, replied: false,
    text: 'Good food, but we were seated next to the service station and asked twice to move. Fine for a quick dinner, not for an occasion.',
    themes: ['seating', 'service'],
  },
  {
    id: 'rv-12', channel: 'gg', author: 'Aman Thakur', rating: 2, age: '5d',
    sentiment: -0.42, replied: false,
    text: 'Booked well in advance for a birthday, and the table was not ready. Staff were apologetic but clearly overwhelmed. The food is very good — the front of house is not keeping up with how busy you have become.',
    themes: ['wait time', 'booking', 'staffing'],
  },
];

// Aggregate review stats.
//
// Google's API gives you the location's average rating and total review count
// directly. The star DISTRIBUTION is not a field — you compute it by pulling
// every review and bucketing, which is what a nightly sync would do. Response
// rate, SLA and median reply time are entirely your own numbers.
const REVIEW_STATS = {
  avg: 4.3,                                // Google location averageRating
  avgPrev: 4.5,                            // your own history — Google keeps none
  total90d: 186,                           // Google totalReviewCount, windowed
  distribution: [8, 11, 19, 51, 97],       // derived by bucketing pulled reviews
  // Reviews gained per month, from stored totalReviewCount deltas. Google
  // gives you today's count; the velocity is yours to remember.
  velocityPerMonth: 62,
  responseRate: 0.68,                      // your own
  responseRateTarget: 0.90,
  medianResponseMins: 214,
  slaMins: 240,
  unanswered: 0,                           // derived below
  unansweredCritical: 0,                   // derived below
  // 12-week rolling average, oldest → newest. You must store this yourself:
  // Google reports today's average and never the history.
  trend12w: [4.6, 4.6, 4.5, 4.6, 4.5, 4.5, 4.4, 4.5, 4.4, 4.3, 4.3, 4.3],
};

// --- Menu item sentiment -----------------------------------------------------
// FULLY DERIVED — and the most defensible screen in the product precisely
// because of that. No platform offers per-dish sentiment; you build it by
// running entity extraction against YOUR menu over guest text the APIs do
// return (Google review comments, Instagram comments and captions you are
// mentioned in), then aggregating with your own sales data.
//
// `name`, `category` and `price` come from your menu system. `mentions7d`,
// `sentiment` and the theme strings are your classification output.
const MENU_ITEMS = [
  {
    id: 'mi-1', name: 'Galouti Kebab', category: 'Small plates', price: 495,
    mentions7d: 412, mentionsChange7dPct: 68, sentiment: 0.81, sentimentDelta: 0.06,
    spark: [140, 165, 188, 210, 268, 344, 412],
    topPraise: 'Texture and spice balance — repeatedly called the best in Delhi',
    topComplaint: 'Portion size at ₹495 questioned by a minority',
    isMoment: true,
  },
  {
    id: 'mi-2', name: 'Awadhi Biryani', category: 'Mains', price: 645,
    mentions7d: 318, mentionsChange7dPct: 22, sentiment: 0.74, sentimentDelta: 0.02,
    spark: [240, 252, 261, 274, 288, 302, 318],
    topPraise: 'The 40-a-day cap reads as a quality signal, not a limitation',
    topComplaint: 'Sells out before 9pm on weekends',
    isMoment: false,
  },
  {
    id: 'mi-3', name: 'Kathal Galouti', category: 'Small plates', price: 395,
    mentions7d: 196, mentionsChange7dPct: 118, sentiment: 0.86, sentimentDelta: 0.11,
    spark: [42, 58, 71, 96, 128, 162, 196],
    topPraise: 'Vegetarians reporting meat-eaters cannot tell the difference',
    topComplaint: 'Not obvious on the menu — guests ask whether it exists',
    isMoment: true,
  },
  {
    id: 'mi-4', name: 'Corn & Chilli Pakora', category: 'Monsoon menu', price: 285,
    mentions7d: 174, mentionsChange7dPct: 240, sentiment: 0.78, sentimentDelta: 0.14,
    spark: [12, 18, 31, 58, 94, 138, 174],
    topPraise: 'The saffron chutney is doing most of the work and people know it',
    topComplaint: 'Only on the menu while the monsoon menu runs',
    isMoment: true,
  },
  {
    id: 'mi-5', name: 'Paneer Tikka Masala', category: 'Mains', price: 525,
    mentions7d: 148, mentionsChange7dPct: -8, sentiment: 0.12, sentimentDelta: -0.19,
    spark: [188, 181, 174, 170, 162, 154, 148],
    topPraise: 'Consistent, safe order for mixed tables',
    topComplaint: 'Repeatedly called "hotel standard" and over-priced for what it is',
    isMoment: true,
  },
  {
    id: 'mi-6', name: 'Ginger-Jaggery Kheer', category: 'Desserts', price: 245,
    mentions7d: 132, mentionsChange7dPct: 84, sentiment: 0.83, sentimentDelta: 0.08,
    spark: [38, 46, 58, 72, 94, 112, 132],
    topPraise: 'Named unprompted in anniversary and celebration bookings',
    topComplaint: 'Only available with the monsoon menu',
    isMoment: false,
  },
  {
    id: 'mi-7', name: 'Kashmiri Morel Pulao', category: 'Monsoon menu', price: 845,
    mentions7d: 88, mentionsChange7dPct: 46, sentiment: 0.58, sentimentDelta: 0.03,
    spark: [32, 38, 44, 51, 62, 74, 88],
    topPraise: 'Treated as the "occasion" dish; strong photo performance',
    topComplaint: 'Price resistance at ₹845 in comments',
    isMoment: false,
  },
  {
    id: 'mi-8', name: 'Butter Chicken', category: 'Mains', price: 565,
    mentions7d: 84, mentionsChange7dPct: -22, sentiment: -0.14, sentimentDelta: -0.26,
    spark: [142, 132, 124, 112, 102, 92, 84],
    topPraise: 'Regulars defend it as deliberately less sweet than the Delhi norm',
    topComplaint: 'New guests expecting the sweeter standard are disappointed',
    isMoment: true,
  },
];

// --- Analytics ---------------------------------------------------------------
// Restructured per channel, because the three APIs report genuinely different
// things. Flattening them into one "likes / comments / shares" table would
// mean inventing numbers for two of them.

// Instagram Graph API — account + media insights.
const ANALYTICS_IG = {
  daily: [
    { d: 'Mon', reach: 6100,  views: 8200,  interactions: 819 },
    { d: 'Tue', reach: 6900,  views: 9100,  interactions: 941 },
    { d: 'Wed', reach: 6400,  views: 8600,  interactions: 870 },
    { d: 'Thu', reach: 8200,  views: 11100, interactions: 1123 },
    { d: 'Fri', reach: 12800, views: 17400, interactions: 1837 },
    { d: 'Sat', reach: 15400, views: 20900, interactions: 2339 },
    { d: 'Sun', reach: 10400, views: 13800, interactions: 1414 },
  ],
  totals: {
    reach: 66200, views: 89100,
    likes: 5140, comments: 586, shares: 1290, saves: 2280,
    follows: 214, profileVisits: 1840,
  },
  change: { reach: 24, views: 28, likes: 19, comments: 31, shares: 22, saves: 41, follows: 12, profileVisits: 18 },
  // Instagram reports demographics for your FOLLOWERS and engaged audience,
  // not for people who ate here. Suppressed below a follower threshold.
  // Labelled honestly in the UI — for a restaurant these differ a lot.
  audience: {
    age:    [ { label: '18–24', value: 14 }, { label: '25–34', value: 41 }, { label: '35–44', value: 26 }, { label: '45–54', value: 12 }, { label: '55+', value: 7 } ],
    gender: [ { label: 'Female', value: 53 }, { label: 'Male', value: 46 }, { label: 'Other', value: 1 } ],
    cities: [
      { label: 'Dwarka',            value: 38 },
      { label: 'Janakpuri / Uttam Nagar', value: 17 },
      { label: 'Palam / Najafgarh', value: 12 },
      { label: 'Gurugram',          value: 11 },
      { label: 'Rest of Delhi',     value: 15 },
      { label: 'Other',             value: 7 },
    ],
  },
};

// Google Business Profile Performance API — daily metrics, up to 18 months.
// These map to the API's actual metric names (BUSINESS_IMPRESSIONS_*,
// BUSINESS_DIRECTION_REQUESTS, CALL_CLICKS, WEBSITE_CLICKS, BUSINESS_BOOKINGS).
const ANALYTICS_GG = {
  daily: [
    { d: 'Mon', searchImpressions: 3100, mapsImpressions: 2400 },
    { d: 'Tue', searchImpressions: 3300, mapsImpressions: 2600 },
    { d: 'Wed', searchImpressions: 3200, mapsImpressions: 2500 },
    { d: 'Thu', searchImpressions: 3900, mapsImpressions: 3100 },
    { d: 'Fri', searchImpressions: 5800, mapsImpressions: 4900 },
    { d: 'Sat', searchImpressions: 6900, mapsImpressions: 5900 },
    { d: 'Sun', searchImpressions: 4700, mapsImpressions: 3900 },
  ],
  totals: {
    searchImpressions: 30900,
    mapsImpressions: 25300,
    directionRequests: 2510,
    callClicks: 604,
    websiteClicks: 388,
    bookings: 96,
  },
  // Google Q&A. Anyone can answer a question on your listing, including people
  // who have never eaten here — an unanswered question is a stranger's guess
  // waiting to become the top answer. This is polled, not pushed.
  qanda: { open: 14, answeredByUs: 31, answeredByPublic: 9, oldestOpenDays: 11 },
  // Photos on the listing. GBP reports media; freshness affects how the
  // listing performs and is entirely within your control.
  photos: { total: 148, addedLast30d: 2, lastAddedDaysAgo: 24 },
  // Percentage change vs the previous 7 days — you compute this from stored
  // history; the API returns a series, not a delta.
  change: { searchImpressions: 18, mapsImpressions: 24, directionRequests: 31, callClicks: 12, websiteClicks: 9, bookings: 22 },
};

// WhatsApp Cloud API + Business Management analytics.
// There is no "reach" or "followers" here — it is a messaging channel, and the
// honest metrics are conversation and message counts.
const ANALYTICS_WA = {
  daily: [
    { d: 'Mon', conversations: 18, messagesIn: 52,  messagesOut: 57 },
    { d: 'Tue', conversations: 21, messagesIn: 58,  messagesOut: 64 },
    { d: 'Wed', conversations: 22, messagesIn: 61,  messagesOut: 66 },
    { d: 'Thu', conversations: 25, messagesIn: 70,  messagesOut: 74 },
    { d: 'Fri', conversations: 34, messagesIn: 98,  messagesOut: 101 },
    { d: 'Sat', conversations: 41, messagesIn: 119, messagesOut: 122 },
    { d: 'Sun', conversations: 27, messagesIn: 76,  messagesOut: 81 },
  ],
  totals: {
    conversations: 188,
    messagesIn: 534,
    messagesOut: 565,
    templatesSent: 96,
    optedInContacts: 1420,
    medianResponseMins: 6,
  },
  change: { conversations: 60, messagesIn: 54, messagesOut: 58, templatesSent: 12 },
};

// Content-type split — your own tagging of your own posts, cross-referenced
// with Instagram reach. Not a platform metric.
const ANALYTICS_BREAKDOWN = [
  { name: 'Food photo', value: 46, color: '#B4451F' },
  { name: 'Reel',       value: 31, color: '#D99A16' },
  { name: 'Team/BTS',   value: 14, color: '#6E2412' },
  { name: 'Text/offer', value:  9, color: '#E0B36A' },
];

// Sentiment per channel — DERIVED from the text each API returns.
const ANALYTICS_SENTIMENT = [
  { platform: 'Instagram', pos: 82, neu: 14, neg:  4 },
  { platform: 'Google',    pos: 64, neu: 19, neg: 17 },
  { platform: 'WhatsApp',  pos: 76, neu: 20, neg:  4 },
];

// --- Trending hashtags --------------------------------------------------------
// Instagram hashtag search is capped at a small number of unique tags per
// rolling 7-day window and returns only recent media — there is no history.
// This is therefore your own watchlist, not a discovery feed.
const TRENDING_TAGS = ['#SaffronHouse', '#Dwarka', '#DelhiFood', '#MonsoonMenu', '#Galouti', '#DelhiTop50', '#DelhiBrunch', '#Biryani'];

// --- Reply templates ----------------------------------------------------------
const TEMPLATES = {
  en: [
    { id: 't1', title: 'Booking confirmation',  body: 'Thank you for booking with Saffron House. You are confirmed — please let us know if anything changes so we can release the table.' },
    { id: 't2', title: 'Waitlist / full house', body: 'We are fully committed for that evening, but we hold a few walk-in seats at the bar from 9pm. Happy to add you to the waitlist and call if a table opens.' },
    { id: 't3', title: 'Late seating apology',  body: 'You booked a time and we did not honour it — that is on us and I am sorry. Could you tell me the date and the name it was under? I want to look at what went wrong on the floor that night.' },
    { id: 't4', title: 'Dietary question',      body: 'Happy to help — please tell us about any allergies when you book and the kitchen will flag your ticket. Most dishes can be adapted, and we will be honest about the ones that cannot.' },
    { id: 't5', title: 'Positive review reply', body: 'Thank you so much — I have passed this to the kitchen and the floor team, which genuinely makes their week. We hope to see you again soon.' },
    { id: 't6', title: 'Creator / press',       body: 'Thanks for reaching out! We host creators on Tuesday and Wednesday lunches so the kitchen can do it properly. Priya will follow up with dates.' },
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
// Sources per channel:
//   ig → mention/tag webhooks, comments, hashtag search (limited)
//   gg → new reviews, Q&A, Performance API impressions
//   wa → conversation volume
// Severity, kind and sentiment are DERIVED classifications over that input.
//
// Three-act story, all of it API-supported now that the marketplaces are gone:
//   Act 1 — volume spike: the galouti reel (Instagram insights + mentions)
//   Act 2 — competitor move: Dwarka Darbar's cadence and interactions climbing
//           (Instagram Business Discovery — public data on a public account)
//   Act 3 — crisis cluster (critical): weekend booking failures surfacing at
//           once in Google reviews, Instagram comments and WhatsApp. The Top
//           50 listing drove demand the floor cannot absorb.
const LISTENING_KINDS = ['volume_spike', 'competitor_move', 'crisis_cluster', 'mention_burst', 'sentiment_shift'];
const LISTENING_SEVERITIES = ['info', 'warn', 'critical'];

const LISTENING_SIGNALS = [
  // ACT 1 — volume spike
  { id: 'sig-001', t: '2h',  channel: 'ig', kind: 'volume_spike',    severity: 'warn',
    title: 'Instagram mentions up 340% in the last 6 hours',
    body:  'Driven by the galouti reel — largest single-day surge in 90 days. Saves running at 2.2% against a 0.9% baseline.',
    metrics: { mentions: 1240, reach: 84000, sentiment: 0.72, changePct: 340 } },
  // ACT 2 — competitor move
  { id: 'sig-002', t: '5h',  channel: 'ig', kind: 'competitor_move', severity: 'warn',
    title: 'Dwarka Darbar launched a monsoon menu; interactions 4× ours',
    body:  'Their launch reel is carrying roughly four times the public interactions of our comparable post. Same week, same category, and they went first.',
    metrics: { mentions: 482, reach: 0, sentiment: 0.48, changePct: 312 } },
  // ACT 3 — crisis cluster
  { id: 'sig-003', t: '1h',  channel: 'gg', kind: 'crisis_cluster',  severity: 'critical',
    title: 'Booked tables not honoured — complaints across three channels',
    body:  'Four negative reports about weekend booking waits inside four hours, on Google, Instagram comments and WhatsApp simultaneously. Demand from the Top 50 listing is outrunning the floor.',
    metrics: { mentions: 612, reach: 124000, sentiment: -0.71, changePct: 540 },
    children: [
      { channel: 'gg', text: 'Waited 55 minutes for a table we had booked for 8pm.', t: '12m' },
      { channel: 'wa', text: 'Booked for 8pm, not seated until 8:50. Third time.', t: '34m' },
      { channel: 'ig', text: 'Food is great but we waited nearly an hour for a booked table 😕', t: '52m' },
      { channel: 'gg', text: 'Second Saturday running that our booking meant nothing.', t: '2h' },
    ] },

  // Background signals.
  { id: 'sig-010', t: '15m', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Story tags from Sector 10 Market, Dwarka up sharply',
    body:  '42 organic story tags in 15 minutes, mostly Saturday-evening geotags — event-driven, not campaign-driven.',
    metrics: { mentions: 42, reach: 8200, sentiment: 0.61, changePct: 88 } },
  { id: 'sig-011', t: '28m', channel: 'gg', kind: 'sentiment_shift', severity: 'warn',
    title: 'Google sentiment slipping on weekend visits',
    body:  'Reviews mentioning a wait average -0.58 while everything else holds above 0.6. The food is not the problem.',
    metrics: { mentions: 187, reach: 24000, sentiment: -0.24, changePct: 42 } },
  { id: 'sig-012', t: '42m', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Delhi Food Diaries post drove 18k views in 30 minutes',
    body:  'Reel from a 240k-follower page tagging the monsoon menu. 1.2k saves, no paid spend behind it.',
    metrics: { mentions: 96, reach: 18000, sentiment: 0.66, changePct: 140 } },
  { id: 'sig-013', t: '1h',  channel: 'wa', kind: 'volume_spike',    severity: 'warn',
    title: 'WhatsApp booking enquiries up 60% — response time holding',
    body:  '76 enquiries in the window, median first reply under six minutes. Weekend requests are the bulk of it.',
    metrics: { mentions: 76, reach: 0, sentiment: 0.58, changePct: 60 } },
  { id: 'sig-014', t: '1h',  channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Google Q&A activity surge after the Top 50 listing',
    body:  '74 new questions in the last hour, mostly on booking policy and parking. Worth answering in bulk.',
    metrics: { mentions: 74, reach: 31000, sentiment: 0.52, changePct: 110 } },
  { id: 'sig-020', t: '2h',  channel: 'gg', kind: 'volume_spike',    severity: 'warn',
    title: 'Direction requests up 31% week on week',
    body:  'Google Performance shows discovery searches and direction requests both climbing since the listing. More walk-ins arriving without a booking.',
    metrics: { mentions: 6420, reach: 124600, sentiment: 0.4, changePct: 31 } },
  { id: 'sig-021', t: '3h',  channel: 'ig', kind: 'volume_spike',    severity: 'warn',
    title: 'Comments on the monsoon-menu post up 220%',
    body:  '288 net-new comments since 09:00. Sentiment positive but the queue is backlogged and questions are going unanswered.',
    metrics: { mentions: 288, reach: 56000, sentiment: 0.58, changePct: 220 } },
  { id: 'sig-022', t: '3h',  channel: 'ig', kind: 'sentiment_shift', severity: 'info',
    title: 'Kathal galouti sentiment back above 0.8',
    body:  'Vegetarian guests driving the lift — repeated "cannot tell the difference" framing in comments.',
    metrics: { mentions: 144, reach: 22000, sentiment: 0.86, changePct: 12 } },
  { id: 'sig-024', t: '5h',  channel: 'gg', kind: 'volume_spike',    severity: 'info',
    title: 'Branded searches doubling versus a typical Tuesday',
    body:  'Mostly discovery traffic following the Top 50 listing. Maps impressions up 24%.',
    metrics: { mentions: 218, reach: 44000, sentiment: 0.49, changePct: 102 } },
  { id: 'sig-025', t: '6h',  channel: 'gg', kind: 'sentiment_shift', severity: 'warn',
    title: 'Weekend wait-time complaints climbing',
    body:  '23 net-negative reviews since the Top 50 listing. Subject: booked tables not ready on arrival. Demand is outrunning the floor.',
    metrics: { mentions: 47, reach: 9100, sentiment: -0.31, changePct: 64 } },
  { id: 'sig-030', t: '7h',  channel: 'ig', kind: 'competitor_move', severity: 'info',
    title: 'Baoli Kitchen seeded a new food-influencer campaign',
    body:  'Four mid-tier Delhi creators posted within a 2-hour window. Identical brief, identical framing — clearly paid.',
    metrics: { mentions: 88, reach: 0, sentiment: 0.22, changePct: 76 } },
  { id: 'sig-032', t: '9h',  channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Hiring story drove 320 profile visits',
    body:  'Commis chef opening. Mostly Delhi-based profiles, majority with hotel-kitchen experience.',
    metrics: { mentions: 41, reach: 12000, sentiment: 0.34, changePct: 84 } },
  { id: 'sig-033', t: '10h', channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Positive cluster around the terrace reopening',
    body:  '12 organic mentions of the terrace in 90 minutes. Sentiment 0.71.',
    metrics: { mentions: 12, reach: 4400, sentiment: 0.71, changePct: 50 } },
  { id: 'sig-040', t: '12h', channel: 'wa', kind: 'sentiment_shift', severity: 'warn',
    title: 'Booking complaints arriving on WhatsApp',
    body:  'Guests who could not get through on the night are following up the next morning. Linked to the weekend crisis cluster.',
    metrics: { mentions: 16, reach: 0, sentiment: -0.52, changePct: 120 } },
  { id: 'sig-041', t: '14h', channel: 'ig', kind: 'mention_burst',   severity: 'info',
    title: 'Kitchen-service reel passing 100k views',
    body:  'Save rate 4.1% — well above the 1.8% average on food posts. Behind-the-scenes outperforms plated food again.',
    metrics: { mentions: 222, reach: 102000, sentiment: 0.76, changePct: 40 } },
  { id: 'sig-043', t: '18h', channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Old pakora post getting fresh life from regional food pages',
    body:  'Original post 42h old, resurfacing through reshares as the rain continues.',
    metrics: { mentions: 188, reach: 67000, sentiment: 0.68, changePct: 60 } },
  { id: 'sig-051', t: '1d',  channel: 'gg', kind: 'sentiment_shift', severity: 'info',
    title: 'Food-only sentiment steady at 0.6+',
    body:  'Reviews that do not mention a wait hold above 0.6. The rating slide is entirely front-of-house.',
    metrics: { mentions: 412, reach: 72000, sentiment: 0.61, changePct: 4 } },
  { id: 'sig-052', t: '1d',  channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Story poll on "next menu addition" drove 1.8k responses',
    body:  'Top vote: return of the Sunday roast-style thali (42%). Then dessert tasting (28%) and a bar menu (18%).',
    metrics: { mentions: 1800, reach: 22000, sentiment: 0.64, changePct: 95 } },
  { id: 'sig-054', t: '1d',  channel: 'wa', kind: 'mention_burst',   severity: 'info',
    title: 'Diwali pre-announcement template sent to 214 opted-in contacts',
    body:  'No opt-outs. Template messages require prior opt-in and are billed per message, so the list is small on purpose.',
    metrics: { mentions: 214, reach: 0, sentiment: 0.58, changePct: 18 } },
  { id: 'sig-055', t: '1d',  channel: 'ig', kind: 'competitor_move', severity: 'info',
    title: 'Dwarka Darbar posting cadence visibly up',
    body:  'Eleven posts this week against the usual four or five. They are buying the monsoon window.',
    metrics: { mentions: 12, reach: 0, sentiment: 0.12, changePct: 130 } },
  { id: 'sig-060', t: '2d',  channel: 'gg', kind: 'mention_burst',   severity: 'info',
    title: 'Floor-team shoutout review going organic',
    body:  'Guest praising Farhan on the floor. 410 helpful votes, 22 comments — all positive.',
    metrics: { mentions: 22, reach: 16000, sentiment: 0.88, changePct: 40 } },
  { id: 'sig-061', t: '2d',  channel: 'ig', kind: 'sentiment_shift', severity: 'info',
    title: 'Sentiment ticking up on dessert content',
    body:  '+0.14 over 7 days. Driver: a single highly-saved kheer carousel.',
    metrics: { mentions: 134, reach: 28000, sentiment: 0.67, changePct: 14 } },
  { id: 'sig-062', t: '3d',  channel: 'ig', kind: 'volume_spike',    severity: 'info',
    title: 'Diwali teaser saved 412 times',
    body:  '3× the typical save rate on event content. Only 24 seats a night against that demand.',
    metrics: { mentions: 412, reach: 38000, sentiment: 0.71, changePct: 200 } },
];

// --- Competitors -------------------------------------------------------------
// STRICTLY LIMITED TO PUBLIC DATA, because that is all that exists.
//
// Instagram Business Discovery returns, for another public business account:
// followers_count, media_count, and per-media like_count / comments_count /
// caption / timestamp. Google Places returns rating and user_ratings_total.
//
// That is the whole set. Their reach, impressions, ad spend, sentiment and
// mention volume are private, and an earlier version of this screen showed all
// of those. They are gone.
//
// `engagementRate` is DERIVED as interactions ÷ followers — an approximation,
// but computed identically for us and for them, so the comparison is at least
// like-for-like. The UI labels it as derived.
//
// ⚠ THESE SIX RESTAURANTS ARE INVENTED. None is a real establishment in
// Sector 10 Market, Dwarka or anywhere else, and the handles below resolve to
// nothing. Every follower count, rating, review total and post is fabricated.
//
// That matters more here than elsewhere in this file, because these are the
// only records that name a THIRD PARTY. The names are plausible enough that
// one could coincide with a real business, and this screen would then be
// attaching invented ratings and "losing ground to them" claims to a real
// restaurant. If this is ever shown outside a private demo, either replace
// the list with real establishments pulled from Places Nearby Search, or
// rename these to something unmistakably synthetic. The UI carries a visible
// sample-data marker until you do.
const COMPETITOR_CATCHMENT = {
  label: 'Sector 10 Market, Dwarka',
  pincode: '110075',
  radiusKm: 2.5,
  // Flips to false once the list is populated from Places Nearby Search.
  isSampleData: true,
  note: 'Restaurants competing for the same table in the same market. Google Places nearby search seeds the list, you curate it.',
};

const LISTENING_COMPETITORS = [
  {
    id: 'cmp-1', synced: true, name: 'Dwarka Darbar', handle: '@dwarkadarbar', channel: 'ig',
    avatarColor: '#7C3AED',
    followers: 41200,       followersChange7dPct: 3.8,
    postsPerWeek: 11,       avgInteractions: 3584,
    engagementRate: 0.087,  engagementChange7dPct: 56,
    googleRating: 4.5,      googleReviews: 3120,  reviewVelocityPerMonth: 148,
    // Caption themes from Business Discovery media — public text, classified
    // by you. Not a platform field.
    themes: ['offers', 'family dining', 'thali'],
    postingPeak: '7–9pm',
    sparkEngagement: [0.058, 0.062, 0.066, 0.071, 0.078, 0.083, 0.087],
    isMoment: true,
  },
  {
    id: 'cmp-2', synced: true, name: 'Sector 10 Social', handle: '@sector10social', channel: 'ig',
    avatarColor: '#0EA5E9',
    followers: 33800,       followersChange7dPct: 2.1,
    postsPerWeek: 9,        avgInteractions: 1386,
    engagementRate: 0.041,  engagementChange7dPct: 9,
    googleRating: 4.2,      googleReviews: 2240,  reviewVelocityPerMonth: 96,
    themes: ['bar', 'late night', 'events'],
    postingPeak: '9–11pm',
    sparkEngagement: [0.037, 0.038, 0.039, 0.040, 0.040, 0.041, 0.041],
    isMoment: false,
  },
  {
    id: 'cmp-3', synced: true, name: 'Baoli Kitchen', handle: '@baolikitchen', channel: 'ig',
    avatarColor: '#10B981',
    followers: 19600,       postsPerWeek: 8,   followersChange7dPct: 4.2,
    avgInteractions: 1196,
    engagementRate: 0.061,  engagementChange7dPct: 4,
    googleRating: 4.4,      googleReviews: 1180,  reviewVelocityPerMonth: 74,
    themes: ['chef stories', 'north indian', 'kebabs'],
    postingPeak: '1–3pm',
    sparkEngagement: [0.058, 0.060, 0.059, 0.061, 0.060, 0.061, 0.061],
    isMoment: false,
  },
  {
    id: 'cmp-4', synced: true, name: 'The Curry Room', handle: '@thecurryroom', channel: 'ig',
    avatarColor: '#F59E0B',
    followers: 11400,       followersChange7dPct: -0.4,
    postsPerWeek: 3,        avgInteractions: 217,
    engagementRate: 0.019,  engagementChange7dPct: -12,
    googleRating: 3.8,      googleReviews: 640,   reviewVelocityPerMonth: 21,
    themes: ['offers', 'delivery'],
    postingPeak: '12–2pm',
    sparkEngagement: [0.024, 0.022, 0.021, 0.020, 0.020, 0.019, 0.019],
    isMoment: false,
  },
  {
    id: 'cmp-5', synced: true, name: 'Nawab & Sons', handle: '@nawabandsons', channel: 'ig',
    avatarColor: '#EC4899',
    followers: 8900,        followersChange7dPct: 6.1,
    postsPerWeek: 6,        avgInteractions: 463,
    engagementRate: 0.052,  engagementChange7dPct: 18,
    googleRating: 4.3,      googleReviews: 810,   reviewVelocityPerMonth: 58,
    themes: ['biryani', 'value', 'family dining'],
    postingPeak: '7–9pm',
    sparkEngagement: [0.043, 0.045, 0.047, 0.048, 0.050, 0.051, 0.052],
    isMoment: false,
  },
  {
    id: 'cmp-6', synced: true, name: 'Chowk 21', handle: '@chowk21', channel: 'ig',
    avatarColor: '#64748B',
    followers: 16200,       followersChange7dPct: 0.0,
    postsPerWeek: 4,        avgInteractions: 551,
    engagementRate: 0.034,  engagementChange7dPct: -1,
    googleRating: 4.0,      googleReviews: 1420,  reviewVelocityPerMonth: 44,
    themes: ['street food', 'offers'],
    postingPeak: '6–8pm',
    sparkEngagement: [0.034, 0.035, 0.034, 0.033, 0.034, 0.034, 0.034],
    isMoment: false,
  },

  // Not yet pulled. `synced: false` means we hold the identity but no
  // Business Discovery response — no followers, no feed, no engagement rate.
  // A sync fills these in; until then they are correctly absent from the
  // table rather than shown with placeholder zeroes.
  {
    id: 'cmp-7', name: 'Wok Republic', handle: '@wokrepublicdwarka', channel: 'ig',
    avatarColor: '#0D9488', synced: false,
    followers: 14800,       followersChange7dPct: 1.8,
    avgInteractions: 533,
    googleRating: 4.1,      googleReviews: 960,   reviewVelocityPerMonth: 51,
    themes: ['chinese', 'offers', 'late night'],
    postingPeak: '8–10pm',
    sparkEngagement: [0.031, 0.032, 0.033, 0.033, 0.034, 0.035, 0.036],
    isMoment: false,
  },
  {
    id: 'cmp-8', name: 'The Bread Room', handle: '@thebreadroom.dwk', channel: 'ig',
    avatarColor: '#A16207', synced: false,
    followers: 9400,        followersChange7dPct: 5.2,
    avgInteractions: 677,
    googleRating: 4.6,      googleReviews: 540,   reviewVelocityPerMonth: 38,
    themes: ['bakes', 'coffee', 'chef stories'],
    postingPeak: '9–11am',
    sparkEngagement: [0.058, 0.061, 0.063, 0.066, 0.068, 0.070, 0.072],
    isMoment: true,
  },
  {
    id: 'cmp-9', name: 'Tandoori Nights', handle: '@tandoorinights10', channel: 'ig',
    avatarColor: '#9333EA', synced: false,
    followers: 12100,       followersChange7dPct: 0.6,
    avgInteractions: 375,
    googleRating: 4.0,      googleReviews: 1120,  reviewVelocityPerMonth: 47,
    themes: ['kebabs', 'offers', 'family dining'],
    postingPeak: '7–9pm',
    sparkEngagement: [0.028, 0.028, 0.029, 0.029, 0.030, 0.030, 0.031],
    isMoment: false,
  },
];

// --- Competitor post feeds ---------------------------------------------------
// In production this array IS the Business Discovery `media` edge:
//
//   GET /{ig-user-id}?fields=business_discovery.username(THEIR_HANDLE){
//         followers_count, media_count,
//         media.limit(50){ caption, media_type, timestamp,
//                          like_count, comments_count, permalink }}
//
// That is the complete field list. Note what is NOT in it:
//
//   · comment TEXT — only `comments_count`. There is no way to read what
//     people said on a competitor's post, so THERE IS NO SENTIMENT TO
//     COMPUTE. Sentiment on their own caption would just be marketing copy
//     rating itself. The viewer shows performance against their own median
//     instead, which answers the real question ("did this work for them?")
//     with data that actually exists.
//   · reach, impressions, saves, shares — private to them.
//   · media files we may store. Meta and Google terms both restrict caching
//     platform media, so the UI shows a format placeholder and links out to
//     the permalink rather than mirroring their photos.
//
// `theme` and `isOffer` are DERIVED by classifying the caption — their public
// text, our classification.

// Fixed variance pattern so the demo is stable across reloads and, more
// importantly, so a competitor's post interactions average exactly to the
// `avgInteractions` shown on their row. Two screens must never disagree.
const FEED_VARIANCE = [1.00, 0.62, 1.48, 0.81, 1.15, 0.55, 2.10, 0.74, 0.93,
                       1.32, 0.68, 1.05, 0.88, 1.62, 0.71, 1.24, 0.59, 1.41];

function buildCompetitorFeed(comp, seeds, nowMs) {
  // A missing avgInteractions silently produced NaN through every derived
  // number, and fmt() renders NaN as an em dash — so the feed looked merely
  // empty rather than broken. Refuse instead.
  if (!Number.isFinite(comp.avgInteractions) || !Number.isFinite(comp.followers)) {
    throw new Error(
      `Cannot build feed for ${comp.id}: avgInteractions and followers must be finite numbers ` +
      `(got ${comp.avgInteractions} / ${comp.followers}). Business Discovery returns both.`
    );
  }
  const n = seeds.length;
  const raw = seeds.map((_, i) => FEED_VARIANCE[i % FEED_VARIANCE.length]);
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  // Normalise so the feed's mean interactions equal the row's avgInteractions.
  const mult = raw.map(v => v / mean);

  return seeds.map((seed, i) => {
    const interactions = Math.round(comp.avgInteractions * mult[i]);
    // Comments run roughly 6–9% of interactions on restaurant content.
    const comments = Math.max(1, Math.round(interactions * (0.06 + (i % 4) * 0.01)));
    const likes = Math.max(0, interactions - comments);
    // Spread across the trailing 14 days, newest first.
    const hoursAgo = Math.round((i * (14 * 24)) / n) + (i % 3) * 2;
    return {
      id: `${comp.id}-m${i + 1}`,
      caption: seed.caption,
      format: seed.format,
      theme: seed.theme,
      isOffer: !!seed.isOffer,
      hashtags: seed.tags || [],
      likes,
      comments,
      interactions,
      // Performance against this competitor's own median — the honest answer
      // to "did this post work", computable from public counts alone.
      index: 0,   // filled below, once the median is known
      // Real shape once the data is real; a marker while it is not, so a
      // permalink copied out of the app cannot masquerade as a live post.
      permalink: COMPETITOR_CATCHMENT.isSampleData
        ? `sample://${comp.id}/m${i + 1}`
        : `https://instagram.com/p/${comp.id}-m${i + 1}`,
      t: new Date(nowMs - hoursAgo * 3_600_000).toISOString(),
    };
  });
}

const COMPETITOR_POST_SEEDS = {
  'cmp-1': [ // Dwarka Darbar — offers, family dining, thali
    { caption: 'FLAT 20% OFF this weekend on all thalis. Dine-in only. Sector 10 Market.', format: 'image', theme: 'offers', isOffer: true, tags: ['#DwarkaFood','#Offer'] },
    { caption: 'The Darbar Special Thali — 11 items, one plate, ₹399. Nobody leaves hungry.', format: 'carousel', theme: 'thali', tags: ['#Thali','#DwarkaDarbar'] },
    { caption: 'Sunday lunch at Darbar. Bring the whole family, we will find the table.', format: 'reel', theme: 'family dining', tags: ['#FamilyDining'] },
    { caption: 'Monsoon menu is live. Pakoras, chai, and a roof that does not leak.', format: 'reel', theme: 'offers', tags: ['#MonsoonMenu'] },
    { caption: 'Kids eat free on Tuesdays. Under 10, with any adult main.', format: 'image', theme: 'family dining', isOffer: true, tags: ['#KidsEatFree'] },
    { caption: 'Our dal makhani takes 12 hours. You will taste every one of them.', format: 'reel', theme: 'thali', tags: ['#DalMakhani'] },
    { caption: 'BUY 1 GET 1 on all starters, Monday to Thursday, 3–7pm.', format: 'image', theme: 'offers', isOffer: true, tags: ['#BOGO','#Dwarka'] },
    { caption: 'Birthday at Darbar? Cake cutting is on us. Just tell us when you book.', format: 'image', theme: 'family dining', tags: ['#Celebrations'] },
    { caption: 'Behind the tandoor at 7pm on a Saturday. Sound on.', format: 'reel', theme: 'thali', tags: ['#Tandoor'] },
    { caption: 'Corporate lunch boxes from ₹199. Delivery across Dwarka.', format: 'image', theme: 'offers', isOffer: true, tags: ['#CorporateLunch'] },
    { caption: 'The paneer tikka everyone in Sector 10 keeps talking about.', format: 'image', theme: 'thali', tags: ['#PaneerTikka'] },
    { caption: 'Weekend brunch buffet — 40+ items, ₹649 per head.', format: 'carousel', theme: 'offers', isOffer: true, tags: ['#Brunch'] },
    { caption: 'Three generations, one table. This is what Sunday should look like.', format: 'image', theme: 'family dining', tags: ['#FamilyDining'] },
    { caption: 'New: Hyderabadi biryani, every Friday, limited portions.', format: 'reel', theme: 'thali', tags: ['#Biryani'] },
    { caption: 'Rain outside, rajma chawal inside. Open till 11.', format: 'image', theme: 'family dining', tags: ['#ComfortFood'] },
    { caption: 'Independence Day thali, ₹299, this week only.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Meet Suresh, who has run our tandoor for nine years.', format: 'reel', theme: 'family dining', tags: ['#TeamStories'] },
    { caption: 'Table for 12? We have the private room. Book on WhatsApp.', format: 'image', theme: 'family dining', tags: ['#GroupDining'] },
  ],
  'cmp-2': [ // Sector 10 Social — bar, late night, events
    { caption: 'Live music every Friday. Doors 8pm, no cover.', format: 'reel', theme: 'events', tags: ['#LiveMusic','#Dwarka'] },
    { caption: 'HAPPY HOURS 4–8pm. 1+1 on all cocktails.', format: 'image', theme: 'bar', isOffer: true, tags: ['#HappyHours'] },
    { caption: 'Kitchen open till 1am. Because Dwarka deserves a late night.', format: 'image', theme: 'late night', tags: ['#LateNight'] },
    { caption: 'Karaoke Wednesdays are back. Bring your worst.', format: 'reel', theme: 'events', tags: ['#Karaoke'] },
    { caption: 'The Sector 10 Sour — our bartender will not tell us what is in it.', format: 'reel', theme: 'bar', tags: ['#Cocktails'] },
    { caption: 'Match screening this Sunday. Big screen, bigger nachos.', format: 'image', theme: 'events', tags: ['#MatchDay'] },
    { caption: 'Ladies night Thursday — selected drinks on the house till 10pm.', format: 'image', theme: 'bar', isOffer: true, tags: ['#LadiesNight'] },
    { caption: 'That 12am plate of chilli garlic noodles hits different.', format: 'image', theme: 'late night', tags: ['#LateNight'] },
    { caption: 'Open mic night. Poets, comics, and one guy with a ukulele.', format: 'reel', theme: 'events', tags: ['#OpenMic'] },
    { caption: 'New cocktail menu drops Friday. 14 drinks, 4 of them dangerous.', format: 'carousel', theme: 'bar', tags: ['#NewMenu'] },
    { caption: 'Weekend DJ nights, 9pm onwards. Entry free before 10.', format: 'reel', theme: 'events', tags: ['#DJNight'] },
    { caption: 'Pitchers at ₹599 all week. Yes, all week.', format: 'image', theme: 'bar', isOffer: true, tags: ['#Offer'] },
    { caption: 'Rooftop is open again now the rain has eased.', format: 'image', theme: 'late night', tags: ['#Rooftop'] },
    { caption: 'Sunday sundowners. 5pm, terrace, acoustic set.', format: 'reel', theme: 'events', tags: ['#Sundowner'] },
  ],
  'cmp-3': [ // Baoli Kitchen — chef stories, north indian, kebabs
    { caption: 'Chef Iqbal learned this seekh from his grandmother in Old Delhi.', format: 'reel', theme: 'chef stories', tags: ['#ChefStories'] },
    { caption: 'The galouti, made the long way. 21 spices, ground every morning.', format: 'reel', theme: 'kebabs', tags: ['#Galouti'] },
    { caption: 'Our nihari runs from 8am Sunday. It usually goes by 11.', format: 'image', theme: 'north indian', tags: ['#Nihari'] },
    { caption: 'Kakori kebab — soft enough to eat with a spoon. That is the test.', format: 'image', theme: 'kebabs', tags: ['#Kakori'] },
    { caption: 'Inside the kitchen at 6am. The marination starts before we open.', format: 'reel', theme: 'chef stories', tags: ['#BehindTheScenes'] },
    { caption: 'Butter chicken, but the Lucknow way. Less sweet, more smoke.', format: 'image', theme: 'north indian', tags: ['#ButterChicken'] },
    { caption: 'Chef Iqbal on why he will not put a pizza on this menu.', format: 'reel', theme: 'chef stories', tags: ['#ChefStories'] },
    { caption: 'Fresh sheermal from the tandoor, every evening at 7.', format: 'image', theme: 'north indian', tags: ['#Sheermal'] },
    { caption: 'The mutton burra takes 40 minutes. Order it when you sit down.', format: 'image', theme: 'kebabs', tags: ['#Burra'] },
    { caption: 'We source our meat from the same butcher since 2016.', format: 'reel', theme: 'chef stories', tags: ['#Sourcing'] },
    { caption: 'Kebab platter for four, ₹899. Six kinds.', format: 'carousel', theme: 'kebabs', isOffer: true, tags: ['#KebabPlatter'] },
    { caption: 'Sunday biryani. One pot, 40 portions, no repeats.', format: 'image', theme: 'north indian', tags: ['#Biryani'] },
  ],
  'cmp-4': [ // The Curry Room — offers, delivery
    { caption: '30% OFF on all online orders this week. Code CURRY30.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Free delivery across Dwarka on orders above ₹399.', format: 'image', theme: 'delivery', isOffer: true, tags: ['#FreeDelivery'] },
    { caption: 'Family combo — 2 mains, 2 breads, rice, dessert. ₹649.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Combo'] },
    { caption: 'Hot and fresh in 30 minutes or your next one is on us.', format: 'image', theme: 'delivery', tags: ['#Delivery'] },
    { caption: 'Weekday lunch boxes ₹149. Order before 11am.', format: 'image', theme: 'offers', isOffer: true, tags: ['#LunchBox'] },
    { caption: 'New packaging. Nothing spills now, we promise.', format: 'image', theme: 'delivery', tags: ['#Packaging'] },
  ],
  'cmp-5': [ // Nawab & Sons — biryani, value, family dining
    { caption: 'The Nawabi dum biryani. Sealed with dough, opened at your table.', format: 'reel', theme: 'biryani', tags: ['#DumBiryani'] },
    { caption: 'Family pack biryani — feeds 4, ₹749. Weekends only.', format: 'image', theme: 'value', isOffer: true, tags: ['#FamilyPack'] },
    { caption: 'Why our rice rests for 20 minutes before it reaches you.', format: 'reel', theme: 'biryani', tags: ['#Biryani'] },
    { caption: 'Thali at ₹249. Eight items. Sector 10 Market.', format: 'image', theme: 'value', isOffer: true, tags: ['#Thali'] },
    { caption: 'Sunday afternoons at Nawab. Loud, full, exactly right.', format: 'image', theme: 'family dining', tags: ['#FamilyDining'] },
    { caption: 'Mutton biryani is back on the weekend menu.', format: 'image', theme: 'biryani', tags: ['#MuttonBiryani'] },
    { caption: 'Kids under 8 eat free with any family pack.', format: 'image', theme: 'family dining', isOffer: true, tags: ['#KidsEatFree'] },
    { caption: 'The kitchen at 11am — 60 kilos of rice, before service.', format: 'reel', theme: 'biryani', tags: ['#BehindTheScenes'] },
    { caption: 'Best value in Sector 10 and we will keep saying it.', format: 'image', theme: 'value', tags: ['#Value'] },
    { caption: 'Bulk orders for functions. Call us a week ahead.', format: 'image', theme: 'family dining', tags: ['#BulkOrders'] },
  ],
  'cmp-7': [ // Wok Republic — chinese, offers, late night
    { caption: 'Hakka noodles, wok-tossed to order. Nothing sits under a lamp here.', format: 'reel', theme: 'chinese', tags: ['#HakkaNoodles'] },
    { caption: 'MIDWEEK DEAL: any two mains + rice, ₹499.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Open till 12:30am Friday and Saturday. Dwarka, we hear you.', format: 'image', theme: 'late night', tags: ['#LateNight'] },
    { caption: 'The chilli garlic prawns are back on the menu.', format: 'image', theme: 'chinese', tags: ['#Prawns'] },
    { caption: 'Dim sum baskets from ₹249. Steamed to order, six a basket.', format: 'carousel', theme: 'chinese', tags: ['#DimSum'] },
    { caption: 'Free Coke with every order above ₹599 this week.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Wok station at 9pm on a Saturday. Sound on.', format: 'reel', theme: 'late night', tags: ['#BehindTheScenes'] },
    { caption: 'New: Burnt garlic fried rice. Order it with the chilli chicken.', format: 'image', theme: 'chinese', tags: ['#FriedRice'] },
    { caption: 'Student combo ₹199, weekdays till 5pm.', format: 'image', theme: 'offers', isOffer: true, tags: ['#StudentDeal'] },
    { caption: 'Our chef trained in Kolkata for six years. It shows in the chowmein.', format: 'reel', theme: 'chinese', tags: ['#ChefStories'] },
    { caption: 'Late-night delivery till 1am across Sector 10 and 11.', format: 'image', theme: 'late night', tags: ['#LateNight'] },
    { caption: 'Momos, steamed or fried, ₹149. All week.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Momos'] },
  ],
  'cmp-8': [ // The Bread Room — bakes, coffee, chef stories
    { caption: 'Sourdough comes out at 8am. It rarely lasts past 11.', format: 'image', theme: 'bakes', tags: ['#Sourdough'] },
    { caption: 'Our croissants take three days. Here is day two.', format: 'reel', theme: 'chef stories', tags: ['#Croissant'] },
    { caption: 'Single-origin filter from Chikmagalur this month.', format: 'image', theme: 'coffee', tags: ['#Coffee'] },
    { caption: 'Cinnamon rolls, Saturday only, from 9am.', format: 'image', theme: 'bakes', tags: ['#CinnamonRoll'] },
    { caption: 'Meet Anjali, who has been baking here since we opened.', format: 'reel', theme: 'chef stories', tags: ['#TeamStories'] },
    { caption: 'Cold brew is back for the season.', format: 'image', theme: 'coffee', tags: ['#ColdBrew'] },
    { caption: 'Whole-wheat loaves now daily. No maida, no shortcuts.', format: 'image', theme: 'bakes', tags: ['#Bread'] },
    { caption: 'The 4pm bake. Everything half price after 8pm.', format: 'image', theme: 'bakes', isOffer: true, tags: ['#Offer'] },
    { caption: 'Why we grind our coffee to order and not before.', format: 'reel', theme: 'coffee', tags: ['#Coffee'] },
    { caption: 'Birthday cakes on 48 hours notice. WhatsApp us.', format: 'image', theme: 'bakes', tags: ['#Cakes'] },
  ],
  'cmp-9': [ // Tandoori Nights — kebabs, offers, family dining
    { caption: 'The tandoor goes on at 4pm. Everything after that is timing.', format: 'reel', theme: 'kebabs', tags: ['#Tandoor'] },
    { caption: 'KEBAB PLATTER ₹649 — six kinds, serves three.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Malai tikka, the way it should be. Soft, not sweet.', format: 'image', theme: 'kebabs', tags: ['#MalaiTikka'] },
    { caption: 'Sunday family lunch, kids under 8 free.', format: 'image', theme: 'family dining', isOffer: true, tags: ['#FamilyDining'] },
    { caption: 'Our seekh is hand-minced every morning. No machines.', format: 'reel', theme: 'kebabs', tags: ['#Seekh'] },
    { caption: 'Terrace seating open now the rain has eased.', format: 'image', theme: 'family dining', tags: ['#Terrace'] },
    { caption: 'Buy one main, get a naan basket free. Till Thursday.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Afghani chicken — marinated 18 hours, cooked in eight minutes.', format: 'image', theme: 'kebabs', tags: ['#Afghani'] },
    { caption: 'Large tables welcome. We seat up to 20 without notice.', format: 'image', theme: 'family dining', tags: ['#GroupDining'] },
    { caption: 'The grill at 8pm. This is the busiest hour of our week.', format: 'reel', theme: 'kebabs', tags: ['#BehindTheScenes'] },
  ],
  'cmp-6': [ // Chowk 21 — street food, offers
    { caption: 'Chaat counter is open. Golgappas till they run out.', format: 'reel', theme: 'street food', tags: ['#Chaat'] },
    { caption: 'ALL CHAAT ₹99 — this weekend only.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Offer'] },
    { caption: 'Dahi bhalla the way Chandni Chowk does it.', format: 'image', theme: 'street food', tags: ['#DahiBhalla'] },
    { caption: 'Monsoon means pakoras. We are ready.', format: 'reel', theme: 'street food', tags: ['#Pakora'] },
    { caption: 'Combo: chole bhature + lassi, ₹199.', format: 'image', theme: 'offers', isOffer: true, tags: ['#Combo'] },
    { caption: 'The tikki gets fried to order. That is why it takes six minutes.', format: 'reel', theme: 'street food', tags: ['#AlooTikki'] },
    { caption: 'Evening rush at the chaat counter, 7pm.', format: 'image', theme: 'street food', tags: ['#StreetFood'] },
    { caption: 'Student discount — 15% off with any college ID.', format: 'image', theme: 'offers', isOffer: true, tags: ['#StudentDiscount'] },
  ],
};

// Attach the feeds, then derive each competitor's cadence, average
// interactions and per-post performance index FROM the feed — so the row
// summary and the expanded posts can never disagree.
// Apply one Business Discovery response to a competitor row: build the feed,
// then derive every summary number FROM that feed so the row and the expanded
// posts can never disagree. Called at load for already-synced rows, and by
// syncCompetitors() for rows pulled later.
function applyCompetitorSync(comp, nowMs) {
  const seeds = COMPETITOR_POST_SEEDS[comp.id] || [];
  if (!seeds.length) return false;

  try {
    comp.recentPosts = buildCompetitorFeed(comp, seeds, nowMs);
  } catch (err) {
    comp.syncError = err.message;
    comp.synced = false;
    return false;
  }
  comp.syncError = null;
  comp.postsPerWeek = Math.round(seeds.length / 2);

  const inter = comp.recentPosts.map(m => m.interactions);
  const sorted = [...inter].sort((a, b) => a - b);
  const med = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  comp.medianInteractions = med;
  comp.recentPosts.forEach(m => { m.index = med ? m.interactions / med : 1; });

  comp.avgInteractions = Math.round(inter.reduce((a, b) => a + b, 0) / inter.length);
  comp.engagementRate = +(comp.avgInteractions / comp.followers).toFixed(4);
  comp.offerShare = comp.recentPosts.filter(m => m.isOffer).length / comp.recentPosts.length;
  comp.synced = true;
  comp.lastSyncedAt = new Date(nowMs).toISOString();
  return true;
}

(function hydrateCompetitorFeeds() {
  const now = Date.now();
  for (const comp of LISTENING_COMPETITORS) {
    if (comp.synced) applyCompetitorSync(comp, now);
  }
})();

// --- Establishments in the catchment -----------------------------------------
// The candidate pool the competitor set is picked from.
//
// In production this list comes from Google Places Nearby Search around the
// market's coordinates:
//
//   GET /place/nearbysearch/json?location=LAT,LNG&radius=2500&type=restaurant
//   → name, place_id, rating, user_ratings_total, vicinity, business_status,
//     price_level, opening_hours
//
// Places gives you the storefront. It does NOT give you social handles — no
// API maps a place_id to an Instagram account — so the handle is found by
// hand once, then stored. That manual step is why this is a curated list
// rather than a live feed.
//
// ⚠ INVENTED, like the competitor rows they feed. No establishment below is a
// real business in Sector 10 Market, Dwarka. See COMPETITOR_CATCHMENT.
//
// Whether an establishment can actually be ANALYSED is the interesting part,
// and it is not a yes/no — it is a tier:
//
//   full    — Google listing + a public Instagram Business/Creator account.
//             Business Discovery works, so you get cadence, engagement and
//             their actual posts.
//   ratings — Google listing only. Their Instagram is personal, private, or
//             does not exist, and Business Discovery CANNOT read personal or
//             private accounts at all. You still get rating, review count and
//             review velocity, which is enough to track a rival's trajectory.
//   none    — no Google listing (delivery-only kitchens often have none).
//             Nothing to analyse; cannot be tracked.
//
// X/Twitter is listed where a handle exists, but is deliberately not part of
// the tier calculation. Reading another account's posts needs a paid API tier
// — the free tier is effectively write-only — and the entry price is well
// beyond a single-outlet restaurant's software budget. Pricing has also
// changed repeatedly, so verify before planning around it. In practice almost
// no neighbourhood restaurant in Delhi posts there anyway.
const ESTABLISHMENTS = [
  { id: 'est-1',  competitorId: 'cmp-1', name: 'Dwarka Darbar',            category: 'North Indian',   distanceKm: 0.2,
    google: { rating: 4.5, reviews: 3120, status: 'OPERATIONAL' },
    instagram: { handle: '@dwarkadarbar',    accountType: 'business' }, x: null },
  { id: 'est-2',  competitorId: 'cmp-2', name: 'Sector 10 Social',         category: 'Bar & kitchen',  distanceKm: 0.3,
    google: { rating: 4.2, reviews: 2240, status: 'OPERATIONAL' },
    instagram: { handle: '@sector10social',  accountType: 'business' }, x: { handle: '@sector10social' } },
  { id: 'est-3',  competitorId: 'cmp-3', name: 'Baoli Kitchen',            category: 'North Indian',   distanceKm: 0.6,
    google: { rating: 4.4, reviews: 1180, status: 'OPERATIONAL' },
    instagram: { handle: '@baolikitchen',    accountType: 'business' }, x: null },
  { id: 'est-4',  competitorId: 'cmp-4', name: 'The Curry Room',           category: 'North Indian',   distanceKm: 1.1,
    google: { rating: 3.8, reviews: 640,  status: 'OPERATIONAL' },
    instagram: { handle: '@thecurryroom',    accountType: 'business' }, x: null },
  { id: 'est-5',  competitorId: 'cmp-5', name: 'Nawab & Sons',             category: 'Biryani',        distanceKm: 0.4,
    google: { rating: 4.3, reviews: 810,  status: 'OPERATIONAL' },
    instagram: { handle: '@nawabandsons',    accountType: 'business' }, x: null },
  { id: 'est-6',  competitorId: 'cmp-6', name: 'Chowk 21',                 category: 'Street food',    distanceKm: 0.2,
    google: { rating: 4.0, reviews: 1420, status: 'OPERATIONAL' },
    instagram: { handle: '@chowk21',         accountType: 'business' }, x: null },

  // Trackable, but not currently in the competitor set.
  { id: 'est-7',  competitorId: 'cmp-7',  name: 'Wok Republic',             category: 'Chinese',        distanceKm: 0.5,
    google: { rating: 4.1, reviews: 960,  status: 'OPERATIONAL' },
    instagram: { handle: '@wokrepublicdwarka', accountType: 'business' }, x: { handle: '@wokrepublic' } },
  { id: 'est-8',  competitorId: 'cmp-8',  name: 'The Bread Room',           category: 'Bakery & cafe',  distanceKm: 0.7,
    google: { rating: 4.6, reviews: 540,  status: 'OPERATIONAL' },
    instagram: { handle: '@thebreadroom.dwk', accountType: 'creator' }, x: null },
  { id: 'est-9',  competitorId: 'cmp-9',  name: 'Tandoori Nights',          category: 'North Indian',   distanceKm: 1.4,
    google: { rating: 4.0, reviews: 1120, status: 'OPERATIONAL' },
    instagram: { handle: '@tandoorinights10', accountType: 'business' }, x: null },
  { id: 'est-10', competitorId: null,    name: 'Punjabi Rasoi',            category: 'North Indian',   distanceKm: 0.9,
    google: { rating: 4.2, reviews: 780,  status: 'OPERATIONAL' },
    // A business account that has not posted in months: Business Discovery
    // works, but there is nothing to compare on.
    instagram: { handle: '@punjabirasoi.dwarka', accountType: 'business', lastPostDaysAgo: 142 }, x: null },

  // Ratings only — Instagram cannot be read.
  { id: 'est-11', competitorId: null,    name: 'Gupta Bhojnalaya',         category: 'North Indian',   distanceKm: 0.3,
    google: { rating: 4.4, reviews: 2010, status: 'OPERATIONAL' },
    instagram: { handle: '@guptabhojnalaya', accountType: 'personal' }, x: null },
  { id: 'est-12', competitorId: null,    name: 'Cafe Mocha Lane',          category: 'Cafe',           distanceKm: 0.8,
    google: { rating: 4.3, reviews: 690,  status: 'OPERATIONAL' },
    instagram: { handle: '@mochalane', accountType: 'private' }, x: null },
  { id: 'est-13', competitorId: null,    name: 'Sethi Sweets & Namkeen',   category: 'Sweets',         distanceKm: 0.1,
    google: { rating: 4.5, reviews: 3460, status: 'OPERATIONAL' },
    instagram: null, x: null },
  { id: 'est-14', competitorId: null,    name: 'Grill & Chill',            category: 'Fast food',      distanceKm: 1.9,
    google: { rating: 3.6, reviews: 420,  status: 'OPERATIONAL' },
    instagram: { handle: '@grillandchill.dwk', accountType: 'personal' }, x: null },

  // Not trackable at all.
  { id: 'est-15', competitorId: null,    name: 'Biryani Junction (cloud kitchen)', category: 'Delivery only', distanceKm: 1.2,
    google: null,
    instagram: { handle: '@biryanijunction.ncr', accountType: 'business' }, x: null },
];

// What can actually be analysed for an establishment, and why. Returns the
// tier plus the reasons, because "you cannot track this" is only useful if it
// says which door is closed.
function establishmentAvailability(e) {
  const reasons = [];
  const hasGoogle = !!(e.google && e.google.status === 'OPERATIONAL');
  const ig = e.instagram;
  const igReadable = !!ig && (ig.accountType === 'business' || ig.accountType === 'creator');

  if (hasGoogle) {
    reasons.push({ ok: true, text: `Google listing — ${e.google.rating.toFixed(1)}★, ${e.google.reviews.toLocaleString('en-IN')} reviews` });
  } else {
    reasons.push({ ok: false, text: 'No Google listing — delivery-only kitchens often have none, and Places is the only way in' });
  }

  if (!ig) {
    reasons.push({ ok: false, text: 'No Instagram account found' });
  } else if (igReadable) {
    const stale = ig.lastPostDaysAgo && ig.lastPostDaysAgo > 60;
    reasons.push({
      ok: !stale,
      text: stale
        ? `Instagram ${ig.accountType} account, but last posted ${ig.lastPostDaysAgo} days ago — readable, nothing to compare`
        : `Instagram ${ig.accountType} account — Business Discovery can read it`,
    });
  } else {
    reasons.push({
      ok: false,
      text: `Instagram account is ${ig.accountType} — Business Discovery cannot read ${ig.accountType} accounts at all`,
    });
  }

  if (e.x) {
    reasons.push({ ok: false, text: 'X handle exists, but reading posts needs a paid API tier — not counted toward availability' });
  }

  const stale = !!(ig && ig.lastPostDaysAgo && ig.lastPostDaysAgo > 60);
  const tier = !hasGoogle ? 'none' : (igReadable && !stale ? 'full' : 'ratings');
  return { tier, reasons, hasGoogle, igReadable, stale };
}

// Which establishments are currently tracked as competitors. Persisted, and
// read by both the Competitors screen and the recommendation engine so one
// choice drives both.
const TRACKED_KEY = 'saf-tracked-v1';
// The six already pulled. est-7/8/9 also carry a competitorId now — they are
// trackable and have a dormant record waiting — but they start untracked, so
// adding one is a deliberate act that costs an API call on the next sync.
const TRACKED_DEFAULT = ['est-1', 'est-2', 'est-3', 'est-4', 'est-5', 'est-6'];

function trackedLoad() {
  try {
    const raw = localStorage.getItem(TRACKED_KEY);
    if (!raw) return [...TRACKED_DEFAULT];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...TRACKED_DEFAULT];
  } catch (e) {
    return [...TRACKED_DEFAULT];
  }
}
function trackedSave(ids) {
  try { localStorage.setItem(TRACKED_KEY, JSON.stringify(ids)); } catch (e) {}
}

// The competitor rows for the currently tracked establishments. Only rows we
// hold full Business Discovery data for can appear on the Competitors table;
// a ratings-only establishment is tracked but has no feed to show.
// Tracked establishments we hold no feed for yet. In production, marking one
// queues a Business Discovery fetch; here there is simply no seed data. Either
// way the honest thing is to say "not synced", not to drop it silently.
function trackedPendingEstablishments() {
  const ids = new Set(trackedLoad());
  return ESTABLISHMENTS.filter(e => {
    if (!ids.has(e.id)) return false;
    if (establishmentAvailability(e).tier !== 'full') return false;
    const comp = e.competitorId && LISTENING_COMPETITORS.find(c => c.id === e.competitorId);
    return !comp || !comp.synced;
  });
}

function trackedCompetitors() {
  const ids = new Set(trackedLoad());
  const wanted = new Set(
    ESTABLISHMENTS.filter(e => ids.has(e.id) && e.competitorId).map(e => e.competitorId)
  );
  return LISTENING_COMPETITORS.filter(c => wanted.has(c.id) && c.synced);
}

// --- Sync --------------------------------------------------------------------
// What a refresh actually does, and what it costs.
//
// One pass over the tracked set:
//   · Google Places Details — 1 call per tracked establishment. Returns
//     rating and user_ratings_total. Works for anything with a listing.
//   · Instagram Business Discovery — 1 call per establishment whose account
//     is a public Business or Creator. Returns followers_count, media_count
//     and the media edge. Personal and private accounts are skipped: the call
//     would return nothing, so spending the quota on it is pointless.
//
// Both share rate limits, which is why the Establishments screen carries a
// soft cap. The report below names every call and its outcome — a sync that
// silently half-worked is worse than one that failed loudly.
//
// Review velocity is the one thing a single sync cannot produce: it is the
// delta between this pull's review count and the last one, so it needs at
// least two syncs on different days. Rows that have never been compared
// report it as unavailable rather than guessing.
const SYNC_KEY = 'saf-sync-v1';

function syncStateLoad() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return { lastSyncedAt: null, runs: 0 };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { lastSyncedAt: null, runs: 0 };
  } catch (e) {
    return { lastSyncedAt: null, runs: 0 };
  }
}
function syncStateSave(st) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(st)); } catch (e) {}
}

// Bumped on every completed sync. Screens that cache derived data key their
// memo on this so a refresh actually propagates rather than needing a reload.
const SYNC_VERSION = { value: 0 };

// Runs the pass and returns a per-establishment report. Synchronous over the
// data; the UI paces it so a person can read what happened.
function syncCompetitors() {
  const now = Date.now();
  const trackedIds = new Set(trackedLoad());
  const targets = ESTABLISHMENTS.filter(e => trackedIds.has(e.id));
  const steps = [];
  let placesCalls = 0;
  let discoveryCalls = 0;

  for (const e of targets) {
    const avail = establishmentAvailability(e);
    const comp = e.competitorId && LISTENING_COMPETITORS.find(c => c.id === e.competitorId);

    // Places Details — every tracked establishment with a listing.
    if (avail.hasGoogle) {
      placesCalls += 1;
      // A real pull would move these; the demo nudges the review count so the
      // "what changed" line is not always empty.
      const gained = 1 + ((now / 60000 | 0) + e.id.length) % 3;
      e.google.reviews += gained;
      if (comp) comp.googleReviews = e.google.reviews;
      steps.push({
        establishment: e.name, api: 'Places Details', ok: true,
        detail: `${e.google.rating.toFixed(1)}★, ${e.google.reviews.toLocaleString('en-IN')} reviews (+${gained})`,
      });
    } else {
      steps.push({
        establishment: e.name, api: 'Places Details', ok: false,
        detail: 'No listing — nothing to fetch',
      });
    }

    // Business Discovery — only where the account is actually readable.
    if (avail.igReadable) {
      discoveryCalls += 1;
      if (comp) {
        const wasSynced = comp.synced;
        const ok = applyCompetitorSync(comp, now);
        steps.push(ok ? {
          establishment: e.name, api: 'Business Discovery', ok: true,
          detail: wasSynced
            ? `${comp.recentPosts.length} posts refreshed · ${comp.postsPerWeek}/week`
            : `First pull — ${comp.recentPosts.length} posts, ${(comp.followers / 1000).toFixed(1)}k followers`,
          isNew: !wasSynced,
        } : {
          establishment: e.name, api: 'Business Discovery', ok: false,
          detail: comp.syncError || 'Pull failed — no content applied',
        });
      } else {
        steps.push({
          establishment: e.name, api: 'Business Discovery', ok: false,
          detail: 'Readable, but no seed content in this prototype',
        });
      }
    } else if (e.instagram) {
      steps.push({
        establishment: e.name, api: 'Business Discovery', ok: false,
        detail: `Skipped — ${e.instagram.accountType} accounts cannot be read, and the call would burn quota for nothing`,
      });
    } else {
      steps.push({
        establishment: e.name, api: 'Business Discovery', ok: false,
        detail: 'Skipped — no Instagram account found',
      });
    }
  }

  const prev = syncStateLoad();
  const state = {
    lastSyncedAt: new Date(now).toISOString(),
    runs: (prev.runs || 0) + 1,
    // Velocity needs two pulls on different days to mean anything.
    velocityComparable: (prev.runs || 0) >= 1,
  };
  syncStateSave(state);
  SYNC_VERSION.value += 1;

  return {
    steps,
    placesCalls,
    discoveryCalls,
    totalCalls: placesCalls + discoveryCalls,
    newlySynced: steps.filter(s => s.isNew).length,
    state,
  };
}

// --- Per-channel trends ------------------------------------------------------
// The three APIs count genuinely different things, so each channel names its
// own metrics rather than being forced into a shared "mentions / reach" shape
// that would be wrong for two of them.
const LISTENING_TRENDS = {
  ig: {
    volumeLabel: 'Mentions', reachLabel: 'Reach',
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
    volumeLabel: 'Reviews + Q&A', reachLabel: 'Impressions',
    sparkMentions:  [38, 42, 51, 48, 56, 64, 71],
    sparkReach:     [12500, 13700, 13200, 15500, 23000, 27300, 19400],
    sparkSentiment: [0.48, 0.51, 0.47, 0.44, 0.40, 0.38, 0.35],
    totalMentions7d: 370,
    totalReach7d:    124600,
    avgSentiment7d:  0.43,
    changeMentionsPct:     14,
    changeReachPct:        21,
    changeSentimentDelta:  -0.13,
  },
  wa: {
    volumeLabel: 'Conversations', reachLabel: 'Messages',
    sparkMentions:  [42, 48, 51, 56, 74, 88, 61],
    sparkReach:     [249, 278, 295, 329, 442, 535, 356],
    sparkSentiment: [0.51, 0.52, 0.55, 0.54, 0.56, 0.57, 0.58],
    totalMentions7d: 420,
    totalReach7d:    2484,
    avgSentiment7d:  0.55,
    changeMentionsPct:     60,
    changeReachPct:        56,
    changeSentimentDelta:  0.06,
  },
};

const SAF_HANDLE = '@saffronhouse';

// Our own row for the Competitors table. Deliberately carries the SAME fields
// as the peer rows — no extra columns from our private data — so every
// comparison on that screen is like-for-like. Our richer metrics live on the
// Analytics screen, where they are not being compared to anyone.
const SAF_SELF_STATS = {
  id: 'saf-self',
  name: 'Saffron House',
  handle: SAF_HANDLE,
  channel: 'ig',
  avatarInitials: 'SH',
  avatarColor: '#B4451F',
  followers: 28400,       followersChange7dPct: 1.4,
  postsPerWeek: 5,        avgInteractions: 1739,
  engagementRate: 0.061,  engagementChange7dPct: 3.2,
  googleRating: 4.3,      googleReviews: 1284,  reviewVelocityPerMonth: 62,
  themes: ['chef stories', 'monsoon menu', 'team stories'],
  postingPeak: '6–8pm',
  sparkEngagement: [0.055, 0.056, 0.055, 0.058, 0.059, 0.060, 0.061],
  isSelf: true,
};

// --- Listening KPI strip -----------------------------------------------------
// "Share of voice" was removed: it is not computable without a listening
// corpus we do not have, and Instagram's hashtag search cannot supply one.
// Replaced with direction requests — a real Google Performance metric, and a
// better proxy for intent to actually turn up than any share number.
const LISTENING_KPIS = {
  mentions: {
    label: 'Mentions (7d)', source: 'Instagram Graph API',
    sparkline: [128, 146, 158, 139, 184, 208, 226],
    current:  1189,
    baseline: 908,
  },
  reach: {
    label: 'Instagram reach (7d)', source: 'Instagram Graph API',
    sparkline: [6100, 6900, 6400, 8200, 12800, 15400, 10400],
    current:  66200,
    baseline: 53400,
  },
  netSentiment: {
    label: 'Net sentiment', source: 'Derived in-house',
    // Reported as an absolute delta, not a percentage: a move from +0.10 to
    // +0.20 is a 100% change but a 0.10 shift, and the latter is what matters.
    sparkline: [0.42, 0.48, 0.39, 0.51, 0.34, 0.56, 0.62],
    current:  0.47,
    baseline: 0.31,
  },
  directionRequests: {
    label: 'Direction requests (7d)', source: 'GBP Performance API',
    sparkline: [282, 302, 315, 343, 430, 479, 359],
    current:  2510,
    baseline: 1920,
  },
};

// --- Timestamp hydration -----------------------------------------------------
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

// Reviews carry a relative `age` and get an absolute ISO timestamp here. The
// Reviews screen runs a live SLA clock against Date.now(), so a hard-coded
// date would drift and the demo would contradict itself.
// WhatsApp conversations carry a relative age for the last inbound message,
// hydrated here for the same reason reviews are: the 24-hour service window
// is a live countdown, and a hard-coded date would drift out of sync with it.
(function hydrateConversationWindows() {
  const now = Date.now();
  for (const c of CONVERSATIONS) {
    if (!c.lastInboundAge) continue;
    c.lastInboundISO = relativeTimeToISO(c.lastInboundAge, now);
    const elapsedMins = (now - new Date(c.lastInboundISO).getTime()) / 60_000;
    c.windowMinsLeft = Math.max(0, Math.round(24 * 60 - elapsedMins));
  }
})();

(function hydrateReviewTimestamps() {
  const now = Date.now();
  for (const r of REVIEWS) {
    r.t = relativeTimeToISO(r.age, now);
    if (r.reply) r.reply.t = relativeTimeToISO(r.reply.age, now);
  }
  const slaMs = REVIEW_STATS.slaMins * 60_000;
  const unanswered = REVIEWS.filter(r => !r.replied);
  REVIEW_STATS.unanswered = unanswered.length;
  REVIEW_STATS.unansweredCritical = unanswered.filter(
    r => r.rating <= 2 && (now - new Date(r.t).getTime()) > slaMs
  ).length;
})();

// --- Persistence -------------------------------------------------------------
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

Object.assign(window, {
  PLATFORMS, PLATFORM_BY_ID, PLATFORM_ID_BY_NAME, hasCap,
  POSTABLE, REVIEW_CHANNELS, INBOX_CHANNELS, platformColor,
  LISTENING_SIGNALS, LISTENING_COMPETITORS, LISTENING_TRENDS, LISTENING_KPIS,
  LISTENING_KINDS, LISTENING_SEVERITIES, listeningLoad, listeningSave,
  SAF_HANDLE, SAF_SELF_STATS, COMPETITOR_CATCHMENT, COMPETITOR_POST_SEEDS,
  ESTABLISHMENTS, establishmentAvailability, trackedLoad, trackedSave, trackedCompetitors,
  trackedPendingEstablishments, syncCompetitors, syncStateLoad, SYNC_VERSION,
  PlatformGlyph, Avatar,
  POSTS, SCHEDULED, CONVERSATIONS, POST_COMMENTS,
  REVIEWS, REVIEW_STATS, MENU_ITEMS,
  ANALYTICS_IG, ANALYTICS_GG, ANALYTICS_WA,
  ANALYTICS_BREAKDOWN, ANALYTICS_SENTIMENT,
  TRENDING_TAGS, TEMPLATES, ACTIVITY,
});
