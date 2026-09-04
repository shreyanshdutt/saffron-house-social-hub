-- Saffron House Social Hub — server schema.
--
-- SQLite today, Postgres later. The SQL below sticks to the intersection of
-- the two wherever that costs nothing: no AUTOINCREMENT, no sqlite-only
-- pragmas in the table bodies, TEXT timestamps in ISO-8601 UTC, explicit
-- CHECK constraints instead of sqlite's loose typing. The two deliberate
-- sqlite-isms are INTEGER PRIMARY KEY for surrogate ids and INTEGER 0/1 for
-- booleans; both map to Postgres with a mechanical edit (GENERATED ALWAYS AS
-- IDENTITY, BOOLEAN) and neither leaks into query logic.

-- ---------------------------------------------------------------------------
-- establishments
--
-- RETENTION IS THE WHOLE DESIGN OF THIS TABLE. Google Maps Platform Service
-- Specific Terms §A.3 permits caching `place_id` indefinitely; §14.3 permits
-- caching latitude/longitude for up to 30 consecutive calendar days. Name,
-- rating, user_ratings_total, address and business status are granted no
-- caching permission there at all (CONVENTIONS.md §10).
--
-- So `place_id` is the ONLY column here that is permanent. Everything else is
-- volatile: grouped below the line, stamped with `fetched_at`, and cleared by
-- purgePlacesContent() once PLACES_RETENTION_DAYS has elapsed. A volatile
-- column going NULL is the system working, not data loss.
CREATE TABLE IF NOT EXISTS establishments (
  -- Permanent. The only Places field we may keep indefinitely (§A.3).
  place_id            TEXT PRIMARY KEY,

  -- Ours, not Google's: our own stable handle for this row, and whether the
  -- row is fabricated seed data or a real Places result. Once real rows land
  -- alongside the seeds, telling them apart is the whole ballgame.
  local_ref           TEXT UNIQUE,
  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),
  first_seen_at       TEXT NOT NULL,

  -- ---- volatile Places content, subject to PLACES_RETENTION_DAYS ----------
  fetched_at          TEXT,
  name                TEXT,
  category            TEXT,
  rating              REAL,
  user_ratings_total  INTEGER,
  business_status     TEXT,
  formatted_address   TEXT,
  lat                 REAL,
  lng                 REAL,
  -- Not returned by Nearby Search; a Details call gives it. Step 5 parses it
  -- for social handles, which is why it is here before anything fetches it.
  website             TEXT
);

-- ---------------------------------------------------------------------------
-- establishment_social
--
-- One row per (establishment, platform). `account_type` is UNKNOWN until a
-- Business Discovery attempt tells us otherwise — that is a real state, not a
-- default to be filled in optimistically. `readable` is likewise NULL until
-- something has actually tried; 0/1 only ever recorded from an outcome.
--
-- A handle discovered by parsing a website is not the same fact as a handle
-- confirmed readable by the API, and `verified_at` is what separates them.
CREATE TABLE IF NOT EXISTS establishment_social (
  id                  INTEGER PRIMARY KEY,
  place_id            TEXT NOT NULL REFERENCES establishments (place_id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN ('instagram', 'x', 'facebook')),
  handle              TEXT,
  account_type        TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (account_type IN ('unknown', 'business', 'creator', 'personal', 'private', 'absent')),
  -- NULL = never attempted. 0/1 = an attempt returned an answer.
  readable            INTEGER CHECK (readable IN (0, 1)),
  last_post_days_ago  INTEGER,
  verified_at         TEXT,
  verification_error  TEXT,
  discovered_from     TEXT,
  UNIQUE (place_id, platform)
);

-- ---------------------------------------------------------------------------
-- tracked
--
-- Which establishments this restaurant has chosen to compete against. This is
-- a per-restaurant decision that outlives a browser profile — it was
-- `saf-tracked-v1` in localStorage, which meant a second device saw a
-- different competitor set and the recommendation engine silently disagreed
-- with itself. `tracked_by` is a role id from PROFILES in mock.jsx.
CREATE TABLE IF NOT EXISTS tracked (
  place_id            TEXT PRIMARY KEY REFERENCES establishments (place_id) ON DELETE CASCADE,
  tracked_at          TEXT NOT NULL,
  tracked_by          TEXT NOT NULL CHECK (tracked_by IN ('admin', 'executive', 'srexec', 'manager'))
);

-- ---------------------------------------------------------------------------
-- observations
--
-- The generalisation of OBSERVATION_HISTORY in mock.jsx. One row is one
-- reading from one API at one moment.
--
-- EVERY MEASURE COLUMN IS NULLABLE ON PURPOSE. In the client a sample is
-- `{ at, reviews, followers, avgInteractions }` with each field present only
-- if the call that returns it actually ran, and absence is what lets
-- changeFromSeries() tell "never observed" from "observed and unchanged".
-- That property has to survive the move to SQL, so a skipped call writes NULL
-- and never 0.
--
-- `source` also carries the §10 requirement not to conflate stores: Places
-- rows describe someone else's listing and fall under §14.3; our own Business
-- Profile readings do not. A consumer can always tell which is which.
CREATE TABLE IF NOT EXISTS observations (
  id                  INTEGER PRIMARY KEY,
  -- An establishment place_id, or the reserved key for our own restaurant.
  -- Deliberately NOT a foreign key: 'saf-self' is us, and we are not a row in
  -- a table of other people's Places listings.
  subject             TEXT NOT NULL,
  observed_at         TEXT NOT NULL,
  source              TEXT NOT NULL
                        CHECK (source IN ('places', 'business_discovery', 'business_profile', 'seed')),
  review_count        INTEGER,
  rating              REAL,
  followers           INTEGER,
  media_count         INTEGER,
  avg_interactions    INTEGER,
  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))
);

CREATE INDEX IF NOT EXISTS observations_subject_time
  ON observations (subject, observed_at);

-- ---------------------------------------------------------------------------
-- scans
--
-- A Places Nearby Search run. Auditable after the fact INCLUDING WHAT IT COST:
-- every external call is money or quota (CONVENTIONS.md §10), so a scan that
-- cannot say how many calls it made cannot be reasoned about later.
CREATE TABLE IF NOT EXISTS scans (
  id                  INTEGER PRIMARY KEY,
  run_at              TEXT NOT NULL,
  centre_lat          REAL NOT NULL,
  centre_lng          REAL NOT NULL,
  radius_m            INTEGER NOT NULL,
  rating_floor        REAL,
  results_count       INTEGER NOT NULL DEFAULT 0,
  pages_fetched       INTEGER NOT NULL DEFAULT 0,
  api_calls           INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'partial', 'failed')),
  error               TEXT
);
