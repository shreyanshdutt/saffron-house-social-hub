# saffron-house-server

The data service for the Saffron House Social Hub. It owns the database, and
it will own the credentials and the external API calls. The client in `src/`
stays buildless and holds nothing secret — see CLAUDE.md § *The client / server
boundary*.

**This build makes no external API call.** There is no Places scan, no handle
discovery and no sampler, and **no post is ever sent** — the publish path runs
for real end to end with only the network call stubbed (`src/publish-adapters.js`).
It serves the establishment list, the tracked set, the observation history and
the post lifecycle from SQLite, and derives every rate over them — the client
renders those values and computes none of them itself.

## Run it

```
cd server
cp .env.example .env      # fill in nothing yet — no key is used by this build
npm test                  # 168 tests, no network
npm run seed              # loads the 15 establishments from seed/seed-data.json
npm start                 # http://127.0.0.1:8787
```

There is no `npm install` step: **the dependency list is empty.** Node 22.5+ is
required for the built-in `node:sqlite`.

## Environment

`server/.env` is gitignored and must never be committed. `.env.example` holds
the keys with no values.

| Key | Meaning |
|---|---|
| `PORT` | listen port, default `8787` |
| `DATABASE_PATH` | default `server/data/saffron.sqlite` (gitignored) |
| `PLACES_RETENTION_DAYS` | default 30; **a value above 30 is refused at boot** |
| `GOOGLE_MAPS_API_KEY` | not read by this build |
| `IG_APP_ID` / `IG_APP_SECRET` / `IG_LONG_LIVED_TOKEN` / `IG_BUSINESS_ACCOUNT_ID` | not read by this build |

## Routes

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | row counts per table |
| GET | `/establishments?maxDistanceKm=&minRating=` | establishments with availability tier and social rows, filtered in SQL. A **tracked** establishment is never filtered out; it comes back flagged `belowFilters` |
| GET | `/establishments/:placeId` | one of the above |
| GET | `/competitors` | the tracked set with availability tier, review velocity, follower change and engagement change **already derived**, plus our own metrics and `minWindowDays` |
| GET | `/tracked` | the tracked set |
| GET | `/observations/:subject` | the observation series, oldest → newest |
| POST | `/tracked` | `{ placeId, trackedBy }` — track one |
| DELETE | `/tracked/:placeId` | untrack one |
| POST | `/observations` | persist a batch of readings (the client's demo sync writes here) |
| GET | `/posts?state=` | every post with its per-channel targets and a **derived** summary |
| GET | `/posts/:id` | one of the above |
| POST | `/posts` | create a draft, or a scheduled post if `scheduledAt` is given |
| POST | `/posts/:id/publish` | the publish attempt — **records the outcome, never refuses** |
| DELETE | `/posts/:id` | delete a draft or scheduled post; an attempted one is a record and is refused |
| PUT | `/establishments/:placeId/social/instagram` | record a hand-entered handle as **unverified** (`unknown` / `readable NULL`) |
| DELETE | `/establishments/:placeId/social/instagram` | record that we looked and there is no account (`absent`) |

`:subject` is a `place_id`, or the reserved `saf-self` for our own restaurant.

## Retention

`place_id` is the only Google Places field stored permanently — Maps Platform
Service Specific Terms §A.3 permits it, and §14.3 caps caching of Lat/Lng at 30
consecutive calendar days while granting no caching permission for name,
rating, review total, address or business status.

Everything volatile lives in clearly-named columns on `establishments` with a
`fetched_at`, and `purgePlacesContent()` nulls them past the window. The row
itself survives, because `place_id` is permanent and the row is what links
tracking, social handles and observations together.

**The window is one constant** — `PLACES_RETENTION_DAYS_DEFAULT` in
`src/config.js`, with the clause quoted beside it. It is never inlined at a
call site.

Whether the competitor review-count history may outlive that window was an open
owner decision; **it was ruled on 2026-09-08 and the answer is that it may
not** (CONVENTIONS.md §10, *Ruling*). `observations` stay on their own switch,
`PURGE_PLACES_OBSERVATIONS`, now `true`: Places-sourced readings for real
establishments are deleted once past the window. A 30-day snapshot and a 90-day
archive kept to derive a rate are different asks under a clause that grants
these columns no window at all.

Competitor review velocity survives this. It needs two readings seven or more
days apart and a 30-day window always holds several, so the lookback is capped
rather than lost — noisier, not absent. Our own velocity reads `saf-self` from
Business Profile, which §14.3 does not reach.

Fabricated seed rows carry `is_sample = 1` and are exempt: they are invented,
not Google Maps Content.

## Posts, and why there are two tables

`posts` holds one piece of content. `post_targets` holds one row per channel.
They are separate because the outcomes are independent: Instagram can succeed
while X fails on cost and Google fails on an expired token, and those are three
different problems needing three different sentences in front of a user.

**The state split is the design.** `posts.state` is what the user ASKED FOR —
`draft`, `scheduled`, `sending`, `attempted`. `post_targets.status` is what
HAPPENED — `pending`, `published`, `failed`, `skipped`. There is deliberately
**no `published` state on a post**: one that succeeded on Instagram and failed
on X is neither published nor failed, and any single word would have to lie
about one of them. A screen wanting one line calls `summarisePost()` in
`src/posts.js`, which is the only place that derivation exists and is tested
there. It is never written back to the row, because a stored summary starts
disagreeing with the targets it came from.

**Metrics live on the target, not the post**, and the seed is why: every seeded
post carries `metricsFrom: 'ig'` while three of the seven went to two channels,
so those figures describe Instagram only. On the post row they would silently
have become every channel's numbers. A target with no metrics holds NULL, which
means *not measured* — not zero.

**The publish attempt records rather than refuses** (owner decision,
2026-09-09). Pressing Publish with nothing connected writes the attempt and
marks each target failed with a reason that distinguishes `never_connected`
from `expired` from `revoked`, because those are three different problems and
`connections` already draws that line. Every attempt returns a cost report —
call count and which calls are billed — computed before it runs, per
CONVENTIONS.md §10. Only X is billed on this path; Business Profile writes to
our own listing are free, and Places (which *is* billed) is a read API for other
people's listings and is never on a publish path.

**`src/publish-adapters.js` is the seam.** Every adapter is a stub returning
`not_implemented`. When credentials arrive, exactly one function per channel
changes — the target rows, the failure vocabulary, the cost report and the
tests are already real.

## Dish mentions

`MENU_ITEMS` in the client claims `mentions7d: 412` for the Galouti Kebab and
`sentiment: 0.81`. The entire seeded guest corpus is **7.3 KB across 57
fragments**, of which 31 are actually guest-written. 412 cannot come from that.
`menu_items` + `menu_item_aliases` exist so the figure can be replaced by one an
owner can check by reading the sentences it came from.

**Aliases, because guests write "biryani", not "Awadhi Biryani".** They are a
table rather than a JSON column so that `alias` can be the PRIMARY KEY, which is
what makes an ambiguous alias impossible rather than merely discouraged:
"Galouti Kebab" and "Kathal Galouti" share the token `galouti`, and a bare
`galouti` alias on both would credit every unqualified mention to whichever was
inserted first. **A missed mention is recoverable; a wrongly attributed one is
invisible**, so neither dish claims it and an unqualified "the galouti was
excellent" is deliberately counted for nobody.

**Evidence is the feature; the count is a by-product.** Every mention carries
the guest's words as written, offsets into the original, the whole quote, and
the source. A count without evidence would be another unverifiable number.

**There is no sentiment**, by owner decision (2026-09-09) — not a column, not a
field, not a placeholder. `src/text-normalize.js` records why the honest version
is not available offline, along with four other negative results tested the same
day, so nobody re-runs that afternoon.

**Why it is tractable with no dependency:** dish names survive Hinglish intact.
Nobody translates "biryani". The dish name is the anchor and the language around
it is irrelevant to a mention count.

## Customers

The first tables here that hold a person. **CONVENTIONS.md §11 is the
specification** and was committed before the schema was written.

**No contact details are stored.** There is no phone, email or address column
on `customers`, and none is to be added — that is an owner decision, not a
default a later feature may relax. What an imported row carries is a
**provider-issued contact reference**, never a phone number and never a hash of
one.

**Reachability is derived, never stored.** `isReachable()` reads the source and
the reference; a `reachable` column could disagree with the row it describes,
the same reason `summarisePost()` derives an outcome instead of persisting one.

**A segment shows two numbers, never one.** `summariseSegment()` returns
`tagged`, `reachable` and `unreachable` — always all three, with no variant
returning a lone total. A single figure beside a broadcast button tells a
restaurant it can reach people it cannot, and at ₹0.8631 a message it finds out
by paying. The seeded Awadhi Biryani segment is **5 tagged · 3 reachable**
precisely so that gap is visible rather than theoretical.

**Two provenances that must never merge.** A customer tag is one person's
judgement and carries `tagged_by` / `tagged_at`, both NOT NULL. A dish mention
is a guest's own words in `guest_texts`. Nothing joins them, no column links
them, and no commit may create the link by inference — an Instagram handle is
not a phone number.

**Contact import is BLOCKED.** `src/contact-import.js` is a stub with a named
reason, the way `publish-adapters.js` stubs publishing. On Meta's Cloud API the
contact identifier *is* the phone number (`wa_id` is E.164), so §11's decisions
1 and 2 cannot both hold against it. The gate lifts when the client names a
provider that issues a non-phone contact ID **and accepts it as a send target**.

## One test looks outside server/

`test/client-globals.test.js` invokes `tools/check-globals.mjs` at the repo
root, which reads every `src/*.jsx` **as text** to find a top-level name
declared in more than one file. It never imports, executes or requires client
code, and nothing under `server/src/` touches `src/` — the service still has no
client dependency.

It lives here because the client is permanently buildless and `npm test` is the
only automated runner in the repo. The alternative was a check somebody has to
remember to run, which is the same weak control as the CLAUDE.md §5 instruction
it exists to back up — and that instruction was already written when
`SourceBadge` shadowed silently on 2026-09-09.

## Known gaps

Stated rather than hidden — none of these is finished:

- **No authentication whatsoever.** Every route is open to anyone who can reach
  the port. The server therefore binds to `127.0.0.1` only. This must be fixed
  before it is exposed anywhere, and before any credential is added to `.env`.
- **CORS is wide open** (`access-control-allow-origin: *`) so the client on
  another port can reach it. Deliberately without credentials, because there
  are none yet. **When auth arrives this must become an allow-list.**
- **No rate limiting and no request logging.**
- **Nothing is ever published.** Every adapter in `src/publish-adapters.js`
  returns `not_implemented`, so a publish attempt against a *connected* channel
  still fails — with a reason that says the channel is fine and the code is
  not. No `fetch` may be added there until the owner records a decision the way
  §10 requires for Places.
- **No contact can be imported, and no screen shows a customer.** The tables,
  the derivations and the tests are real; the import path is stubbed on the §11
  gate and there is no HTTP route or UI yet. Sample rows carry `is_sample = 1`
  and `sample:`-prefixed references, which is what keeps the seed inside that
  gate — it blocks populating `contact_ref` with a REAL value.
- **Nothing counts mentions yet.** The matcher and the menu are here; the guest
  corpus is still in `src/mock.jsx` and the Menu screen still renders the
  invented `mentions7d` / `sentiment` / `topPraise` / `topComplaint`. Part 2
  moves the corpus and wires the screen. There is deliberately no HTTP route
  for the menu until something renders it.
- **Nothing runs a scheduled post.** There is no scheduler: a post in state
  `scheduled` stays there until something calls `/posts/:id/publish`. The state
  records an intention, and no part of this build acts on it.
- **No external API calls, no scan, no handle discovery, no sampler.** Later
  commits. The Establishments screen's "Re-run nearby search" button is wired
  to nothing on purpose and says what it is blocked on.
- **A hand-entered handle is never verified by this build.** It is stored
  `unknown` / `readable NULL` / `verified_at NULL` and does NOT raise the
  availability tier. Only a real Business Discovery attempt can resolve it,
  which needs Instagram Graph credentials.
- **No migration framework.** `schema.sql` is applied with `CREATE TABLE IF NOT
  EXISTS`; there is no versioning and no down-migration. Fine while the only
  database is a local file that can be deleted and re-seeded, not fine later.
- **`node:sqlite` is experimental** in Node 22 and prints a warning on import.
  It is quarantined in `src/db.js` so swapping to `better-sqlite3` is one file.
- **The seed data is frozen in `seed/seed-data.json`**, extracted once from
  `src/mock.jsx` at commit `40c9100` immediately before that data was deleted
  from the client. The SERVICE reads nothing under the client's `src/`, so
  CLAUDE.md §2's "the server never imports from `src/`" holds: no module under
  `server/src/` touches it and nothing imports from it. One TEST reads
  `src/*.jsx` as text — see *One test looks outside server/* below — which is a
  static scan rather than an import, and does not travel with the service.
  Regenerate with `git show 40c9100:src/mock.jsx`.

## Layout

```
src/config.js        env + the retention constant, with §14.3 quoted
src/db.js            the only module that touches the sqlite driver
src/schema.sql       DDL
src/availability.js  the full / ratings / none tier derivation
src/observations.js  the observation series, in the client's sample shape
src/retention.js     the purge
src/repo.js          queries
src/http.js          routes
src/index.js         boot
seed/seed-data.json  frozen seed, extracted from mock.jsx at 40c9100
seed/seed.js         one-shot seeding
src/derive.js        review velocity, follower change, engagement change
src/posts.js         post lifecycle, channel-id translation, the derived summary
src/publish-adapters.js  THE STUBBED SEAM — the only place a platform call would live
src/text-normalize.js    guest-text normalizing + the negative results, recorded
src/dish-matcher.js      dish-name matching with the evidence attached

(and outside server/, invoked by one test:)
../tools/check-globals.mjs  top-level name collisions across src/*.jsx
src/customers.js         reachability + segment derivation (nothing persisted)
src/contact-import.js    THE BLOCKED SEAM — contact import, stubbed on the §11 gate
test/                168 tests, node:test, no network
```
