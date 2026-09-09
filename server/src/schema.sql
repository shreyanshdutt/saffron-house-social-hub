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
  -- The competitor record this establishment corresponds to, where one exists.
  -- Instagram post content (captions, formats, per-post interactions) is not
  -- modelled here — it stays in the client's LISTENING_COMPETITORS for now —
  -- and this is the join between the two. Without it the client would have to
  -- rebuild the link from a string pattern on local_ref, which breaks the day
  -- local_ref stops being 'est-N'.
  competitor_ref      TEXT,
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
  website             TEXT,

  -- Distance from the catchment centre, in km. NOT a Places field and NOT
  -- derivable here yet: it is a haversine over `lat`/`lng` against the
  -- catchment centre, and the seed has no coordinates because mock.jsx never
  -- had any. Seeded from mock.jsx's precomputed `distanceKm` so the
  -- Establishments screen keeps sorting as it did, and superseded the moment a
  -- real Nearby Search fills lat/lng — at which point this column should be
  -- dropped and the value computed. Demo data, live architecture
  -- (CONVENTIONS.md §10).
  distance_km         REAL
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
  -- 'youtube' was missing, so the database REJECTED a YouTube handle outright
  -- while the product's pitch covered the channel. See CHANNEL_CAPABILITIES in
  -- channels.js for what each of these can actually answer.
  platform            TEXT NOT NULL CHECK (platform IN ('instagram', 'x', 'youtube', 'facebook')),
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
  -- Named after the API that produced the reading, as the existing values are.
  -- `youtube_data` is the YouTube Data API; `x_api` is X's v2 API, and it is
  -- the first source here whose reads are billed per call rather than per
  -- quota unit (CONVENTIONS.md §10 — cost is a correctness concern).
  source              TEXT NOT NULL
                        CHECK (source IN ('places', 'business_discovery', 'business_profile',
                                          'youtube_data', 'x_api', 'seed')),
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
-- connections
--
-- OUR OWN accounts — which channels this restaurant has connected, and the
-- state of each. Nothing described this before: the Settings > Accounts tab
-- hardcoded three plausible-looking rows with a follower count and a "Token
-- expired" pill, and there was no token, no expiry and no connection record
-- anywhere in the system.
--
-- VOCABULARY TRAP — this CHECK is NOT the one on establishment_social.
-- That column lists ('instagram','x','youtube','facebook') because it
-- describes COMPETITORS, and a competitor has no Google Business Profile or
-- WhatsApp line *with us*. This table describes the channels WE connect to,
-- which is a different set: Google Business Profile and WhatsApp are in, and
-- Facebook is out because the product does not model it. Reusing the other
-- constraint would let a row exist that neither table means, so they stay
-- separate on purpose.
CREATE TABLE IF NOT EXISTS connections (
  platform            TEXT PRIMARY KEY
                        CHECK (platform IN ('instagram', 'google_business', 'whatsapp', 'x', 'youtube')),

  -- FOUR STATES, and the distinction between the middle two is the entire
  -- point of this table:
  --   never_connected — nobody has ever authorised this channel. There is no
  --                     credential to be expired, and no account to name.
  --   connected       — authorised, credential valid.
  --   expired         — WAS connected and the credential has since lapsed. The
  --                     account reference is still known and the history is
  --                     still ours; only the token needs replacing.
  --   revoked         — access was withdrawn at the provider end, by the
  --                     account owner or the platform. Reconnecting may not be
  --                     ours to do, so it is not the same problem as `expired`.
  -- Collapsing never_connected and expired into one "not working" value is
  -- exactly the lie this commit removes: one is "set this up", the other is
  -- "sign in again", and they need different words in front of a user.
  status              TEXT NOT NULL
                        CHECK (status IN ('never_connected', 'connected', 'expired', 'revoked')),

  -- What the connection points AT, in whatever form the channel uses: a
  -- handle, a Business Profile location name, or a phone number. One column
  -- rather than three nullable ones, because only ever one applies, and the
  -- label beside it is decided by `platform`.
  account_ref         TEXT,
  account_label       TEXT,             -- what to call that reference on screen

  connected_at        TEXT,             -- NULL while never_connected
  last_synced_at      TEXT,             -- NULL until something has actually run
  expires_at          TEXT,             -- NULL when there is no credential
  last_error          TEXT,             -- why it broke, verbatim, or NULL

  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))
);

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

-- ---------------------------------------------------------------------------
-- posts  +  post_targets
--
-- TWO TABLES BECAUSE A POST HAS ONE PIECE OF CONTENT AND N INDEPENDENT
-- OUTCOMES. Instagram can succeed while X fails on cost and Google fails on an
-- expired token, and those are three different problems needing three
-- different sentences in front of a user. Putting the outcomes in a JSON
-- column on the post row would be the same collapse this codebase has already
-- undone twice — `draftReply` split from `replied` (6a7a75c) because "a reply
-- exists" and "a reply was sent" are different facts, and social handles moved
-- to `establishment_social` (3949f8b) for the same reason.
--
-- THE STATE SPLIT IS THE WHOLE DESIGN AND IT IS DELIBERATE:
--
--   posts.state         is what the USER ASKED FOR.
--   post_targets.status is what HAPPENED, per channel.
--
-- There is deliberately NO 'published' state on a post. A post that succeeded
-- on Instagram and failed on X is not "published", and it is not "failed"
-- either; any single word here would have to lie about one of the two. This is
-- the same mistake `connections.status` avoids by keeping never_connected /
-- expired / revoked apart instead of flattening them to "not working". A
-- screen that wants one line derives it — `summarisePost()` in src/posts.js,
-- which is tested and is the only place that derivation exists.
CREATE TABLE IF NOT EXISTS posts (
  id                  TEXT PRIMARY KEY,

  -- FOUR STATES, none of which is an outcome:
  --   draft     — written, not submitted anywhere.
  --   scheduled — submitted for a future time. `scheduled_at` is then NOT NULL.
  --   sending   — an attempt is in flight. A row should not rest here; if one
  --               does, a run died midway and that is worth seeing.
  --   attempted — the attempt has run and every target has settled. It says
  --               the attempt HAPPENED, not that it worked. Read the targets.
  state               TEXT NOT NULL DEFAULT 'draft'
                        CHECK (state IN ('draft', 'scheduled', 'sending', 'attempted')),

  content             TEXT NOT NULL,
  format              TEXT CHECK (format IN ('image', 'video', 'carousel', 'reel', 'text')),
  author              TEXT,

  -- The tag list is ONE fact — an ordered list of strings that belongs to the
  -- post as a whole — so JSON is honest here in a way it would not be for
  -- per-channel outcomes. Stored as a JSON array of strings.
  tags                TEXT NOT NULL DEFAULT '[]',

  -- Media is three scalars, so it is three columns rather than a JSON blob.
  media_kind          TEXT CHECK (media_kind IN ('image', 'video', 'pdf')),
  media_label         TEXT,
  media_tone          TEXT,

  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,

  -- BOTH, and neither is derivable from the other. `scheduled_at` carries an
  -- absolute instant with its offset; `scheduled_tz` records the zone the user
  -- actually chose, which an offset cannot reconstruct (+05:30 is Asia/Kolkata
  -- and Asia/Colombo, and a zone's offset changes across a DST boundary while
  -- the user's intent — "9am local" — does not).
  scheduled_at        TEXT,
  scheduled_tz        TEXT,

  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),

  CHECK (state <> 'scheduled' OR scheduled_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS post_targets (
  post_id             TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- The SAME vocabulary as `connections.platform`, on purpose: the publish
  -- attempt joins these two, and two spellings of "Instagram" across a join is
  -- how a channel silently never matches. The client's short ids (ig/gg/wa)
  -- are translated at the edge — see CHANNEL_BY_CLIENT_ID in src/posts.js.
  platform            TEXT NOT NULL
                        CHECK (platform IN ('instagram', 'google_business', 'whatsapp', 'x', 'youtube')),

  --   pending   — selected, not yet attempted.
  --   published — the channel accepted it.
  --   failed    — attempted and refused. `reason` says why, in words.
  --   skipped   — deliberately not attempted this run.
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'published', 'failed', 'skipped')),

  -- WHY, machine-readable, kept apart from the human sentence. The first three
  -- mirror `connections.status` exactly, because a publish that fails on a
  -- channel that was never connected is a different problem from one whose
  -- token lapsed, and the connections table already draws that line — losing
  -- it here would reintroduce the collapse one table over.
  failure_kind        TEXT CHECK (failure_kind IN
                        ('never_connected', 'expired', 'revoked', 'not_implemented', 'api_error')),
  reason              TEXT,

  external_id         TEXT,             -- the platform's id for the post, once it has one
  attempted_at        TEXT,
  published_at        TEXT,

  -- METRICS LIVE HERE, NOT ON THE POST, and the seed is why. Every seeded post
  -- carries `metricsFrom: 'ig'` while three of them went to two channels — so
  -- those figures describe INSTAGRAM ONLY and were never the post's totals.
  -- Hanging them on the post row would have silently turned one channel's
  -- numbers into every channel's. A target with no metrics holds NULL, which
  -- is "not measured", not zero.
  views               INTEGER,
  reach               INTEGER,
  likes               INTEGER,
  comments            INTEGER,
  shares              INTEGER,
  saves               INTEGER,
  engagement_rate     REAL,

  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),

  PRIMARY KEY (post_id, platform)
);

CREATE INDEX IF NOT EXISTS posts_state_time
  ON posts (state, COALESCE(scheduled_at, created_at));
CREATE INDEX IF NOT EXISTS post_targets_platform
  ON post_targets (platform, status);

-- ---------------------------------------------------------------------------
-- menu_items  +  menu_item_aliases
--
-- The Menu screen currently claims `mentions7d: 412` for the Galouti Kebab.
-- The ENTIRE seeded guest corpus — every review, comment, DM and signal — is
-- under 9 KB. That number cannot come from that text, and no arithmetic over
-- it produces 412. These two tables exist so the figure can be replaced by one
-- a restaurant owner can check by reading the sentences it came from.
--
-- ALIASES ARE A TABLE, NOT A JSON COLUMN, for two reasons that are not style:
--   1. UNIQUE(alias) below is what makes an ambiguous alias IMPOSSIBLE rather
--      than merely discouraged. "Galouti Kebab" and "Kathal Galouti" share the
--      token `galouti`, and a bare `galouti` alias on both would silently
--      attribute half the mentions to the wrong dish. The database refuses it.
--   2. An alias earns its place from real guest text, so it will want
--      provenance later — when it was added and what sentence justified it.
--      A row can grow those columns; a JSON array cannot without a migration.
CREATE TABLE IF NOT EXISTS menu_items (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  category            TEXT,
  price               INTEGER,
  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))
);

CREATE TABLE IF NOT EXISTS menu_item_aliases (
  -- Stored ALREADY NORMALIZED (lowercased, punctuation stripped, spelling
  -- variants folded) by normalizeAlias() in src/text-normalize.js. Storing the
  -- raw form and normalizing on read would mean the UNIQUE constraint guarded
  -- the wrong strings: 'Galouti' and 'galouti' would both be accepted and the
  -- collision this table exists to prevent would come back.
  alias               TEXT PRIMARY KEY,
  menu_item_id        TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  -- How many words it is. The matcher prefers the longest match at a position,
  -- and keeping the count here means it is not recomputed per candidate.
  word_count          INTEGER NOT NULL,
  is_sample           INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))
);

CREATE INDEX IF NOT EXISTS menu_item_aliases_item ON menu_item_aliases (menu_item_id);
