# What is real, what is derived, what you cannot get

Every number in this prototype is fabricated. This document maps each dataset
to what would actually feed it in production, and is deliberately honest about
the gaps — because the gaps change what the product can promise.

**Verify current API capabilities before building.** Platform APIs churn
constantly (Meta deprecates metrics most years; Google has repeatedly reshaped
the Business Profile APIs). Treat the specifics below as a starting map, not a
contract.

## Scope

Three channels, three first-party APIs. Zomato, Swiggy and District were
**removed from the product** because none of them has a public API — see the
bottom of this document for what that would have cost.

| Channel | API | Access |
|---|---|---|
| Instagram | Instagram Graph API | Meta app + Business account linked to a Facebook Page |
| Google Business Profile | Business Profile APIs | Allowlisting request — start this first, it queues |
| WhatsApp | WhatsApp Business Platform (Cloud API) | Verified Meta Business + a dedicated phone number |

The in-app **Data & access** screen (Owner role) carries the same map plus the
exact OAuth scopes to request, in the order to request them.

### Posts and publishing (`POSTS`, `SCHEDULED`)

| Field | Source | Availability |
|---|---|---|
| Post content, media, timestamp | Instagram Graph API `/media` | API |
| Likes, comments count | Instagram Graph API | API |
| Reach, saves, shares, video views | Instagram Graph API `/insights` | API |
| Publishing + scheduling | Instagram Content Publishing API | API (daily post cap) |
| Google posts | GBP `localPosts` | API |

Meta has repeatedly renamed and retired media metrics (`impressions` gave way
to `views` in recent versions). Pin an API version and budget for migration.

### Reviews (`REVIEWS`, `REVIEW_STATS`)

| Field | Source | Availability |
|---|---|---|
| Google review text, rating, author, time | GBP Reviews API | API |
| Replying to a Google review | GBP Reviews API | API |
| Google Q&A | GBP `questions.answers` | API |
| Sentiment score | Your own derivation — method not yet chosen | Derived |
| Themes (`wait time`, `packaging`) | Your own derivation — method not yet chosen | Derived |
| SLA clock, response rate | Your own system | Own |

**There is no review webhook on Google.** You poll. Sub-hour freshness is
achievable; true real-time is not. That matters, because the SLA countdown in
the Reviews screen is the product's main promise — a 4-hour SLA against a
15-minute poll is fine, a 15-minute SLA is not.

With Google as the only review channel, the rating shown IS Google's — there is
no blending, and nothing to explain away.

**Our own review velocity comes from the same store as every rival's.** GBP
returns a current review count, not a rate, so our figure is the delta between
stored readings under the reserved key `saf-self` — the identical code path,
so the two sides of the comparison cannot be computed differently. If our own
history is too thin to give a rate, the review-velocity recommendation does
not fire at all rather than comparing a known rival against an assumed us.

### Inbox (`CONVERSATIONS`)

| Field | Source | Availability |
|---|---|---|
| Instagram DMs, comment replies | Instagram Messaging API (webhooks) | API |
| WhatsApp messages, delivery/read receipts | WhatsApp Cloud API (webhooks) | API |
| Guest phone number | WhatsApp gives you it; others do not | API / ✗ |

WhatsApp is genuinely real-time (webhooks, not polling), and it is the only
channel here where you hold the guest's actual phone number. Marketing template
messages require prior opt-in and cost money per message.

### Menu sentiment (`MENU_ITEMS`) — **the most valuable screen, entirely derived**

No platform gives you per-dish sentiment. This whole screen is something you
build:

1. Pull every piece of guest text you can legitimately reach — Google reviews
   and Q&A, Instagram comments and captions you are tagged in, WhatsApp
   messages.
2. Run entity extraction against **your own menu** (you have the canonical dish
   list; that is your advantage over any generic listening vendor).
3. Classify sentiment per dish mention.
4. Aggregate with your POS sales data.

Price, category and the item list come from your own menu system. Mention
counts and sentiment are derived. Nothing here is fetched.

This is genuinely achievable over text you already hold, and it is the part of
the product a competitor cannot trivially copy — because it depends on your
menu and your sales data, not on public APIs.

**The method is deterministic, and it is NOT YET CHOSEN.** The owner ruled on
2026-09-09 that these derivations run as algorithms over data we hold — string
matching against the canonical dish list, a sentiment lexicon — rather than as
model calls. What exactly that looks like is undecided, and this document does
not name an approach it does not have: an invented algorithm name here would
read as a decision to whoever builds it. What IS decided is the shape of the
answer — every derived figure still has to be traceable to the text it came
from, the same standard the rest of this document holds fetched data to.

### Listening (`LISTENING_SIGNALS`, `LISTENING_TRENDS`, `LISTENING_KPIS`)

| Field | Source | Availability |
|---|---|---|
| Mentions of your handle/tags | Instagram `/tags`, mention webhooks | API (partial) |
| Hashtag conversation | Instagram `/ig_hashtag_search` | API, **heavily limited** |
| Google search/discovery volume | GBP Performance API | API |
| Direction requests, calls, bookings | GBP Performance API | API |
| Sentiment, signal classification | Derived | Derived |
| Share of voice | Only within a corpus you define | Derived |
| Broad web/press mentions | Listening vendor (Brandwatch, Talkwalker, Meltwater, Sprinklr) | Paid third party |

Instagram's hashtag search is capped at a small number of unique hashtags per
rolling window and returns only recent media — **there is no historical
hashtag data**. Any "mentions over the last 90 days" chart requires that you
have been collecting continuously since day one. Start collecting before you
start promising trends.

"Share of voice" is not an absolute number anyone can hand you. It is your
mentions divided by mentions across a competitor set *you* chose, over a corpus
*you* can see. State the denominator in the UI or the number is meaningless.

### Competitors (`LISTENING_COMPETITORS`)

Still the thinnest data in the product, but no longer a single verdict. What we
can know about a rival depends on WHICH CHANNEL you ask, and the answers differ
enough that stating one of them as a universal fact is wrong. On Instagram the
screen is cut back to public counts, because comment text cannot be obtained
there at any price. On YouTube the same question has a different answer: public
comment text is readable with an API key. On X it is readable and billed per
read. That is the whole reason the server models capability per channel
(`server/src/channels.js`) rather than per establishment.

Do not read this as the competitor data getting rich. Reach, impressions, ad
spend and audience remain private on every channel, and most rivals in a
neighbourhood market have no YouTube or X presence at all — so for the typical
row the practical answer is still Instagram counts plus a Google rating. What
changed is that the ceiling is now per channel instead of set by the weakest
one.

**Two different things decide each answer, and the model keeps them apart.**

- **The platform** — what an API can EVER return. Static, and no account,
  budget or permission changes it. Instagram will not return comment text.
- **The account** — whether THIS rival has a readable presence on that channel.
  Per establishment, from `establishment_social`.

A capability is the product of the two, and when it comes out false the reason
has to say which side produced the no. "We cannot read their comments" and
"they have no account there" are different problems with different fixes, and
only the second is something a user can act on. The server carries this as
`blockedBy: 'platform' | 'account'`; the screen must not flatten it.

#### What each channel can ever return

The specification is `CHANNEL_CAPABILITIES` in `server/src/channels.js`. This
table describes it; if they disagree, the code is right and this is the defect.

| Channel | Their posts | Comment / reply TEXT | Rating + review count | Review text | Cost of a read |
|---|---|---|---|---|---|
| **Instagram** | ✔ Business Discovery `media` edge, public Business/Creator only | ✗ **counts only, at any tier** — a hard API limit, not a price | ✗ n/a | ✗ n/a | Quota, not billed |
| **YouTube** | ✔ public videos, Data API v3 | ✔ **`commentThreads.list`, API key alone, 1 quota unit** | ✗ n/a | ✗ n/a | Quota, not billed |
| **X** | ✔ public posts | ✔ replies | ✗ n/a | ✗ n/a | **Billed per read** |
| **Google** | ✗ no competitor feed | ✗ | ✔ Places Details | ✗ **the number yes, the words no** | Billed per call |

Instagram's ✗ and a rival's missing YouTube channel are not the same ✗. The
first is the platform; the second is the account.

#### Per-field detail

| Field | Source | Availability |
|---|---|---|
| Follower / subscriber count, post count | Instagram Business Discovery; YouTube Data API; X | API (public accounts) |
| Their follower **change** | Counts stored over time, differenced | Derived, needs history |
| Their engagement-rate **change** | Stored interactions ÷ followers, differenced | Derived, needs history |
| Their likes + comment COUNTS per post | Instagram Business Discovery; equivalents on YouTube and X | API |
| Their captions, format, timestamps, permalinks | Instagram `media` edge; YouTube video metadata; X posts | API |
| Their post themes + offer detection | Your classification of their captions | Derived |
| Their per-post performance vs own median | Computed from public counts | Derived |
| **Comment text — Instagram** | Not returned; Business Discovery gives counts only | ✗ **impossible at any tier** |
| **Comment text — YouTube** | `commentThreads.list` on public videos | ✔ API key, 1 quota unit |
| **Reply text — X** | Public replies | ✔ **billed per read — see the cost note below** |
| Competitor sentiment | Classification of whatever comment text we hold | ✔ YouTube / X · ✗ Instagram |
| Their star rating + review count | Google Places API | API |
| Their review **velocity** (new reviews/month) | Places review counts stored over time, differenced | Derived, needs history |
| Engagement **rate** | Computed as interactions ÷ followers | Derived, approximate |
| Their **reach / impressions** | Private to them | ✗ — on every channel |
| Their mention volume | Not visible | ✗ — removed from the screen |
| Their ad spend | Meta Ad Library shows creatives, not spend | Partial |

#### The cost fact that split posts from comment text

Posts and comment text are modelled as separate capabilities, and this is why.
Everything else in the product runs **$0–11 per outlet per month**. X does not.

| What you read, for 10 competitors | Roughly |
|---|---|
| Their posts, weekly | **~$4 / month** |
| Their posts **and replies**, weekly | **~$48 / month** |
| Their posts and replies, daily | **~$330 / month** |

Reading a rival's replies costs about ten times reading their posts, because
there are about ten times as many of them at the same per-read price. That is a
different order of spending from the rest of the product, and it is why the
expensive capability can be switched off without disabling the channel: a
caller can take X posts and refuse X replies. Any job that fans out over
tracked establishments states its call count before it runs, and must be able
to say which of those reads are billed (CONVENTIONS.md §10).

`engagementRate` is computed the same way for us and for them — interactions
÷ followers — so the comparison is at least like-for-like, and our own row
carries no columns the peer rows lack. Our richer metrics live on Analytics,
where they are not being compared to anyone.

**Business Discovery returns a snapshot, not a delta.** It gives a follower
count and the posts behind an interaction average as they are *right now*;
there is no "change over the last 7 days" field in the API and no way to ask
for one. So follower change and engagement-rate change are derived exactly like
review velocity — the difference between two readings we stored — and they
carry the same three states and the same 7-day floor. Until this was true, the
app showed `followersChange7dPct` and `engagementChange7dPct` as measured
figures; they were seeded literals, and three of them sat on competitors that
had never been pulled at all.

Engagement change is the percent change in interactions ÷ followers between the
two readings. It needs both fields on a sample, so a reading that captured only
one is not an observation of it.

**Review velocity is the one Places figure that no single call can return.**
Places Details gives a review count as a snapshot; the rate of change is the
delta between two snapshots divided by the days between them. So the app keeps
its own store of readings — the `observations` table in the server database —
appends one per establishment on every sync, and derives the rate from that
store. There is no seeded velocity anywhere, and since the move off
`localStorage` there is no client-side derivation either: the server computes
every rate and the client renders the result with its state attached. This makes three genuinely different states, and the
UI distinguishes all three rather than collapsing them to a blank:

| Stored readings | Window | Shown as |
|---|---|---|
| under 2 | — | "No history yet" — a baseline is not a rate |
| 2 or more | under 7 days | the measured delta and its window, no monthly figure |
| 2 or more | 7 days or more | the delta scaled to 30 days |

The 7-day floor exists because two readings four minutes apart give a real
delta and a meaningless rate: scaling it to a month would manufacture a figure
of thousands from one extra review. A rival still inside that window is
excluded from the catchment median and from the review-velocity
recommendation, and the population line on the card says how many were left
out and why.

Velocity does NOT require a readable Instagram account, so a *ratings-only*
establishment carries it on the same terms as a full-tier one — the tier is
about Business Discovery, and this figure comes from Places. The reverse also
holds and is why the two are stored together but derived separately: a
ratings-only establishment never gets a Business Discovery call, so no sample
of it ever carries a follower count and its follower and engagement change stay
in the `none` state permanently. That is a fact about the API, not a gap in the
data, and the screen says so rather than showing 0%.

The Google Places terms restrict caching and storing most place content —
review text especially. Storing a bare review COUNT plus a timestamp, which is
all the velocity store holds, is a much smaller ask than a review archive — but
check the terms before you build either.

### Establishment discovery (`ESTABLISHMENTS`)

| Field | Source | Availability |
|---|---|---|
| Name, place_id, address, category | Google Places Nearby Search | API |
| Their rating + review count | Google Places | API |
| Business status (operational / closed) | Google Places | API |
| Their Instagram handle | **No API maps a place to a social account** | Manual, once per establishment |
| Whether their Instagram is readable | Business Discovery succeeds or returns nothing | API (by attempting it) |
| Their Instagram **handle** | Website parse, or entered by hand | Derived / manual — **not** evidence of readability |

**Knowing a handle is not the same as being able to read it.** A handle can be
parsed off a website or typed in by hand; neither tells you whether the account
is a Business, Creator, personal or private one, and the only way to find out is
to attempt the call. So a hand-entered handle is stored as `unknown` with
`readable` NULL and does not raise the availability tier — an establishment does
not become a full comparison because somebody typed something. It becomes a
lookup waiting to happen.

Business Discovery reads **public Business and Creator accounts only**. A
personal or private account returns nothing at all — not partial data, nothing
— and you cannot tell which it is from the outside without trying. Expect to
lose a meaningful share of a neighbourhood market this way.

**X is included for competitors, replies included — but it is not counted
toward the availability tier.** Those are two separate statements and both
still hold.

The tier (full / ratings / none) means what it has always meant: a Google
listing plus a readable Instagram account. X does not raise or lower it. What
changed is that X is now modelled as a channel a competitor can be read on, and
that includes reply text — the owner's decision, and the reason the capability
model carries X at all.

**The pricing description here used to be out of date.** X replaced its tiered
plans with pay-per-use as the default on **6 February 2026**: credits are
bought up front in the developer console and drawn down per call, and there is
no free tier for new developers. It is no longer "the entry tier costs $X a
month" — it is a meter. That makes reading X the only competitor data in this
product with a direct per-read price, and the numbers are in the cost table in
the Competitors section above. Budget before enabling it.

**A handle is still not readability.** Knowing a rival's X handle tells you
nothing about whether their posts can be read, the same way an Instagram handle
does not tell you whether the account is a Business or a personal one. The
handle is recorded; whether anything can be pulled with it is a separate fact
the model tracks separately. And in this catchment most rivals still post
nothing on X, so a readable handle often leads to an empty feed — which is a
finding, not a failure.

### Analytics (`ANALYTICS_*`)

| Field | Source | Availability |
|---|---|---|
| Reach/engagement per channel per day | Instagram insights + GBP Performance | API |
| Audience age / gender | Instagram audience insights | API, **thresholded** |
| Audience location | Instagram (city-level) + GBP | API |
| Content-type breakdown | Your own tagging | Own |
| Covers, revenue, table turns | POS / booking system | Own |

Instagram suppresses demographic breakdowns below a follower threshold, and it
covers your *followers*, not the people who ate at your restaurant. Do not
present it as guest demographics — it is audience demographics, and for a
restaurant those differ a lot.

### Not obtainable at all

- **Cross-platform identity.** The guest who reviewed on Google and the one
  who messaged on WhatsApp cannot be linked without a shared phone number.
  Only WhatsApp and your booking system give you that.
- **Competitor reach, impressions, ad spend, or private metrics.**
- **Historical Instagram hashtag data** before you started collecting.
- **Why someone did not come back.**

## What this means for the product

The honest split, by screen:

- **Reviews** — fully API-backed. Google returns the text, ratings and reply
  endpoint; sentiment and themes are your classification over that text.
- **Inbox** — real for Instagram and WhatsApp. WhatsApp is the only channel
  that gives you a phone number, and the only one that is truly real-time.
- **Menu Items** — entirely derived, and the most defensible thing here,
  because it depends on your menu and your sales data rather than on any
  public API a competitor could also call.
- **Analytics** — real per channel, structured per channel. Not joinable to
  covers without your POS.
- **Competitors** — thin, and honest about being thin, but the ceiling is per
  channel rather than one verdict. Instagram is public counts only and comment
  text is impossible there at any price; YouTube returns public comment text
  for a quota unit; X returns replies and bills per read. Most rivals in a
  neighbourhood market are on Instagram and Google alone, so in practice the
  typical row is still counts plus a rating — but that is a fact about who is
  present, not about what the APIs allow.
- **Listening trends** — only as good as the day you started collecting.
- **Actions** — computed from all of the above; every recommendation carries
  the source of each figure it used.

## Cost of adding the delivery marketplaces back

If the business later wants Zomato and Swiggy in the product, the path is:

1. **A POS/aggregator middleware contract** — UrbanPiper, Petpooja, Posist,
   Rista or similar. These hold the partner integrations and normalise menu,
   orders and (to varying degrees) ratings. Per-outlet monthly cost.
2. **Partner onboarding with each marketplace**, done by the business owner.
3. Roughly a week of integration work once the credentials exist.

What you would gain: delivery order data, marketplace ratings, and the
dine-in/delivery split that had to be removed from the Reviews screen.

What you would not gain: marketplace customer chat, or competitor data on
either platform. Neither is exposed at any tier.

Scraping the public listings is technically possible and violates the terms of
service of both. Do not design a product around it.
