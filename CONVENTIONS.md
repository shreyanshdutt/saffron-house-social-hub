# Saffron House Social Hub — Operating Conventions (source of truth)

Both AI systems working this repo — the Claude app (planning, prompt-crafting)
and Claude Code in VS Code (execution) — read and OBEY this file. A rule that
lives in one chat's memory does not exist; it lives here.

Owner: Billy. Changes to this file are owner-approved only.

`CLAUDE.md` describes what the code IS. This file describes how work on it is
DONE. Read both. Where they overlap, this file is the stricter statement.

---

## 1. Honest data is the #1 value — in the product AND in the report

The product thesis is that every field on screen is deliverable by a real API
(`CLAUDE.md` §1, `DATA-SOURCES.md`). That rule extends to the work itself:

- **Never fabricate a value in the product.** No number, handle, rating,
  follower count, permalink, timestamp or status invented to fill a gap. An
  unavailable value shows the honest state — "not synced yet", "unavailable on
  a first sync", an em dash, an inert link with the reason — and stays in
  whatever list would prompt someone to go get it.
- **Never fabricate a value in the report.** Any figure, file path, line
  number, symbol name, commit SHA or observed behaviour you state must have
  been read or run. If you did not run it and look at it, the report says so.
- **The honest failure path is a PLANNING requirement, not a fallback.** Every
  plan states how the feature fails honestly before it states how it succeeds.
  This is checked in review, and it is checked hardest wherever a value could
  plausibly be substituted rather than left blank.
- **"I don't know" and "not verified" are correct answers** and carry no
  penalty here. A confident wrong claim carries a large one, because in a repo
  with no tests nothing downstream will catch it.

Fabricated *seed* data is legitimate — the whole prototype is seeded — but it
must announce itself. `COMPETITOR_CATCHMENT.isSampleData` is the mechanism, and
`CLAUDE.md` §11 trap 2 is why it exists.

## 2. Verify before believing

- **Cite `file:line` for every premise.** A symbol you remember from a summary,
  a README, an earlier turn, or a previous version of the file is not evidence
  that it exists in the code now. Open the file.
- **Verify the prompt's premises against the actual repo before acting.** A
  stale SHA, a renamed symbol, a file that does not exist, a screen described
  differently from how it is built → **STOP and report it.** Never reconcile a
  wrong premise by inventing the missing piece, and never build the thing the
  prompt described instead of the thing the repo contains.
- **Two readings from the same source are one reading, not corroboration.**
- **An empty result is not a proven absence.** A blank metric panel in this
  codebase is as likely to be `NaN` rendered as an em dash as it is to be no
  data (`CLAUDE.md` §11 trap 1); a missing screen is as likely to be an absent
  `<script>` tag as a broken component (§11 trap 7); a missing icon is as
  likely to be a bad Lucide name as a layout bug (§11 trap 3). Name which one
  it is before reporting a cause.

## 3. Docs and code are one artifact — drift is a defect

`README.md`, `DATA-SOURCES.md`, `CLAUDE.md` and this file are part of the
product, not commentary on it. This is the highest-frequency defect class in
this repo, and it is what makes an assistant confidently invent: when the docs
and the code contradict each other, gaps get filled from whichever half was
read most recently.

Rules:

- **Any change to behaviour, data or channels updates the docs in the SAME
  commit.** A commit that changes `PLATFORMS`, `PERMS`, `PAGE_PERMS`, a
  `localStorage` key, or what a screen can show, and leaves the docs stating
  the old thing, is not finished.
- **When docs and code disagree, do not silently pick one.** Say which two
  statements conflict, cite both locations, say which you believe is correct
  and why, and ask. The doc is the defect roughly as often as the code is.
- **Never edit a doc to agree with code you just wrote** without establishing
  which of the two is correct.

- **When you close drift from a REMOVED feature, grep for its vocabulary, not
  its name.** Removing Zomato/Swiggy/District left behind the word "blended"
  on the Reviews screen, a "dine-in/delivery context" claim, a dead
  `maskedOrder`, and an unreachable `partner` source tier — none of which
  contain a channel name. `a38c4eb` grepped for the names and missed all of
  them; they were found by a person looking at the screen. Grep the removed
  CAPABILITY: what the feature let you claim, not what it was called.

### Drift register

The register exists so that a closed defect is not re-discovered as new, and
not reverted by someone who reads only the stale half. **A closed item stays
listed, marked closed, with the commit that closed it.** Deleting the entry
loses the second of those protections.

This register itself went stale on 2026-09-05 — it still read "unfixed" after
every item in it had been closed, and was by then the only source in the repo
for the strings `KhanMarket` and `blended`. An audit reading it would have
chased six defects that no longer existed. **Updating the register is part of
closing an item, not follow-up work.**

#### Closed

1. `README.md` composer previews described a marketplace post and a District
   event post. Channels removed in `9f6e8ab`. — closed `a38c4eb`
2. `README.md` said "three of the **six** channels". There are three. —
   closed `a38c4eb`
3. `README.md` seeded-narrative cited a "blended rating" and "Swiggy
   sentiment falls hardest". Google is the only review channel. —
   closed `a38c4eb`
4. `mock.jsx` `TRENDING_TAGS` carried `#KhanMarket`; the restaurant relocated
   to Sector 10 Market, Dwarka in `c747dd6`. — closed `a38c4eb`.
   Six further `#KhanMarket` sites in `POSTS`, `SCHEDULED` and the composer's
   seeded chips were missed by that pass — closed `df34712`
5. `index.html` described the `pulseRingSubtle` keyframe as being for "a
   regulated-bank product", carried over from the ARC prototype. The calmer
   animation itself was always deliberate and stays. — closed `a38c4eb`
6. `README.md` claimed the Tailwind CDN "cannot generate `dark:` variants for
   arbitrary token names". Owner verified in a browser 2026-09-04 that it
   can. `CLAUDE.md` § 8 now records when a `dark:` utility is right and when
   the `html.dark` override block owns the change instead. — closed `a38c4eb`
7. `page-reviews.jsx` rendered a **"Blended rating"** KPI label, and its
   header comment said the same, directly beneath a subtitle reading "Every
   Google review" — while `DATA-SOURCES.md` states there is no blending. The
   most visible instance of this defect class, and the one that survived
   `a38c4eb` because that pass grepped only for channel names. —
   closed `df34712`
8. `page-compose.jsx` described the previews as "not five variations on one
   card"; there are two. — closed `df34712`
9. `page-listening-overview.jsx` carried a "Share of voice is a fraction"
   comment above the line computing a percent change for direction requests.
   Share of voice was removed and direction requests replaced it. —
   closed `df34712`
10. `CLAUDE.md` § 10 described the third act as a "delivery-temperature
    crisis cluster". `sig-003` is booked tables not honoured. Written into
    the standards from the stale README without checking the seed data. —
    closed `df34712`
11. `sig-003`'s body said "Four negative reports" while its `children` array
    held three, and both crisis panels render `children.length` — so the
    screen printed "3 related incidents" above "Four negative reports".
    Fourth child added from `rv-4`. — closed `df34712`

12. **`maskedOrder` was dead** — an alias of `maskedAccount` used in zero
    screens, left over from the marketplace removal. Removed from `mock.jsx`
    and from the `window.*` export set in `CLAUDE.md` § 5. `maskedAccount`
    itself stays: it masks the booking reference in the Inbox
    (`page-messages.jsx:201`). — closed in this commit
13. **The `partner` recommendation source tier was unreachable** — no entry in
    `REC_SOURCES` carried `tier: 'partner'`, so `REC_TIER_LABEL.partner` was
    never looked up. Removed from `REC_TIER_LABEL` (`recommend.jsx`) and the
    `SourceBadge` tone map (`page-recommendations.jsx`). The Actions screen's
    on-screen **Sources legend** was wrong in both directions — it named the
    dead `partner` tier and omitted `partial`, which `publicApi` carries and
    eight rules cite — and now lists the four tiers that exist: `api`,
    `derived`, `own`, `partial`. Two stale comments citing a "partner
    dashboard" and the removed "Zomato partner dashboard" went with it.
    The history it recorded in an inline comment now lives only in
    `DATA-SOURCES.md` § *Cost of adding the delivery marketplaces back*,
    which is where it belongs. — closed in this commit
14. **`page-reviews.jsx` subtitle indentation** — text sat flush at column 0
    inside its `<p>`. Cosmetic; re-indented. — closed in this commit

15. **`reviewVelocityPerMonth` was a stored derivation the app did not
    store.** Ten seeded literals — nine in `LISTENING_COMPETITORS`, one in
    `SAF_SELF_STATS` — stated a rate of change that no single API call can
    return and that nothing in the repo computed: `syncCompetitors()` never
    derived it from review counts, and the `velocityComparable` flag on
    `saf-sync-v1` recorded only that a second sync had *happened*, not what it
    read. So a figure the product presented as measured was written by hand,
    which is the exact failure the honest-data thesis exists to prevent, and
    the seeded number could never move no matter how many times a viewer
    synced. Reported while closing item 13's neighbouring work and fixed here:
    review counts are now stored per establishment in `saf-sync-v2`, and
    `reviewVelocity()` is the single derivation path for every consumer.
    Two consequences worth recording, because both were live defects rather
    than tidy-ups:
    · Nothing persisted the in-memory review-count bump, so a naive history
      store would have gone **negative** after a reload. `hydrateReviewCounts()`
      replays stored counts at load (`CLAUDE.md` § 6).
    · A ratings-only rival was given `reviewVelocityPerMonth: null` on the
      reasoning that its data was unreadable. That reasoning was wrong — the
      tier is about Instagram, and velocity comes from Places — so those rows
      now carry a real velocity. — closed in this commit

16. **`followersChange7dPct` and `engagementChange7dPct` were the same defect
    as item 15, one layer over.** Seventeen literals — nine follower and six
    engagement figures across `LISTENING_COMPETITORS`, plus both on
    `SAF_SELF_STATS` — stated a rate of change that Business Discovery cannot
    return. `DATA-SOURCES.md` lists that API as giving "Follower count, post
    count": a SNAPSHOT. There is no change-over-7-days field, and the app
    stored no follower history, so the percentages were invented and could
    never move however many times a viewer synced. Three of them sat on
    competitors marked `synced: false` — a seven-day follower trend for an
    account that had never been pulled once. All seventeen are replaced by a
    derivation over the stored series, sharing one `changeFromSeries()` path
    with review velocity. **Note the count: the task brief said eighteen. It is
    seventeen — `cmp-7`/`8`/`9` carry no `engagementChange7dPct`, because they
    carry no `engagementRate` either.** — closed in this commit

    Two things worth recording:
    · `comp.followers` was never assigned anywhere, so deriving a change from
      history alone would have produced a permanent 0%. Sync now nudges it the
      way it already nudges the review count, and engagement moves as a
      *consequence* — `applyCompetitorSync()` recomputes
      `avgInteractions ÷ followers`, so the relationship is real rather than a
      second invented number.
    · The same reset trap as item 15 applied to follower counts;
      `hydrateObservedCounts()` now replays those too.

17. **`saf-sync-v2` gained two sample fields WITHOUT a key bump — a deliberate
    exception to `CLAUDE.md` § 6, recorded here so it is not mistaken for
    someone ignoring the rule.** § 6 requires a new `-vN` key when a persisted
    SHAPE changes, because a returning viewer has the old shape in their
    browser. That rule targets a change that *reinterprets* an existing field,
    where old data read under new assumptions is silently wrong. This change
    only *adds* two optional fields to a sample. Every reader filters to
    samples carrying the field it needs, so a pre-existing reading stays fully
    valid for review velocity and is correctly invisible to the follower
    metrics — it reports `none`, which is exactly true: those readings never
    observed a follower count. Bumping to `-v3` would have thrown away review
    history viewers had already accumulated, a real and permanent loss, to
    guard against a risk that does not exist here. Verified in a browser by
    seeding a `v2` blob whose samples carry only `{ at, reviews }`: review
    velocity still derived (110/month over its own 60-day window) while
    follower and engagement change reported `none` with zero samples, and no
    seeded follower count was zeroed. — recorded in this commit

18. **`REVIEW_CHANNELS` and `INBOX_CHANNELS` are dead exports.** Both are
    derived from `caps` in `mock.jsx` and assigned onto `window`, and neither
    has a single consumer anywhere in `src/` — the only occurrences are the
    definition and the export line. `POSTABLE`, derived the same way, is alive
    and has exactly one real consumer (`page-compose.jsx:106`), which is what
    makes the other two look load-bearing at a glance. Same class as items 12
    and 13: a symbol that reads as wired up and is not.

    **Confirmed three times, and the third pass matters.** One of the earlier
    checks was a shell loop that silently reported `POSTABLE` as unused too,
    which is false. The reliable check is `git grep -n "\bINBOX_CHANNELS\b"
    -- src/`; anything that pipes filenames through `grep -l` on stdin will
    lie. The next person will run this grep, so the trap is recorded with the
    finding rather than left to be rediscovered.

    **Held open until a commit could own the decision**, because deleting them
    changes the caps model's public surface: they exist because `caps` is the
    enforcement mechanism (`CLAUDE.md` § 3) and a future screen reading "which
    channels take reviews" would reach for exactly these names. The answer, on
    review, is DELETE — nothing reached for them across nineteen commits, and a
    derived export with no consumer is a claim that something is wired up.
    `POSTABLE` stays: one real consumer at `page-compose.jsx`. — closed in this
    commit

19. **The `composerInitial` chain was orphaned by its own fix.** `b884f71`
    removed the AI assistant, whose "Copy to composer" was the only writer of
    `composerInitial` via `handleCopyToComposer`. The state, its
    clear-on-navigate, the prop threaded through `PageRouter`, and the sync
    effect in `ComposePage` all survived — five lines and a prop that could
    never be anything but `null`. It was reported in that commit's own report
    rather than fixed there, because removing it meant changing `ComposePage`'s
    signature and "the Composer is unaffected" was one of that commit's
    verification conditions. Removed here. The seeded default it guarded
    ('Tonight at Saffron House 🔥 — ') is untouched: the dead operand went, the value
    that actually runs stayed. — closed in this commit

20. **The Brand voice tab fed nothing, and its Save button never saved.** The
    tab held a brand-voice textarea in component state and a "Save changes"
    button that had no `onClick` at any point in its history — a control that
    lies, flagged in `c0e54f1`'s report and left then because removing the tab
    was a separate decision. Once `b884f71` removed the AI assistant the
    textarea fed nothing at all, and `9831154` had already had to correct its
    description from "passed to the AI assistant" to "nothing reads it
    automatically". Owner ruled 2026-09-09 to remove it. Gone with its
    component, its tab entry and its `t.settings.brand` key; Settings now shows
    three tabs.

    Its brand palette went with it, deliberately: six hardcoded hex values
    (`#B4451F`, `#6E2412`, `#D99A16`, `#2E7D4F`, `#B7791F`, `#C0342B`)
    duplicating the `tailwind.config` block in `index.html`, which `CLAUDE.md`
    § 8 names as the single source for those tokens. It was also a PARTIAL
    duplicate — six of the twelve — so it under-described the palette while
    appearing to document it. — closed in this commit

21. **`ComposePage`'s `onPublished` prop was never passed by anything.** The
    signature took it and the fake publish flow called it, but no caller in
    `app.jsx` or anywhere else in `src/` ever supplied one — so the `&&` guard
    was the whole of its behaviour and it had never fired. It read as a wired
    callback into the rest of the app (refresh the calendar, bump the activity
    feed) and there was nothing on the other end. Removed with the fake publish
    flow that was its only caller. — closed in this commit

22. **The Reviews screen claimed replies were live and escalations had been
    sent.** Two false success claims with two different shapes, fixed two
    different ways.

    *`submitReply` said "Reply published" / "…is live on Google".* The write
    was real — `setReplies` puts the reply on the card — but the claim was
    about the world, not the screen: nothing reaches Google Business Profile,
    and with no `localStorage` and no `fetch` anywhere in the file the reply
    does not survive a reload either. The word "live" was the specific defect;
    it asserts a state of the world. Drafting is genuinely useful and still
    works, so the flow stays enabled and was relabelled instead: the toast is
    "Reply drafted — nothing sent" at `info` rather than `success`, the modal's
    submit button says "Draft reply" rather than "Publish reply", the modal
    carries the reason above the textarea, and the reply renders on the card as
    a dashed-rule draft marked "Draft · not sent" rather than as the solid
    terracotta block a guest would see. That marker is scoped by `isLocalDraft`
    to replies written THIS SESSION: a seeded reply keeps the original
    treatment, because the demo's narrative is that those went out and marking
    them "not sent" would have invented five unsent drafts rather than removed
    a false claim — over-applying an honesty marker is its own inaccuracy.
    The draft block needed a new `html.dark .bg-saf-surface\/60` override
    (CLAUDE.md § 8): the dark block enumerates opacity variants as separate
    class names, so without it the LIGHT token was used in dark mode and the
    muted text rendered at 1.07:1, i.e. invisible. It is 7.4:1 now. The modal's coaching about public
    replies was kept — it is good advice and § 12.11 of CLAUDE.md forbids
    weakening an inline caveat — but moved off the present tense, since it was
    telling the user THIS reply was about to become public.

    *`onEscalate` was a toast and nothing else.* No state write, no side
    effect, and it claimed a complaint had reached the duty manager's WhatsApp.
    The most consequential false claim in the product: a manager who believes
    an escalation happened stops chasing it and the guest hears nothing.
    Nothing honest could be left enabled, so it follows `c0e54f1` — disabled
    for every role, reason on hover and beside the control. The
    `review.escalate` permission gate was NOT dropped; it is folded into the
    hover text, with the build reason leading because it is the unfixable half.
    That precedence is the one `server/src/channels.js` already uses when a
    platform limit and an account limit both say no. — closed in this commit

23. **An unsent draft stopped the SLA clock.** Carried as an open entry from
    `8ce1c20` and ruled on by the owner 2026-09-09: a drafted reply is
    INVISIBLE to the SLA. Nothing about a guest's experience changed because
    somebody typed into a box.

    `withLocal` set `replied: true` for a local draft and `slaState` returns
    `'answered'` for anything with that flag, so one unsent draft on a 1★
    complaint moved "Past SLA now" 6 → 5, dropped the review out of Needs
    reply, promoted it past every genuinely unanswered review under the urgency
    sort, and exported it as `replied: yes` / `sla_state: answered` with the
    draft text sitting in `reply_text`. Reproduced in both themes before the
    fix rather than taken on description.

    **The draft moved to its own field, `draftReply`, rather than `replied`
    staying false beside a populated `reply`.** Both would fix the four
    consumers, but the second leaves two fields that must be read together to
    mean anything, and the next person to write `if (r.reply)` meaning
    "answered" gets a draft. Different shapes cannot be confused: a consumer
    that means "sent" reads `replied` or `reply` and a draft is not reachable
    from either. This also retires `isLocalDraft` from `8ce1c20` — the field
    name now carries the seeded/local distinction that flag existed for.

    Four consumers, all verified by measurement: `slaState` returns
    open/due/breached for a drafted review; `urgencyScore` keeps a drafted 1★
    ahead of every answered review because it reads `slaState`; the status
    filter leaves it under unanswered; and the CSV exports `replied: no` with
    the real `sla_state`. **`replied_by` and `reply_text` are left EMPTY for a
    draft** — those columns assert a reply happened, an export outlives the
    session and can be quoted back, and a CSV carries no "Draft · not sent"
    pill to travel with the text. If drafts should leave the product they need
    their own named columns, which is a schema change and a separate decision.

    `8ce1c20`'s card rendering is unchanged and still correct: dashed block,
    "drafted by", the pill, the reload line, and the five seeded replies still
    reading "replied by" with their SLA answered. — closed in this commit


24. **The Approvals screen claimed eight actions it did not perform.** The
    worst cluster in the product, carried as part of the open entry below since
    `8ce1c20` and closed here. Re-verified before editing rather than taken on
    description: the file's only state is `tab`, `drawerPost` and `search`, it
    contains no `localStorage` and no `fetch`, and every one of the eight was
    an inline `toast.push` with no other statement in the handler. Nothing had
    a local half worth leaving enabled the way drafting a reply did in
    `8ce1c20`, so all eight follow `c0e54f1`: disabled, with the reason stated.

    **One panel, not eight tooltips.** The whole approval chain is unbuilt for
    a single reason, so it is said once above the tabs — where it is on screen
    whichever tab is open — with a one-line hover on each control.

    **The reason is deliberately NOT the Composer's.** `760ec7b` disabled the
    Composer because no channel is connected and there is nowhere to store a
    post. This screen is dead for a different reason: there is no approval
    state anywhere — no server table, no client state, nothing that remembers a
    decision — so a post cannot move between tabs and connecting Instagram
    would not make Approve work. Copying the Composer's wording would have sent
    someone off to fix the wrong thing.

    **The permission gates stay**, because the distinction is real and
    demoable: a Social Coordinator genuinely cannot approve. `ActionBtn` keeps
    its `enabled` prop and now always renders the disabled form, composing the
    hover as build reason first, permission reason second. That precedence —
    the unfixable half leads — is the rule `server/src/channels.js` uses for
    platform-before-account and `8ce1c20`'s escalate tooltip already follows.
    The prop carrying the gate text was renamed `tooltip` → `permissionReason`,
    because it is no longer the tooltip but one input to it, and a prop whose
    name misdescribes its value is the same class of quiet inaccuracy this
    series exists to remove. — closed in this commit


25. **The last two "Reply sent" claims, and two dead controls.** Three surfaces
    that needed three different fixes, because the actions genuinely differed.

    *`page-messages.jsx`:48 — the Reviews shape.* `sendReply` really does
    append the message to `setConversations`, so it renders in the thread;
    writing a reply works and is useful and stays enabled. What was false was
    the toast and, more sharply, **the `status: 'sent'` literal — the same
    claim in DATA rather than in a toast.** That field is read at :311 to pick
    a delivery tick, so `'sent'` drew the single check every messaging app uses
    to mean the platform has it. It now carries `'unsent'`, with its own branch
    that renders the words "Not sent · this screen only" and no tick at all —
    there is no tick that honestly means "still on your screen". **The `else`
    fallback there used to draw a tick for any unrecognised status**, so a new
    status value alone would not have been enough; the fallback is now explicit
    and returns nothing. The bubble loses the solid outbound treatment for the
    dashed muted one `8ce1c20` established. Seeded `'read'` and `'delivered'`
    messages are untouched.

    *`page-history.jsx`:199 — the c0e54f1 shape, and the worst of the three.*
    A pure no-op that ALSO destroyed the user's work: it claimed the reply had
    gone out, cleared the textarea and kept nothing anywhere. Nothing local was
    worth preserving, so it is disabled with the reason, and the textarea is
    left alone. **The reason is deliberately NOT `0d65504`'s sentence
    verbatim** — that one names an "approval decision" and this control is a
    public reply to a comment, so reusing it word for word would have described
    the wrong thing. The shared half, that there is nowhere to record it, is
    what carries over.

    **This file is the Approvals drawer, not a screen.** It defines no
    `HistoryPage` — `PostDetailDrawer` and six helpers, consumed by
    `page-approvals.jsx` (and `Stat` by dashboard and analytics) through global
    scope, which is why `index.html` loads it at :311 immediately before
    approvals at :312. Anyone editing it is editing the Approvals drawer.

    *Two dead controls in `page-approvals.jsx`.* Neither made a false claim, so
    both were correctly outside `0d65504`'s scope; but `Edit & resubmit` was
    left ENABLED beside eight disabled siblings, which read as the one thing
    that works — its own way of misleading. It is an approval action, so it
    takes the approval reason. **`Filters` was the judgement call**: it has
    never had an `onClick`, so unlike the eight it is not blocked on a backend
    — there is simply no filter panel. Removing it would also be defensible;
    disabling states the truth without deciding the future of a feature someone
    may still want, so its hover points at what DOES work (the tabs and the
    search box) rather than borrowing the approval-state sentence, which would
    not be true of it. The search box itself is untouched and still filters.

    *The dead alias* `window.HistoryPage = ApprovalsPage` is removed. Nothing
    referenced `HistoryPage` and no `history` route exists — same dead-export
    class as entries 12, 13 and 18. — closed in this commit


26. **The last eight false success claims, in `page-stubs.jsx`.** Verified
    first: zero `localStorage`, zero `fetch`, no writer of any kind, and each
    of the eight an inline toast with nothing else in the handler. All follow
    `c0e54f1` — disabled, reason stated — since none had a local half worth
    keeping the way drafting a reply did.

    **Three screens, three reasons, written separately on purpose.** One
    sentence pasted three times would be a lie by flattening: it would tell
    someone the same thing is missing in all three places when each needs
    different work. Brand Kit has nowhere to store an asset, a token or a copy
    block. Users has no directory to write to and no mail path out of the app —
    the `'Invitation sent'` case is the Escalate shape from `8ce1c20`, where
    somebody waits for a message that was never sent.

    **The two downloads were the worst and the Exports panel says why.**
    `downloadCsv` (csv-util.jsx:30) builds a real Blob and a real object URL,
    and it is genuinely called at `page-reviews.jsx`:209,
    `page-recommendations.jsx`:114 and `page-listening-signals.jsx`:172/:182 —
    checked, not assumed, because the panel makes a claim about the product.
    Pressing Download really does produce a file everywhere else, so a user
    who presses it here and gets nothing concludes the product is BROKEN. The
    panel therefore states that this is unbuilt rather than broken, and names
    where downloads are real. That clause is the whole difference between a
    bug report and an accurate expectation.

    Permission gates stay and are still demoable. `GatedButton` keeps its
    `enabled` prop and always renders the disabled form, appending the role
    sentence after the build reason; the `Assign role` ternary collapses the
    same way, since neither branch could act. On Exports the per-card `allowed`
    check is untouched and the locked branch now leads with the build reason
    too. Three now-unused `useToast` handles went with the toasts.

    **This closes the campaign.** Seven commits — `760ec7b`, `8ce1c20`,
    `6a7a75c`, `a7d76c9`, `0d65504`, `f93a72b` and this one — across six files:
    `page-compose.jsx`, `page-reviews.jsx`, `page-approvals.jsx`,
    `page-messages.jsx`, `page-history.jsx` and `page-stubs.jsx`. **Twenty-three
    false success claims** in total: 3 + 2 + 8 + 1 + 1 + 8. Two of those commits
    fixed damage the campaign itself caused rather than claims — `6a7a75c`,
    because keeping an unsent draft out of `replied` was what stopped it
    clearing the SLA, and `a7d76c9`, because a drafted review then sat at the
    head of the queue with no control on it.

    A final sweep of all of `src/` for `toast.push`, success kinds and
    past-tense action language returns no remaining false claim. Every
    surviving toast is backed by a server call, a `localStorage` write or a
    real file download, or states an absence or an error. — closed in this
    commit


27. **Five of the six post read sites moved to the server; `SCHEDULED` is
    gone.** `page-dashboard.jsx` (three sites), `page-analytics.jsx`,
    `page-scheduled.jsx` and `recommend.jsx` now read `SERVER.posts` through an
    adapter in `api.jsx`, and all four screens are gated behind
    `<RequiresServerData>` so an unreachable service reads as unreachable
    rather than as a restaurant that has published nothing.

    **The shape change was the work, not the plumbing.** "Published posts" was
    a filter on a post field and is now a question about targets, answered by
    `summary.outcome` server-side — nothing client-side recomputes it. Metrics
    were never the post's: every seeded post carried `metricsFrom: 'ig'` while
    three went to two channels, so `postMetrics()` sums only targets that HAVE
    figures, reports which channels they cover, and returns null rather than a
    bag of zeroes when none does. A rate is not summed at all: with one
    measured channel it is that channel's, and with more there is no honest
    single number, so it is absent.

    The Dashboard's reach KPI carried an invented `delta="+12%"`. It now says
    what the figure covers — "from Instagram" — or, when a post published today
    has no measured target, "N of M posts measured", because a partial total
    presented as a complete one is the same lie in arithmetic.

    `recommend.jsx` keeps running synchronously inside `RequiresServerData`
    (`page-recommendations.jsx`:23), which was checked rather than assumed —
    `generateRecommendations()` has exactly one caller and it is inside the
    gate. Two rules that branched on the old `status` now read `outcome`, and a
    third was corrected to ask what it actually needed: it wants a MEASURED
    post, not a published one, and the status check was always a proxy for
    that. A `mixed` post is deliberately not swept into "this channel is not
    publishing" — that is a different claim from "one of two channels refused".

    `SCHEDULED` is deleted from `mock.jsx` and from its window export; nothing
    in `src/` references it. **`POSTS` survives for `page-approvals.jsx` alone**
    — see the open entry below. — closed in this commit


#### Open

1. **`POSTS` survives in `mock.jsx` for `page-approvals.jsx` alone, and moving
   it needs an owner decision first.** Part 3 stopped on that screen rather
   than guessing, per its own instruction.

   **What that screen actually takes from `POSTS` is one row.** Its six tabs
   are `draft` / `in_review` / `approved` / `sent_back` / `rejected` /
   `templates`, and the seeded posts carry `published` (5), `failed` (1) and
   `draft` (1). Only `p7:draft` matches a tab; the other six have never been
   visible on that screen at all. Everything the workflow tabs show comes from
   the four rows `APPROVAL_POSTS` invents at `page-approvals.jsx`:58.

   **The server has no approval state and deliberately did not gain one.**
   `posts.state` is `draft` / `scheduled` / `sending` / `attempted` — a
   LIFECYCLE, which is what a post does on its way to a channel. `in_review`,
   `approved`, `sent_back` and `rejected` are a WORKFLOW between people, and
   `0d65504` established there is nowhere to record one; that is why all eight
   controls on that screen are disabled with a panel saying so.

   **The decision, which is the owner's and not an agent's:**
   - *Build it* — an approval workflow server-side (a state column or a
     decisions table, plus who decided and why), after which the screen moves
     over whole and its eight controls can become real. This is the largest of
     the three and is a product commitment, not a refactor.
   - *Reduce it* — the screen shows only what exists: drafts and scheduled
     posts from the server, with the workflow tabs and the four invented rows
     removed. Honest immediately, and it deletes a demo narrative.
   - *Leave it* — `POSTS` and the four invented rows stay as declared sample
     data. Cheapest, and it keeps the duplication this entry exists to track.

   **Until it is decided:** a draft written in the Composer is stored on the
   server and does NOT appear in the Approvals Draft tab, which still shows the
   seeded `p7`. That divergence is visible today and is the cost of leaving it.

## 4. Scope discipline

- Change what was asked and nothing adjacent.
- **No drive-by reformatting, reordering, renaming or "tidying"** of code you
  were not asked to touch. The diff is read by a human; noise in it is a cost
  you imposed on the reviewer.
- **No wholesale file rewrites for a scoped change.** Edit in place.
- Found a second defect while working? **Name it in the report. Do not fix it
  in the same change** unless told to.
- Never delete or weaken an existing honesty guard, explanatory comment or
  in-UI caveat because it makes a screen look busier.
- Never convert global-scope declarations to `window.*` exports or back as a
  side effect. That is a scope change dressed as a tidy-up.

## 5. What is automated here

**The client: nothing.** `src/` and `index.html` have no build, no test suite,
no CI, no linter and no type checker, and that is permanent (CLAUDE.md §2).
Nothing there can fail; a commit cannot break a pipeline because there is no
pipeline. **The entire verification story for a client change is one person
loading the page in a browser and looking at it** — and every class of defect
this codebase has actually shipped was silent: `NaN` rendered as an em dash, a
missing script tag, a non-existent icon name, a dead link that 404s on a real
domain, a red "behind the median" arrow beside "no history yet". None of them
threw. None would have been caught by a test that does not exist. So for the
client, a green anything is not available to be reported, and "it should work"
is not a status. The only evidence that counts is § 6.

**The server: tested, and not optionally.** `server/` has a toolchain, so it
carries real tests. `npm test` in `server/` must be green before any commit
that touches it, and **its actual output pasted in the report** — a claim that
tests pass is not evidence that they ran. New behaviour arrives with a test; a
bug fixed there arrives with a test that fails without the fix. There is still
no CI, so "green" means green on the machine that made the commit, and the
report says so.

**Neither half's rule excuses the other.** A commit spanning both is verified
twice: `npm test` for `server/`, a browser for `src/`.

*(Rewritten 2026-09-05. Until the `server/` workspace existed this section read
"What is automated here: NOTHING", which was true of the whole repo and is now
true only of the client. Wording proposed by the implementing agent in the
report for 1984107 and adopted by the owner.)*

## 6. Definition of Done

The checklist EVERY change passes before it is reported as finished. A change
that cannot answer these is not finished, and reporting it as finished is
itself the defect.

**a. It was loaded in a browser.** `python3 -m http.server 8000` from the repo
root, then <http://localhost:8000/>. `file://` does not work and a `file://`
attempt that "showed nothing" is not a finding.

**b. The console is clean.** Zero errors, zero React warnings introduced by
this change. Report the console state; do not omit it because it was fine.

**c. Every screen the change can reach was actually visited** — not reasoned
about. A change to `mock.jsx`, `ui.jsx`, `i18n.jsx` or `recommend.jsx` reaches
many screens; name which you opened.

**d. Both themes, and every affected role.** Dark mode is hand-written CSS
overrides (`CLAUDE.md` §8) and a missing override is invisible in light mode.
Role gating is two separate mechanisms (`PERMS` and `PAGE_PERMS`) and a hole in
either is invisible from the role you happened to be using. Switch roles from
the topbar; switch theme with `Cmd/Ctrl + \`.

**e. Interactive things were actually clicked, in both directions**, and the
resulting DOM observed. An element can exist and be clipped; a toggle can
exist and not toggle. DOM presence is not verification.

**f. Look at it.** Take a screenshot and read it. Every layout defect in this
class of UI is found by looking; numeric probes come back clean. Text that CSS
switches is read with `innerText`, never `textContent`, which ignores
`display:none` and will return both states concatenated.

**g. Empty panels were checked for `NaN` before being called empty.**
`CLAUDE.md` §11 trap 1.

**h. New data was checked against `DATA-SOURCES.md`.** Any field added to a
seed record, or shown on a screen, is either traceable to a real API, derivable
from text a real API returns, or readable from the restaurant's own systems —
or it does not go in. State which, for each new field.

**i. Docs updated in the same commit.** § 3.

**j. Deviations self-reported.** What you tried and reverted, what you could
not verify and why, any edit that silently no-opped, any premise in the prompt
that turned out to be wrong. Where the reasoning would stop someone repeating
the attempt, it belongs in a **code comment at the site**, not only in the
report — the next person to hit it should find out from the file.

## 7. Commit hygiene

- **Subject: lowercase Conventional, ≤100 characters.**
  `feat:` `fix:` `docs:` `refactor:` `style:` `chore:`, optional scope in
  parentheses — `fix(competitors): ...`, `docs(conventions): ...`.
- **Empty body. Zero trailers.** No `Co-Authored-By`, no `Generated with`, no
  `Signed-off-by`, no session links.
- **Author == committer**, `Shreyansh Dutt <shreyansh45@gmail.com>` — the same
  identity as Meridian Stratus (owner decision 2026-09-04). This is set in the
  repo's local git config, so it applies without anyone having to remember it;
  never override it per-commit with `--author`, `-c user.name`, or
  `GIT_AUTHOR_*` / `GIT_COMMITTER_*` environment variables.
  Commits `cc46f64`…`83028ad` carry `Billy <billy@justflycheap.com>`; they
  predate this decision and are not rewritten (see below).
- One logical change per commit.

**Where the reasoning goes now.** Commits `cc46f64`…`83028ad` carry long
narrative bodies, and that reasoning is genuinely load-bearing — the `NaN`,
dead-link and Lucide traps were all recorded there. Under an empty-body rule
that reasoning must not simply be lost. It goes, in order of preference:

1. a **code comment at the site**, where the next person to try the thing
   will actually find it;
2. `CLAUDE.md` § 11 *Known traps*, if it generalises beyond one line of code;
3. the slice report, if it is specific to this piece of work.

The nine existing commits are **not** rewritten. History before this file is
history; the rule applies from the first commit after it.

## 8. Git posture (remote adopted 2026-09-05)

### Remote

- **`origin` is a PRIVATE GitHub repository.** Private is a deliberate choice,
  not a default: `mock.jsx` invents six competitor restaurants in a real Delhi
  neighbourhood and attaches invented ratings, follower counts and
  "losing ground to them" claims to them. That risk is contained locally and
  is not containable once indexed. Making the repo public requires replacing
  those names with unmistakably synthetic ones FIRST, and an owner decision
  recorded here.
- **Never push a branch carrying a credential.** A secret that reaches origin
  is compromised even if the next commit removes it — rotate it, do not just
  delete the line (§10).

### Who pushes what

- **An agent may push ONE thing: the feature branch it just committed to.**
  That is what puts a stacked pull request in front of the owner to review.
  Nothing else.
- **An agent NEVER** pushes `main`, force-pushes anything, rebases a branch
  that has been pushed, opens or closes or merges a pull request, deletes a
  remote branch, or changes any repository setting.
- **The owner pushes `main` and the owner merges.** That has not changed and
  is the rule this whole document is built around. Opening a pull request is
  a publishing action and the merge button sits one click from it.
- **A rejected push is a STOP, never a `--force`.** If `git push` is refused,
  report what git said and stop. The remedy is never force; it is finding out
  why the remote has something you do not.

### Stacked pull requests

Work already arrives as a stack — each branch cut from the last, each commit
self-contained and reviewable alone. GitHub's stacked pull requests (public
preview since August 2026) put a review surface over that. They change the
review, not the sequencing; the discipline that produces reviewable commits
is § 4 and § 6, not a GitHub feature.

- **Each pull request targets its PARENT branch in the stack, not `main`.**
  Only the bottom of the stack targets `main`.
- **Merge bottom-up, one at a time.** After each merge, verify the next pull
  request's base is what you expect before merging it — do not assume the
  retarget happened, and do not assume it happened correctly. § 2.
- **A stack is not a licence to grow one.** If the bottom of the stack is
  ready, land it. Six unmerged commits was manageable; the reason to notice
  is that each additional layer makes the one below harder to revert alone.
- **Never rebase to "tidy" a stack that has been pushed.** The history a
  reviewer has already read is not yours to rewrite.

### Where git is run from

- **The planning assistant does not run git commands that WRITE**, and
  prefixes even its reads with `GIT_OPTIONAL_LOCKS=0`. `git log`, `git show`
  and `git rev-parse` are safe unprefixed. **`git status` and `git diff` are
  NOT** — both refresh the index and take `.git/index.lock` to do it, which
  is a write, and which through this mount is a lock that cannot be released.
  `GIT_OPTIONAL_LOCKS=0` tells git to skip exactly that, and was verified to
  work here on 2026-09-08.
- The reason is mechanical, not stylistic. The repository is reached through a
  folder mount that cannot delete files, so git cannot clean up its own
  temporary objects or release its own locks. On 2026-09-08 a ONE-LINE docs
  commit run this way left `.git/HEAD.lock` and
  `.git/objects/maintenance.lock` behind, and every operation that moves HEAD
  — checkout, commit, reset — then failed with "Another git process seems to
  be running" until the owner deleted two zero-byte files by hand. A
  partially applied `checkout` had also left the working tree holding one
  branch's content while HEAD pointed at another, which then blocked the
  merge.
- **So: the assistant edits files and hands over the commands; the owner and
  CC run git.** A change small enough to feel not worth handing over is
  precisely the one that causes this, because its smallness is what makes
  running it yourself feel reasonable.

### Unchanged

- **Branch before the first commit of a piece of work.** `main` is not
  committed to directly.
- **STOP before merge.** Report the branch and the commit; the owner takes it
  from there.
- **Never `git checkout .`, `git reset --hard`, `git stash drop`, or `git
  clean`** on a working tree you did not create. Committed work now has a
  backup on origin; **uncommitted work still has none anywhere.**
- Verify actual git state before acting on a stated one: current branch, HEAD,
  upstream, and `git status` — not what a prompt claims they are. § 2. A
  prompt written before the last commit is a prompt describing a repo that no
  longer exists.

## 9. Prompt discipline (applies to the planning side too)

These guards appear in EVERY implementation prompt written for this repo. A
prompt missing them is incomplete and should not be dispatched:

1. **Name the files and symbols** the work touches, by path and name. Never
   "the competitor screen" alone.
2. **Forbid invention explicitly**, and say what the honest empty state is for
   the specific thing being built.
3. **Require read-before-write with `file:line` evidence**, and require a STOP
   on any premise that does not check out.
4. **State the verification expected** from § 6 — which screens, which roles,
   which theme — rather than "test it".
5. **State the scope boundary**: what must NOT change.
6. **Require the deviation self-report** (§ 6j) as part of the deliverable.
## 10. External data, secrets and retention (owner directive 2026-09-05)

The `server/` workspace exists to hold the two things a browser cannot: other
people's credentials, and data that must outlive one person's browser.

**Secrets.**
- No API key, access token or secret in any committed file, in either
  workspace. Env only. `.gitignore` covers `node_modules/`, `.env*` and the
  local database.
- A secret that has ever been committed is compromised: rotate it, do not
  just remove the line.
- The client holds no credentials. It calls the server; the server calls
  Google and Meta. Any design that puts a key in the browser is wrong even if
  the key is "restricted".

**Third-party terms are a build constraint, not a footnote.**
- **Google Maps Platform Service Specific Terms §14.3** permits caching
  latitude/longitude from the Places API for **up to 30 consecutive calendar
  days**, after which it must be deleted. §A.3 permits caching `place_id`.
  Name, rating, `user_ratings_total`, address and business status are granted
  no caching permission there.
- Consequence for this product: **`place_id` is the only Places field stored
  permanently.** Everything else is fetched for display and held under an
  explicit, configurable retention policy with the clause cited beside it in
  code. A retention window is a named constant, never a number inlined at a
  call site.
- Our OWN listing is Google Business Profile, not Places. That data is the
  restaurant's own and is not subject to §14.3 — `saf-self` history is
  unaffected. Do not conflate the two in one store without labelling which
  rows came from which source.
- The competitor review-count history built in `3eb4344` predates this
  section. Whether it may be retained beyond the Places window is an OWNER
  decision, not an engineering one — see the gate below.

### Demo data until UAT, architecture as if live (owner decision 2026-09-05)

Until UAT, every establishment, rating, review count and follower figure in
this product is **fabricated**, carries `is_sample = 1`, and is therefore not
Google Maps Content. §14.3 does not apply to any of it, and the purge exempts
it by design.

That is a statement about the DATA, not a licence for the architecture. Build
every layer as though the data were real:

- The retention constant, the boot-time refusal of a window above the §14.3
  ceiling, and the purge routine are all live and enforced. They are
  architecture, not decoration, and must not be stubbed because nothing
  currently trips them.
- `place_id` remains the only permanently-stored Places field. Sample rows
  carry a `sample:` prefix so a real 27-character Google id can never be
  confused with one of ours.
- Credentials, rate-limit accounting and call reporting are built for real
  volumes from the start. A job states its call count before it runs.

**GATE — CLEARED 2026-09-08.** The two questions below were answered by the
owner on that date; the ruling follows them. The questions stay recorded
rather than deleted, so a future reader sees what was decided and against
what alternatives. Before that date, no commit could issue a live Places
request. The blocked questions were:

1. **Volatile Places columns** (name, rating, `user_ratings_total`, address,
   business status). §14.3 grants a 30-day window to latitude and longitude
   *specifically*; the strict reading gives these columns no window at all.
   Either they get a zero window and the Establishments screen fetches on
   demand, or the owner knowingly accepts the 30-day treatment. The schema
   currently applies the 30-day window, which is the more permissive reading.
2. **Competitor review-count history.** Review velocity needs 90+ days of
   `user_ratings_total` readings. Under the strict reading that history is not
   lawfully derivable from Places at all, and the honest alternatives are to
   derive velocity only for our own Business Profile listing, or to obtain
   competitor data under different terms. `PURGE_PLACES_OBSERVATIONS` is
   currently `false`, which preserves the status quo; flipping it to `true`
   deletes competitor history past the window and degrades every competitor
   velocity to `none` — which the UI already renders honestly.

#### Ruling (owner, 2026-09-08)

**1 — Volatile Places columns: the 30-day window stands.** Name, rating,
`user_ratings_total`, address and business status keep the same window §14.3
grants latitude and longitude. This is the more permissive of the two
readings and it is taken knowingly: the clause names lat/lng *specifically*,
and extending it by analogy is a judgement about risk, not something the text
grants. `PLACES_RETENTION_DAYS_DEFAULT` stays 30, and the boot-time refusal
of any window above the ceiling stays exactly as it is.

**2 — Competitor review-count history: purged.**
`PURGE_PLACES_OBSERVATIONS` becomes `true`. Places-sourced observations for
real establishments are deleted once past the window. The reasoning is that a
snapshot held for 30 days and a 90-day archive kept in order to derive a rate
are different asks, and only the first survives a clause that grants these
columns no window at all.

**What ruling 2 actually costs — stated precisely, because it was first
described here more harshly than it is.** Competitor review velocity is NOT
removed. `changeFromSeries` needs two readings seven or more days apart, and
a 30-day window always holds several of them, so velocity survives with its
lookback capped at 30 days rather than growing without bound. The figure
becomes noisier and slower to stabilise; it does not become `none`. Our own
velocity reads `saf-self` from Business Profile rather than Places and is
untouched by either ruling.

**One consequence for engineering:** the `true` branch of
`purgePlacesContent()` has never executed in a test. Flipping the switch
turns previously dead code live, so the commit that flips it owes tests for
the branch, not just for the constant.

Work touching live Google Places data is unblocked from this date.

- Meta's terms and rate limits apply the same way. Business Discovery reads
  public Business and Creator accounts only; scraping Instagram to fill the
  gap is out of the question regardless of how easy it looks.

**Rate limits and cost are correctness concerns.**
- Every external call costs money or quota or both. A job that fans out over
  tracked establishments states its call count before it runs, the way
  `syncCompetitors()` already reports every call and every skip.
- Never call an API you know will return nothing. The existing rule — skip
  Business Discovery on personal and private accounts rather than spending
  quota to be told no — generalises.
