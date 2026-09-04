# saffron-house-server

The data service for the Saffron House Social Hub. It owns the database, and
it will own the credentials and the external API calls. The client in `src/`
stays buildless and holds nothing secret — see CLAUDE.md § *The client / server
boundary*.

**This build makes no external API call.** There is no Places scan, no handle
discovery and no sampler. It serves the data the client already has, from
SQLite instead of from `mock.jsx`, so that the next commit can move the client
across one risky step at a time.

## Run it

```
cd server
cp .env.example .env      # fill in nothing yet — no key is used by this build
npm test                  # 26 tests, no network
npm run seed              # loads the 15 establishments from ../src/mock.jsx
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
| GET | `/establishments` | every establishment with its availability tier and social rows |
| GET | `/establishments/:placeId` | one of the above |
| GET | `/tracked` | the tracked set |
| GET | `/observations/:subject` | the observation series, oldest → newest |
| POST | `/tracked` | `{ placeId, trackedBy }` — track one |
| DELETE | `/tracked/:placeId` | untrack one |

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
call site. Whether the competitor review-count history may outlive that window
is an open owner decision (CONVENTIONS.md §10), so `observations` are governed
by a separate switch, `PURGE_PLACES_OBSERVATIONS`, currently `false`. Flipping
the owner's answer is a one-line change in that file.

Fabricated seed rows carry `is_sample = 1` and are exempt: they are invented,
not Google Maps Content.

## Known gaps

Stated rather than hidden — none of these is finished:

- **No authentication whatsoever.** Every route is open to anyone who can reach
  the port. The server therefore binds to `127.0.0.1` only. This must be fixed
  before it is exposed anywhere, and before any credential is added to `.env`.
- **No rate limiting, no request logging, no CORS policy.** The next commit,
  which moves the client across, will need CORS or a same-origin proxy.
- **No external API calls, no scan, no handle discovery, no sampler.** Later
  commits.
- **No migration framework.** `schema.sql` is applied with `CREATE TABLE IF NOT
  EXISTS`; there is no versioning and no down-migration. Fine while the only
  database is a local file that can be deleted and re-seeded, not fine later.
- **`node:sqlite` is experimental** in Node 22 and prints a warning on import.
  It is quarantined in `src/db.js` so swapping to `better-sqlite3` is one file.
- **The seed reads `../src/mock.jsx`.** That is the one place the server looks
  at the client, it is a one-shot tool rather than part of the running service,
  and it reads the file as text rather than importing it. See the header of
  `seed/extract-mock.js`. Delete it once real Places data replaces the seeds.

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
seed/extract-mock.js reads src/mock.jsx as text, without importing it
seed/seed.js         one-shot seeding
test/                26 tests, node:test, no network
```
