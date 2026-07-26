# WRAP — s78 lane 1: `leads · board · runs`

Branch `s78-lane1-leadsboardruns`. **Not merged** — the lead merge-gates on rebase
+ `npm run verify` on merged main.

## Round 1 — the verify gate: 12 findings, 12 survived, 0 refuted

Three parallel workflows (one per surface), **three independent verifiers per
finding**, each prompted to REFUTE, each defaulting `real:false`, each on a
different lens (`code` = does the code literally do this · `by-design` = honest
refusal / sheet-faithful port / already served elsewhere · `repro` = does it
happen on today's real data). Majority of 3 to survive. **36 verifiers, 35 voted
real.**

| id | finding | votes | verdict |
|---|---|---|---|
| L1 `blocker` | Dismiss + Mark hot have no pointer control | 3/3 | SURVIVES |
| L2 `high` | blocked draft keeps the pass draft's send affordances | 3/3 | SURVIVES |
| L3 `high` | failed run-feed read renders as "No draft yet" | 3/3 | SURVIVES |
| L4 `high` | draft outside the 50-run window invisible, toast contradicts | 3/3 | SURVIVES |
| L5 `high` | Dismissed view has no cue and no visible clear | **2/3** | SURVIVES, NARROWED |
| B1 `high` | Waiting column drops 9 of 21 behind a misleading note | 3/3 | SURVIVES |
| B2 `high` | 620px column bound clips at the sheet's own density | 3/3 | SURVIVES |
| B3 `high` | "Needs you · 25" vs "Waiting on you 21", same screen | 3/3 | SURVIVES |
| B4 `high` | Approved/Composing/At-the-judge cards carry no platform | 3/3 | SURVIVES |
| R1 `high` | global Enter binding hijacks the surface's own buttons | 3/3 | SURVIVES |
| R2 `high` | failed run with zero drafts selects a DIFFERENT run's draft | 3/3 | SURVIVES |
| R3 `high` | every row's lead derived from platforms only | 3/3 | SURVIVES |

**Nothing was killed.** That is an unusual result and worth stating plainly: the
pass was scoped to blocker+high only, which is the pile least likely to be
invented, and every finding came with a file:line the walker had already read.
The verify pass still paid for itself — it corrected six of the twelve in ways
that **changed the fix**, and one of those corrections reversed my planned
approach entirely. Verifiers used the live dev server and a real browser, so
several claims are now measured rather than argued.

### The one narrowed finding — L5, 2/3

The `repro` lens refuted it, correctly: the Dismissed view is **not**
irreversible. `showDismissed` was unpersisted component state (a reload cleared
it), the filter could only ever be ENTERED with the provenance panel open, and
the exit sat one click behind the always-visible footer disclosure. The accurate
residual defect — which the other two lenses confirmed and which I fixed — is
narrower: while the filter was on **and** the operator had since closed or
swapped that panel, nothing on screen named it. Header still read "Leads · N
scored"; rows carried no dismissed marker. So: a visibility gap, not a trap.

### Corrections the verify pass forced on the fixes

- **B4 — my planned fix was wrong.** I was going to put the platform in the card
  META. The verifiers opened the sheet: `Board.dc.html` leads the *title* with the
  platform in every column except Waiting (`Blog · inside the build-step
  pipeline`), and the meta line I was about to change is a faithful port. They
  also disproved the finding's stated mechanism — fan-out siblings do **not**
  share an excerpt; the cards collapse because `.k-title` is a two-line clamp
  cutting at ~50 chars, before near-duplicate briefs diverge. Fix follows the
  sheet: platform-led title, where the clamp cannot reach it.
- **B1 — half the finding was wrong.** The header count was already honest (21,
  the true total) and a door to the remainder does exist (Approve). The real
  defect was the note's wording: "column scrolls — all 21 counted above" explains
  the gap away. Fixed as N-of-M + a link, following this repo's own precedent
  (`week-card.tsx` "+N more" / "not shown, not lost").
- **B2 — the clearest instance is not the one in the finding.** Measured live at
  1440×940: the `.cols` region is 798px, so the 620px constant left 136px unused.
  The 12-card Waiting column would scroll anyway; the actual clip was **Intel
  picks at four cards** (each carrying a 54px thumb = 644px in a 620px box).
- **B3 — the cause is narrower.** `PLAN_ASSET_CAP` (40) is not binding at today's
  data; the whole 25-vs-21 gap is `PLAN_RUN_WINDOW` 20 vs `PULSE_RUN_WINDOW` 50.
- **R1 — the blast radius is wider than the finding.** The window listener steals
  Enter from *every* focusable control while Runs is mounted, including the
  shell's side-nav (verified live: Enter on the focused "Intel" nav link landed
  on `/app/approve?run=…`). And `preventDefault` **cancels** the button's
  activation click, so the filter did not even apply before navigating. Four
  sibling surfaces already carry the exact guard with the exact rationale —
  **Runs was the outlier.**
- **R3 — the number in the findings doc is stale.** 17 of 27 rows read "Fan-out ·
  Video", not 19; and 8 consecutive rows in one day card were byte-identical
  across lead, excerpt, thumb, pill *and* aria-label.
- **L3/L4 — the harm was overstated.** Both claimed the operator is invited to
  waste a generation. Compose is idempotent (content-hashed brief → same
  `generationKey` → same draft, zero model calls), so no copy of mine says
  "re-spend". L4's fix uses that idempotency rather than fighting it.

## Round 2 — what shipped

**Leads** (`components/leads/**`)
- **L1** — `Mark hot`/`Clear hot` + `Dismiss` as real buttons in the dossier
  `card-head` beside the `#id` stamp; Dismiss rests as an honest refusal on an
  already-dismissed lead. Closes a regression: the pre-rebuild lead card drew
  both verbs. Matches Approve, which binds `a`/`r` **and** draws the buttons.
- **L2** — the judge pill is now a door (`/app/approve?draft=<id>`), and a
  **blocked draft fails closed**: Copy body/subject disabled with the reason, the
  prefilled `mailto` replaced by the unarmed-span treatment Runs already uses,
  and the block stated persistently in the error channel instead of only in a
  toast that has gone. This was the one route by which ungated copy could reach a
  real recipient — Approve's state machine has no `blocked → approved` path.
- **L3** — `setRuns("error")` and a `feed-error` outreach state: "unresolved, not
  an empty history", with `Try again` in place of the compose button.
- **L4** — the compose door's own `runId` is held (keyed by lead) and outranks the
  bounded-feed scan, so an aged-out draft resolves and the `alreadyComposed` toast
  stops contradicting the band.
- **L5** — `showDismissed` is gone, replaced by a labelled status filter that
  names itself in resting chrome.

**Board** (`components/board/**`)
- **B1+B3 as one fix** (they are one sentence on screen): the Waiting count is the
  pulse's `needsYou` — the same number the topbar and rail show — and the note
  reads `12 of 25 shown — open the queue for the rest →`. Two guards: with a
  platform filter applied it falls back to the column's own count, and the total
  can never read below the cards rendered.
- **B2** — `.col { max-height: 100% }` + `.col-bd { flex: 1; min-height: 0 }`; the
  620px constant is gone.
- **B4** — platform-led titles for Composing / At-the-judge / Approved, per the
  sheet. Waiting keeps its own grammar (platform in the meta).

**Runs** (`components/runs/**`)
- **R1** — `closest("button, a, [role=button]")` guard on the Enter binding, the
  four-sibling pattern. `[role=button]` is the one extension: this surface's rows
  are divs with their own Enter handler.
- **R3** — subject-first lead (`runLead`), bounded at a word boundary; a run the
  plan window doesn't cover keeps the honest platform-only line.
- **R2** — Runs side + a cross-lane touch, below.

**The founder's re-introductions**, one grammar across all three surfaces —
Approve's own `.sel-ctl` chip markup (sheet chrome + a transparent native
`<select>`, so it is genuinely keyboard/AT-operable):
- **Leads**: find (name/company/email/role) · status filter (contract-derived from
  `LEAD_STATUSES`) · sort (Best fit first / Newest first).
- **Board**: platform filter · sort (Oldest first default = today's board exactly).
- **Runs**: find (lead + excerpt) · platform filter · sort, left of the sheet's own
  All/Failed/Published seg so that control keeps its drawn slot.
- Every narrowed-empty view says **the knob** emptied it, never "nothing here".
  The Intel column says `not narrowed — a sweep card has no platform until it's
  promoted` rather than passing for filtered.

## Cross-lane touch — READ THIS

**`components/approve/approve-surface.tsx` is lane 4's surface (session B) and I
edited it.** R2's second half lives there and nowhere else. I took the kickoff's
first option deliberately:

- The Runs side alone **cannot** fix it. Runs cannot tell "this run produced zero
  drafts" from "this run is outside the plan window" — the feed hydrates every
  run's drafts server-side but exposes only `draftsComplete` and `waiting`, so
  distinguishing them needs a widened wire (`RunFeedItem`), which the frozen
  window and lane-disjointness both argue against. **Reported, not done.**
- The change is ~40 lines, additive, and appears only on a miss: an unmatched
  `?run=`/`?draft=` sets `deepLinkMiss` and renders a `role="alert"` band naming
  what was requested, with `Back to Runs`. The fallback selection still stands —
  it is just no longer silent.
- No live conflict: lane 2 is disjoint, lane 4 does not start until s79. **s79
  lane 4 must rebase onto this.**
- Reproduced on live data before the fix: run `7bc5254e-…` is `status=failed` with
  zero drafts, and `/app/approve?run=7bc5254e-…` selected an unrelated run's draft
  under live Approve/Reject/Edit controls.

## Screenshot gate — NOT run (per the lead's correction mid-session)

The lead corrected the kickoff: `shoot-surface.mjs` targets `localhost:3111`,
which serves **main**, so it would have handed me a false pass, and `next dev`
cannot run in a lane at all. Below is what the lead's gate should look for.

**Leads** (`Leads.dc.html`)
- Header band gains three controls **between the pills and the List/Board seg**:
  a ~178px find box, then two `.sel-ctl` chips ("Active leads", "Best fit first").
  Left half (headline + `N scored` + `N hot · follow up`) unchanged; the seg and
  `Import contacts` keep their rightmost slots. Board tab hides all three.
- Dossier `card-head` gains two `btn-ghost btn-sm` buttons before the `#id` stamp
  ("Mark hot"/"Clear hot", "Dismiss"). Title, `follow up` pill and stamp unmoved.
- Outreach band: the judge pill is now a link and gains a trailing ` →`. On a
  **blocked** draft only: a red line above the `.mail` box, Copy body drops from
  primary to quiet, and "Open in your mail client" is a quiet unarmed span. A
  **passed** draft's band must be byte-identical to before.
- List rows, `.mail` box, reasons grid, Activity column: unchanged.

**Board** (`Board.dc.html`)
- Header band gains two `.sel-ctl` chips before the `the pipeline as columns…`
  label.
- **Columns now grow to the full `.cols` height** (798px at 1440×940 vs 620px
  before) — this is the biggest visual delta in the lane. Short columns must still
  hug their content exactly as the sheet draws them; the ~136px of dead space
  under the tallest column should be gone.
- Composing / At-the-judge / Approved card titles now begin `LinkedIn · `,
  `Blog · ` etc. Waiting column titles unchanged.
- The overflow note reads `12 of 25 shown — open the queue for the rest →` with a
  link, in `.col-note` type. Waiting header count may now read the pulse's number.

**Runs** (`Runs.dc.html`)
- Header band gains a ~190px find box + two chips, **left of** the
  All/Failed/Published seg, which keeps its rightmost slot.
- Row leads change from `Fan-out · Video` to `<subject> · Video`, one line,
  ellipsised. Row height, thumb, pill, timestamp and Retry/Open → unchanged.
- No visual change from the Enter guard.

**Approve** (cross-lane): a `role="alert"` band above the `.split`, present only
when a deep link missed. Absent at rest — the resting render is unchanged.

## Tests — every fix pinned, every ratchet revert-checked

**+41 tests.** Each was run against the reverted fix to prove it fails without
it — L2, L3, L4, B1, B2, B3, B4, R1 and the Approve band all confirmed. Two
existing tests were updated where they pinned the OLD behaviour (`runs-model`
lead string, board Composing title) and two row-queries rewritten (they matched
`/^Fan-out · /`, which R3 deliberately breaks).

New file: `board/__tests__/board-css.test.ts` — B2 is pure CSS and jsdom computes
no layout, so it is pinned as a stylesheet assertion on the *rule* (a column body
is bounded by its container, never a constant), not the number.

Also fixed while in there: `runs.test.tsx` never reset its module-scoped `push`
mock, so any "never navigated" assertion would have passed or failed for the
wrong reason. `beforeEach(() => push.mockClear())` added.

## Verify

`npm run verify` — **291 files / 2239 tests passed, 9 skipped, 0 failed; typecheck
and lint clean.**

Two things worth recording:
1. **The typecheck caught a real error the suite did not** — a new test fixture
   used `{ updated, failed }` where `TriageResult` is `{ done, failed }`. Green
   vitest, red build. Fourth time on record; the gate is `npm run verify`, never
   `vitest` alone.
2. An earlier run showed **4 failures in `packages/judge`** — all 30s timeouts in
   grounding/identity-grounding/cadence/pipeline, none touched by this lane. Load
   average was ~13 (36 verify agents + lane 2 + the suite). `--project judge`
   alone: 9 files / 70 tests green. They are load-induced timeouts, not
   regressions, but the lead should expect them if the merge-gate suite runs while
   another lane is live.

## Deliberately left

- **Mediums and lows** (32 across my three surfaces) — s80's, per the plan, and
  now genuinely stale against this code.
- **One medium pulled FORWARD**, stated for the record: Enter on the published
  live-page link fired two navigations (`runs.tsx:310`). It is fixed, because the
  R1 guard lands in that exact code path and half a fix there is worse than none.
- **`RunFeedItem` needs a `drafts` count** for Runs to distinguish "zero drafts"
  from "outside the plan window" without the Approve-side band. Additive, one
  server-side line (`listRunsFeed` already has the array in hand) — belongs in the
  next contract window, not this session.
- **`dashboard/needs-you-card.tsx:60-65` carries the same unguarded Enter binding
  as R1.** Dashboard is lane 3 (s79). Fix is one line, the same guard.
- **`PLAN_RUN_WINDOW` (20) vs `PULSE_RUN_WINDOW` (50)** — B3 is fixed at the
  surface (one number, honestly disclosed), but the two windows still disagree at
  the source, and the Dashboard carries the sibling symptom
  (`dashboard.tsx:252-254`). Reconciling them is a shared-lib decision with a
  read-cost implication — the lead's call, not a lane's.
- **`.sel-ctl` is restated in three surface stylesheets.** `workspace.css` is
  lead-owned and the shared-component escape hatch is a pinned ratchet test, both
  off-limits to a lane; README rule 6 wants surface-scoped rules anyway (`.col*`
  is already restated between board.css and leads.css for the same reason).
  Promoting it into the shell is the lead's call.
- **Two `impeccable` hook findings left unchanged** — `.mail` font-size 13px and
  `.l-bar` radius 2px in leads.css, plus `.k-thumb` 5px/9px in board.css. All are
  pre-existing lines ported 1:1 from the sheets' helmets, outside my diff; under
  DOCTRINE 0 the sheet's bytes win over the DESIGN.md ramp. Nothing suppressed.

## Sequence gate — honoured

No publish path was exercised and none was armed. The L2 fix moves in the
opposite direction: it **closes** the one path by which ungated copy could have
left the workspace.
