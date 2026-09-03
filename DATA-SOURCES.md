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
| Sentiment score | Your own NLP/LLM | Derived |
| Themes (`wait time`, `packaging`) | Your own NLP/LLM | Derived |
| SLA clock, response rate | Your own system | Own |

**There is no review webhook on Google.** You poll. Sub-hour freshness is
achievable; true real-time is not. That matters, because the SLA countdown in
the Reviews screen is the product's main promise — a 4-hour SLA against a
15-minute poll is fine, a 15-minute SLA is not.

With Google as the only review channel, the rating shown IS Google's — there is
no blending, and nothing to explain away.

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

This is genuinely achievable with an LLM classification pass over text you
already hold, and it is the part of the product a competitor cannot trivially
copy — because it depends on your menu and your sales data, not on public APIs.

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

The thinnest data in the product. The Competitors screen has been cut back to
public counts only — the fields that used to sit there and could not be
obtained (their reach, mention volume and sentiment) are gone.

| Field | Source | Availability |
|---|---|---|
| Follower count, post count | Instagram Business Discovery | API (public accounts) |
| Their likes + comments per post | Instagram Business Discovery | API |
| Their star rating + review count | Google Places API | API |
| Engagement **rate** | Computed as interactions ÷ followers | Derived, approximate |
| Their **reach / impressions** | Private to them | ✗ — removed from the screen |
| Their mention volume | Not visible | ✗ — removed from the screen |
| Their sentiment | Not visible at any useful volume | ✗ — removed from the screen |
| Their ad spend | Meta Ad Library shows creatives, not spend | Partial |

`engagementRate` is computed the same way for us and for them — interactions
÷ followers — so the comparison is at least like-for-like, and our own row
carries no columns the peer rows lack. Our richer metrics live on Analytics,
where they are not being compared to anyone.

The Google Places terms restrict caching and storing most place content —
review text especially. Check them before you build a competitor review
archive.

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
- **Competitors** — public counts only. Thin, and honest about being thin.
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
