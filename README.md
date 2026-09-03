# Saffron House Social Hub

Prototype UI for a single-restaurant social and reputation hub, built for
**Saffron House** — a flagship modern-Indian restaurant in Khan Market, New
Delhi.

Single-page React app served from `index.html`, using CDN-hosted React 18,
in-browser Babel for the JSX in `src/`, an importmap to bind ESM modules
(`lucide-react`, `recharts`) to the same React instance, and Tailwind via CDN.

## Run it locally

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

One restaurant, one location, six channels, four roles.

**Channels** (`PLATFORMS` in `src/mock.jsx`) each carry a `kind` that decides
which screens they appear on:

| Channel | id | kind | Where it shows up |
|---|---|---|---|
| Instagram | `ig` | social | Compose, Scheduled, Analytics, Inbox |
| Google Business Profile | `gg` | review | Reviews, Compose, Analytics |
| Zomato | `zo` | review | Reviews, Compose, Analytics, Inbox |
| Swiggy | `sw` | review | Reviews, Compose, Analytics, Inbox |
| District | `di` | social | Compose, Scheduled, Analytics |
| WhatsApp | `wa` | messaging | Inbox only — no feed to post to |

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
  the "what should I do today" screen. Eleven rules run over the week's
  reviews, menu conversation, listening signals, channel performance and
  publishing queue, and produce a ranked list of concrete actions — post this
  dish, fix the packing station, open a second Diwali seating, do not promote
  that curry. Nothing executes: each action carries an owner, a place it
  happens (kitchen, partner dashboard, composer) and a deadline. Every figure
  behind a recommendation is shown with its real-world source and badged by
  whether that source is live via API, needs a partner integration, or is
  derived in-house.

- **Reviews** (`src/page-reviews.jsx`) is a first-class screen, not a feed tab.
  Reviews arrive with a star rating, a dine-in/delivery context, and an SLA
  clock; the list sorts by *urgency* rather than recency, because an unanswered
  1★ is a standing advertisement against you. Replying is gated
  (`review.reply`), and issuing a comp is Marketing-Manager-only because it
  costs money and is logged to the audit trail.
- **Menu Items** (`src/page-listening-menu.jsx`) is a Listening sub-screen that
  tracks sentiment per *dish* rather than per hashtag — the only vocabulary a
  kitchen can act on. It leads with the biggest mover in each direction, since
  "most talked about" is just the bestseller you already knew about.
- **Composer previews** (`src/page-compose.jsx`) are genuinely different per
  channel. A Google post renders inside a business listing with its rating and
  Book/Directions buttons; a marketplace post renders above an order button; a
  District post renders as a dated event with a seat count. The same 200
  characters land differently in each, and the composer shows that.

The compliance skeleton from the source design is intact and still earns its
place: draft → review → approve → publish, a hash-chained audit log, PII
masking on guest phone numbers and delivery order IDs with a gated unmask, and
crisis-cluster detection in Listening.

## Seeded demo narrative

The Listening data carries a deliberate three-act story:

1. **Volume spike** — the galouti reel drives Instagram mentions up 340%.
2. **Competitor move** — Dilli Darbar launches a monsoon menu with 4× our
   engagement, in the same week and the same category.
3. **Crisis cluster** (critical) — three negative threads on delivery
   temperature and missing items inside four hours, all delivery and none
   dine-in, pointing at packing and handover rather than the kitchen.

That last thread is consistent across screens: the blended rating slides 4.6 →
4.3 while dine-in holds, Swiggy sentiment falls hardest, and the packaging
complaint shows up in Reviews, Menu Items and the Inbox.

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
honest about the gaps — the headline one being that three of the six channels
(Zomato, Swiggy, District) have no public API, and reach a real build only via
POS/aggregator middleware.

## Design tokens

Tailwind colours are namespaced `saf-*` and defined in `index.html`. Dark mode
is a class on `<html>` with hand-written CSS overrides (Tailwind's CDN build
cannot generate `dark:` variants for arbitrary token names), documented inline
with their contrast ratios. Type is Inter for UI and Fraunces for display
numerals. Renaming the brand is a `saf-` token rename plus the strings in
`i18n.jsx` and `mock.jsx`.
