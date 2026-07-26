# WRAP — s78 lane 2: `calendar · settings (+integrations) · profiles`

Branch `s78-lane2-calsetprof`, off `b78f1bc`. **NOT merged** — the lead
merge-gates on rebase + `npm run verify` on merged main.

Verify-and-fix lane. **11 blocker+high findings verified adversarially, 8
survived and are fixed, 3 were killed.** Plus the founder's named
re-introduction: `/api/calendar` **is in scope and is armed**.

---

## Round 1 — what verification KILLED

33 refuters (11 findings × 3 distinct lenses: `code-truth` mechanism ·
`by-design` intent · `consequence` impact at real density), each defaulting
`real:false` and prompted to refute. Majority survives.

| id | finding | votes | verdict |
|---|---|---|---|
| C1 | wrong day marked "today" on every navigated week | 3/3 | SURVIVES |
| C2 | time grid clips with no scrollbar | 3/3 | SURVIVES |
| **C3** | **`.sel` styled only for `.ev-plan`** | **1/3** | **REFUTED** |
| **C4** | **j/k walks into events with no box** | **1/3** | **REFUTED** |
| C5 | "+N more" is a dead end | 2/3 | SURVIVES |
| C6 | agenda rows carry no date | 3/3 | SURVIVES |
| S1 | Instagram walks a paste into a refusing driver | 3/3 | SURVIVES |
| S2 | "Connected" never says ARMED | 2/3 | SURVIVES |
| P1 | save deletes `identity.style` | 3/3 | SURVIVES |
| **P2** | **Voice step renders an authored voice blank** | **0/3** | **REFUTED** |
| P3 | review shows a tone the save deletes | 3/3 | SURVIVES |

### The three kills, and why

- **C3 — `.sel` only styles `.ev-plan`.** The CSS fact is true, but the
  consequence does not follow. `.ev-plan.sel` is a **byte-true port of the
  sheet's only selected-state rule** (`Calendar.dc.html:36`), and selection is
  not silent: `DetailCard` opens for **any** selected kind naming its lead,
  weekday, clock and excerpt, the box carries `aria-pressed`, and the
  `aria-live` region announces every move. The operator gets a large, correct,
  immediate response. What survives is a cosmetic inconsistency — **a low, off
  by two bands**, logged for s80.
- **C4 — j/k walks into undrawn events.** The set difference is real, but every
  member is honestly represented: waiting items are amber chips in the lane,
  out-of-window items are counted verbatim by the quiet bands beside an expand
  toggle, and the popover never opens on nothing. Decisively, **the proposed
  fix was actively wrong**: `+N more` was inert, so *the keyboard walk was the
  only route to the overflowed waiting drafts*. Narrowing `ordered` would have
  **removed the one working path**. Fixing C5 is the correct answer to the same
  concern, and it shipped.
- **P2 — Voice step renders an authored voice blank.** Unanimous kill, and the
  repo already pinned the opposite: `profiles-surface.test.tsx:121` seeds
  `{tone:["Confident","Concrete"], sample:"…"}` and asserts both render. The
  step hydrates from `readVoice` on mount and prints a free-text tone verbatim.
  The only blank shape is a voice holding *neither* `tone` nor `sample`, which
  nothing in the product writes. Residual: voice keys the wizard doesn't own
  are carried but never displayed — **a low**, logged for s80.

**That is a real fraction killed — 3 of 11 — and one of the three carried a
fix that would have made the surface worse.** The gate earned its cost.

### Corrections the verification forced on the surviving fixes

These changed what I built. The walker's sketches were wrong in detail:

- **C1** — the now-line's *position* was always honest (real clock); the defect
  is its **gate** (`days.some(d => d.isToday)`, permanently true). And the
  carry is direction-dependent: paging forward dumps everything on the fake
  day, paging back **silently drops** it. Fixed at both.
- **C2** — "clips at 18:38" is viewport-dependent. At the spec 1440×940 the
  *collapsed* week fits (~790px in ~797px), which is why the sheet and the
  screenshot gate never caught it; the **expanded** state is the severe one,
  cutting ~409px and hiding roughly 15:00–24:00 while the band says "quiet
  hours · shown". The fix is therefore about real density, not resting geometry.
- **C6** — scope is narrower than "agenda rows": only carried `kind:"you"` rows
  can be out of range. But reachability is **wider** — one click on `›` makes
  every waiting item carried. `MonthMark` had the identical gap and is fixed too.
- **S1** — the sheet **already drew the caveat and the rebuild dropped it**:
  `Integrations.dc.html:77-79` gives Instagram pill "Almost ready" and sub-line
  "Needs public image URLs — shipping — then the Graph connect". So restoring a
  capability line is sheet-faithful, not invention. Two further corrections:
  the refusal is **unconditional, media included** (`SocialPostInput.media`
  exists; the driver still throws), so the copy states today's truth; and the
  sharpest defect is **post-connect**, where `ROLE_VERB.social` made the card
  assert "Posting as @handle" for a driver that never posts.
- **P3** — the sketch (branch on `tone.length`) would have broken a pinned
  behaviour. The row lies in **both** directions, so it now renders from the
  object `writeVoice` actually produces — the review cannot disagree with the
  save.
- **P1** — scope is wider than `style`: every identity catchall key was dropped,
  and `renderBrandIdentity` feeds extras into **both the generation prompt and
  the judge's grounding chunk**, so the save silently changed what the judge
  grounds against. Also lost on **load**, not only on write.

---

## Round 2 — what shipped

Every fix has a test that fails without it (**revert-checked**, individually).

### Profiles

- **P1 [blocker] — silent data loss on save.** `formToConfig` rebuilt
  `identity` from the eight form-backed keys, dropping every catchall key.
  `brandIdentitySchema` is `.catchall(z.unknown())`, `identity.style` is read
  by `packages/engine/src/render/composition.ts` `deriveBrandStyle` (the video
  render's brand colours), and a verifier found the **live dev DB's active
  `self` profile carries it** — so one Save wrote a version without it and the
  next render silently fell back to the generic accent. The carry now keys on
  what the form **owns**, so a key added later rides through without a fourth
  live loss. *Third instance of one disease* (top-level blocks 2026-07-14, the
  window-2 pair 2026-07-19, identity's catchall now).
  Test asserts the **class**: an arbitrary unknown key (`mascot`) survives the
  round trip, not just the named field.
- **P3 [high] — the review row asserted a tone the save would delete.** Now
  derived from `writeVoice`'s own output. Two tests, both directions.

### Calendar

- **C1 [blocker] — the clock decides which day is today**, re-flagged against
  `now` exactly as `monthCells` already did. Kept **local to the surface**:
  `weekDays` is shared with Dashboard and Runs (lane 3 / lane 1) and they pass
  the real clock correctly, so its signature is untouched — no cross-lane risk.
  Second half: `waitingEvents`' `?? days[0].key` fallback gave a today-less
  range a carry target; a range with no today now carries nothing.
- **C2 [blocker] — the grid could clip with no scrollbar.** `.cal` was
  `flex: 1` inside a `flex: 1; overflow: hidden auto` column, so it sized to
  free space and clipped — including the `21–24` band that *carries the hidden
  count*, so the cue that anything was lost was itself the thing lost. Now
  `flex: 0 0 auto`, so the surface's own scroll contract applies.
- **C5 [high] — both "+N more" markers are real controls.** Week lane → opens
  Agenda at "Needs you" scope (lists every waiting item, each with its Approve
  link); month cell → opens that day's week. Keyboard- and touch-operable;
  the old disclosure was a mouse-only `title`.
- **C6 [high] — carried rows disclose the carry**, in two channels: the true
  date in the stamp column, and the week lane's own words. `MonthMark` fixed
  in the same change.
- **`cursor: grab` (low, named in-scope by the kickoff).** Drag is still not
  wired, so no box advertises one: cursor is `pointer` and the `⋮⋮` grip is not
  drawn. Both restore in the change that wires drag.

### Settings + Integrations

- **S1 [high] — Instagram's capability, stated before the paste.** A
  per-destination capability note, in the sheet's own voice at today's truth,
  rendered in **every** state. And a driver that cannot do its class's job no
  longer claims the class verb: the card reads "Connected as @handle", not
  "Posting as @handle".
- **S2 [high] — ARMED is now on the card.** The card enumerated every *other*
  rung of "will this post" (plan gate, expiry, re-auth, env seat), which made
  it read as the complete ladder while omitting the top one. `armed` +
  `armedReason` now ride the read model, rendered as a worded pill
  (never colour-only) plus its reason, and only where a credential exists.
  **The derivation is shared, not duplicated**: `socialArmed` was extracted in
  `social-arming.ts` and the publish ratchet now uses the same function — two
  spellings of "armed" would have been two truths, and the surface's would be
  the one never tested against a real post. `null` for classes that never post,
  and for a plan-gated seat (the plan gate outranks it).

---

## `/api/calendar` — VERDICT: in scope. Built, wired, tested.

**Evidence that it needed no table, no contract and no migration:**

| piece | where | status |
|---|---|---|
| `planned_slots` table | `packages/db/drizzle/0015_phase1_window.sql` | shipped s61 |
| `plannedSlotSchema` | `packages/contracts/src/workspace.ts:19` | shipped |
| `plan` / `unplan` / `listRange` repo | `packages/db/src/repos/planned-slots.ts` | shipped, with the `(tenant, draft)` unique making `plan` an upsert |
| events in the same transaction | `draft.slot_planned` · `slot_replanned` · `slot_unplanned` | pinned in `phase1-window-repos.test.ts:68-70` |
| tenancy | table listed in `tenant-id.test.ts:34`; foreign draft throws `NotFoundError` | shipped |

So the only missing piece was the route. Added
`apps/web/src/app/api/calendar/slots/route.ts` (POST upserts = plan **and**
reschedule; DELETE unplans), plus `planSlot`/`removeSlot` clients, and wired
**Reschedule** and **Remove** in the detail popover — which previously rendered
disabled with "the planned-slot store has a read route only".

`DetailCard` is now **keyed by the selected event**: it holds a mode and a
typed instant, and that state must not outlive the plan it describes.

**Drag is deliberately NOT wired.** I cannot render-verify from this worktree
(see below), and shipping unverified drag-and-drop on a time grid blind is
worse than not shipping it. The route is what unblocks it; the cursor and grip
tell the truth in the meantime.

**A slot is a plan.** Writing one publishes nothing and arms nothing. No
publish path was exercised, no platform API called, nothing armed — the
sequence gate held.

---

## Expected visual deltas — for the lead's merge-time gate

Per the lead's correction: **I did not run `shoot-surface.mjs`.** It targets
`localhost:3111`, which serves the lead's dev server on **main**, so it would
have rendered unchanged code and returned a **false pass**; and `next dev`
cannot run inside a lane at all (Turbopack rejects the out-of-root
`node_modules` symlinks — `WRAP-videos-rebuild.md:207`). What follows is what
your gate should look for instead.

### Calendar (`/app/calendar`, `Calendar.dc.html`)

1. **Plan boxes lose the `⋮⋮` grip.** Sheet-visible change. Top-right of every
   dashed plan box. Everything else about the box is unchanged.
2. **Cursor over an event box is `pointer`, was `grab`.**
3. **The week card now takes natural height and the page scrolls if it
   overflows.** At the sheet's resting 1440×940 the collapsed week **should
   still look identical** — it fits (~790px in ~797px). The visible difference
   appears only when content exceeds the viewport (press **expand**: you should
   now be able to reach 21:00–24:00 by scrolling, where before it was cut with
   no scrollbar).
4. **Navigate to any other week: no day is tinted, no "· today", no red
   now-line, and the waiting lane shows only that week's own items.** The
   current week is unchanged.
5. **`+N more` renders as a control** (still the sheet's `.lane-more` text
   style, so it should look the same at rest) — week lane and month cell.
6. **Agenda: a carried row's stamp reads a date ("14 Jul 09:00") instead of a
   weekday**, and its sub-line is prefixed "started waiting before this week ·
   Nh —". Only carried rows change; in-range rows are untouched.
7. **Detail popover on a plan: Reschedule/Remove are enabled**, and Reschedule
   reveals a `datetime-local` field + Move/Cancel inside the 184px popover.
   **Worth your eye — this is the one band I could not measure.** The popover
   is narrow and the native date control may crowd it.

### Integrations (`/app/settings/integrations`, `Integrations.dc.html`)

8. **Social cards gain a second pill** ("Armed" / "Not armed") beside the state
   pill in `.int-head`, plus one extra `.int-sub` line with its reason. Only
   where a credential exists. This is a **band-density change** in the card
   head — check the head still fits on one line at the sheet's card width.
9. **Instagram gains a warn-toned `.int-sub` capability line** in every state.
   The sheet drew this caveat (as pill + sub-line); I kept the engine-derived
   state pill and put the caveat in a sub-line, so the card is one line taller
   than the sheet's.
10. **A connected Instagram card reads "Connected as @…" not "Posting as @…".**

### Profiles (`/app/profiles`, `Profiles.dc.html`)

11. **Review step, Voice row wording only** — may now read "tone cleared —
    this save removes it", or a stored free-text tone where it previously
    showed derived chips. No layout change.

---

## Deliberately left

- **The mediums and lows are s80's**, per the plan — not verified, not fixed.
- **Drag-to-reschedule** — see above. The write route it needs now exists.
- **C3 / C4 / P2 residuals**, demoted to lows for s80 (below).
- **No `armedReason` door.** Verification established there is nowhere to route
  to: no surface shows or edits the tenant social block (Profiles only names it
  as a carried block). A worded state is the honest fix; a link would be a new
  dead door.

## New findings for the s80 pile

Discovered while verifying; none fixed, none verified beyond one lens:

- `[low]` The `" sel"` class is appended to every event kind but only
  `.ev-plan.sel` is styled — a dead class on four of five kinds (C3 residual).
- `[low]` The detail popover **mis-anchors** for an out-of-window event: `top`
  clamps, so a 03:00 pick parks the card at the 06:00 row, pointing at a slot
  holding no such event (C4 residual).
- `[low]` Voice keys the wizard does not own (e.g. `persona`) are carried
  verbatim through every save but displayed nowhere — the `CARRIED_BLOCKS`
  treatment exists one panel over (P2 residual).
- `[low]` Calendar ships no visible `keys ·` legend, unlike its sibling triage
  lists, so j/k is undiscoverable here.

## Two things the lead must see

1. **I touched one lead-owned file.** `apps/web/src/components/__tests__/keyed-by-entity.test.tsx:271`
   — widening `WireIntegrationCard` broke its compile, so its `intCard` fixture
   gained `armed: null, armedReason: null`. **Compile-only: no assertion
   changed and the pin still tests exactly what it did before.** I made the
   change rather than hand you a red typecheck, but it is yours to review.
   Nothing else on the do-not-touch list was modified: `workspace.css`,
   `packages/contracts/**` and `packages/db/**` are untouched.

2. **A factual error in the sheets README, which a future lane will cite.**
   `README.md:82-96` justifies the "+N more" ruling with *"the sheet ALREADY
   uses that treatment in its own waiting lane."* **It does not** —
   `Calendar.dc.html` contains no "+N more" anywhere (its waiting lane draws a
   single un-capped `.amber-chip`), and **no sheet in the set does**;
   `.lane-more` and `LANE_CHIP_BOUND` are the rebuild's own inventions, and the
   code comment at `calendar-surface.tsx:44` ("the sheet bounds a day cell at
   what it can show") is not true of the sheet either. **The ruling itself
   stands** — it is the founder's/lead's call and I did not reopen it, and the
   other half of its reasoning (clipping a name mid-word loses information with
   no cue) is sound and sufficient. Only the sheet-precedent claim is wrong.
   Worth correcting so nobody builds on it.

---

## Verify

`npm run verify` (test → typecheck → lint), run from the worktree, written to
a file and read — never piped through `tail`.

- **typecheck: PASS** (exit 0, all workspaces). It caught two real errors the
  green vitest run had not — the fourth catch on record for "vitest does not
  typecheck".
- **suite: 2231 passed · 9 skipped (2240) across 291 files passed · 4 skipped.
  0 failed.**
- **lint: 0 errors, 8 warnings** — all pre-existing and all in files this lane
  never touched (`api/health/route.ts`, the landing `page.tsx`,
  `components/ui/empty-art.tsx`).
- **`npm run verify` exit 0.**

The full run showed **no hook timeouts** — by then the box had quietened.

Note for the lead: mid-session the box hit **load average 17.6 on 6 vCPUs**
(this lane, lane 1, `next-server`, chrome), and under that load `beforeEach`
DB spin-ups blew their 10s hook timeout — including on *pure* tests that touch
no database. Every one of those files passed when run alone. If the merge-gate
suite shows scattered `Hook timed out in 10000ms`, that is contention, not
these changes.
