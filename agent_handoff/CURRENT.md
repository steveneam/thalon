# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-18 (session 58, syd4 — founder live at the opener) · **FULL-SLATE SESSION, 0cr: founder GO'd all three T-lanes ("GO — all three") → launched staggered via launch-lane.sh → all three SHIPPED, lead-reviewed with a REAL visual pass (chrome-devtools + throwaway 8898 server over the worktrees — the "no headless chrome on syd4" constraint no longer binds the lead), MERGED (`73d3858` · `c6a4f04` · `ec4c199`), GC'd** · **workspace PHASE D OPENED: three annotated designs in claude-design (Workspace Spine · Content Calendar · Leads Board) — all 9 survey questions answered or checkpoint-flagged; repo record `docs/research/workspace-phase-d-designs.md`** · height-auto portfolio ratchet extended to split css/ dirs (`c28e7ed`, suite 6/6) · peer-mail was CLEAN twice (step-8 dump confirm + basicauth pair BOTH still pending → s59 opener) · balance 718.36 (no spend) · guard clean.

## Resume prompt (session 59, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-18, session-58 wrap. **s59 = Phase D session 2 + wave-3 ⑫ Pearl & Rowe (both lead design work, both already approved — no new gates)**. Founder verdicts pending on the s58 output ride NEEDS-STEVEN; the design checkpoint (gates Phase I) comes when Phase D s2 is done.

**Resume · Thalon** — session 59, syd4:

0. **Quick self-check (box stays 8GiB + 6GB swap — resize refused, ticket with founder):** `tmux attach -A -t thalon` · `pg_isready` · 8899 up (`curl -s localhost:8899/ >/dev/null`; relaunch: `setsid nohup python3 scripts/preview-server.py 8899 &`) · `git status` + this stamp.
1. **Opener:** peer-mail (`bash scripts/peer-mail-check.sh`) — BOTH tails still open at the s58 wrap: swordfish's **step-8 nightly-dump confirm** (on confirm: delete `.context/cutover-s56/`) and the **rotated preview basicauth pair** (→ swap GitHub secret `STAGING_EDGE_AUTH`, update `.context/staging-secrets-from-swordfish.md`, re-run the five-route probe). If the founder verdicted the three refreshed wave-1 sites or the Phase D trio (NEEDS-STEVEN rows), fold the feedback in first.
2. **Lead spine — Phase D session 2** in the same claude-design project ("Thalon workspace — Phase D"): intel dossier card + per-family exits + Create context-chip handoff mocks (`workspace-ux-v2.md` §3), calendar week view, approve refinements (judge reasons on blocked drafts + the informed-consent panel from the §10 critique backlog), icon cleanup pass. The decision ledger + what's-owed list = `docs/research/workspace-phase-d-designs.md`. Verify loop = chrome-devtools MCP on render_preview serve URLs (works on this box; proven s58).
3. **Interleave — wave-3 ⑫ Pearl & Rowe** (dental / soft-organic + data-instrument, s56 verdict): full meta-prompt treatment (look-first sweep → FDI tooth-chart instrument grammar → mints with get_cost preflight → ≥3 two-lane passes → ratchet → /guide). A+ bar standing.
4. **Then:** Phase D done → **founder design checkpoint** (also carries: manifest schema model/credits fields · headlamp.webp provenance cleanup · the recurrence/undo-after-terminal flags) → Phase I four lanes (W-spine lead / W-intel / W-create / W-boards, EACH launch = fresh founder approval) → Phase R = s40 re-critique. Wave-3 ⑬–⑯ continue interleaving.

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md (queue rows + the s58 session message) → `docs/research/workspace-phase-d-designs.md` → `proprietary/templates/meta-prompt.md` → memory `higgsfield-kompozy-assignment`.

▎ ▸ **State:** main = origin @ s58 wrap (no open PRs; no worktrees; no lanes; 1 tmux window) · migrations through 0014 · staging LIVE on tenant-pg (step-8 confirm + basicauth/DB_DUMP_TOKEN rotation = the open tails) · portfolio: **12 sites, 12/12 verdicted; wave-1 loopwell/northpace/truebore refreshed s58 AWAITING founder verdict** · portfolio ratchet 6/6 (height-auto now reads css/ dirs) · Phase D designs 3/≈6 done (spine/calendar/board; dossier/create/approve owed) · 8899 = `scripts/preview-server.py` (no-cache) · balance 718.36 · box 8GiB (STAGGER any parallel launches).

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** verdict on the 3 refreshed wave-1 sites · Phase D trio first-look · credit call · live-send GO + stealth pick · (s40 re-critique rides Phase R).

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · get_cost preflight per mint, ≥40cr ping · hero = best roster model · text-in-scene = text-precise seat · soul-2: compose printable surfaces OUT of frame · aspect variants = own-engine recut · design authored by Fable 5 directly (design subagents = Fable-pinned + fresh approval) · lead drives lanes/tmux/interactive flows · **close wrapped lane windows at batch review (capture the pane first) — s58 lesson: an idle claude in a finished lane window collected a stray cross-lane kickoff line; caught unsent** · at wrap: guard + commit + push (+ ASK-BACKS ping only when the founder isn't live).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no in-flight renders/vendor jobs; the throwaway 8898 server is DOWN (founder's 8899 untouched); guard green at HEAD; full matrix rides the push CI.

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (queue + the s58 session message) → `agent_handoff/NEEDS-STEVEN.md`.

## Delta (session 58, full)

Founder GO at the opener → three T-lane worktrees prepped (`worktree-setup.ps1` direct via pwsh — the npm alias still calls Windows `powershell`, unfixed) → staggered launches ~25min apart, 8GiB posture held (peak ~3.0Gi used + healthy cache) → **all three lanes wrapped honestly and merged after lead diff-review + visual verification** (loopwell 6/6-green after the ratchet extension; northpace's 50:00 arithmetic + time-linear session chart honesty fix; truebore's static-marquee/no-JS + svh fixes) → **Phase D opened in claude-design**: spine/calendar/board designs with in-file annotation tables; design verify-loop caught a calendar off-by-one (July 2026 grid), pill-scale bug, stale count → `docs/research/workspace-phase-d-designs.md` records all decisions + the 9 survey answers → board refreshed (s54 table archived; s58 lane table + session message; queue row 1 → s59 slate) → NEEDS-STEVEN: T-lane confirm line closed, two review rows added. Incidents: stray hand-typed truebore kickoff found unsent in the wrapped northpace window (cleared by closing the window post-archive; lesson ratcheted to the standing list above) · first GC chain aborted by a pkill exit code, re-run clean. Checkpoint candidates carried: manifest model/credits fields · headlamp.webp cleanup · recurrence + undo-after-terminal design flags.

## Next action

**s59 opener: self-check → peer-mail (both tails) → fold in any founder verdicts → Phase D session 2 in claude-design, interleaved with wave-3 ⑫ Pearl & Rowe.** No launch gates this session; the design checkpoint gates Phase I.
