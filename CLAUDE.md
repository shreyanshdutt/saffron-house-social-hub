# CLAUDE.md — Saffron House Social Hub codebase conventions

Read this before touching any file in this repo. It describes what the code
**is**. `CONVENTIONS.md` describes how work on it is **done** — read that too.
The two are one instruction set; neither is optional, and neither overrides
the other. Where they overlap, CONVENTIONS.md is the stricter statement.

Owner: Billy. Changes to this file are owner-approved only.

## 1. What this codebase is

A prototype UI for a single-restaurant social and reputation hub, built for
**Saffron House** — modern-Indian, Sector 10 Market, Dwarka, New Delhi 110075.
Positioning, prices, follower counts and review volumes are scaled to a
neighbourhood market, not a central-Delhi flagship.

It is a **demonstration of a product thesis**, not a shipping app. The thesis:
*every field on screen is deliverable by a real API*. Anything that could not
be fetched from Instagram Graph / Google Business Profile / WhatsApp Cloud,
derived by classification over text those return, or read from the
restaurant's own POS and menu systems has been **removed rather than faked**.

That is the product. A change that quietly puts an unobtainable field back on
screen has destroyed the thing being demonstrated, however good it looks. The
field-by-field map of what is API / derived / unobtainable is `DATA-SOURCES.md`
and the in-app **Data & access** screen (Owner role). Both are binding.

There is no backend, no database, no test suite, no CI, no type checker, no
linter and no build step. Read that literally: **the only verification that
exists in this repo is a human loading the page in a browser and looking at
it.** See CONVENTIONS.md § Definition of Done.

## 2. Stack, and what it forbids

- **React 18.3.1 UMD** + ReactDOM UMD from unpkg, pinned with SRI hashes.
- **`@babel/standalone` 7.29.0** compiles every `src/*.jsx` in the browser, at
  load time, via `<script type="text/babel" src="...">`.
- An **importmap** rebinds bare `react` / `react-dom` to `window.React` /
  `window.ReactDOM` so the ESM packages below share ONE React instance.
  Breaking that produces invalid-hook-call errors, not a clear message.
- **`lucide-react` 0.453.0** and **`recharts` 2.12.7** load as ES modules from
  esm.sh with React externalised. They land on `window.Lucide` /
  `window.Recharts` and fire a `deps-ready` event the bootstrap block waits on.
- **Tailwind via the play CDN**, configured inline in `index.html`.

Consequences, all non-negotiable:

- **No ES `import` / `export` anywhere in `src/*.jsx`.** Every file compiles as
  a classic script into GLOBAL scope. There are currently zero imports in
  `src/`. Keep it that way. An `import` line does not fail loudly — it changes
  the module's scope and the symbols other files depend on silently vanish.
- **No build step, no bundler, no `package.json`, no `npm install`, no
  TypeScript.** Do not add one. If a change appears to require one, STOP and
  ask the owner rather than introducing it.
- **`file://` does not work.** ES modules, the importmap and `text/babel` all
  need an HTTP origin. Serve with `python3 -m http.server 8000` from the repo
  root and open <http://localhost:8000/>.
- **Everything is client-side and ephemeral.** The only persistence is
  `localStorage` (§6). A page reload re-seeds from `mock.jsx`.

## 3. The non-negotiables

1. **Honest data.** No field on screen that a real API could not deliver. No
   number invented to fill a gap. Where a value is genuinely unavailable, the
   UI says so — "not synced yet", "unavailable on a first sync", an em dash —
   it does not substitute a plausible one. This is the project's #1 value and
   it outranks completeness, symmetry and visual polish.
2. **`caps` gating is the enforcement mechanism.** Each channel in `PLATFORMS`
   carries a `caps` list of what its API genuinely supports, and screens read
   it: a channel without `publish` never reaches the composer, one without
   `metrics` never reaches a performance chart. Add a capability only when the
   real API provides it. Never hardcode a channel id where `hasCap()` belongs.
3. **Three channels. `ig`, `gg`, `wa`.** Zomato, Swiggy and District were
   removed in `9f6e8ab` because none has a public API and reaching them means
   a paid POS-middleware contract. Do not reintroduce them, and do not treat a
   stale mention in a doc as licence to. If a doc still names them, the doc is
   the defect — fix the doc (CONVENTIONS.md § Docs and code are one artifact).
4. **Fabricated seed data must announce itself.** `COMPETITOR_CATCHMENT.isSampleData`
   is the flag. While it is set, outbound links render as inert text and post
   permalinks use a `sample://` marker rather than an `instagram.com` URL —
   see §11 trap 2. Both revert to real links when the flag is cleared.
5. **Load order is load-bearing.** §4.

## 4. Load order — `index.html`

`index.html` is the entry point and carries five things: the Tailwind config
and `saf-*` colour tokens, the hand-written dark-mode CSS (§8), the CDN loads
and importmap, the **ordered list** of `<script type="text/babel">` tags, and
the bootstrap block that mounts `<App />` once `deps-ready` has fired.

Because every file lands in global scope, **a file that references a symbol at
module-evaluation time must load after the file that defines it.** The order
currently in `index.html`, and why the non-obvious parts sit where they do:

```
i18n.jsx          I18N strings, useT, tFor, AppCtx        — first: everything reads it
mock.jsx          ALL seed data + roles + channels        — second: everything reads it
ui.jsx            shared primitives
sidebar.jsx, topbar.jsx
page-dashboard … page-reviews.jsx
recommend.jsx     recommendation engine                   — before page-recommendations
page-data-sources, page-settings, page-stubs, csv-util
page-listening-signals.jsx                                ┐
page-listening-overview.jsx                               │ sub-screens BEFORE the shell:
page-listening-trends.jsx                                 │ page-listening.jsx references
page-listening-competitors.jsx                            │ SignalsScreen / OverviewScreen /
page-listening-menu.jsx                                   ┘ TrendsScreen / CompetitorsScreen
page-establishments.jsx                                     by bare name
page-recommendations.jsx
page-listening.jsx        the shell                       — after its five sub-screens
ai-assistant.jsx
app.jsx           <App />, PageRouter, PAGE_PERMS         — LAST
```

**Adding a `src/*.jsx` file without adding a `<script>` tag for it to
`index.html` means the file never loads.** Nothing errors; the symbol is
simply undefined at the call site, which surfaces as a blank region or a
React "element type is invalid" at render, far from the cause. Adding the tag
in the wrong position surfaces the same way.

## 5. How files talk to each other

There is no module system. Two mechanisms, and both are in use:

- **Global scope by load order.** A top-level `const` or `function` in an
  earlier file is directly visible by bare name in a later one. Most
  cross-file references work this way — `PLATFORMS`, `REVIEWS`, `hasPerm`,
  `Card`, `Icon`, `fmt`, `StarRow`.
- **Explicit `window.*` assignment** at the bottom of a file, for symbols
  crossing a boundary where the author wanted the export to be legible. The
  current set: `maskedPhone`, `maskedAccount`, `maskedOrder`, `csvEscape`,
  `buildCsv`, `downloadCsv`, `ROLES`, `PROFILES`, `PROFILE_BY_ID`, `PERMS`,
  `hasPerm`, `I18N`, `useT`, `tFor`, `AppCtx`, `PAGE_PERMS`, `PAGE_LABEL`,
  `App`, and the page/screen components (`ApprovalsPage`, `HistoryPage`,
  `DataSourcesPage`, `ACCESS_STEPS`, `FIELD_MAP`, `EstablishmentsPage`,
  `RecommendationsPage`, `TeamPage`, `NotificationsCenterPage`, `ReviewsPage`,
  `reviewSlaState`, `reviewMinsSince`, `SignalsScreen`, `OverviewScreen`,
  `TrendsScreen`, `MenuScreen`, `CompetitorsScreen`, `CompetitorFeed`,
  `ListeningPage`).

Follow whichever pattern the surrounding file already uses. Do not convert one
to the other as a drive-by; that is a scope change dressed as a tidy-up.

**Grep before you introduce a top-level name.** Every `src/*.jsx` shares one
global namespace, so a name is either unique across the whole repo or it is a
collision. A duplicate top-level `const` throws; a duplicate `function` or
`var` silently shadows by load order, which is the bad case. `grep -n
"^\(const\|function\) <Name>\b" src/*.jsx` before adding one.

## 6. The data layer

**`src/mock.jsx` is the single seed source.** Every dataset on every screen
originates there: `POSTS`, `SCHEDULED`, `CONVERSATIONS`, `POST_COMMENTS`,
`REVIEWS`, `REVIEW_STATS`, `MENU_ITEMS`, `ANALYTICS_IG` / `_GG` / `_WA`,
`ANALYTICS_BREAKDOWN`, `ANALYTICS_SENTIMENT`, `TRENDING_TAGS`, `TEMPLATES`,
`ACTIVITY`, `LISTENING_SIGNALS`, `LISTENING_TRENDS`, `LISTENING_KPIS`,
`LISTENING_COMPETITORS`, `COMPETITOR_CATCHMENT`, `COMPETITOR_POST_SEEDS`,
`ESTABLISHMENTS`, `SAF_SELF_STATS`.

Do not create a second seed array inside a page file. A screen needing data
either reads an existing export or gets a new one added to `mock.jsx` — and a
new one must be defensible against `DATA-SOURCES.md` before it is written.

**Derived-at-runtime, not seeded:** `buildCompetitorFeed()`,
`applyCompetitorSync()`, `establishmentAvailability()`, `trackedCompetitors()`,
`trackedPendingEstablishments()`, `syncCompetitors()`, and the whole of
`recommend.jsx`.

**`SYNC_VERSION`** (`{ value: 0 }` in `mock.jsx`) is the cache key. A completed
`syncCompetitors()` bumps it; the Competitors table and the recommendation
engine key their memos on it, so a refresh propagates without a page reload.
Anything caching derived competitor state must key on it too.

**`localStorage` keys** — the entire persistence layer. Every read is wrapped
in `try/catch` because private-mode browsers throw on access; keep that.

| Key | Holds | Written by |
|---|---|---|
| `saf-role` | current role id | `app.jsx` |
| `saf-theme` | `'light'` / `'dark'` | `app.jsx` + the pre-paint block in `index.html` |
| `saf-tracked-v1` | tracked establishment ids | `trackedSave()` |
| `saf-sync-v1` | last sync state | `syncStateSave()` |
| `saf-listening-v1` | dismissed / assignments / read / notes / tags / filter | `listeningSave()` |
| `saf-recs-v1` | recommendation id → `accepted` / `done` / `dismissed` | `recsSave()` |

Changing the SHAPE of a persisted value requires a new `-v2` key, not a
silent reinterpretation of the old one — a returning viewer has the old shape
in their browser and will hit whatever the new code assumes.

## 7. Roles and permissions

Four roles. The **ids are generic internal keys** because they are referenced
across every screen; the label is what the audience sees.

| id | Label | Holds |
|---|---|---|
| `admin` | Owner | Channels, users, audit, brand kit |
| `executive` | Social Coordinator | Drafts and replies, no publish |
| `srexec` | Guest Relations Lead | Reviews drafts, replies to reviews, flags |
| `manager` | Marketing Manager | Approves, publishes, unmasks PII, issues comps |

Do not rename the ids. Change the label in `PROFILES` (`mock.jsx`).

Two gates, and both must be set for a new screen:

- **`PERMS`** (`mock.jsx`) maps a permission string to the set of roles that
  hold it. Read it through `hasPerm(role, perm)` — never by touching `PERMS`
  directly, and never by comparing role strings inline.
- **`PAGE_PERMS`** (`app.jsx`) maps a route to the permission it requires.
  `<RoleRedirector>` sends a role that lacks it back to the Dashboard with a
  toast naming the screen via `PAGE_LABEL`. A route absent from `PAGE_PERMS`
  is reachable by every role — that is a permission hole, not a default.

Money- and PII-touching actions are Marketing-Manager-only by design:
`review.comp`, `inbox.unmask`, `post.publish`, `draft.approve`. Do not widen
one to make a demo flow smoother.

## 8. Styling, tokens and dark mode

- Colours are namespaced **`saf-*`** and defined in the `tailwind.config` block
  in `index.html`: `primary #B4451F`, `dark #6E2412`, `light #FCEFE7`,
  `accent #D99A16`, `surface #FBF7F2`, `card #FFFFFF`, `text #2A1D16`,
  `muted #7A6A5F`, `success #2E7D4F`, `warning #B7791F`, `danger #C0342B`,
  `border #EADFD4`.
- Type: **Inter** for UI, **Fraunces** for display numerals.
- **Dark mode is `class` strategy plus hand-written CSS overrides** in
  `index.html`. The `.jsx` files keep using the same `saf-*` utility classes
  and the override block remaps their output under `html.dark`. Contrast
  ratios are documented inline against the dark card `#221913` — the terracotta
  primary fails AA there at full saturation and is lifted to `#F0A07A` (8.2:1).
  **If you add a new `saf-*` surface or text colour, add its `html.dark`
  override in the same change**, and state the measured ratio in the comment
  the way the existing entries do. A missing override is invisible in light
  mode and unreadable in dark.
- Recharts dark theming uses `!important` deliberately: Recharts emits inline
  `stroke` / `fill` attributes from the JSX that plain CSS would lose to.
- **`dark:` variants DO work on `saf-*` tokens — SETTLED (owner verified in a
  browser, 2026-09-04).** `README.md` § *Design tokens* claims the Tailwind CDN
  build "cannot generate `dark:` variants for arbitrary token names". That
  claim is **false** and is tracked as doc drift (CONVENTIONS.md § 3, item 6).
  The play CDN generates them for any colour in the inline `tailwind.config`,
  and does so for React-injected classes too because it watches the DOM.
  Six such utilities are already in use and render correctly:
  `page-analytics.jsx:403`, `page-listening-competitors.jsx:477` and `:577`,
  `page-listening-overview.jsx:161`, `page-listening-signals.jsx:617` and
  `:621`. (`ui.jsx:25` and `:59` also read `dark:`, but those are variant-map
  object keys, not Tailwind classes — do not count them.)

  **Which to use.** Both are available; they are not interchangeable.
  - The **`html.dark` override block** is for **remapping a token wholesale** —
    when every `bg-saf-card` on every screen should become `#221913`. That is
    how the theme is built and it stays the default. One edit, one place, and
    a `.jsx` file never learns about theming.
  - A **`dark:` utility** is for a **one-off at a single site** that the token
    remap cannot express — a different opacity, a hand-picked colour, a
    rose-tinted crisis panel. That is exactly what the six existing ones are.

  Reaching for `dark:` to fix something a token remap should own scatters
  theming across `src/` and is how a theme stops being maintainable in one
  file. Adding a new `saf-*` surface or text colour still means adding its
  `html.dark` override, per the rule above.

## 9. Naming

- Files: `page-<screen>.jsx`; Listening sub-screens `page-listening-<tab>.jsx`.
- Components: `PascalCase`. Screens mounted by `PageRouter` end in `Page`
  (`ReviewsPage`); Listening sub-screens end in `Screen` (`SignalsScreen`).
- Seed data: `SCREAMING_SNAKE_CASE` top-level consts in `mock.jsx`.
- Permissions: dotted lowercase, `noun.verb` (`review.reply`, `inbox.unmask`).
- Routes: lowercase, hyphenated (`data-sources`, `channel-health`).
- localStorage keys: `saf-<thing>-v<n>`.
- Channel ids: two letters (`ig`, `gg`, `wa`). Refer to channels by id, never
  by display name, except through `PLATFORM_ID_BY_NAME`.

## 10. How to add X

**A screen.** Create `src/page-<name>.jsx` → add a `<script>` tag in the right
position in `index.html` → add a `case` to `PageRouter` in `app.jsx` → add the
route to `PAGE_PERMS` **and** `PAGE_LABEL` → add the nav entry to
`SIDEBAR_SECTIONS` in `sidebar.jsx` (`workflow` / `insights` / `admin`) → add
its strings to `i18n.jsx`. Six places. Missing the
`PAGE_PERMS` entry is a permission hole; missing the `<script>` tag is a blank
screen with no error.

**A channel.** Only if it has a first-party public API the restaurant can be
granted access to. Add to `PLATFORMS` with an honest `caps` list, `api` name
and character `limit`, add the brand colour and a `colorDark` if the light one
fails on the dark card, extend `PlatformGlyph`, and add the row to
`DATA-SOURCES.md` and the Data & access screen (`ACCESS_STEPS` / `FIELD_MAP`).
`POSTABLE`, `REVIEW_CHANNELS` and `INBOX_CHANNELS` derive from `caps`
automatically — do not hand-edit them.

**A recommendation rule.** Add to `REC_RULES` in `recommend.jsx`. Every rule
carries its `kind` (`REC_KINDS`), its owner, where the action happens, a
deadline, and **the provenance of every figure it cites** (`REC_SOURCES`,
`REC_TIER_LABEL`). A rule that cites a number without a source tier is
incomplete. Rules read `buildRecommendationContext()`; they do not reach into
seed arrays directly.

**A listening signal.** Add to `LISTENING_SIGNALS` using an existing `kind`
from `LISTENING_KINDS` and severity from `LISTENING_SEVERITIES`. Relative
times are converted by `relativeTimeToISO()` so the seeded story stays fresh
relative to load — do not hardcode ISO timestamps.

**A menu dish, review, or post.** Add to the corresponding array in
`mock.jsx`. If it participates in the seeded three-act narrative (galouti reel
volume spike → competitor monsoon menu → booking-wait crisis cluster),
keep it consistent across Reviews, Menu Items and the Inbox — that consistency
is the demo.

## 11. Known traps

Every one of these has already cost a cycle in this repo. They share a
signature: **the failure is silent.** Nothing throws, so a change looks
finished and the defect is found later by eye. Where a trap is re-encountered,
the reasoning belongs in a code comment at the site, not only in a report.

1. **`fmt()` renders `NaN` as an em dash.** `fmt()` in `ui.jsx` opens with
   `if (n == null || isNaN(n)) return '—'`. A whole panel of `NaN` therefore
   reads as *merely empty*, not broken, and a `NaN` median is falsy so
   downstream chips silently fall back to a default. This shipped once
   (`83028ad`): dormant competitor records carried `followers` but no
   `avgInteractions`, and `buildCompetitorFeed` multiplied `undefined` through
   every post metric. **When a metric panel looks empty, check for `NaN`
   before concluding there is no data.** `buildCompetitorFeed` now refuses
   non-finite inputs rather than propagating them; keep that guard.

2. **Fabricated handles must never produce a real URL.** "View on Instagram"
   once pointed at `instagram.com` URLs built from invented handles, so
   clicking gave Instagram's own 404 — and fabricated data that 404s on a real
   domain reads as *our data broke*, which is worse than data that says it is
   invented (`83028ad`). While `COMPETITOR_CATCHMENT.isSampleData` is set,
   those render as inert text with an explanatory tooltip, and stored
   permalinks use a `sample://` marker so a link copied out of the app cannot
   masquerade as a live post either. Do not "fix" these into working links.

3. **A wrong Lucide icon name renders nothing, silently.** `Icon` in `ui.jsx`
   returns an empty sized `<span>` when `window.Lucide[name]` is undefined.
   `LinkSlash` does not exist in Lucide (the name is `Unlink`) and produced an
   invisible gap rather than an error (`83028ad`). **Verify an icon name
   against the installed Lucide build before using it** — in the browser
   console, `Object.keys(window.Lucide)`.

4. **Review velocity cannot exist on a first sync.** It is the delta between
   two review counts, so one pull can only set a baseline. The UI says so
   (`404f0d0`). Claiming a velocity from one sample is inventing it.

5. **A readable but dormant competitor account is not "full comparison".**
   `est-10` Punjabi Rasoi (`lastPostDaysAgo: 142`) landed in the full tier
   while the reason underneath said "nothing to compare" (`eb2a33d`).
   `establishmentAvailability()` now treats `lastPostDaysAgo > 60` as stale and
   downgrades to ratings-only, so the tier matches its own explanation.

6. **Giving an establishment a competitor id pulls it into the default tracked
   set.** `TRACKED_DEFAULT` in `mock.jsx` is `est-1`…`est-6`; `est-7`/`8`/`9`
   were accidentally tracked by construction and had to start untracked, so
   that adding one is a deliberate act that costs an API call (`404f0d0`).

7. **A missing `<script>` tag, or one in the wrong position, is a blank
   region** with no console error until React reports an invalid element type
   at render — far from the cause. §4.

8. **`textContent` concatenates both states of CSS-switched text.** When
   verifying text that light/dark or a toggle swaps, read `innerText`.

## 12. Things to never do

1. Never add an ES `import` or `export` to a `src/*.jsx` file. §2.
2. Never add a build step, bundler, `package.json` or TypeScript. §2.
3. Never put a field on screen that no real API can deliver, and never invent
   a number, handle, rating, follower count, permalink or timestamp to fill a
   gap. Show the honest empty state. §3.
4. Never reintroduce Zomato, Swiggy or District, or any channel without a
   first-party public API. §3.
5. Never hardcode a channel id where `hasCap()` belongs, or a role string
   where `hasPerm()` belongs.
6. Never add a route to `PageRouter` without adding it to `PAGE_PERMS`.
7. Never widen a permission to make a demo flow smoother. §7.
8. Never change the shape of a persisted `localStorage` value under its
   existing key. §6.
9. Never construct a live `instagram.com` / `google.com` URL from seed data
   while `isSampleData` is set. §11 trap 2.
10. Never rewrite a file wholesale when asked for a scoped change, and never
    reformat, reorder or "tidy" code you were not asked to touch. The diff is
    read by a human; noise in it is a cost you imposed on the reviewer.
11. Never delete or weaken an existing honesty guard, an explanatory comment,
    or an inline caveat in the UI because it makes a screen look busier.
12. Never edit `README.md` or `DATA-SOURCES.md` to agree with code you just
    wrote without checking which of the two is actually correct.
    CONVENTIONS.md § Docs and code are one artifact.

## 13. Notes for AI assistants specifically

This section exists because the failure mode that costs this project most is
not a broken build — nothing here can break a build — it is **plausible
invention**: a number, a field, an API capability, a file path or a verified
result that was produced rather than observed.

- **Read before you write.** Open the actual file and cite `file:line` for
  every premise you are acting on. A symbol you remember from a summary, a
  README, or an earlier turn is not evidence that it exists in the code now.
- **The docs and the code disagree in places.** They are both artifacts of
  this repo and either can be the stale one. When they conflict, say so and
  ask — do not silently pick the half that is easier to satisfy. Known
  disagreements are tracked in CONVENTIONS.md.
- **Never state a result you did not observe.** "Verified in the browser",
  "the sync makes 14 calls", "renders correctly in dark mode" are claims about
  something that happened. If you did not run it and look, say what you did
  instead and what remains unchecked. An honest "not verified" is worth more
  than a confident wrong claim, and is treated as such here.
- **Report what you could not verify, and what you tried and reverted.** That
  is a required part of a finished job, not an admission of failure.
- **If a premise in the prompt is wrong** — a file that does not exist, a
  symbol that was renamed, a stale SHA, a screen described differently from
  how it is built — STOP and report it. Do not reconcile it by inventing the
  missing piece, and do not build the thing the prompt described instead of
  the thing the repo contains.
- **Scope.** Change what was asked and nothing adjacent. If you find a second
  defect while working, name it in the report; do not fix it in the same
  change unless told to.
- **When you genuinely do not know, say so.** There is no penalty here for
  not knowing and a large one for guessing convincingly.
