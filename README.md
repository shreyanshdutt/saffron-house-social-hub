# Saffron House Social Hub

Prototype UI for a single-restaurant social and reputation hub, built for
**Saffron House** — a modern-Indian restaurant in Sector 10 Market, Dwarka,
New Delhi 110075. Positioning, prices, follower counts and review volumes are
scaled to that catchment: it is the upmarket option in a neighbourhood market,
not a central-Delhi flagship.

Single-page React app served from `index.html`, using CDN-hosted React 18,
in-browser Babel for the JSX in `src/`, an importmap to bind ESM modules
(`lucide-react`, `recharts`) to the same React instance, and Tailwind via CDN.

Two workspaces, and the line between them is hard (CLAUDE.md § *The client /
server boundary*): **`src/` + `index.html`** is the buildless client, and
**`server/`** is a small Node service that owns the database and — later — the
API credentials. They meet at HTTP and nowhere else. The establishment list,
the tracked competitor set and the observation history that review velocity and
follower change are derived from all live on the server; the client fetches
them and renders. Everything else on screen still comes from `src/mock.jsx`.

## Run it locally

The Competitors, Establishments and Actions screens need the data service
running as well as the static client — they say so plainly rather than
rendering an empty table if it is down. See [server/README.md](server/README.md).

```
cd server && npm start        # http://127.0.0.1:8787, no npm install needed
```

There is no build step. `index.html` uses ES modules, an importmap, and
`<script type="text/babel">` — all of which require an HTTP origin. Opening
`index.html` directly via `file://` **will not work**.

From this directory:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

Any static server is fine (`npx serve`, `php -S localhost:8000`, etc.) — the
project just needs to be served over HTTP.

## What this models

One restaurant, one location, three channels, four roles.

**Every field on screen is deliverable by a real API.** Anything that could not
be fetched, derived from fetched text, or read from the restaurant's own
systems has been removed rather than faked — see the in-app **Data & access**
screen (Owner role) for the field-by-field map and the OAuth scopes to request.

**Channels** (`PLATFORMS` in `src/mock.jsx`) each carry a `kind` that decides
which screens they appear on:

| Channel | id | API | Capabilities |
|---|---|---|---|
| Instagram | `ig` | Instagram Graph API | publish, schedule, metrics, comments, DMs, mentions, audience, competitor |
| Google Business Profile | `gg` | Business Profile APIs | publish, metrics, reviews, Q&A, competitor |
| WhatsApp | `wa` | WhatsApp Cloud API | DMs, metrics, templates |

Each channel carries a `caps` list of what its API genuinely supports, and the
UI reads it: a channel without `publish` never appears in the composer, one
without `metrics` never appears in a performance chart. That is the mechanism
that keeps the product honest.

Zomato, Swiggy and District were removed — none has a public API, and reaching
them means a paid POS-middleware contract. See [DATA-SOURCES.md](DATA-SOURCES.md).

**Roles.** The role *ids* are generic internal keys (`admin` / `executive` /
`srexec` / `manager`) because they are referenced across every screen; what the
audience sees is the label:

| id | Label | Holds |
|---|---|---|
| `admin` | Owner | Channels, users, audit, brand kit |
| `executive` | Social Coordinator | Drafts and replies, no publish |
| `srexec` | Guest Relations Lead | Reviews drafts, replies to reviews, flags |
| `manager` | Marketing Manager | Approves, publishes, unmasks PII, issues comps |

Switch roles from the topbar. Screens the current role cannot reach are hidden
from the sidebar, and navigating to one redirects to the Dashboard with a toast
explaining why.

## How it differs from a generic social hub

Four things were restructured around restaurant reality rather than carried
over:

- **Actions** (`src/page-recommendations.jsx`, engine in `src/recommend.jsx`) is
  the "what should I do today" screen. Eighteen rules run over the week's
  reviews, menu conversation, listening signals, channel performance and
  publishing queue, and produce a ranked list of concrete actions — post this
  dish, fix the packing station, open a second Diwali seating, do not promote
  that curry. Nothing executes: each action carries an owner, a place it
  happens (kitchen, partner dashboard, composer) and a deadline. Every figure
  behind a recommendation is shown with its real-world source and badged by
  whether that source is live via API, needs a partner integration, or is
  derived in-house.

- **Reviews** (`src/page-reviews.jsx`) is a first-class screen, not a feed tab.
  Reviews arrive with a star rating, derived themes, and an SLA
  clock; the list sorts by *urgency* rather than recency, because an unanswered
  1★ is a standing advertisement against you. Replying is gated
  (`review.reply`), and issuing a comp is Marketing-Manager-only because it
  costs money and is logged to the audit trail.
- **Menu Items** (`src/page-listening-menu.jsx`) is a Listening sub-screen that
  tracks sentiment per *dish* rather than per hashtag — the only vocabulary a
  kitchen can act on. It leads with the biggest mover in each direction, since
  "most talked about" is just the bestseller you already knew about.
- **Competitor insights** (`src/page-listening-competitors.jsx`) compares the
  restaurant against a named catchment — Sector 10 Market, Dwarka, 2.5km — on
  the four things public data actually supports: posting cadence, engagement
  rate, Google rating and review velocity. Plus a content-positioning split of
  themes nobody nearby posts versus themes two or more rivals own. Every figure
  is Business Discovery or Places; their reach and sentiment are private and
  are not shown at any confidence. Each competitor row expands into their last
  14 days of posts, one at a time — caption, format, likes, comments, derived
  theme, offer flag, and how the post performed against that competitor's own
  median. There is no sentiment on competitor posts: Business Discovery returns
  comment counts, not comment text, so there is nothing to classify.
- **Establishments** (`src/page-establishments.jsx`) is the candidate pool the
  competitor set is chosen from — every restaurant Places Nearby Search returns
  in the catchment, with a per-channel verdict on whether it can be analysed at
  all. Three tiers: *full comparison* (Google listing + public Instagram
  Business/Creator account), *ratings only* (Google alone — their Instagram is
  personal, private, dormant or absent, and Business Discovery cannot read
  those), and *cannot track* (no Google listing, common for delivery-only
  kitchens). Marking an establishment here drives both the Competitors screen
  and the recommendation engine. A *ratings-only* rival appears on Competitors
  as a partial row: its Google rating and review count are populated, and the
  Instagram-derived columns — followers, engagement, cadence — read **"Not
  readable"** with the specific reason on hover, never an em dash, because an
  em dash would be indistinguishable from zero. It has no feed to expand and
  no engagement sparkline. In the engine it counts toward the review-velocity
  comparison and is excluded from the cadence one, and each median on the
  Insights cards states the population it is over.
- **Sync** (`syncCompetitors()` in `src/mock.jsx`, button on Competitors) runs
  one pass over the tracked set: a Places Details call per establishment, plus
  a Business Discovery call per readable Instagram account. Personal and
  private accounts are skipped rather than called, since the call would return
  nothing and still spend quota. The report names every call and its outcome —
  a sync that silently half-works is worse than one that fails loudly. A
  completed sync bumps `SYNC_VERSION`, which the Competitors table and the
  recommendation engine key their caches on, so a refresh propagates without a
  page reload.
- **Composer previews** (`src/page-compose.jsx`) are genuinely different per
  channel. A Google post renders inside a business listing with its rating and
  Book/Directions buttons; an Instagram post renders inside a feed. The same
  200 characters land differently in each, and the composer shows that.

The compliance skeleton from the source design is intact and still earns its
place: draft → review → approve → publish, a hash-chained audit log, PII
masking on guest phone numbers with a gated unmask, and
crisis-cluster detection in Listening.

## Seeded demo narrative

The Listening data carries a deliberate three-act story:

1. **Volume spike** — the galouti reel drives Instagram mentions up 340%.
2. **Competitor move** — Dwarka Darbar launches a monsoon menu with 4× our
   public interactions, in the same week and the same category.
3. **Crisis cluster** (critical) — four negative reports on weekend booking
   waits inside four hours, on Google, Instagram comments and WhatsApp at
   once, pointing at the floor being outrun by Top 50 demand rather than at
   the kitchen.

That last thread is consistent across screens: the Google rating slides 4.6 →
4.3 (`REVIEW_STATS.trend12w`), and the wait-time/booking complaint recurs
across Reviews, Listening and the Inbox.

## Layout

```
index.html       Entry point. Tailwind config, theme tokens, font + CDN loads,
                 and the ordered list of <script type="text/babel"> tags.
src/             JSX modules, loaded in dependency order by index.html.
  i18n.jsx       UI strings + AppCtx (English only)
  mock.jsx       Seed data — channels, roles, posts, reviews, menu, listening
  ui.jsx         Shared primitives (buttons, cards, StarRow, RatingBadge, …)
  csv-util.jsx   RFC 4180 CSV build + download
  sidebar.jsx    Left navigation
  topbar.jsx     Header, role switcher, notifications
  recommend.jsx  Recommendation engine — rules, scoring, provenance
  page-*.jsx     One file per screen
  page-listening*.jsx  Listening shell + 5 sub-screens
  ai-assistant.jsx     Floating AI assistant
  app.jsx        Root <App /> (mounted by the bootstrap block in index.html)
```

Each `src/*.jsx` runs in the global scope under Babel standalone — they share
state through window globals rather than ES imports. Load order in
`index.html` is therefore load-bearing.

## Live data

Every number here is fabricated. **[DATA-SOURCES.md](DATA-SOURCES.md)** maps
each dataset to what would actually feed it in production and is deliberately
honest about the gaps. There are three channels; Zomato, Swiggy and District
were removed because none has a public API, and reaching them means a
POS/aggregator middleware contract.

## Design tokens

Tailwind colours are namespaced `saf-*` and defined in `index.html`. Dark mode
is a class on `<html>` with hand-written CSS overrides, documented inline with
their contrast ratios. `dark:` variants do work on `saf-*` tokens; the
`html.dark` override block owns remapping a token wholesale, and a `dark:`
utility is for a one-off at a single site that a remap cannot express. Type is
Inter for UI and Fraunces for display numerals. Renaming the brand is a `saf-`
token rename plus the strings in `i18n.jsx` and `mock.jsx`.
