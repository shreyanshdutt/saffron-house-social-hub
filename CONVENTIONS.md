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

#### Open

None.

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

## 5. What is automated here: NOTHING

Read this literally before reporting anything as done.

There is **no test suite, no CI, no type checker, no linter, no build step and
no server**. There is no `package.json`. Nothing in this repo can fail. A
commit cannot break a pipeline, because there is no pipeline.

That is not a licence; it is the reason the rest of this document is strict.
**The entire verification story is one person loading the page in a browser
and looking at it**, and every class of defect this codebase has actually
shipped was silent — `NaN` rendered as an em dash, a missing script tag, a
non-existent icon name, a dead link that 404s on a real domain. None of them
threw. None of them would have been caught by a test that does not exist.

So: a green anything is not available to be reported, and "it should work" is
not a status. The only evidence that counts is § 6.

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

## 8. Git posture

- **Local-only.** There is no remote configured on this repo and none is to be
  added without an owner decision recorded here.
- **Branch before the first commit of a piece of work.** `main` is not
  committed to directly.
- **STOP before merge.** The owner merges. Agents do not merge, do not
  fast-forward `main`, do not rebase, do not `git push`, do not force-push,
  and do not delete branches — not even to "clean up" or "sync".
- **Never `git checkout .`, `git reset --hard`, `git stash drop`, or `git
  clean`** on a working tree you did not create. Uncommitted work in this repo
  has no backup anywhere.
- Verify actual git state before acting on a stated one: current branch, HEAD,
  and `git status` — not what a prompt claims they are. § 2.

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
