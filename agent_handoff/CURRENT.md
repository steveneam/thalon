# CURRENT

## Stamp

2026-07-26 (session 78, syd4 — zero credit spend, OPUS 5). **THE VERIFY-AND-FIX PASS, PART 1 OF 2 — DONE, AND THE GATE EARNED ITS KEEP THREE TIMES.** Final verify on merged main: **2276 passed / 9 skipped, 0 lint errors** (2194 at the s77 baseline). Working tree clean, everything pushed, nothing in flight.

**The keyed-by-entity sweep shipped FIRST, lead-direct, before any lane launched** (`8d35a9e` + `93470ec`). One disease, **7 instances, one spelling**, 7 pinned tests in ONE file that names the class — all verified to fail with the fixes stashed. It killed the Approve **data-corruption blocker** (open the editor on draft A, click draft B, Save edit → A's body written onto B) a whole session before Approve's own lane. **Two instances came from the sweep, not the fan-out:** Runs (**latent, not live** — `rowsFor` maps 1:1 over a feed read exactly once, so unreachable today; fixed so the next refresh path cannot make it live), and **Settings `ConnectPanel`** — the worst of them, a pasted credential riding into the NEXT destination's box where Connect would seal it. Both Settings walkers had flagged that one; my own grep missed it because it is neither index-shaped nor a detail card. Checked and left alone as genuinely clean: the command palette and Profiles' wizard step.

**Both lanes verified adversarially before fixing, and that is the whole point.** Lane 2: **11 findings → 8 survived, 3 refuted** — and on C4 the walker's proposed fix would have made the surface WORSE (narrowing `ordered` would have removed the only working route to overflowed waiting drafts; fixing C5 was the right answer to the same concern). Lane 1: **12 → 12 survived, 0 refuted**, but verification still corrected SIX of the twelve in ways that changed the fix, one reversing the planned approach entirely. Lane 2 also found the Profiles blocker was **wider than reported** — every identity catchall key was dropped, on load as well as save, and `renderBrandIdentity` feeds those extras into both the generation prompt and the judge's grounding chunk, so a Save silently changed what the judge grounds against. Third instance of that disease on record.

**`/api/calendar` — VERDICT: in scope, built, wired, tested.** The table, the contract, the repo, the events and the tenancy pin all shipped in s61; only the route was missing. Reschedule and Remove are live. Drag stays deliberately unwired (it cannot be render-verified from a lane, and shipping blind drag on a time grid is worse than not shipping it). **A slot is a plan — writing one publishes nothing and arms nothing.**

**THE MERGE GATE CAUGHT A REAL REGRESSION, and only measuring found it.** Lane 1's B2 fix replaced a 620px constant with `.col { max-height: 100% }` — right idea, shipped as a no-op: `.cols` had auto rows, so the row sizes to its tallest column and `100%` of it is the column's own height. Circular. Measured live at 1440×940: the 25-card Waiting column reached 1078px inside a 798px region, `.col-bd` never scrolled, and the whole surface scrolled instead — taking every column HEADER off screen on a kanban. Fixed with `grid-template-rows: minmax(0, 1fr)` (`b5140c7`); re-measured at 756px, scrolling itself, short columns still hugging. **Severity stated honestly: the content stayed REACHABLE — my first read said nothing scrolled, which was wrong; I had measured `documentElement` when the scroll container is `.content.board-surface`.** Neither jsdom nor a stylesheet assertion could see this; lane 1 said so itself when it wrote that test.

**MY OWN MISTAKE, RATCHETED TWICE ON THE FOUNDER'S CALL.** Both lane kickoffs told the lanes to screenshot-gate their own work. Wrong in the worst direction: `shoot-surface.mjs` targets the lead's dev server, which serves MAIN, so a lane would capture code that is not its own and read it as passing — **a false pass on a gate**. (`next dev` cannot run in a lane either; Turbopack rejects the out-of-root symlinks.) First fix was a runtime refusal in one script; the founder's verdict was *"better ratchet your mistake"*, and he was right — that is the shape of guard that rots (`npm run guard` sat broken for three buckets). Now **structural** (`scripts/lib/worktree.mjs`) plus **executable** (`tests/worktree-screenshot-guard.test.ts`, in the repo-wide suite CI runs). The pin that matters spawns the REAL script inside a fabricated worktree, so deleting the CALL fails even if the helper survives — verified by doing exactly that.

**THE 15TH SURFACE IS WALKED** (`docs/research/video-editor-audit-s78.md`) — the video editor, 1,916 lines, identified by absence and then audited on the founder's call. 59 agents, **50 raw → 36 confirmed, 14 refuted**. The headline is the JOBS table: of 27 jobs an operator would try, **8 work, 4 are dead doors, 15 have no affordance at all** — no undo anywhere, no unsaved-work guard on any exit, no insert/delete of a beat or caption, and while dirty the player shows the PREVIOUS render with only an "unsaved" pill beside it. **It corrected my brief, too:** I told it the editor had no sheet; `Videos.dc.html` IS the editor's sheet, and the render gate against it does not match.

## Resume prompt (session 79, syd4 — "gogogo" boots this)

**Resume · Thalon** — s79 = **THE VERIFY-AND-FIX PASS, part 2 of 2.**

Same shape as s78, which worked: **verify adversarially first, fix only what
survives.** The gate killed 3 of 23 findings across the two s78 lanes and
rewrote the fix on eight more — including one whose proposed fix would have
removed the only working path on that surface.

**Do these in this order:**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111 ·
   `git status` + this stamp.
1. **Ask the founder to approve the two lane launches** (standing rule: fresh
   approval, per named run). Mode B via `scripts/launch-lane.sh`, Opus-5 pin.
2. **Launch lanes 3 + 4** — `dashboard · transcription · sites` and
   `approve · create · intel · videos`. Each verifies its **blocker+high ONLY**
   (4 blockers · 20 high across both), then fixes survivors.
3. **Lead merge-gates each lane** on rebase + `npm run verify` on merged main,
   **then MEASURES the rendered surface** — not just a screenshot, and not the
   lane's word. The s78 board regression was invisible to the suite, to jsdom
   and to a stylesheet assertion, and showed up only in a live measurement.
4. **Carry into the fix work:** Approve's unmatched-`?run=` honesty (lane 1
   left the precise instruction in `WRAP-s78-lane1.md`), and Intel's
   angle-toggle seam, which the s77 fan-out caught shipping half-fixed.

**Explicitly NOT this session:** the 139 s77 mediums+lows (s80+, re-read against
the FIXED code) · the 36 video-editor findings (their own session — see below) ·
any publish path (the sequence gate below).

▎ ▸ **Read first:** CLAUDE.md → this file → `docs/research/workspace-audit-findings-s77.md` (the work list; its keyed-by-entity section names the 7 findings already CLOSED so no lane re-does them) → `.claude/skills/thalon-check/SKILL.md` → `agent_handoff/WRAP-s78-lane1.md` + `WRAP-s78-lane2.md` → COORDINATION.md → NEEDS-STEVEN.md.
▎ ▸ **THE VIDEO EDITOR NEEDS ITS OWN SESSION, and it is not s79.** `docs/research/video-editor-audit-s78.md`: 36 confirmed findings, but the real number is **15 of 27 jobs with no affordance at all** — undo, exit-without-losing-work, add/remove a beat or caption, swap the music track, preview the working copy. That is not a fix list, it is a **build** list, and it wants the founder's call on scope before anyone starts. Its one blocker (keyboard-dead timeline blocks, so caption + music inspectors are unreachable by keyboard) is small and could ride s79's lane 4 if he wants it closed early.
▎ ▸ **The sheet map was wrong and is now right:** `Videos.dc.html` = the video EDITOR · `Videos Overview.dc.html` = the list · `Video Dossier.dc.html` = the project page. The editor's render gate against its real sheet DOES NOT MATCH — unquantified, and the first thing its session should measure.
▎ ▸ **State:** main = origin, all pushed · verify **2276 passed / 9 skipped, 0 lint errors** · budget 2M · balance 584.12 · **zero spend s78** · both s78 worktrees/branches/tmux windows GC'd.
▎ ▸ ⛔ **THE SEQUENCE GATE, his words:** *"we're not posting anything yet until all the walks are verified and fixed."* s78 built a calendar WRITE route — a slot is a plan; it publishes nothing and arms nothing. No publish path was exercised, no platform API called. Posting still needs a fresh per-platform GO after the fixes land.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant · **every lane/subagent launch needs fresh founder approval** · NEVER pipe the suite through `tail` · **vitest does NOT typecheck** (three catches on record, one this session) · verify-on-merged-main = THE gate, and **measure the rendered surface too** · a LANE CANNOT SCREENSHOT ITS OWN WORK (now enforced — `shoot-surface.mjs` refuses from a worktree) · **never run a full verify while lane fan-outs are live** (it produced 4 phantom engine failures this session; all 29 passed in isolation) · REDESIGN ERA MODEL = OPUS 5 · wrap = verify+commit+push+restamp.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync with origin; both lanes merged and GC'd; tmux back to `dev` + `agent`.

## Pointer

CLAUDE.md → this file → `docs/research/workspace-audit-findings-s77.md` → `docs/research/video-editor-audit-s78.md` → `.claude/skills/thalon-check/SKILL.md` → COORDINATION.md → NEEDS-STEVEN.md.

## Delta (session 77)

The s77 contract window froze first (`13163d4`, contracts-only, ZERO migrations) — `MediaRef` as a union on WHERE THE BYTES LIVE. Lane A shipped the resolver, `<SourceThumb>`, three migrated surfaces and the authed `/api/media/[sha]` door; lane B shipped oEmbed dimensions, derived posters, **ffmpeg in the image (+472 MB unpacked / +175 MB compressed)** and the audio bed. The founder then found four bugs in Intel's Ready-to-create by hand, the fourth being a missing React `key` on `DossierCard` — which became s78's whole sweep. His ask also became a durable tool: `.claude/skills/thalon-check/SKILL.md` plus the `fe-check`/`be-check` workflows, whose fan-out produced the 189-finding audit that s78 and s79 are working through.

## Next action — s79 (BOOT ON OPUS 5): self-check · ask for the two lane approvals · launch lanes 3+4 (`dashboard · transcription · sites` / `approve · create · intel · videos`) · merge-gate each on rebase + verify + a MEASURED render · then put the video editor's scope to the founder as its own session.
