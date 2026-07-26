# CURRENT

## Stamp

2026-07-26 (session 79, syd4 — zero credit spend; OPUS 5, closed on Fable 5 after the founder's live `/model` switch). **THE VERIFY-AND-FIX PASS PART 2 OF 2 — DONE, BOTH LANES MERGED — THEN THE FOUNDER USED THE PRODUCT AND THE SESSION BECAME A LIVE FIX LOOP.** Final verify on merged main: **2392 passed / 9 skipped, 0 lint errors** (2293 at the s78 close). Tree clean, everything pushed, both worktrees/branches/tmux windows GC'd. **The jobs table: 14 works · 9 dead doors · 2 no-affordance at open → 29-of-29 works, console-clean, at close.**

**THE ARC OF THE SESSION: the s78 lesson became a TOOL, and the tool was then hardened by its own failures.** `scripts/drive-surface.mjs` — `--inventory <route>` lists what a surface OFFERS; `--jobs <surface>|all` prints a JOBS TABLE scored **works · dead-door · no-affordance · undriven · ⚠ console**. `fe-check`'s G1 phase now DRIVES before reading (its prompt used to end *"verify every claim against the code"* — the gate whose purpose is finding what ISN'T there, verifying against the one thing that cannot show absence). The two verdicts added mid-session were both bought with a miss: **undriven** after the harness printed ✓ for a job an empty shelf made untestable, and **⚠ console** after the founder saw browser errors on a surface the table called green — the driver watched the DOM and never listened to the console.

**WHAT DRIVING FOUND THAT READING NEVER COULD, in one session:** (1) the calendar's empty planner stated the WRONG fact while its own docstring promised the right one ("nothing approved yet" vs "everything is already planned" — five drafts approved, all planned, operator told to approve). (2) **Video ingest was permanently dead** — founder-found by pasting a YouTube URL. Split brain: `llm_cache` (Postgres) holds pointers, the object store holds truth, and `THALON_DATA_DIR=.data` is RELATIVE so the store root follows the process cwd — dev server 71 embeddings, root-cwd runs 704, one shared index. The old code THREW on a dangling pointer and the row survives a throw, so the failure was permanent. Fixed (`93a9972`): a dangling pointer is a self-healing MISS, reported via `onCacheDangling`, never silent. Proven live: his 44-minute ingest = 882 segments, zero console errors. (3) **The Sites dossier's webfonts were CORS-blocked** — the preview iframe is sandboxed `allow-scripts` WITHOUT `allow-same-origin` (correct: previewed sites run real scripts), which makes its origin opaque, and fonts unlike `<img>` always fetch in CORS mode. Fixed at the preview door (`ACAO: *` — widens nothing, an opaque origin can't be allowlisted and wildcard forbids credentials). (4) Chrome's form-field issue: transcription's six fields had aria-labels but no `name` — all named.

**BOTH LANES: 22 findings, 22 SURVIVED, 0 refuted — and 12 changed shape under verification.** Lane 3 (`44e3e00`): drove all three surfaces before fixing (D2: selection 743px down a 419px box, scrollTop 0); its own verifiers REFUSED its planned D3 fix (equalising counts trades one visible disagreement for two invisible ones) — it ships *"21 of 25 shown — the oldest wait in the queue →"*. **State the bound, don't chase the number.** Lane 4 (`5f3b1ee`): A2 much worse than reported — 11 of 13 waiting drafts have NO decision verb (product call homed with facts, see NEEDS-STEVEN); C3 wider — a failed profile read painted "Denylist · empty" against six real terms; Intel↔Create shipped as ONE decision, leading with "Create video", arming DISARMED per the sequence gate.

**THE HARNESS'S OWN LEDGER, kept honest in `docs/research/jobs-table-s79.md`:** five wrong selectors, three false passes, and it contradicted lane 4 about Approve's grounding tiers and LOST (it read `body.innerText` instead of the panel's own `.reason-gate` column, on a waiting row instead of a blocked one). Two criteria demanded count-equality the lanes had correctly fixed by stating the gap. **A gate that insists on the wrong remedy is worse than one that misses the defect; a harness that measures the wrong element manufactures a contradiction with someone who measured right, and the more confident output wins.**

**MAIN WENT RED FOUR SEPARATE TIMES THIS SESSION AND EVERY ONE WAS CAUGHT BY A GATE:** (1) at boot — both s78 guards of mine (the dead-link guard flagging kickoffs' own future wraps; the worktree ratchet false-redding inside the lanes it protects, now `--git-common-dir`-anchored); (2) a flaky intel j/k test (the suite's only raw `fireEvent.keyDown(window,…)` — now userEvent like its nine siblings); (3) my `vitest … | grep && git commit` gating on grep's exit — the rule said `tail`, so grep felt safe; now **gate on the exit code, never pipe into anything**; (4) 4 lint errors from undeclared browser globals — linted before adding the test, not after. Plus: a NUL byte made a 12KB test file BINARY to git and it merged with no reviewable diff — lane 3 caught it post-merge, cherry-picked after blob-identity check, and the class (second occurrence) is now `tests/no-nul-in-source.test.ts`. **And the tried-and-reverted one:** the absolute-`THALON_DATA_DIR` refusal (founder-approved) threw on a healthy dev server because `readEnv()` doesn't see `.env.local` at every call site — reverted within minutes of his "console and recoverable error"; the pollution fix that mattered shipped as hermetic test data dirs for engine+eval (`tests/setup/hermetic-data-dir.ts`).

**FOUNDER RULINGS THIS SESSION, all homed in NEEDS-STEVEN:** video editor = **FULL BUILD-OUT, its own session — s80, planned below** · YouTube ration = CLOSED, the arithmetic that kept it open was wrong (cadence is 180 min; already fits) · transcription = **NOT a Thalon feature** — his own knowledge-ingestion tool ("get transcripts about system/building stuff to teach you"), free/deterministic by default, an AI button beside Ingest on demand, no second artifact (my two-artifact invariant withdrawn with its premise) · data-dir = his (b), tried, reverted, safe landing queued-and-confirmed · stage artifacts = **RULED at the close** (*"i'll follow your recommendation"*): (a) fix the counts + (c) archive the dogfood rows — their verb was always **advance**, not approve; execution = s80's pre-flight.

## Resume prompt (session 80, syd4 — "gogogo" boots this)

**Resume · Thalon** — s80 = **THE VIDEO EDITOR FULL BUILD-OUT.** His ruling on
the three options was the whole thing — not the safety slice, not parked.
Boot model = the founder's default (he set **Fable 5** at the s79 close; the
editor is design-heavy work, which is the standing Fable-5 doctrine — confirm
at boot rather than assume).

**The spec is use-truth, and it already exists:**
`docs/research/video-editor-audit-s78.md` — 36 confirmed findings, and the real
number is the JOBS table: **of 27 operator jobs, 8 work · 4 dead doors · 15
with NO affordance at all.** The sheet is `Videos.dc.html` (the editor's real
sheet — corrected s78; Videos Overview = the list, Video Dossier = the project
page), and the render gate against it DOES NOT MATCH — unquantified.

**Do these in this order:**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111 ·
   `git status` + this stamp. **No open founder calls — all three were RULED at
   the s79 close** ("i'll follow your recommendation"); see NEEDS-STEVEN.
0.5. **PRE-FLIGHT, lead-direct, ~30 min: execute the two ruled items.**
   (a) stage artifacts (`direction_doc`/`storyboard`) leave the `needsYou`
   derivation — a queue only counts what the operator can act on; expect the
   rail/pulse/Board to drop from 25 to ~14 and lane-4's honest-gap copy plus
   any count-pinned tests to need the same-change update. (c) archive the
   Jul-19–25 dogfood stage DRAFTS (the video PROJECTS the editor drives
   against are untouched — verify FK edges: approvals/verdicts rows, before
   deleting). Full verify GATED ON THE EXIT CODE before the editor work
   starts — the session should not stare at a dishonest count all day, and
   the stale dogfood rows are exactly the fixtures the editor would trip
   over.
1. **AUTHOR THE 27 JOBS FIRST** — port the audit's jobs table into
   `scripts/lib/surface-jobs.mjs` as an `editor` job set against
   `/app/videos/<projectId>/edit`, driving what exists TODAY. Mechanical
   wrinkle stated so it costs nothing: the editor's route is DYNAMIC — the
   job set must resolve a real projectId at run time (first project off the
   live videos list), not hardcode one that an archive or reseed would kill. That baseline is
   the build's definition of done: every no-affordance row is a build item,
   every dead door a fix, and the session ends with the table green. This is
   use-truth-driven development — the tool s79 built is exactly what this
   session needs, and its self-inflicted-bug ledger
   (`docs/research/jobs-table-s79.md`) is required reading before trusting a
   verdict.
2. **MEASURE the render gate against `Videos.dc.html`** — first number of the
   session; the drift is currently unquantified.
3. **Pre-plan before code** (the ⑯ PREPLAN.md artifact class), and its FIRST
   answer is the CONTRACT-WINDOW question — windows freeze before build, so
   settle it before a line of code. The probe says the answer is likely NO
   new schema, because the capabilities already exist as doors: `saveCut` is
   live (so the exit guard can offer Save / Discard / Stay with zero schema),
   undo/redo is a client-side spine over the one working copy the editor
   already keeps ("one dirty bit, one working copy"), and music swap =
   SURFACING the s77 bed system (`setAudioBed` + the operator-attested,
   license-gated bed door) — never inventing a music library. If anything
   turns out to need a table or contract after all, freeze the window FIRST.
   Then the build order: (a) the SAFETY CORE: undo/redo spine + unsaved-work
   guard on every exit (three plain `<Link>`s and the back button currently
   discard the working copy silently) + the honest player (while dirty it
   shows the PREVIOUS render with only an "unsaved" pill); (b) the BLOCKER:
   keyboard-reachable timeline blocks (real `<button>`s wired to
   `onPointerDown` only — caption/music inspectors unreachable by keyboard);
   (c) the MISSING VERBS: insert/delete a beat, insert/delete a caption, swap
   the music track, preview the working copy; (d) the 36 findings folded in
   where they touch the same code; (e) the four copilot chips that spend a
   metered call to be refused — wire them or make them honest.
3.5. **BUILD IN MERGEABLE SLICES — the safety core lands as its own verified
   checkpoint (verify + drive + measure) BEFORE the verbs begin.** "Full
   build-out" is the scope, not one atomic change: if the session runs long,
   what has merged is coherent and the remainder rolls cleanly to s81 —
   never stop mid-edit (standing rule, learned at the s53 OOM).
4. **Founder checkpoint at the pre-plan** — and the honest default is
   **LEAD-DIRECT, not lanes**: the editor is ONE tightly-coupled file set
   (`components/videos/editor*.tsx` + the `/edit` route), the work is
   design-heavy (the Fable-5 doctrine's home turf), and two lanes in one
   component tree buy conflicts, not speed. Propose a lane ONLY if the
   pre-plan surfaces a genuinely disjoint engine seam (e.g. pure EDL
   operations / the undo model as a lib with its own tests) — and any lane
   still needs his fresh approval, per named run.
5. **Merge-gate = the s79 ritual**: rebase · verify on merged main GATED ON
   THE EXIT CODE · drive the editor's 27 jobs · measure the render · read the
   screenshots.

**Explicitly NOT s80:** any publish path (the sequence gate) · the 139 s77
mediums+lows (s81+, re-read against the fixed code — and re-DRIVEN, not
re-read) · transcription's free-tier flag + AI button (s81+, small, his
sequencing).

▎ ▸ **Read first:** CLAUDE.md → this file → `docs/research/video-editor-audit-s78.md` → `docs/research/mock-sheets/Videos.dc.html` + the sheets README → `agent_handoff/lanes/WRAP-media-lane-b.md` (**the raw material for the music/beat verbs**: the bed attestation door + its flagged EDL cue-add gap and project-ref-vs-stored-sha mismatch — this session either closes those or states why not) → `docs/research/jobs-table-s79.md` → `.claude/skills/thalon-check/SKILL.md` → COORDINATION.md → NEEDS-STEVEN.md.
▎ ▸ **State:** main = origin, all pushed · verify **2392 passed / 9 skipped, 0 lint errors** · budget 2M · balance 584.12 · **zero spend s79** · dev transcript shim = hand-started `.context/tools/transcript-shim.py` on 127.0.0.1:8787, NOT a unit — it dies with the session and only transcription ingest needs it.
▎ ▸ ⛔ **THE SEQUENCE GATE, unchanged:** *"we're not posting anything yet until all the walks are verified and fixed."* No publish path, no platform call, no token-spending generation without his GO. The editor session's copilot chips SPEND (metered gateway calls) — reachability checks only until he says otherwise. **But draw the line where the money is, not wider:** the working-copy PREVIEW is a LOCAL render (hyperframes driver + the ffmpeg now in the image — compute, not credits, not a platform call), so building and exercising it is inside scope; treating local rendering as gated spend would hollow out the honest-player build, which is the safety core's whole point.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant · **every lane/subagent launch needs fresh founder approval** · **GATE ON THE SUITE'S EXIT CODE — never pipe it into anything** · **vitest does NOT typecheck and does not lint** (five catches on record) · verify-on-merged-main = THE gate, plus a MEASURED render, plus DRIVE the surface, plus **watch the console** (the driver does now) · a LANE CANNOT SCREENSHOT OR DRIVE ITS OWN WORK (both enforced) · never full-verify while lane fan-outs are live · wrap = verify+commit+push+restamp.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync with origin; tmux back to `dev` + `agent`.

## Pointer

CLAUDE.md → this file → `docs/research/video-editor-audit-s78.md` → `docs/research/jobs-table-s79.md` → `docs/research/workspace-audit-findings-s77.md` → `.claude/skills/thalon-check/SKILL.md` → COORDINATION.md → NEEDS-STEVEN.md.

## Delta (session 78)

s78 was part 1: the keyed-by-entity sweep (7 instances, one spelling), lanes 1+2 (23 findings, 20 fixed), the founder finding the calendar could not plan, the planner built, the 15th surface walked (the editor — s80's whole spec), and the harness gap named that s79 closed.

## Next action — s80 (boot on the founder's model default, Fable 5 as of the s79 close): self-check · PRE-FLIGHT the two ruled items (honest counts + dogfood archive, verified) · author the editor's 27-job baseline and measure the sheet drift · pre-plan the build (safety core → keyboard blocker → missing verbs → findings → copilot honesty) · founder checkpoint · build.
