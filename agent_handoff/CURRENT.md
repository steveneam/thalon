# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-18 (session 57, syd4 — founder live) · **EXECUTION SESSION: founder re-cut the division live ("research this session, T lanes next session") and called the wrap after Sprig & Barrow — all three granted items DONE: ⑪ Sprig & Barrow SHIPPED (`a1bd54e`, the grocer port — scroll-drop kinematics, produce colour worlds, kilo-scale, day clock) · wave-1 casting remints SHIPPED (`d956e2c`, northpace first-light + truebore callout, pinned+exported for the T-lanes) · W-research SHIPPED (`4e3fd93`, boards/calendar survey → Phase D)** · pre-session: **16GB resize REFUSED by BinaryLane (host capacity — NO reboot, box stays 8GiB; swap now 6GB; STAGGER lane launches standing)** · spend 3.56cr (balance 718.36, API-verified) · guard clean.

## Resume prompt (session 58, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-18, session-57 wrap. **s58 = the wave-1 taste-pass T-lanes** (founder moved them here from s57), then the approved sequence continues. One gate: the three named lane launches need his one-word confirm at the opener (fresh-approval rule).

**Resume · Thalon** — session 58, syd4:

0. **Quick self-check (no reboot happened — the resize was refused; box is 8GiB + 6GB swap):** `tmux attach -A -t thalon` (never a bare code-server terminal) · `pg_isready` (port in `.context/dev-postgres-from-swordfish.md`) · 8899 preview up (`curl -s localhost:8899/ >/dev/null`; relaunch if dead: `setsid nohup python3 scripts/preview-server.py 8899 &`) · `git status` + this stamp.
1. **Opener:** peer-mail check (`bash scripts/peer-mail-check.sh`) — expected inbound: swordfish's **step-8 nightly-dump confirm** (was due post-15:00 UTC 07-18; on confirm, delete `.context/cutover-s56/`) and possibly the **rotated preview basicauth pair** (gitignored `.context` channel → swap GitHub secret `STAGING_EDGE_AUTH`, update `.context/staging-secrets-from-swordfish.md`, re-run the five-route probe). Then **ask the founder's one-word confirm on the three T-lanes: T-loopwell · T-northpace · T-truebore** (taste pass, Fable-5-pinned subagents, code-only, one site dir each; the remint files are already pinned+exported — `northpace/assets/first-light.webp`, `truebore/assets/callout.webp`).
2. **On confirm, launch the three lanes STAGGERED** (swordfish standing rec: one lane alone peaked 3.7GiB on 07-17 and the box is still 8GiB — spread the starts). Each lane owns ONLY `proprietary/templates/sites/<slug>/`: representation-ladder conversions (prose → 0cr code-drawn instruments), the playfulness wink, casting audit + `?v=` stamps on any same-name asset replacement; NO minting in lanes; the shared portfolio test stays lead-owned. Batch-review at the end.
3. **Lead while lanes run:** nothing is pre-approved beyond review/merge of the lanes — wave-3 ⑫ Pearl & Rowe is the next approved design item if the founder wants the lead building in parallel (his call at the opener).
4. **Then (approved order, later sessions):** wave-3 ⑫ Pearl & Rowe → ⑬ First Crack → ⑭ Sparkwright → ⑮ Stem & Vow + ⑯ Ridge & Valley → wave-3 checkpoint → workspace Phase D in claude-design (**Bounded-List Rule + the boards/calendar survey = named inputs**) → founder design checkpoint → Phase I four lanes → Phase R = s40 re-critique.

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md (queue row 1 + the s56 verdict + s57 session messages) → `proprietary/templates/meta-prompt.md` → `docs/research/boards-calendar-ui-patterns.md` (skim §4) → memory `higgsfield-kompozy-assignment`.

▎ ▸ **State:** main = origin @ s57 wrap (no open PRs; no worktrees; no lanes) · migrations through 0014 · **staging LIVE on tenant-pg (rollback = unset DATABASE_URL; step-8 dump confirm + basicauth/DB_DUMP_TOKEN rotation = the open tails)** · **Dokploy key = deploy-only, CI secret ONLY** · portfolio: **12 sites** (11 verdicted + ⑪ Sprig & Barrow awaiting founder glance on 8899), ratchet 6/6 · 8899 = `scripts/preview-server.py` (no-cache) · balance 718.36 · gateway $14.53 · **box 8GiB (resize refused, ticket with founder; 6GB swap; STAGGER lanes)**.

▎ ▸ **Wave-3 slate of record (s56 verdicts):** ⑫ Pearl & Rowe (dental, soft-organic + data-instrument) · ⑬ First Crack (roaster, data-instrument + cinematic) · ⑭ Sparkwright (electrician, high-quality-3d + otherworldly-animation) · ⑮ Stem & Vow (florist, cinematic + soft-organic) · ⑯ Ridge & Valley (roofer, brutalist-raw + cinematic). Wave-4 anchors: exceptional-palette · editorial-print · novel-typography. Film = post-landing.

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** s58 T-lane confirm · ⑪ Sprig & Barrow glance · credit call · live-send GO + stealth pick · (s40 re-critique rides Phase R).

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · get_cost preflight per mint, ≥40cr ping · hero = best roster model per slot · **text-in-scene = text-precise seat (the S&B sign: every word exact, first take, 2cr — the seat is worth it)** · **soul-2 letters every printable surface in workwear/market scenes — compose printable surfaces OUT of frame, don't negative-prompt** · aspect variants = own-engine recut · design authored by Fable 5 directly (design subagents = Fable-pinned + fresh approval) · lead drives lanes/tmux/interactive flows · at wrap: guard + commit + push (+ ASK-BACKS ping only when the founder isn't live).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no in-flight renders/vendor jobs; guard green at HEAD; full matrix rides the push CI. (A session-scoped file monitor on FROM-SWORDFISH.md was live for the step-8 confirm — it does not survive a fresh session; the s58 opener's peer-mail check covers it.)

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (queue row 1 + the s57 session messages) → `agent_handoff/NEEDS-STEVEN.md`.

## Delta (session 57, full)

Pre-session (between s56/s57, monitor-caught): BinaryLane REFUSED the founder-fired 16GB resize (host capacity; no reboot; swordfish raised swap 2→6GB, confirmed tmux+PG units up, recommended staggered lane launches) — handoff docs corrected + swordfish ACK'd (`da6eff9`). Session, founder live: division re-cut ("research this session, T lanes next") → **W-research lane** ran in the background (approved) and shipped the boards/calendar survey with the cal.com→MIT lineage correction (`4e3fd93`) → **lead spine ①**: wave-1 casting remints — northpace runner (take 2) + truebore tradie (take 5; the soul-2 printable-surface lesson earned honestly across 4 rejects) — pinned + exported for the T-lanes (`d956e2c`) → **lead spine ②**: ⑪ Sprig & Barrow, the PujusFresh port as a neutral fictional grocer — look-first sweep (5 taste notes on the board), five produce colour worlds, the scroll-drop kinematic fall replacing Matter.js (deterministic, reversible, engine-free), kilo-scale instrument, day clock, wonky-carrot wink; 5 keeper mints incl. the NB2 chalk sign (all words exact, first take); three two-lane passes with real catches logged in /guide; ratchet 6/6 (`a1bd54e`) → founder called the wrap. Spend 3.56cr exactly as ledgered (balance 718.36 API-verified).

## Next action

**s58 opener: quick self-check (no reboot — resize was refused) → peer-mail (step-8 confirm → delete the cutover tarball · basicauth pair → `STAGING_EDGE_AUTH` swap) → founder one-word confirm on T-loopwell · T-northpace · T-truebore → launch STAGGERED** — everything they need is already exported; the founder may also want ⑪ on the 8899 preview for a glance and can call wave-3 ⑫ for the lead in parallel.
