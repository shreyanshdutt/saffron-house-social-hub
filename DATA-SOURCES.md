# What is real, what is derived, what you cannot get

Every number in this prototype is fabricated. This document maps each dataset
to what would actually feed it in production, and is deliberately honest about
the gaps — because the gaps change what the product can promise.

**Verify current API capabilities before building.** Platform APIs churn
constantly (Meta deprecates metrics most years; Google has repeatedly reshaped
the Business Profile APIs). Treat the specifics below as a starting map, not a
contract.

## The headline problem

Of the six channels in this hub, **three have no official public API**:

| Channel | First-party API | Reality |
|---|---|---|
| Instagram | ✅ Instagram Graph API (Meta) | Good coverage, real limits |
| Google Business Profile | ✅ Business Profile APIs | Good coverage, needs allowlisting |
| WhatsApp | ✅ WhatsApp Business Platform (Cloud API) | Good coverage, per-message cost |
| Zomato | ❌ | Public developer API was retired. Partner dashboard only |
| Swiggy | ❌ (partner/POS integrations only) | Menu + orders via POS middleware; ratings are dashboard-side |
| District | ❌ | Zomato's going-out app. Partner onboarding, no API |

For Zomato and Swiggy, the realistic path is **POS/aggregator middleware** —
UrbanPiper, Petpooja, Posist, Rista and similar hold the partner integrations
and normalise menu, orders and (to varying degrees) ratings across both. That
is a commercial dependency and a per-outlet cost, and it should be a line item
in any build estimate rather than an afterthought.

Scraping the public listings is technically possible and violates the terms of
service of both. Do not design a product around it.

## Field-by-field

Availability legend: **API** = first-party, pollable. **Partner** = via
middleware or a merchant dashboard. **Derived** = you compute it from text you
already hold. **Own** = your own systems. **✗** = not obtainable.

### Posts and publishing (`POSTS`, `SCHEDULED`)

| Field | Source | Availability |
|---|---|---|
| Post content, media, timestamp | Instagram Graph API `/media` | API |
| Likes, comments count | Instagram Graph API | API |
| Reach, saves, shares, video views | Instagram Graph API `/insights` | API |
| Publishing + scheduling | Instagram Content Publishing API | API (daily post cap) |
| Google posts | GBP `localPosts` | API |
| Zomato / Swiggy promo content | Partner dashboard | Partner |

Meta has repeatedly renamed and retired media metrics (`impressions` gave way
to `views` in recent versions). Pin an API version and budget for migration.

### Reviews (`REVIEWS`, `REVIEW_STATS`)

| Field | Source | Availability |
|---|---|---|
| Google review text, rating, author, time | GBP Reviews API | API |
| Replying to a Google review | GBP Reviews API | API |
| Google Q&A | GBP `questions.answers` | API |
| Zomato / Swiggy review text + rating | Partner dashboard or middleware | Partner |
| Dine-in vs delivery context | Inferred from channel + your POS | Derived / Own |
| Sentiment score | Your own NLP/LLM | Derived |
| Themes (`wait time`, `packaging`) | Your own NLP/LLM | Derived |
| SLA clock, response rate | Your own system | Own |

**There is no review webhook on Google.** You poll. Sub-hour freshness is
achievable; true real-time is not. That matters, because the SLA countdown in
the Reviews screen is the product's main promise — a 4-hour SLA against a
15-minute poll is fine, a 15-minute SLA is not.

The blended rating across three platforms is **your** computation, not a number
any platform gives you.

### Inbox (`CONVERSATIONS`)

| Field | Source | Availability |
|---|---|---|
| Instagram DMs, comment replies | Instagram Messaging API (webhooks) | API |
| WhatsApp messages, delivery/read receipts | WhatsApp Cloud API (webhooks) | API |
| Guest phone number | WhatsApp gives you it; others do not | API / ✗ |
| Delivery order ID + order contents | POS middleware | Partner |
| Zomato / Swiggy customer chat | Not exposed | ✗ |

WhatsApp is genuinely real-time (webhooks, not polling), and it is the only
channel here where you hold the guest's actual phone number. Marketing template
messages require prior opt-in and cost money per message.

### Menu sentiment (`MENU_ITEMS`) — **the most valuable screen, entirely derived**

No platform gives you per-dish sentiment. This whole screen is something you
build:

1. Pull every piece of guest text you can legitimately reach — Google reviews,
   Instagram comments, partner-dashboard reviews, WhatsApp messages.
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

This is the weakest data in the product, and the prototype currently overstates
what is knowable.

| Field | Source | Availability |
|---|---|---|
| Follower count, post count | Instagram Business Discovery | API (public accounts) |
| Their likes + comments per post | Instagram Business Discovery | API |
| Their star rating + review count | Google Places API | API |
| Engagement **rate** | Computed as (likes+comments)/followers | Derived, approximate |
| Their **reach / impressions** | Private to them | ✗ |
| Their mention volume | Only what your listening corpus sees | Derived, partial |
| Their sentiment | Derived from text you can see | Derived, partial |
| Their ad spend | Meta Ad Library shows creatives, not spend | Partial |

Their reach is not obtainable, and the prototype's competitor `engagementRate`
silently mixes a real metric (yours) with an approximation (theirs). In
production those need visibly different treatment, or an owner will make a
decision on a comparison that is not apples-to-apples.

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

- **Cross-platform identity.** The Arjun Mehta who complained on Zomato and the
  one who reviewed on Google cannot be linked without a shared phone number.
  Only WhatsApp and your booking system give you that.
- **Competitor reach, impressions, ad spend, or private metrics.**
- **Historical Instagram hashtag data** before you started collecting.
- **Why someone did not come back.**

## What this means for the product

The honest split, by screen:

- **Reviews** — mostly real, and the strongest case for building. Google is
  fully API-driven; Zomato and Swiggy need middleware.
- **Inbox** — real for Instagram and WhatsApp; marketplace chat is not reachable.
- **Menu Items** — entirely derived, and the most defensible thing here.
- **Analytics** — real per channel, but not joinable to covers without your POS.
- **Competitors** — thin and partly approximated. Weakest claim in the deck.
- **Listening trends** — only as good as the day you started collecting.
