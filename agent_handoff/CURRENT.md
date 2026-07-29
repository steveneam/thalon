# CURRENT

## Stamp

2026-07-29 (session 87, syd4 — **zero credit spend**). **THE s87 BOOT SEQUENCE RAN
END TO END: contract window BUILT · VERIFIED · MERGED · FROZEN, then BOTH LANES
LAUNCHED on the founder's GO.** Verify-on-merged-main after the window: **2885
passed / 9 skipped, 0 lint errors** (s86 closed at 2840 — the +45 are the window's
own ratchets). Tree clean, pushed. Zero posts.

**HIS GO, VERBATIM, MID-TURN:** *"you also have my approval for lane-launch GO.
i'll be away for a bit. so keep working."* That covers exactly the two named runs —
`create-engine` and `analytics-spine`.

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

**Resume · Thalon** — s87 froze the contract window, launched both approved lanes on
the founder's GO, and banked the video arc's last references. **The next action is
whatever the lanes left: read their WRAPs, merge each through main on a green
verify-on-merged-main, GC the worktrees, kill the windows.** Then the held work.

**Read first:** CLAUDE.md → this file → COORDINATION.md §s87 → the two APPROVED specs
(`docs/create-engine/spec.md`, `docs/video-arc/spec.md`) →
`docs/research/ux-refinement-program.md`.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` · `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

▎ ▸ **s87 shipped:** `308a94a` the window · `ff55f0f` window merged · `737adbb` both
kickoffs gained "THE WINDOW AS FROZEN" · `d8a323f` video Overview+Dossier references
· `6b503e1` lane board.
▎ ▸ **⚠️ BUDGET IS THE LIVE CONSTRAINT:** the weekly limit read **87% used** at lane
launch (was 84% at s86), **resets Jul 31, 11pm UTC**. Two lanes were consuming it in
parallel. **The video sheet passes are HELD on this, not on doubt** — banking the
references first is what made the hold cheap. Check headroom before drawing.
▎ ▸ **IN FLIGHT AT THE STAMP:** both lanes running in tmux (`thalon:create-engine`,
`thalon:analytics-spine`), worktrees at `.claude/worktrees/`. If a session resumes
cold: `tmux capture-pane -t thalon:<lane> -p | tail -30` and check for
`agent_handoff/lanes/WRAP-<lane>.md` on each branch. **The lead merges; lanes never
do.** Dead-lane worktrees are salvageable — inspect status/log/stash before redoing.
▎ ▸ **Each kickoff carries a "THE WINDOW AS FROZEN" section** naming the shapes that
differ from the specs' prose, so neither lane stops on a false surprise. The two that
matter: `CREATE_CHILD_KINDS` is **three** (`fanout_run | draft | video_project`) not
the four-way per-family set — every family lands through the single-draft spine and
`drafts.fanout_run_id` is NOT NULL; and `publicationMetrics.append` takes **no
`platform` argument**.
▎ ▸ **Still open, founder's call when he wants:** the app-side Calendar → Schedule
rename (build task, own go) · the Composer POPOUT state (pass 3, in spec) · YouTube
as a destination (needs its own window — platform key + capability row + driver).
▎ ▸ **Waiting on ONE founder word, unchanged since s85:** swordfish correctly did NOT
re-issue the `thalon-deploy` credential (a relayed approval is not an in-session
confirmation). One 30-second confirm covers BOTH that and the templates-preview
credential → `NEEDS-STEVEN` 2026-07-29e.
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his recorded words;
every other platform is per-platform + per-post GO; the queue consumer's key rests
EMPTY. Instagram's media path is BUILT end to end and **disarmed**. **Nothing was
posted.**
▎ ▸ **`impeccable` still RELAXED on `docs/research/mock-sheets/**`** on his ruling —
`apps/web/**` and landing pages are NOT covered. It expires: when pass 3 closes a
surface, audit it, reconcile the ramp into `design.json`, drop the ignore.
▎ ▸ **Traps worth keeping:** the Bash tool's working directory PERSISTS across calls
(use `git -C` / absolute paths after any `cd`) · `npx vitest run -w <pkg>` is
**`--watch`**, not a workspace filter — use `npm test -w <pkg>` · never
`pkill -f vitest` while lanes are live · vitest does NOT typecheck.
▎ ▸ **Standing:** stealth · hermes-relay = founder · design is lead-direct, never
delegated · every lane/subagent launch needs fresh founder approval · GATE ON EXIT
CODE, never pipe the suite · **verify-on-merged-main = THE gate** · research before
build (rule 10) · check the ENVIRONMENT before his hands (rule 11) · platform logins
live durably in `.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin, pushed at `6b503e1` · staging on s85 code + the OCI
label · four social channels connected.

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
