# WRAP — s79 lane 4: `approve · create · intel · videos`

Branch `s79-lane4-approvecreateintelvideos`, based on main `d5c46c4`. **Not
merged** — the lead merge-gates on rebase + `npm run verify` on merged main,
then measures the rendered surface.

## Round 1 — the verify gate: 11 findings, 11 survived, 0 refuted

**I ran this gate INLINE and DROVE THE LIVE APP, rather than fanning out
reading-only refuters.** Two reasons, both deliberate:

1. `thalon-check` says the fan-out version "needs the founder's explicit
   opt-in", and the s79 boot approval covered the lane launch, not a
   ~33-agent verification fan-out inside it.
2. It is strictly stronger for this pile. The s78 retro named the harness gap
   itself: *"`fe-check` has no interaction driver — it reads code and refutes
   claims, so it cannot see a capability that is absent rather than wrong."*
   Every finding below was checked against the **running app on
   `localhost:3111`** (which serves main = this branch's base), by doing the
   job the finding describes. Six are now **measured**, not argued.

Lenses per finding, all defaulting to `real:false`: **code** (does it literally
do this) · **by-design** (honest refusal / sheet-faithful / served elsewhere) ·
**repro** (does it happen on today's real data).

| id | finding | verdict | how |
|---|---|---|---|
| I1 `blocker` | dossier's primary exit lands on a refused Generate, and it is the pre-picked one | SURVIVES | **driven** |
| I2 `high` | "ride without an angle" is false — the seam re-attaches the first | SURVIVES, **WIDER** | **driven** |
| I3 `high` | "Target this" defaults to a family Create can't generate | SURVIVES | **driven** |
| A1 `high` | "13 waiting" beside "Approve all waiting (2)" | SURVIVES | **measured** |
| A2 `high` | a staged row kills j/k/a/r/e while the footer advertises them | SURVIVES, **WORSE** | **measured** |
| A3 `high` | both grounding tiers labelled "Grounding" | SURVIVES | **measured** |
| C1 `high` | "Advanced · staged flow →" is a dead path | SURVIVES, **NARROWED** | driven |
| C2 `high` | Intel's suggested exit lands on a disabled Generate | SURVIVES (= I1) | **driven** |
| C3 `high` | a failed profile read renders as "no active profile" | SURVIVES, **WIDER** | **measured** |
| C4 `high` | Grounding row lost the sheet's "view sources" door | SURVIVES | **measured** |
| V1 `high` | card "4 aspect cuts" vs dossier "none yet" | SURVIVES, **WIDER** | **measured** |

**Nothing was refuted.** Same result lane 1 got, and the same caveat applies:
this pile is blocker+high only, every item arrived with a file:line a walker
had already read. The gate still paid for itself — **four findings changed
shape**, and two of those changed the fix.

### The four that changed under verification

- **A2 is much worse than reported.** The finding said the keyboard grammar
  lies. Measured: a staged WAITING draft has **zero decision verbs anywhere in
  the right pane** (29 buttons, none of them approve/reject/re-judge/edit),
  `a`/`r` are gated off, the footer advertises all five keys, and **three
  separate strings tell the operator to act "from the draft panel" — the panel
  that pane replaced**, one of them sending them to Approve, the surface they
  are already on. On today's data that is **11 of the 13 waiting drafts with no
  way to decide them at all**. See "For the founder" below — the copy is fixed,
  the capability hole is his call.
- **C3 is wider.** With `/api/profiles` cut, the surface paints **five**
  positive claims about a profile it never read: "no active profile · these are
  the engine's own defaults", "none in your profile yet", "not set", "no terms
  yet", and — the sharp one — **"Denylist · empty · grounding · every gate
  on"**, against a real profile carrying **six** denylist terms. A broken read
  told the operator they had no term protection.
- **V1 is wider.** Live on `thalon-concept-film`: the card's four "aspect cuts"
  all hang off `concept-film-16x9 v6`, not off the headline — and the headline
  cut is **itself a recut, counted among its own derivatives**.
- **I2 is wider.** It is not only the toggle-off case. Promoting with **zero
  angle clicks** seeds the Create prompt with `Angle: <angles[0]>` — measured
  end-to-end: Intel → `Create post · suggested` → Create's prompt box.
- **C1 is narrowed.** The door is not dead — it navigates. The defects are that
  the label promises a staged **authoring** flow that does not exist (the
  sheet's own `href="#"` was never wired), and the typed brief is discarded on
  the way. Fixed as a labelling fix, not a routing one.

## Round 2 — what shipped

**Intel** (`components/intel/**`, `lib/intel/store.ts`)
- **I2** — the two defaults are split at the seam: `pickRequired` keeps
  default-to-first for the title ("one always rides", as the card promises),
  `pickOptional` returns undefined for an unpicked angle. An explicit
  out-of-range index still refuses with a 400 rather than falling back.
- **I1** — `leadingExit`: the primary slot goes to an exit Create can actually
  run. The editorial suggestion is **not** overwritten — same word, same
  reason, demoted to a ghost that still says `· suggested`. All three exits
  stay one click and all three still promote.
- **I3** — the horizon card's footer names what waits at the other end,
  derived from the same seam.

**Approve** (`components/approve/**`, one string in `components/staged/`)
- **A1** — `batchScopeNote`, a pure helper: `1 of 2 waiting can be approved
  together — 1 staged draft advance through their own flow.` It names a
  narrowing filter separately, so staged work never explains a gap it did not
  cause, and it is absent entirely when the counts agree.
- **A2** — `j`/`k` are off the master gate (**navigation is never owned by the
  detail pane**); `a`/`r` stay gated and the legend now says so, with `a r e`
  dimmed via a scoped `.kbd-off`. The three "draft panel" strings are gone.
- **A3** — `checkLabel(mark.gate)` replaces `mark.label.split(" — ")[0]`. The
  panel reads `Denylist / Grounding — screen / Grounding — final`, which is
  what the composite note under it has always been describing.

**Create** (`components/create/**`, `lib/create/families.ts` — new)
- **C3** — three states, not two (`reading | read | failed`), a red honest
  line, a `Try again`, and every row that used to assert an absence now says
  `unread`. The Judge row separates the structural gates (always on) from the
  profile's denylist (unread).
- **C4** — the sheet's `view sources` door restored as `view source ↗` on the
  Grounding row. It reads the **pruned** context, so dropping the source field
  drops the door with it.
- **C1** — `advanced staged authoring isn’t wired yet` + `Staged runs in
  Approve →`.

**Videos** (`components/videos/videos-model.ts`, `dossier.tsx`)
- **V1** — the card's aspect count is scoped to the cut it speaks for
  (`derivedFrom`), obeying the card's own already-documented one-rule doctrine.
  So nothing is hidden by that narrowing, the dossier's empty band now reads
  `none from this version · N elsewhere in this project, from <parent> v<n>`,
  with `soleParentOf` refusing to guess a parent when they disagree and
  `derivedElsewhere` never counting the cut you are looking at (it is itself a
  recut on the live project — the same self-counting trap as the card).

## The Intel↔Create decision, and exactly what state the arming is in

**One finding wearing three rows (I1 + I3 + C2), fixed as one decision.**

The cause was structural: `CreateSurface` hard-coded `armed = family ===
"video" || …` while **three upstream doors independently chose which family to
hand it**, and none could see the refusal waiting at the other end. So the fix
is a seam — **`apps/web/src/lib/create/families.ts`** — that owns the single
answer to *"can Create generate this, and if not, what do we say"*. Create's
button, Create's honest line, Intel's dossier exits and Intel's Target this all
read it. They can no longer drift apart, and **one edit updates every sentence
on both surfaces.**

**⛔ I did NOT arm post/page generation. Read this before assuming otherwise.**

The kickoff said the honest fix *may* be arming the door, and to build the
arming disarmed. I built the seam and the honest journey, and stopped short of
authoring the generation service. Stated plainly so you can overturn it:

- **The engine halves already exist** — `runFanout` (post) and
  `runWebPageGeneration` (page), both exercised by `scripts/create-posts.ts`
  and the eval dogfood. What is missing is only the route + service between
  them and the surface, mirroring `/api/create/video`. The seam's docblock
  names that exactly.
- **Why I stopped:** your sequence gate defers activation anyway, so an armed
  door delivers an operator **nothing today** — while adding ~200 lines of
  spend-path code I am forbidden to execute even once. Untested generation
  code that looks built is worse than an honest seam. It is also a build
  bucket (B3.15 is chartered; a Create fan-out door is not).
- **Your call, cheaply reversible.** If you want it built disarmed anyway, say
  so and it is one focused session against a seam that is already in place.

Nothing on this branch spends a token, calls a platform, or publishes.

## Carried work — the unmatched `?run=` honesty

Verified lane 1's shipped `role="alert"` band against its own instruction. It
is correct for every case it reaches — and **it did not reach the most obvious
one**: the deep-link check sat after an early return on an empty queue, so a
`?run=` that missed on an **empty** queue said nothing at all. Fixed (the guard
now only covers a failed read, which the queue card reports itself) and pinned.

Lane 1's other deferral stands untouched and is still right: `RunFeedItem`
needs a `drafts` count for Runs to distinguish "zero drafts" from "outside the
plan window" without the Approve-side band. **Contract window — frozen. Not
mine.**

## Jobs driven vs deferred

**Driven end-to-end on the live app (pre-fix, `localhost:3111` = this branch's
base) — this is the verification, and it is what found the four reshapes:**

- Intel → picked no angle → `Create post · suggested` → landed on Create →
  read the seeded prompt and the pick panel → confirmed the unpicked angle rode
  and Generate was disabled.
- Intel → Search → `Target this` on the top horizon card → landed on Create
  with family `Page` and Generate disabled.
- Approve → measured both counts → selected a staged waiting row → pressed `j`
  (dead) → selected a plain row → pressed `j` (moved 1→2, the control) →
  enumerated the staged pane's 29 buttons for decision verbs (none).
- Approve → selected a real blocked draft → read the reasons panel's gate
  column and the composite note under it.
- Create → forced `/api/profiles` to fail → read all six rows.
- Videos → grid card → dossier → compared the family line to the aspect band,
  then read the project's real cut lineage from `/api/videos/<id>`.

**Deferred — I cannot drive my own fixes.** `next dev` will not run in a lane
and `shoot-surface.mjs` refuses from a worktree (both correctly). Every fix is
pinned at the DOM level by jsdom tests, but **layout, the dimmed `.kbd-off`,
and real navigation are unverified.** Drive script for the merged-main gate:

```
# A1 + A2 — /app/approve
1. Read the header pill and the bulk button. The new sentence under them must
   name the difference and the numbers must add up.
2. Click a "Video · direction" row with a Waiting pill.
   → the a/r/e chips dim, the legend gains "a · r · e aren't wired…"
   → press j: the selection MUST move off the row (this was dead)
   → press a: nothing happens, and nothing on screen claimed it would
   → the staged pane must not mention a "draft panel" anywhere
3. Click a plain row: no dimming, no sentence, a/r work as before.
4. /app/approve?run=aaaaaaaa-0000-0000-0000-000000000000 → the alert band.

# A3 — /app/approve
5. Select the blocked "Three Claude releases…(Opus 4.8 in May…" LinkedIn row,
   open "reasons on record": the gate column must read
   Denylist / Grounding — screen / Grounding — final.

# I1 + I2 + C4 — /app/intel → /app/create
6. On the top dossier card, pick NO angle. The primary button must read
   "Create video"; "Post · suggested" must still be there as a ghost with its
   reason; the footer must name post and page as unwired.
7. Click it → on Create, the prompt must carry NO "Angle:" clause, and the
   Grounding row must show "view source ↗" pointing at the capture's URL.
8. Open the pick chip, Drop "source" → the link disappears with the field.

# I3 — /app/intel?tab=search
9. A horizon card's footer must name page generation as unwired.

# C3 — /app/create with the profile route blocked (devtools)
10. The head must read "Couldn't read your profile…", every row "unread", and
    the Judge row "Denylist unread" — never "Denylist · empty".

# V1 — /app/videos
11. thalon-concept-film's card must no longer say "4 aspect cuts"; open it and
    the aspect band must read "none from this version · 3 elsewhere in this
    project, from concept-film-16x9 v6".
```

## Expected visual deltas

- **Approve header**: one new `t-label` line under the header band, present
  only when the waiting counts differ. Absent when they agree.
- **Approve queue footer**: `a`/`r`/`e` at 45% opacity plus a leading sentence,
  **only** while a staged row is selected. Resting render byte-unchanged.
- **Approve reasons panel**: the gate column widens in content only
  ("Grounding" → "Grounding — screen"). `.reason-gate` is a fixed 132px; **the
  lead should check the longest label does not clip at that width.**
- **Create header**: the right-hand link changes text and gains a `t-label`
  before it — the row is now two elements, not one.
- **Create Grounding row**: gains a `card-link` between the value and the
  `t-label`, matching Platforms/Discoverability.
- **Create plan card head**: gains a `Try again` button in the failure state
  only.
- **Intel dossier footer**: the primary button's word changes
  (`Create post · suggested` → `Create video`), the ghost row gains
  `· suggested`, and the trailing `t-label` grows a clause — **this line may
  now wrap; worth a look at 1440px.**
- **Videos grid**: `thalon-concept-film` loses its "· 4 aspect cuts" segment.
- **Video dossier**: the aspect band's sub-label grows a clause.

## ⚠️ For the founder — one capability hole, found by driving, not reading

**11 of the 13 drafts the workspace says are waiting on you cannot be approved
or rejected by any means.** They are one-prompt video stage artifacts
(`direction` / `storyboard`). They count toward `needsYou` — the rail's "Needs
you · 25", the pulse, the Board — but their detail pane is read-only and offers
no verb, and batch approve deliberately skips them.

This lane made that state **honest** (the copy no longer sends you to a panel
that does not exist, and the legend no longer advertises keys that do nothing).
It did **not** invent a decision path, because the right answer is a product
call, not a lane's:

- **(a)** stage artifacts are intermediate and should not count as work waiting
  on you — fix the counts; or
- **(b)** they are decisions and need approve/reject on the staged pane.

This is the same shape as the calendar: reading the code says "consistent",
using it says "the verb is unreachable". It wants your ruling.

## Verify

`npm run verify` — **296 files / 2340 tests passed, 9 skipped, 0 failed;
typecheck clean; lint 0 errors** (8 pre-existing `<img>`/unused-var warnings,
none in this diff). Written to a file and read from the file — never piped
through `tail` — and the gate is the whole script, since `vitest` does not
typecheck.

**+44 tests** (45 added, 1 replaced), one new file
(`approve/__tests__/draft-card.test.tsx`) and one new module's suite
(`lib/create/__tests__/families.test.ts`).

> **Process note the lead should not repeat.** I burned two verify runs by
> editing files while the suite was mid-flight, and the second run's redirect
> truncated a log the first run still had an open fd on — **two writers, one
> file, a spliced log that showed a finished lint under an unfinished test
> run.** A verify is only evidence if the tree is frozen for its whole
> duration and it owns its log path. Also worth knowing: load average hit 20+
> with lane 3 live, which is exactly the condition the standing note warns
> produces phantom engine failures. This run was clean, but the lead's
> merged-main gate should run with the lanes quiet.

**Every fix revert-checked** — the fix was reverted in place and the new test
confirmed failing, for all ten: I2, I1/C2 (`leadingExit`), I3, A1, A2 (both the
keyboard gate and the legend), A3, C1, C3, C4, V1, and the empty-queue deep
link.

**Three existing tests pinned the OLD behaviour and were updated, not
deleted** — each one is annotated with what it used to pin:
- `store.test.ts` asserted `angle: angles[0]` after a promote with no
  `angleIndex`. It was pinning the I2 bug.
- `create-surface.test.tsx` asserted the `Advanced · staged flow →` text and
  the old refusal sentence.
- `intel.test.tsx` asserted `Create post · suggested` as the primary.

## Deliberately left

- **Mediums and lows** across my four surfaces — s80's, per the plan.
- **Create's brief is still discarded on navigation.** It is the s80 medium at
  `create-surface.tsx:427` and belongs with the plan card's links; fixing half
  of it here would leave s80 re-verifying a moved target. C1's label fix
  removes the *invitation* that made the loss harmful.
- **The video EDITOR** — untouched, per the kickoff. Its blocker was not added
  to my scope at boot.
- **A new finding, not fixed, for s80's pile:** the video dossier's version
  strip only lists versions sharing the picked cut's NAME, so a project's other
  cut names (`concept-film-16x9`, `concept-film-9x16`, `-scored`) are not
  reachable from the dossier at all. My V1 fix names them in the aspect band;
  it does not give them a door.
- **Two `impeccable` hook findings left unchanged** in `videos/dossier.css`
  (side-tab accent, two off-ramp colours, one off-ramp font-size). All are
  pre-existing sheet-ported lines outside my diff — under DOCTRINE 0 the
  sheet's bytes win over the DESIGN.md ramp, the same call lane 1 recorded.
  Nothing suppressed.

## Cross-directory touch — the lead should know

**`components/staged/staged-flow.tsx`** (three strings) is outside my named
file set. It is mounted from exactly one place — `approve-surface.tsx:487` —
and all three strings pointed at a panel that this component replaces, which is
the second half of finding A2. Lane 3 is disjoint from it. Flagged, not hidden.

## Sequence gate — honoured

No publish path was exercised, no platform API called, no generation run, zero
tokens spent. Nothing was armed: the one seam added is **fail-closed by
construction** — post and page report `armed: false` with a reason, and there
is no code path on this branch that can generate either.
