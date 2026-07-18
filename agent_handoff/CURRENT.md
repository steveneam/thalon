# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-18 (session 56, syd4 — founder live) · **PLANNING SESSION CLOSED WITH VERDICTS: all five proposals founder-approved same session, two wave-3 substitutions (architecture → ⑭ Sparkwright electrician · bookshop → ⑯ Ridge & Valley roofer) · Sprig & Barrow port approved · workspace D→I→R approved + The Bounded-List Rule ratcheted into `DESIGN.md` §5 · film = revisit AFTER the Thalon landing work · s57 = EXECUTION with the parallel division cut** · zero spend (balance 721.92) · guard clean.

## Resume prompt (session 57, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-18, session-56 wrap. **s57 = EXECUTION of the founder-approved slate** (s56 verdict message, COORDINATION). One gate remains: the four named lane launches need his one-word confirm at the opener (fresh-approval rule).

**Resume · Thalon** — session 57, syd4:

0. **POST-REBOOT CHECKS FIRST (founder plans a BinaryLane RAM upgrade syd4 → 16GB between s56 and s57, coordinated with swordfish — the box will have rebooted):** `tmux attach -A -t thalon` (agent-tmux.service should auto-start; never work in a bare code-server terminal) · dev Postgres up (`pg_isready` on the `.context/dev-postgres-from-swordfish.md` port) · relaunch the preview server: `setsid nohup python3 scripts/preview-server.py 8899 &` · `git status` + this stamp for any interrupted state.

1. **Opener — CUTOVER FIRST (gate opened late s56: swordfish confirmed all four step-0 preconditions, window = s57 opener per the ASK-BACKS ACK):** peer-mail check → run cutover steps 1–4 (`stop app · volume snapshot · dry-run · execute` via `scripts/migrate-pglite-to-tenant-pg.ts`) → signal in ASK-BACKS → **founder boots swordfish same sitting for step 5 (DATABASE_URL flip + redeploy)** → verify staging up on tenant-PG (steps 6–7); rollback = unset DATABASE_URL. Then **ask the founder's one-word confirm on the four named lanes: T-loopwell · T-northpace · T-truebore (taste pass, Fable-5-pinned subagents, code-only, one site dir each) + W-research (boards/calendar UI survey → `docs/research/boards-calendar-ui-patterns.md`)**.
2. **Lead spine (approved, no further gate):** ① wave-1 casting remints FIRST — Northpace runner + TrueBore tradie (the taste pass's only mints; get_cost preflight; pin + export so lanes consume the files) → ② **Sprig & Barrow** port of PujusFresh: physics-interaction + exceptional-palette; DELETE the inlined Matter.js, scroll-driven kinematic fall (items drop off-screen with scroll, deterministic, no collisions); ALL assets re-minted (~0.5–1cr; client CC photos stay gitignored, client copy untouched); full meta-prompt treatment. Commit each on ship.
3. **On founder confirm, launch the four lanes** (disjoint: each T-lane owns only `proprietary/templates/sites/<slug>/`; portfolio test + all minting stay lead; W-research touches only the new docs/research file). Batch-review the taste pass at its end.
4. **Then (approved order, later sessions):** wave-3 ⑫ Pearl & Rowe → ⑬ First Crack → ⑭ Sparkwright → then ⑮ Stem & Vow + ⑯ Ridge & Valley (lead design; ≤15cr est.) → wave-3 checkpoint → workspace Phase D in claude-design (**Bounded-List Rule = named input**) → founder design checkpoint → Phase I four lanes → Phase R = s40 re-critique.

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md (queue row 1 + the s56 planning AND verdict messages = full slate detail) → `proprietary/templates/meta-prompt.md` → `DESIGN.md` §5 (the new Bounded-List Rule) → memory `higgsfield-kompozy-assignment` (s56 entry).

▎ ▸ **State:** main = origin @ s56 wrap (planning + verdict commits only; no open PRs; no worktrees; no lanes) · migrations through 0014 · staging untouched since s54 · portfolio: 11 sites verdicted, ratchet 6/6 · **8899 = `scripts/preview-server.py` (no-cache; if the box reboots: `setsid nohup python3 scripts/preview-server.py 8899 &`)** · balance 721.92 · gateway $14.53.

▎ ▸ **Wave-3 slate of record (s56 verdicts):** ⑫ Pearl & Rowe (dental, soft-organic + data-instrument) · ⑬ First Crack (roaster, data-instrument + cinematic) · ⑭ Sparkwright (electrician, high-quality-3d + otherworldly-animation — dark 3D home lights circuit-by-circuit on scroll) · ⑮ Stem & Vow (florist, cinematic + soft-organic) · ⑯ Ridge & Valley (roofer, brutalist-raw + cinematic — weather/materials register, never Crateline's paperwork). Wave-4 anchors: exceptional-palette · editorial-print · novel-typography. Film seat map parked on the s56 planning message (revisit post-landing).

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** s57 lane confirm · credit call · live-send GO + stealth pick · (s40 re-critique = rides Phase R).

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · get_cost preflight per mint, ≥40cr ping · hero = best roster model per slot · text-in-scene = text-precise seat · aspect variants = own-engine recut · design authored by Fable 5 directly (design subagents = Fable-pinned + fresh approval) · lead drives lanes/tmux/interactive flows · dev = real Postgres · at wrap: guard + commit + push (+ ASK-BACKS ping only when the founder isn't live).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no Monitors; no in-flight renders/vendor jobs; guard green at HEAD; full matrix rides the push CI.

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (queue row 1 + the s56 planning/verdict messages) → `agent_handoff/NEEDS-STEVEN.md`.

## Delta (session 56, full)

Planning session per the s55 direction, founder live: five proposals authored and filed (COORDINATION s56 planning message) → founder verdicted same session — wave-3 approved with electrician (Sparkwright) and roofer (Ridge & Valley) swapped in for architecture and bookshop; Sprig & Barrow port approved; wave-1 taste pass approved; workspace D→I→R approved plus a new design rule ratcheted same change (**DESIGN.md §5 The Bounded-List Rule** — growing lists never grow the page: scroll/tabs/pagination, sibling sections keep dimensions); film pinned to post-Thalon-landing → s57 parallel division cut (lead spine: remints → port; lanes T-loopwell/T-northpace/T-truebore + W-research) → founder's swordfish-note question answered (open cutover thread; ball with swordfish; timing independent of the slate). Zero credits spent; no product code touched.

## Next action

**s57 opener: cutover steps 1–4 (gate open, window picked — founder boots swordfish for step 5 same sitting) → founder one-word confirm on the four named lanes → execute** — lead remints → Sprig & Barrow port; lanes run the wave-1 taste pass + the boards/calendar survey. Everything else is pre-approved on the board.
