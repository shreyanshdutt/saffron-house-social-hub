// The client's one door to the server. Nothing else in `src/` calls fetch.
//
// WHY THE BOUNDARY IS DRAWN HERE
// The screens that read this subsystem were all synchronous, and one of them —
// buildRecommendationContext() in recommend.jsx — is called DURING render of
// the Actions screen. Scattering `await` through render paths would have meant
// rewriting the engine and every caller.
//
// So: fetch once into a module-level snapshot, then gate the three screens
// that need it behind <RequiresServerData>. Inside that gate the snapshot is
// guaranteed loaded, so every existing synchronous reader keeps working
// unchanged and reads `serverData()` directly. One await, at one place, above
// the screens — not one per component.
//
// The gate is SCOPED to Establishments, Competitors and Actions on purpose.
// Dashboard, Reviews, Inbox and Analytics still read mock.jsx and must not
// start failing because a data service they do not use is down.

// Configuration, not a secret — CLAUDE.md §2 is explicit that the client holds
// no credentials, and a base URL is not one. Overridable at runtime so the
// same files work against a different host without an edit:
//   localStorage.setItem('saf-api-base', 'http://192.168.1.10:8787')
const API_BASE_DEFAULT = 'http://127.0.0.1:8787';

function apiBase() {
  try {
    return localStorage.getItem('saf-api-base') || API_BASE_DEFAULT;
  } catch (e) {
    return API_BASE_DEFAULT;
  }
}

// ---------------------------------------------------------------------------
// The snapshot.
//
// `status` is the honest state of the whole subsystem and there are four of
// them. `loading` and `ready-but-empty` are DIFFERENT FACTS and the UI must
// never collapse them: a Competitors screen that renders "no competitors
// tracked" because a fetch is in flight is a lie, and one that renders it
// because the server is unreachable is the worst outcome this commit can
// produce (CONVENTIONS.md §1).
const SERVER = {
  status: 'idle',      // idle | loading | ready | error
  error: null,
  establishments: [],
  competitors: [],
  // OUR OWN channel connections, one row per channel. Previously the Settings
  // Accounts tab invented these; there was no connection state anywhere.
  connections: [],
  self: null,
  // Every post with its per-channel targets and the server's DERIVED summary.
  // It lives on this snapshot rather than in the Composer's own state so there
  // is one mechanism, and so `loadServerData({ force: true })` after a write
  // actually refreshes it. Part 3 moves History, Calendar and Approvals onto
  // this array; part 2 only writes to it.
  posts: [],
  // The menu with REAL mention counts and the guest sentences behind them.
  // `menuCorpus` travels with it so the screen can say how much text the
  // counts were drawn from — a count of 2 means something different over 31
  // fragments than over 31,000, and the screen must be able to say which.
  menu: [],
  menuCorpus: null,
  // Customers, and the SEGMENT NUMBERS THE SERVER COMPUTED. Three fields per
  // segment arrive ready to render; nothing here counts a list. A client that
  // counted would be a second implementation of CONVENTIONS.md §11 decision 3
  // and would drift from the server's the first time either was edited.
  customers: [],
  segments: [],
  // The WhatsApp marketing rate, from server/src/config.js. Never hardcoded on
  // this side — a price inlined in a screen is a second source for a number
  // that governs money.
  marketingRate: null,
  // Why contact import is blocked, in the server's words. The screen renders
  // this rather than carrying the sentence in JSX.
  importStatus: null,
  // The window below which a delta cannot be scaled. Served, not hardcoded:
  // the rule lives in server/src/derive.js and the copy on screen explains it,
  // so the two must not be able to disagree.
  minWindowDays: 7,
  // When competitor content was last pulled, or null if never. Derived from
  // stored observations server-side, not from a run counter in this browser.
  lastSyncedAt: null,
  refreshing: false,   // a background refresh of data we already hold
  // Scan filters. These are SERVER query parameters, not a client-side
  // .filter() — `distance_km` and `rating` are real columns, and a real
  // catchment returns more rows than a browser should be shipped in order to
  // throw most of them away. `null` means unset, which is not the same as 0.
  filters: { maxDistanceKm: null, minRating: null },
  version: 0,          // bumped on every state change so React re-renders
};

// Pure presentation: a window is minutes on a second sync and months on a
// seeded one. Formatting belongs on this side; the number it formats does not.
function formatObservationWindow(days) {
  if (!Number.isFinite(days)) return 'an unknown span';
  const mins = days * 1440;
  if (mins < 90) return `${Math.max(1, Math.round(mins))} min`;
  if (days < 2) return `${Math.round(days * 24)} hr`;
  return `${Math.round(days)} days`;
}

function serverData() { return SERVER; }

const listeners = new Set();
function notify() {
  SERVER.version += 1;
  for (const fn of listeners) fn(SERVER.version);
}

function filterQuery(f) {
  const q = new URLSearchParams();
  if (f.maxDistanceKm !== null && f.maxDistanceKm !== undefined) q.set('maxDistanceKm', String(f.maxDistanceKm));
  if (f.minRating !== null && f.minRating !== undefined) q.set('minRating', String(f.minRating));
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function getJson(path) {
  const res = await fetch(`${apiBase()}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} returned ${res.status} ${res.statusText}`);
  return res.json();
}

// Loads everything the gated screens need, in one pass. Called by the gate.
async function loadServerData({ force = false } = {}) {
  if (SERVER.status === 'loading' || SERVER.refreshing) return;
  if (SERVER.status === 'ready' && !force) return;
  // A REFRESH of data we already hold is not the same as a first load, and it
  // must not flip the status to `loading`: the gate would unmount the screen
  // underneath it, taking the sync report and any open row with it, and every
  // track click would flash a loading card over a screen that already has its
  // data. So a refresh keeps `ready` and flags itself separately; only a first
  // load blocks the screen.
  const refreshing = force && SERVER.status === 'ready';
  if (refreshing) SERVER.refreshing = true;
  else SERVER.status = 'loading';
  SERVER.error = null;
  notify();
  try {
    const [ests, comps, conns, posts, menu, custs, importStatus] = await Promise.all([
      getJson(`/establishments${filterQuery(SERVER.filters)}`),
      getJson('/competitors'),
      getJson('/connections'),
      getJson('/posts'),
      getJson('/menu'),
      getJson('/customers'),
      getJson('/customers/import-status'),
    ]);
    SERVER.establishments = ests.establishments;
    SERVER.competitors = comps.competitors;
    SERVER.connections = conns.connections;
    SERVER.self = comps.self;
    SERVER.posts = posts.posts;
    SERVER.menu = menu.items;
    SERVER.menuCorpus = menu.corpus;
    SERVER.customers = custs.customers;
    SERVER.segments = custs.segments;
    SERVER.marketingRate = custs.marketingRateInr;
    SERVER.importStatus = importStatus;
    if (Number.isFinite(comps.minWindowDays)) SERVER.minWindowDays = comps.minWindowDays;
    SERVER.lastSyncedAt = comps.lastSyncedAt || null;
    SERVER.status = 'ready';
    SERVER.error = null;
  } catch (err) {
    // A failed load does NOT leave stale rows behind pretending to be current —
    // including a failed REFRESH. Once a request has failed we no longer know
    // the state, and showing the last known one as though it were current is
    // the quiet lie this whole commit exists to avoid.
    SERVER.establishments = [];
    SERVER.competitors = [];
    SERVER.connections = [];
    SERVER.posts = [];
    SERVER.menu = [];
    SERVER.menuCorpus = null;
    SERVER.customers = [];
    SERVER.segments = [];
    SERVER.marketingRate = null;
    SERVER.importStatus = null;
    SERVER.self = null;
    SERVER.status = 'error';
    SERVER.error = err.message || String(err);
  }
  SERVER.refreshing = false;
  notify();
}

// Re-runs the establishment query with new filters. A filter change is a
// REFRESH of data we already hold, so the screen keeps its rows while the new
// set arrives rather than blanking on every slider tick.
async function setFilters(next) {
  SERVER.filters = { ...SERVER.filters, ...next };
  await loadServerData({ force: true });
}

// --- writes ----------------------------------------------------------------
// Each returns the reloaded snapshot, because the server owns the derivations
// and a local guess at the new state would be a second implementation.

async function trackEstablishment(placeId, trackedBy) {
  const res = await fetch(`${apiBase()}/tracked`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ placeId, trackedBy }),
  });
  if (!res.ok) throw new Error(`track failed: ${res.status}`);
  await loadServerData({ force: true });
}

async function untrackEstablishment(placeId) {
  const res = await fetch(`${apiBase()}/tracked/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`untrack failed: ${res.status}`);
  await loadServerData({ force: true });
}

// Records a hand-entered Instagram handle. It is stored UNVERIFIED — see
// setInstagramHandle() in server/src/repo.js. This deliberately does not
// change the availability tier, and the server is what enforces that.
async function saveInstagramHandle(placeId, handle) {
  const res = await fetch(`${apiBase()}/establishments/${encodeURIComponent(placeId)}/social/instagram`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `save failed: ${res.status}`);
  }
  await loadServerData({ force: true });
}

// Records that we LOOKED and there is no account — not the same as never
// having looked, which is the absence of a row entirely.
async function clearInstagramHandle(placeId) {
  const res = await fetch(`${apiBase()}/establishments/${encodeURIComponent(placeId)}/social/instagram`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clear failed: ${res.status}`);
  await loadServerData({ force: true });
}

// --- reading posts ---------------------------------------------------------
//
// The server's shape and the screens' shape differ, and the difference is the
// whole of 849c3b7's design: `state` on the post is INTENT, `status` on each
// target is OUTCOME, and metrics live on the target because every seeded post
// carried `metricsFrom: 'ig'` while three of them went to two channels.
//
// This adapter TRANSLATES; it does not DERIVE. Whether a post published is
// answered by `summary.outcome`, computed once in server/src/posts.js where it
// is tested — nothing here recomputes it. What is done here is presenting the
// server's answer under the field names five screens already read.

// Sums the metrics the post ACTUALLY HAS, and says what it summed.
//
// A target with no metrics contributes NOTHING and is not counted as a zero —
// "not measured" and "measured at zero" are different facts, and collapsing
// them is the trap CLAUDE.md §11 opens with. A post with no measured target at
// all returns null, not a bag of zeroes.
function postMetrics(post) {
  const measured = (post.targets || []).filter(t => t.metrics);
  if (!measured.length) return null;
  const sum = (k) => measured.reduce((n, t) => n + (Number.isFinite(t.metrics[k]) ? t.metrics[k] : 0), 0);
  return {
    views: sum('views'), reach: sum('reach'), likes: sum('likes'),
    comments: sum('comments'), shares: sum('shares'), saves: sum('saves'),
    // A RATE CANNOT BE SUMMED, and averaging two rates over different
    // denominators is not the rate either. With one measured channel it is
    // that channel's rate; with more than one there is no honest single number
    // without the formula, so it is absent and the UI says so.
    rate: measured.length === 1 ? measured[0].metrics.rate : null,
    // Which channels these figures actually cover. The drawer already had a
    // `metricsFrom` field for exactly this, and it was right all along.
    measuredOn: measured.map(t => t.clientId),
    measuredCount: measured.length,
    targetCount: (post.targets || []).length,
  };
}

// A server post in the shape the screens read. `outcome` is the server's word
// and is the field to branch on; `status` is a legacy alias for the drawer in
// page-history.jsx, which predates all of this.
function adaptPost(post) {
  const metrics = postMetrics(post);
  const failed = (post.targets || []).filter(t => t.status === 'failed');
  return {
    id: post.id,
    content: post.content,
    tags: post.tags || [],
    format: post.format,
    author: post.author,
    media: post.media,
    platforms: (post.targets || []).map(t => t.clientId).filter(Boolean),
    date: post.scheduledAt || post.createdAt,
    when: post.scheduledAt,
    state: post.state,
    outcome: post.summary.outcome,
    summaryLabel: post.summary.label,
    status: {
      published: 'published',
      failed: 'failed',
      in_flight: 'sending',
      not_attempted: post.state === 'scheduled' ? 'scheduled' : 'draft',
    }[post.summary.outcome] || post.summary.outcome,   // 'mixed' stays 'mixed'
    metrics,
    metricsFrom: metrics ? metrics.measuredOn.join(', ') : null,
    error: failed.length ? failed[0].reason : null,
    targets: post.targets,
    isSample: post.isSample,
  };
}

// Everything that has been attempted and came back fully published. Screens
// that show "what went out" want this. A `mixed` post is deliberately NOT here
// — it did not fully publish, and a list that included it would be making the
// claim the two-table design exists to prevent.
function publishedPosts() {
  return SERVER.posts.filter(p => p.summary.outcome === 'published').map(adaptPost);
}

// Posts with measured figures, whatever their outcome. This is the honest
// question behind "top posts": it asks for numbers, not for a status.
function measuredPosts() {
  return SERVER.posts.filter(p => p.targets.some(t => t.metrics)).map(adaptPost);
}

function scheduledPosts() {
  return SERVER.posts.filter(p => p.state === 'scheduled').map(adaptPost)
    .sort((a, b) => new Date(a.when) - new Date(b.when));
}

function allPosts() { return SERVER.posts.map(adaptPost); }

// --- posts -----------------------------------------------------------------
//
// The Composer speaks in two-letter channel ids and so does the server's
// response: every target carries `clientId` beside `platform` (849c3b7), so
// there is no mapping table in `src/` to drift out of step with the one in
// server/src/posts.js.

async function postJson(path, body, method = 'POST') {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch (e) { payload = null; }
  if (!res.ok) {
    throw new Error((payload && payload.error) || `${path} returned ${res.status} ${res.statusText}`);
  }
  return payload;
}

// Creates a draft, or a scheduled post when `scheduledAt` is present. Returns
// the created post — the caller needs its id and its targets, and re-reading
// the snapshot to find it would be a lookup that can fail.
async function createPost({ platforms, content, tags, format, author, media, scheduledAt, scheduledTz }) {
  const post = await postJson('/posts', {
    platforms, content, tags, format, author, media, scheduledAt, scheduledTz,
  });
  await loadServerData({ force: true });
  return post;
}

// THE ATTEMPT, AND ITS FAILURE IS NOT AN EXCEPTION.
//
// The server answers 200 with per-target outcomes even when every channel
// failed, because MAKING the attempt succeeded and the outcomes are the answer
// (849c3b7). Throwing here on "nothing published" would convert a detailed,
// per-channel result into one thrown string — the exact collapse this week's
// commits removed. Only a transport failure throws.
async function publishPost(id) {
  const result = await postJson(`/posts/${encodeURIComponent(id)}/publish`, undefined);
  await loadServerData({ force: true });
  return result;                    // { post, plan }
}

async function deletePost(id) {
  const out = await postJson(`/posts/${encodeURIComponent(id)}`, undefined, 'DELETE');
  await loadServerData({ force: true });
  return out;
}

// --- customers -------------------------------------------------------------
//
// Three writes, and deliberately no fourth: there is no deleteCustomer here
// because there is no route for it. Import is not here either — it is blocked
// on a decision (§11), and a helper for it would imply otherwise.

// Staff rows only. `display_label` is the whole body, and the server refuses
// anything else — including `source` — so this cannot grow a phone number by
// someone adding a field at this end.
async function addStaffCustomer(displayLabel) {
  const created = await postJson('/customers', { display_label: displayLabel });
  await loadServerData({ force: true });
  return created;
}

// `taggedBy` has no default here either. Passing one would put an author on a
// judgement that nobody made.
async function tagCustomer(customerId, menuItemId, taggedBy) {
  const updated = await postJson(`/customers/${encodeURIComponent(customerId)}/tags`, {
    menu_item_id: menuItemId, tagged_by: taggedBy,
  });
  await loadServerData({ force: true });
  return updated;
}

async function untagCustomer(customerId, menuItemId) {
  const updated = await postJson(
    `/customers/${encodeURIComponent(customerId)}/tags/${encodeURIComponent(menuItemId)}`,
    undefined, 'DELETE',
  );
  await loadServerData({ force: true });
  return updated;
}

async function postObservations(observations) {
  const res = await fetch(`${apiBase()}/observations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ observations }),
  });
  if (!res.ok) throw new Error(`observations failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// React glue.

function useServerData() {
  const [, setV] = React.useState(SERVER.version);
  React.useEffect(() => {
    listeners.add(setV);
    if (SERVER.status === 'idle') loadServerData();
    return () => listeners.delete(setV);
  }, []);
  return SERVER;
}

// The gate. Renders children ONLY when the snapshot is loaded, so everything
// inside can stay synchronous.
function RequiresServerData({ children, what = 'this screen' }) {
  const data = useServerData();

  if (data.status === 'error') {
    return <ServerUnreachable what={what} error={data.error} />;
  }
  if (data.status !== 'ready') {
    return <ServerLoading what={what} />;
  }
  return typeof children === 'function' ? children(data) : children;
}

// Loading. Says it is loading, in words. Not an empty table, not a zero.
function ServerLoading({ what }) {
  return (
    <Card padding="p-8">
      <div className="flex items-center gap-3">
        <Icon name="Loader" size={18} className="text-saf-muted animate-spin" />
        <div>
          <div className="text-[14px] font-semibold text-saf-text">Loading {what}…</div>
          <div className="text-[12px] text-saf-muted mt-0.5">
            Fetching establishments and competitor observations from the data service.
          </div>
        </div>
      </div>
    </Card>
  );
}

// Unreachable. The one thing this must never do is look like "no data".
// An empty table would read as "you track nobody", a zero as "they gained
// nothing" — both are claims we cannot make when we could not ask.
function ServerUnreachable({ what, error }) {
  const [retrying, setRetrying] = React.useState(false);
  const retry = async () => {
    setRetrying(true);
    await loadServerData({ force: true });
    setRetrying(false);
  };
  return (
    <Card padding="p-6">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 grid place-items-center shrink-0">
          <Icon name="CloudOff" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-saf-text">Cannot reach the data service</div>
          <p className="text-[12.5px] text-saf-muted mt-1.5 leading-relaxed">
            This screen reads {what} from the database, not from this browser, and the request failed.
            <strong className="text-saf-text"> Nothing is shown below rather than a partial or stale list</strong> —
            an empty table here would read as “you track nobody”, which is not something we can know while the
            service is unreachable.
          </p>
          <p className="text-[11.5px] text-saf-muted mt-2 font-mono break-all">{error}</p>
          <p className="text-[11.5px] text-saf-muted mt-2">
            Start it with <span className="font-mono">cd server &amp;&amp; npm start</span>, then retry.
          </p>
          <button
            onClick={retry}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-saf-primary text-white text-[12.5px] font-medium disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary"
          >
            <Icon name="RefreshCw" size={13} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    </Card>
  );
}

window.formatObservationWindow = formatObservationWindow;
window.setFilters = setFilters;
window.saveInstagramHandle = saveInstagramHandle;
window.clearInstagramHandle = clearInstagramHandle;
window.serverData = serverData;
window.loadServerData = loadServerData;
window.trackEstablishment = trackEstablishment;
window.untrackEstablishment = untrackEstablishment;
window.postObservations = postObservations;
window.adaptPost = adaptPost;
window.postMetrics = postMetrics;
window.publishedPosts = publishedPosts;
window.measuredPosts = measuredPosts;
window.scheduledPosts = scheduledPosts;
window.allPosts = allPosts;
window.addStaffCustomer = addStaffCustomer;
window.tagCustomer = tagCustomer;
window.untagCustomer = untagCustomer;
window.createPost = createPost;
window.publishPost = publishPost;
window.deletePost = deletePost;
window.useServerData = useServerData;
window.RequiresServerData = RequiresServerData;
