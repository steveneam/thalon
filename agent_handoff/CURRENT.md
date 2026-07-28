# CURRENT

## Stamp

2026-07-28 (session 82, syd4 — **zero credit spend**; Opus 5 (1M), set with
`/model` before "gogogo"). **THE THREE-LANE PLAN EXECUTED END TO END: both
pre-flight windows frozen, all three lanes launched, merged and gated, and the
founder's live triage of their reports taken the same session.** Final verify
on main: **2694 passed / 9 skipped, 0 lint errors** (2439 at the s81 close).
Tree clean, everything pushed, `main == origin/main`. ⛔ Zero live platform
calls, zero spend, all session.

**THE EDITOR'S TWO GATES, START TO CLOSE.** Both re-measured at boot before any
code (they reproduced the s81 stamp exactly) and re-run on merged main:

| gate | s82 boot | s82 close |
|---|---|---|
| **jobs** (`drive-surface.mjs --jobs editor`) | 21 works · 0 dead doors · **5 no-affordance** · 1 undriven | **25 works · 0 dead doors · 0 no-affordance · 2 undriven** |
| **render** (`measure-sheet.mjs`) | 9 missing · 30 drifted · 9 within ±2px | 8 missing · 31 drifted · **9 within ±2px** (flat; 6 new app-only classes are lane B's own elements) |

**TWO OF THE FIVE "GAPS" WERE NEVER GAPS — the harness was lying, for the third
session running.** (9) The audition job counted a preview control only if it sat
INSIDE `button.take` — markup HTML forbids, since interactive content cannot
nest — and matched `aria-label*='play'` while the seam names itself *Audition*.
It reported NO AFFORDANCE against a working control. (10) The resume job
asserted the surface names an in-flight render **without first checking one was
running**, so an idle project scored NO AFFORDANCE. The lead settled both by
driving rather than believing: the live DOM shows the audition control present,
not nested, mounting media from `/api/videos/…` on press; and a real render
(local ffmpeg, 0 credits) made the surface say **"Rendering…"** on return, so A4
is proven. Both are wrong verdicts (9)/(10) in `jobs-table-s79.md`. **The
standing fix has been the same three times: name the ROLE, not the markup.**

**B3 SHIPPED DEAD, AND THE LANE SPLIT IS WHY.** Lane B built and tested the
timeline's judge-refusal marks; lane A owned the file that had to pass them.
Neither could see the seam, so the feature rendered as nothing. Wired at the
gate, with the refusal band's own half of the same finding: it printed the raw
0-based `line 0` while the inspector beside it called that plate "Caption 1" —
the operator had to know the off-by-one to act on their own gate result. It
reads Caption N now and each refusal is a BUTTON that selects the plate it
refused. The index basis was verified in the judge's own source, not assumed;
the test pins the POSITION, because an off-by-one would mark the wrong caption,
which is worse than marking none. **A shared seam needs an owner for the JOIN.**

**THE WINDOWS, AND THE ONE DISTINCTION W1 RESTS ON.** W1 (`7fee14c`) gave
`publish_queue` its first repository — a table dormant since B0.3 with neither
end wired — plus `videoCuts.remove` with the three ratified refusals, and the
platform capability matrix. **The matrix is NOT `platformProfiles.charLimit`:**
that is an authoring BUDGET (Facebook's shipped budget is 5000 against a
platform accepting 63,206 — the gap IS the opinion); the matrix is the CEILING.
The invariant tying them is executable in
`engine/src/fanout/__tests__/profiles.test.ts` and was **watched failing** (x
bumped to 300 against 280) before being trusted. The migration is two ADD
COLUMNs; the status check now draws its vocabulary from contracts and generated
NO SQL diff. W2 (`3513ef5`) is the shared `<TakeAudition>` seam, and **writing
its tests found a defect before either lane could inherit it**: the
one-at-a-time slot was keyed on the component alone, so a recycled tile
inherited the audition and began streaming a file nobody asked to hear.

**THE BOX HAS A MEASURED CEILING.** Three lanes each running an unbounded
`npm run verify` exceeded 16 GiB: the kernel OOM-killed next-server, chrome and
python3 at once, swap sat 5/6 GB, and two lanes had verify runs **killed (143)
rather than failed**. `--maxWorkers=2` fit. `launch-lane.sh` states it when it
makes lane #3, together with the fact that `pkill -f vitest` is a **cross-lane
weapon** (a lane used it and killed a neighbour's suite, then disclosed it). The
s64 "stagger retired" note measured lanes doing ordinary work, never three full
suites at once. Also fixed: `npm run worktree:setup` invoked `powershell` and
had been **dead on Linux since the migration** — it is `pwsh` now, executed
verbatim afterwards.

## Resume prompt (session 83, syd4 — "gogogo" boots this)

**Resume · Thalon** — s83 = **THE CONNECTOR SEAM (B-int.4 pulled forward), the
recommended headline**, proven by adding **Reddit + Bluesky** — both have
instant developer-app creation and **no posting-scope review wall** (Bluesky is
an app password, no OAuth at all), so the seam can be proven end to end with two
NEW platforms in one session, through the existing publish door and s82's queue,
waiting on no partner filing. Plan of record: `docs/research/s82-PREPLAN.md` §4;
the charter is **ratified → ADR 0012** (`docs/research/distribution-charter.md`),
where this is D1. **s82's queue neither waits on it nor conflicts with it.**

**Read first:** CLAUDE.md → this file → `docs/research/s82-PREPLAN.md` §4 →
`docs/research/distribution-charter.md` → COORDINATION.md §Work queue (the four
deferred items, all four decided by the founder as next-session) →
`docs/research/jobs-table-s79.md` (the harness ledger — **TEN** wrong selectors
now; READ BEFORE TRUSTING A VERDICT).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units
   (`XDG_RUNTIME_DIR=/run/user/$(id -u)` or systemctl cannot see the bus) ·
   dev 3111 · `git status` + this stamp.
0b. **MOBBIN (founder-directed, s82 close): expect it as a claude.ai
   CONNECTOR, then research.** His Mobbin account exists (his claude.ai email)
   and the ruled route is claude.ai → Settings → Connectors — same MCP server,
   his browser does the OAuth, and it arrives in sessions as `claude_ai_Mobbin`
   tools exactly like Higgsfield/Gmail do. **Once those tools appear, REMOVE
   the box-local fallback** (`claude mcp remove --scope user mobbin` — it sits
   unauthenticated in user config, never the tracked `.mcp.json`) so there is
   one registration, not two. If the connector did NOT arrive, the fallback's
   `/mcp` auth is the plan B. Then a BOUNDED pattern sweep of comparable
   interfaces: social schedulers/distributors (composer · queue · calendar) ·
   workspace shells · video editors · settings/connect-account flows. Two
   payoffs, in order: the s83 connect-flow UI (Settings → Integrations gains
   the generic connect door — Mobbin's connect-account patterns are directly
   on point) and the D4 design wave (Analytics · Calendar→Schedule · composer
   band · Channels sheets). Findings land as a tracked reference memo under
   `docs/research/`, not as chat.
1. **The seam, per plan §4:** ONE `SocialConnector` contract in
   `packages/contracts` (identifier · scopes · capabilities, merging with W1's
   matrix · per-platform settings schema · `generateAuthUrl` / `exchangeCode` /
   `refreshToken` / `whoAmI` / `post`), ONE hardened fetch in the engine with
   typed refusal classification (429-retry · 401→refresh · verbatim platform
   body — `errors.ts` already half-does this). After it, a new platform ≈ one
   connector file + one settings schema + a registry line + a vault pair.
2. **The connect flow:** replace mode-2 token pasting with the generic dance —
   one connect door + ONE dynamic callback route under Settings → Integrations,
   single-use state rows in Postgres with a TTL (we run no Redis; a table is the
   honest equivalent), tokens landing in the EXISTING vault, which is already
   stronger than Postiz's storage. Refresh rides the proven sweep-scheduler.
3. **Research first.** AGENTS.md rule 10 — the seam is a capability family, so
   the `prior-art` sweep runs BEFORE the plan hardens, and any step that would
   assign the founder recurring manual work is a DEFECT until research proves
   no better path exists.

▎ ▸ **s82 shipped:** W1 window `7fee14c` · W2 seam `3513ef5` · kickoffs +
worktree-prep fix `104efcb` · lane C `a95b6d8` · lane A `843a063` · lane B
`3b151ed` · harness wrong-verdicts `3cec8c0` · the founder's three triaged
fixes `27b4ba4`. Lanes GC'd (windows killed, worktrees removed, branches
deleted).
▎ ▸ **FOUR ITEMS THE FOUNDER RULED NEXT-SESSION**, full detail in COORDINATION
§Work queue: C3's arming third (gated on his per-platform GO anyway) · no
cadence pre-check at the producer (+ `cadenceBreaches` reads planned slots
only) · an unreachable media hole (fit allows 4, the door caps at 1) · the
`scheduled` draft status trap (needs a contracts window). **None is broken
today.** Plus the architectural note that matters before D4: the capability
validator **cannot run client-side**, so fit crosses the wire via
`/api/social/fit`.
▎ ▸ **Postiz, two lines:** AGPL-3.0 — patterns re-implemented, never code; no
Postiz text is in this repo and nobody opens their source while implementing.
The s82 take (finishing our own half-built queue) is DONE.
▎ ▸ **Design-hook waiver on record (founder s82):** `editor.css` added to
`.impeccable/config.json` ignoreFiles — its findings are the border-triangle
technique and byte-true sheet values, the known false-positive class. **The
waiver is FILE-scoped**, so real findings there would also go quiet; revisit if
the sheet's own values stop being the reason.
▎ ▸ **State:** main = origin, all pushed · verify **2694 passed / 9 skipped, 0
lint errors** · budget 2M · balance 584.12 · **zero spend s82**.
▎ ▸ ⛔ **THE SEQUENCE GATE, unchanged:** *"we're not posting anything yet until
all the walks are verified and fixed."* The queue consumer ships DISARMED —
structurally, not by a flag: no `armed` is passed and no publisher resolver is
wired, and an armed tick without a resolver throws before reading a row. Arming
+ per-platform GO + per-post GO all still his.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
**every lane/subagent launch needs fresh founder approval** · **GATE ON THE
SUITE'S EXIT CODE — never pipe it** · **vitest does NOT typecheck and does not
lint** · verify-on-merged-main = THE gate + MEASURED render + DRIVE the surface
· a LANE CANNOT DRIVE OR SCREENSHOT ITS OWN WORK · **research before build**
(rule 10) · **no AGPL code embedded, ever** · wrap = verify+commit+push+restamp.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync with origin.

## Pointer

CLAUDE.md → this file → `docs/research/s82-PREPLAN.md` →
`docs/research/distribution-charter.md` → `docs/research/jobs-table-s79.md`
(the harness ledger) → `.claude/skills/thalon-check/SKILL.md` →
COORDINATION.md → NEEDS-STEVEN.md.

## Delta (session 81)

s81 finished the editor build-out: every ratified step executed, both gates
re-run rather than trusted, the two dead doors closed (a refusal that only a
mouse could discover), and the two cheap provenance rows taken. It closed at
jobs 21 · 0 · 5 · 1 and render 9 missing · 30 drifted · 9 within ±2px — the
numbers s82 booted from and reproduced exactly.

## Next action — s83: the CONNECTOR SEAM (charter D1) — one `SocialConnector` contract + one hardened fetch + the generic connect flow, proven by adding Reddit + Bluesky end to end through the existing publish door and s82's queue. Prior-art sweep FIRST (rule 10). The four deferred s82 items are in COORDINATION §Work queue; D4's design wave still queues after.
