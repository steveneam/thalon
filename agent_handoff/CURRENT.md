# CURRENT

## Stamp

2026-08-02 (session 91, syd4 — **zero credit spend, zero posts**). **s91 booted
on his "gogogo. you have my approval on W2 too" and ran the whole plan
lead-direct, founder-hands-free: the W2 verdict BANKED (four ledger rows
flipped; B-create.4 queues s92) · the PIPELINE BOARD drawn + on canvas +
his verdict asked by text · ALL THREE W1 BUILDS SHIPPED (Approve rebuild
with the reject-reason learning door · Dashboard setup band · Runs
re-shape with create-run parents).** Verify on main at the wrap: **exit 0,
3154 passed / 9 skipped (the +17 over s90's 3137 are this session's
pins), 0 lint errors** — the literal `npm run verify`, single-lane, dev
server stopped first. No lanes ran (the analytics lane awaits his GO).

**His words this session:** *"gogogo. you have my approval on W2 too"* (the
boot + the W2 verdict of record — covers the s90b-redrawn Create set and
the s90c Composer iteration, per the scope the s90 wrap recorded).

**s91b — POST-WRAP, his text (verbatim): "board approved and go
analytics. wrap it all up for next session, with your plan (or parrallel
worktree)."** Both banked same turn (ledger row 11 + library §Pipeline
board + COORDINATION §s91 close): the **pipeline board is VERDICTED**
(toggle wiring + `/app/board` deletion unblocked, one change) and the
**analytics lane GO is ON RECORD** (launches at the s92 boot, no re-ask;
kickoff written at the boot per rule 12). The parallel-worktree shape he
asked for is the s92 plan below.

## WHAT SHIPPED

**W2 VERDICT BANKED (`2af1611`):** ledger rows 5/6/16/19 → VERDICTED;
COORDINATION §s91 opened. Create home + wizard + Sites + Library builds
unblocked; **B-create.4 (Composer route + wizard build) queues for s92.**

**PIPELINE BOARD DRAWN (`ef24402`):** `Board.dc.html` redrawn as the
Dashboard toggle's Board state — loop-order columns (Intel picks →
Generating → At the judge → In Approve → Scheduled → Published), live
counts on heads, the day's in/out as ONE aligned feet row (columns stretch
full height — HubSpot's funnel math made literal), ✓/✗ judge chips on
every Approve card with the blocked reason verbatim, warn tint on the one
human gate, "unpicked" fixture card removed (picks only). Measured: all
six columns bottom 916 ≤ 940, zero spills/clips (probe, not eyeball). On
canvas f5d304cb. **His verdict asked by text (`cbb0e9d` — one word:
"board approved"); the same ping carries the analytics-lane GO ask.**

**APPROVE W1 REBUILD (`438b140`):** the s89-amended sheet wired over the
s74 surface — state qtabs with live counts (pressed filter buttons;
Approved covers published) · family picker in the header · run-group
bands with "Approve run · N" behind named confirms · real platform marks
(sheet SVGs + letter fallback, never invented logos; shared `PlatMark` in
components/approve) · verbs carry keys inline (aria-hidden kbd +
aria-keyshortcuts so accessible names hold) · **the reject-reason door:
prompt ask → client → route → the merged `rejectDraft(..., reason?)` seat;
stated reason = the eval row (s90 window), blank = bare decision with no
body on the wire, Cancel keeps the draft; this session's reasons render on
the rejected row, older ones honestly carry no chip (no read exposes
recorded reasons — events/eval only)** · the Composer door drawn but
resting unarmed with its reason (B-create.4 lands the route). 87 tests,
dark+light shot on real data.

**DASHBOARD SETUP BAND (`ac1d200`):** gap §5.1's verdicted answer — Hex's
"Set up your workspace · N of 4" between header and tiles; step truth from
real reads only (connected integration card · brand profile · any run ·
any approval; the approve door carries the live waiting count); renders
only once every read resolved; first pending step is the ONE live door;
dismiss = per-tenant localStorage; self-retires at 4/4 — on dev it is
honestly absent (all four genuinely done). Board seg-opt keeps routing to
the still-live `/app/board` with the pending wiring named in a comment.

**RUNS W1 RE-SHAPE (`ca042fa`):** running-now band above the history
(both reads, real elapsed math; create runs get no dead Watch door) ·
create-run PARENT rows with the family nested in the sheet's `.child`
grammar, fed by the NEW read-only **`/api/create/runs`**
(createRuns.list + usageLedger.totalForDay; no schema change) · absorbed
fanout rows leave the flat history; orphans never mint a fake parent ·
seg → All/Live/Waiting/Failed/Published, one predicate set for rows and
parents · footer gains the Clay day total from the wire's real sums.
**Deliberately not drawn: per-run cost + durations (no read exposes
either).** A failed create read = flat history WITH a stated note. Dev
renders flat/bandless because that is TRUE (no create rows, nothing live).
38 tests incl. the orphan/absorption/verbatim-child-failure pins.

## Resume prompt (session 92, syd4)

**Resume · Thalon** — s91 banked the W2 verdict, drew the Pipeline board,
shipped all three W1 builds lead-direct, and **both post-wrap verdicts
LANDED by text: "board approved and go analytics"** — nothing is waiting
on him. **The s92 plan of record (COORDINATION §s91 close), his
parallel-worktree ask honored — two tracks, disjoint by construction:**

**LANE (launch AT THE BOOT, GO already on record — no re-ask):**
`analytics` — write the kickoff at the boot (rule 12 re-ground first:
check `capability.ts`'s current Facebook metric vocabulary + what
`/api/...` reads exist for publication_metrics), then Mode B via
`scripts/launch-lane.sh`, worktree, strongest-tier pin, vitest
`--maxWorkers=2`. Scope: derive the corrected Facebook fixture values
(capability.ts is the truth — the sheet still shows retired
`post_impressions*`) + the Analytics BUILD (`Analytics.dc.html` →
`/app/analytics`, exact-mock, surface-scoped analytics.css per README
rule 6). The worktree cannot shoot its own work — the LEAD is the
screenshot-vs-sheet merge gate and applies the sheet's fixture edit there
(sheets stay lead-owned). Worktree prep: hand `ln -s` the node_modules
set (junctions no-op on Linux), copy env, NEVER npm install in the lane,
`next dev` can't run inside it.

**LEAD TRACK, in order, while the lane runs:**
1. **Wire the Dashboard toggle's Board state as the pipeline board and
   DELETE `/app/board` in the same change** (verdicted; the board's reads:
   intel picks · live/generating runs · judge state · approve queue ·
   planned slots · published — every count real or visibly unresolved,
   feet = the day's in/out, the drawn sheet is the spec). Delete
   `Board`'s route + components as rebuilt; screenshot-vs-sheet the
   toggle's Board state against `Board.dc.html`.
2. **B-create.4 — Composer route + wizard build** (W2 verdicted):
   exact-mock from `Composer.dc.html` (the s90c iteration is the spec) +
   `Create Wizard.dc.html`; Create home rebuild to the s90b ask-card
   sheet rides the same arc. Sites + Library rebuilds (the
   `/app/transcription` retirement) go s93 if time runs short — never
   rushed past their gates.
3. **Merge gate for the lane** (rebase → capped verify green → lead
   screenshot-vs-sheet → merge; the literal `npm run verify` single-lane
   AFTER the merge, dev server stopped).

**Read first:** CLAUDE.md → this file → runway §9 → COORDINATION §s91 →
`docs/workspace/spec.md` (Create/Composer contracts) → the W2 sheets →
`docs/research/ux-refinement-program.md` (ledger).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` · `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

▎ ▸ **⛔ HIS s90 CONSTRAINT IS LIVE: no console visits this week** ("this
week" dates from 2026-08-01 — re-test, don't assume expired). Console
batch stays PARKED on NEEDS-STEVEN.
▎ ▸ **NO VERDICTS OPEN** — both landed post-wrap ("board approved and go
analytics"). The board wiring + `/app/board` deletion and the analytics
lane are UNBLOCKED; the lane's approval covers exactly the named run
(reviewer/fix-round resumes included), nothing else.
▎ ▸ **The /app/board route deletes ONLY in the same change that wires the
toggle's Board state** — never before, never separately.
▎ ▸ **`/api/create/runs` is NEW** (read-only, no schema change) — dev
create_runs is empty so Runs renders flat; the first real Create run
exercises the parent grammar live.
▎ ▸ **No read exposes recorded rejection reasons** (they live in the
transition event + eval row); the Approve row chip is session-local by
design. A future read is a contract-window question, not a quick fix.
▎ ▸ **The s90 windows stay frozen** — nothing in s91 touched
packages/db or packages/contracts (the new route reads existing repos).
▎ ▸ **Dev server was stopped at wrap** (`next dev -p 3111` killed); the
8899 preview + sweeper user units keep running — NEVER hand-start the
sweeper.
▎ ▸ **impeccable hook notes:** the 4px-radius/9-10.5px-font findings on
approve.css/runs.css are SHEET-VERBATIM ports (DOCTRINE 0) — intentional,
not suppressed; don't "fix" them.
▎ ▸ **Traps worth keeping:** Bash cwd PERSISTS (`git -C`/absolute paths) ·
`npx vitest run -w <pkg>` is `--watch` · vitest doesn't typecheck ·
claude-design writes need finalize_plan → plan_token now · full uuid for
the canvas project (f5d304cb-cd0e-484d-8542-7b6561e1ef30) · lanes cap
vitest at `--maxWorkers=2`, the lead runs the literal verify single-lane.
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his
recorded words; every other platform per-platform + per-post GO; queue
consumer's key EMPTY; youtube CANNOT arm (test-pinned). **Nothing posted.
Zero credits spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · design lead-direct ·
every lane/subagent launch needs fresh founder approval (a texted GO
suffices) · GATE ON EXIT CODE · verify-on-main = THE gate, re-run after
your LAST commit · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (this wrap) · staging on s85 code (moves next
deploy — the W1 rebuilds will roll it) · four social channels connected ·
previews auto-deploy ARMED · dev PG live.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; both verdicts
banked in-repo; tree clean and pushed; s92 boots on "gogogo" alone (this
file carries the whole plan — lane launch included, no re-ask needed).

## Pointer

CLAUDE.md → this file → `docs/launch-runway.md` §9 → COORDINATION.md
(§s91) → `docs/workspace/spec.md` → `docs/research/ux-refinement-program.md`
→ NEEDS-STEVEN.md (PARKED header) →
`docs/research/prior-art-portal-automation-s84.md` (BEFORE ANY PORTAL WORK).

## Delta (session 90)

s90 merged both lanes, drew W2, wired the credentials, restructured the
runway hands-free. s91 spent the structure exactly as written: the W2
verdict arrived in the boot message and was banked the same turn; the
pipeline board went from ruling to drawn-measured-on-canvas with the
verdict asked by text; and the three W1 builds the runway queued all
shipped lead-direct with their tests, screenshot gates, and honest
not-on-the-wire slots named. The only deferrals are verdict-gated by
design (Board wiring/deletion; the analytics lane).
