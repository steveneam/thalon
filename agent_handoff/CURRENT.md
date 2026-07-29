# CURRENT

## Stamp

2026-07-29 (session 87, syd4 — **zero credit spend, zero posts**). **THE WHOLE s87
BOOT SEQUENCE RAN, AND BOTH LANES ARE MERGED.** Contract window built · verified ·
frozen · merged; both approved lanes launched on the founder's GO, wrapped, and
merged through main. Final verify-on-merged-main: **exit 0, 3037 passed / 9 skipped,
0 lint errors** (s86 closed at 2840). Worktrees GC'd, branches deleted, tmux windows
killed, tree clean at `7bcd5b9`, pushed.

**HIS GO, VERBATIM, MID-TURN:** *"you also have my approval for lane-launch GO. i'll
be away for a bit. so keep working."*

**THE SESSION'S REAL STORY: BOTH LANES FOUND DEFECTS IN THE LEAD'S OWN WINDOW, AND
NEITHER TOUCHED IT.** `create-engine` found `platformRouting` accepted by the config
schema with no column and no persist line — silently dropped for every tenant, and
**the third time that identical gap has shipped** (the `outreach` docblock records it
for `outreach`, then `social`). It reported it and pinned a ratchet built to go red
the day the column landed. `analytics-spine` found `publicationMetrics.series()`
breaking ties on a random uuid. Both fixed at merge; the routing one got the ratchet
that should have existed after occurrence #1 — `brand-profile-config-blocks.test.ts`
enumerates the blocks **from the contract**, so a fourth occurrence has to get past a
test rather than past a reviewer. Red-checked by breaking the persist line.

## THE WINDOW — what landed, and the two ratchets that caught real defects

`308a94a` → merge `ff55f0f`, migration `0022_s87_window.sql`. **Purely additive**:
two CREATE TABLEs, two optional contract fields, no rename, no drop, no type
tightening. Read the SQL before merging — confirmed CREATE/ADD/ENABLE only.

- **`create_runs`** — the Brief → Plan → Generate → Composer → Approve record (spec
  R1). Holds the ask, the resolved plan, the child refs — and **deliberately not**
  the drafts, the profile version, or anything the judge decides, each of which
  already has a home a second copy would drift from. `generation_key` mirrors
  `fanout_runs` for a sharper reason here: **a Create run SPENDS**, so a
  double-clicked Generate must return the first run rather than start a second.
- **`publication_metrics`** — the `source_metrics` pattern pointed at our own posts,
  shaped around **"absence, never zero"**: no nullable value, no "unavailable" flag,
  because a platform that cannot report a metric must yield NO ROW. `platform` is
  denormalized for the per-channel roll-up but **derived from the publication by the
  repo, never accepted from the caller** — which is also what walls the tenancy.
- **Media roles `use | reference`** — the licensing wall as data. Optional on the
  envelope (pre-window media parses byte-identically; absence reads as `use` through
  the single `mediaRole()` helper), **required** at the Create attach door.
  `outputEligible()` is the one filter, so a future third role cannot land on the
  publish side by accident.
- **`platformRouting`** — family → default destinations, prefilling the wizard.
  **NOT** the existing `routing` (bucket → platforms); both may coexist and the
  docblock says why, at length, because collapsing them would be a real defect.
- **D3 per-platform settings slice** — complete over `SOCIAL_PLATFORMS`, cover frame
  on the CUT rather than per tab, registered as an optional field on the post draft
  meta so the slice has a declared home before its consumer exists.

**TWO RATCHETS FIRED, AND BOTH WERE RIGHT.** (a) zod 4's `z.record()` over an ENUM
key is **exhaustive** — the first cut of `platformRouting` refused every partial map,
i.e. a tenant routing only video could not save. Fixed with `partialRecord`; the trap
now has its own test so nobody reverts it. The repo's own `socialPublishConfigSchema`
docblock had warned about this exact thing. (b) migrate-data's `COPY_ORDER`
completeness check refused both new tables until they were placed in FK order — a
table the copy would silently skip is precisely the bug it exists to stop.

**ONE HONEST GAP, RECORDED AS A VALUE A TEST READS.** Both specs name YouTube's
title / thumbnail / made-for-kids settings. There is no `youtube` platform key, no
capability row and no driver — so a schema for it would assert a destination the
product cannot reach. It sits in `SETTINGS_DEFERRED` with its reason, and a test
fails the day `youtube` becomes real rather than letting the deferral quietly outlive
its truth. **Founder call if he wants YouTube sooner: it needs its own window.**

## THE VIDEO ARC'S LAST BLANK IS FILLED (`d8a323f`)

The video spec called Overview + Dossier "the only surfaces with zero banked
references". Swept s87; both are now banked in
`docs/research/ux-refinement-program.md` §Overview + Dossier references, with the
per-screen Mobbin links. **Do not re-search these, and do not re-search the editor
set (VEED/Vimeo/Descript) either.**

**What the sweep changed about the plan:** the five no-affordance jobs do **not** need
five inventions. Version-compare, named variants, delete-with-a-real-confirm and
published-state are all *one well-drawn version rail* — Synthesia puts the version
selector in the breadcrumb with a `PUBLISHED` pill, Adobe Express groups "Marked
versions" above the raw autosave list, Fibery's restore confirm names what you lose
and when it was from. Render-state-on-return is a badge on a card (VEED, which also
draws "No Preview Available" as a real tile — our honest-absence rule, already drawn
by someone else). **Take audition is the one genuinely separate affordance.**

## Resume prompt (session 88, syd4 — "gogogo" boots this)

**Resume · Thalon** — s87 froze the s87 contract window and shipped BOTH approved
lanes end to end: **B-create.2 (the Create run engine)** and **D2 (the own-post
analytics spine)**, merged on a green verify-on-merged-main. Nothing is in flight.
**The next action is the founder's sequencing call**, because three good candidates
are now unblocked and they are not equally urgent.

**Read first:** CLAUDE.md → this file → COORDINATION.md §s87 (the lane record + the
six lead items) → the two APPROVED specs → `docs/research/ux-refinement-program.md`.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` · `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

**The three candidates, with the honest case for each:**
1. **Video sheets pass 1** (Overview + Dossier + editor thumbnails). References are
   BANKED (s87) so this starts cold and cheap; it is the biggest remaining surface
   area and it is design, which is lead-direct and never delegated. **Held at s87 on
   BUDGET, not doubt.**
2. **B-create.3 — the Create sheets** (home update + wizard + Composer run-scope).
   The engine underneath them now exists, so the sheets would be drawing something
   real rather than something proposed.
3. **The Analytics surface** — D2 gives it real data, but **read lead item 1 first:
   the sheet's Facebook fixture is wrong** (it shows reach under a metric Meta
   retired). That has to be reconciled against the capability table before drawing.

▎ ▸ **s87 shipped:** `308a94a`+`ff55f0f` the window · `737adbb` kickoffs got "THE
WINDOW AS FROZEN" · `d8a323f` video references banked · `6b503e1` lane board ·
`5a579a4`+`bbe8131` create-engine · `783d10f` the platformRouting fix + its ratchet ·
`35bbbc5`+`8b8e8f5` analytics-spine · `7bcd5b9` the series() determinism fix.
▎ ▸ **⚠️ BUDGET WAS THE LIVE CONSTRAINT ALL SESSION:** 87% of the weekly limit at
lane launch, **resets Jul 31, 11pm UTC**. That is why the video sheets are held and
why the references were banked first — the durable half is done and the drawing can
start cold. **Check headroom before drawing anything.**
▎ ▸ **⚠️ THE ANALYTICS SHEET'S FACEBOOK FIXTURE IS WRONG** — Meta retired
`post_impressions_unique` (2025-06-15) and `post_impressions*` (2025-11-15). Reach
survives as `post_total_media_view_unique`. Read the capability table in
`packages/engine/src/social/metrics/capability.ts`, not the mock's numbers.
▎ ▸ **💸 X ANALYTICS COST MONEY** — metered pay-per-use, no free read tier.
`NEEDS-STEVEN` 2026-07-29f. Nothing has spent: the tick needs `--armed`, rides no
timer, and prints the bill before the pass. Every other platform reads free.
▎ ▸ **Six lead items** (Facebook fixture · X spend · `SOCIAL_METRICS_ARMED` when the
tick earns a timer · four `fanout_runs` per four-destination Create run, deliberate ·
no real vision driver yet · read-model is one query per publication) are written up
in COORDINATION.md §s87 rather than repeated here.
▎ ▸ **Still open, founder's call:** the app-side Calendar → Schedule rename · the
Composer POPOUT state (pass 3, in spec) · YouTube as a destination (needs its own
window — platform key + capability row + driver; recorded in `SETTINGS_DEFERRED` with
a test that fires the day it becomes real).
▎ ▸ **Waiting on ONE founder word, unchanged since s85:** the `thalon-deploy` +
templates-preview credentials → `NEEDS-STEVEN` 2026-07-29e.
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his recorded words;
every other platform is per-platform + per-post GO; the queue consumer's key rests
EMPTY. Instagram's media path is BUILT and **disarmed**. The D2 tick ships disarmed
on its own separate flag. **Nothing was posted.**
▎ ▸ **`impeccable` still RELAXED on `docs/research/mock-sheets/**`** on his ruling —
`apps/web/**` and landing pages are NOT covered; the re-arm trigger is in the
programme file.
▎ ▸ **Traps worth keeping:** the Bash tool's working directory PERSISTS across calls
(use `git -C` / absolute paths) · `npx vitest run -w <pkg>` is **`--watch`**, not a
workspace filter — use `npm test -w <pkg>` · never `pkill -f vitest` while lanes are
live · vitest does NOT typecheck · zod 4's `z.record()` over an ENUM key is
**exhaustive** (use `partialRecord`) — it refused every partial map in this window's
first cut.
▎ ▸ **Standing:** stealth · hermes-relay = founder · design is lead-direct, never
delegated · every lane/subagent launch needs fresh founder approval · GATE ON EXIT
CODE, never pipe the suite · **verify-on-merged-main = THE gate** · research before
build (rule 10) · check the ENVIRONMENT before his hands (rule 11) · platform logins
live durably in `.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin at `7bcd5b9`, pushed · staging on s85 code + the OCI
label · four social channels connected.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync; both lane
worktrees GC'd, branches deleted, tmux windows killed.

## Pointer

CLAUDE.md → this file → `docs/research/ux-refinement-program.md` →
`docs/research/mock-sheets/README.md` → COORDINATION.md → NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (READ BEFORE ANY PORTAL WORK).

## Delta (session 86)

s86 finished pass 1 on the D4 four (Schedule · Composer · Channels, all four sheets
byte-identical on the canvas), merged both s86 lanes (`ig-admission`,
`transcription-free`), and closed with BOTH SPECS APPROVED — the Create engine spec
and the Video arc spec, which are the charters s87 built against. Its Composer flow
question was answered with ground truth and specced: Create → Generate → Composer
(run-scoped) → Approve, per-draft re-entry secondary.
