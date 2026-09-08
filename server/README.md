# saffron-house-server

The data service for the Saffron House Social Hub. It owns the database, and
it will own the credentials and the external API calls. The client in `src/`
stays buildless and holds nothing secret — see CLAUDE.md § *The client / server
boundary*.

**This build makes no external API call.** There is no Places scan, no handle
discovery and no sampler. It serves the establishment list, the tracked set and
the observation history from SQLite, and derives every rate over them — the
client renders those values and computes none of them itself.

## Run it

```
cd server
cp .env.example .env      # fill in nothing yet — no key is used by this build
npm test                  # 55 tests, no network
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

## Known gaps

Stated rather than hidden — none of these is finished:

- **No authentication whatsoever.** Every route is open to anyone who can reach
  the port. The server therefore binds to `127.0.0.1` only. This must be fixed
  before it is exposed anywhere, and before any credential is added to `.env`.
- **CORS is wide open** (`access-control-allow-origin: *`) so the client on
  another port can reach it. Deliberately without credentials, because there
  are none yet. **When auth arrives this must become an allow-list.**
- **No rate limiting and no request logging.**
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
  from the client. The server no longer reads anything under `src/`, so
  CLAUDE.md §2's "the server never imports from `src/`" now holds with no
  exception. Regenerate with `git show 40c9100:src/mock.jsx`.

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
test/                55 tests, node:test, no network
```
