# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-18 (session 60 close, syd4 — founder live at opener + mid-session) · **PHASE I BUILT AND MERGED IN ONE SESSION** — founder GO on all three lanes at the opener; W-spine (lead) + W-intel + W-create + W-boards all shipped, reviewed, visual-passed on live dev data, merged in order, pushed (`be6f47c`); suite 582/582 · **⑬ FIRST CRACK SHIPPED interleaved (`311402b`, founder-directed)** — 14 sites, 0.60cr, balance 716.44 · TWO ratchets: worktree-setup works on Linux (`c1dee7f`) + meta-prompt machine-bodies/vintage-livery lesson (`5cf337e`) · guard clean.

## Resume prompt (session 61, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-18, session-60 close. **The box auto-reboots 18:30 UTC 2026-07-18 (kernel patch)** — after it, tmux + Postgres auto-start but the 8899 preview server does NOT (relaunch below). Phase I is DONE and pushed; Phase R + the contract window are founder-gated on NEEDS-STEVEN.

**Resume · Thalon** — session 61, syd4:

0. **Self-check:** `tmux attach -A -t thalon` · `pg_isready` · 8899 up (`curl -s localhost:8899/ >/dev/null`; relaunch: `setsid nohup python3 scripts/preview-server.py 8899 &`) · `git status` + this stamp. (If the 18:30 reboot happened, 8899 WILL need the relaunch.)
1. **Opener:** peer-mail (`bash scripts/peer-mail-check.sh`) — open tails: swordfish step-8 nightly-dump confirm (on confirm delete `.context/cutover-s56/`) · rotated basicauth pair (→ CI `STAGING_EDGE_AUTH` swap + five-route probe). Check NEEDS-STEVEN verdicts: Phase I glance · ⑬ verdict (fix round done) · **Phase-I contract window approval** · W-sites pick (design-first vs straight-to-build). Sequencing per founder: W-sites → W-audit.
2. **Main line (as verdicts allow):** W-audit = the founder-directed FULL workspace audit, AFTER W-sites (scope in queue row 1c: FEATURE-MAP conformance · Source-Link Rule sweep + thumbnails · full /impeccable audit · the s40 re-critique) · the Phase-I contract window (planned-slot store + scheduledFor · lead stage field · captures list read · capture-id on drafts · saved-views store — use `/contract-window`, founder approval) · **W-sites (queued s60, planned: `docs/research/sites-surface-plan.md` — founder picks design-first vs straight-to-build + approves the lane; his console arms the templates preview service)** — these can run as parallel lanes with fresh approval.
2b. **W-audit item (a) is founder-confirmed FIRST audit work: register the concept film through the product's own pipeline (pin masters+keepers into the object store, write video_projects/takes/cuts rows) so Videos shows the flagship film.** Checkpoint candidates riding row 4: **B-sitegen** (meta-prompt behind Create's page family) + **S3 store wiring**.
3. **Interleave:** **⑭ Sparkwright** (electrician; high-quality-3d × otherworldly; the dark CSS-3D house gaining light circuit-by-circuit with scroll; standing approval, no gate). Then ⑮ Stem & Vow / ⑯ Ridge & Valley remain in wave 3.
4. **Standing tails:** live-send GO + stealth pick · month-end credit call (both NEEDS-STEVEN, founder-paced).

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md (Phase I close record + ⑬ message) → `agent_handoff/NEEDS-STEVEN.md`.

▎ ▸ **State:** main = origin @ s60 close (`5cf337e` tip; no PRs; no worktrees; no lanes; 1 tmux window) · migrations through 0014, contract untouched all session · staging LIVE on tenant-pg, auto-redeployed with Phase I · portfolio: **14 sites, ALL verdicted (⑬ fix round: founder "looks a lot better")** · workspace: **Phase D designs IMPLEMENTED** (journey spine + rail shell · dossier launchpad · create handoff · approve consent · calendar month/week · leads board; suite 582/582; honest gaps = the queued contract window) · 8899 preview up (dies at the 18:30 reboot) · balance 716.44 · repo suite 11/11.

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** Phase I glance · Phase R GO · ⑬ verdict · contract-window approval · credit call · live-send GO + stealth pick.

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · get_cost preflight per mint, ≥40cr ping · hero = best roster model · text-in-scene = text-precise seat · **printable surfaces compose OUT (now incl. MACHINE BODIES; vintage machinery = livery magnet — modernize the object; disclosed local blur = last resort)** · casting archetypes per vertical + nature-vs-dread (meta-prompt §casting 7+8) · aspect variants = own-engine recut · design authored by Fable 5 directly (design subagents = Fable-pinned + fresh approval) · lead drives lanes/tmux · **worktree prep now verified end-to-end by the fixed `scripts/worktree-setup.ps1` (Linux SymbolicLink + link-materialize checks)** · close wrapped lane windows at batch review (two s60 misfire candidates were caught: hand-typed unsubmitted lines in lane input boxes — capture pane, then kill) · at wrap: guard + commit + push.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no in-flight renders/vendor jobs; throwaway dev server killed; guard green at HEAD; full matrix rides the push CI; the 18:30 reboot is expected and survivable.

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (Phase I close + ⑬) → `agent_handoff/NEEDS-STEVEN.md`.

## Delta (session 60)

**Phase I, one session:** founder GO at the opener → kickoffs committed (`8c0a006`) → three lanes launched staggered via `launch-lane.sh` (Fable-5 default) while the lead built W-spine → each lane wrapped honestly in 22–27m → serialized merges with lead review + live-data browser passes at 1440+390 per surface (real catches fixed at every stage: spine honesty bugs · the intel→create chip seam exercised end-to-end by click · calendar/board verified) → follow-ups (selected-row conformance additions, smooth-scroll opt-in) → single batch push `be6f47c`. Lane honesty of note: W-boards built NO drag anywhere because both designed drags need write doors that don't exist — stated in UI copy, queued as the contract window. Ops: worktree-setup's junction step silently no-ops on Linux (caught by W-intel, masked by Node ancestor resolution) — hand-linked live, then the script was fixed and verified (SymbolicLink + materialize checks + separator-class filters). **⑬ First Crack** interleaved on the founder's mid-session direction: look-first sweep (genre default refused), the roast-log concept, 3 keepers / 5 takes 0.60cr, machine-body lettering lesson ratcheted into the meta-prompt, 3/3 passes, suite 11/11. Kernel-patch auto-reboot discovered scheduled for 18:30 UTC (routine, weekly window; services survive; 8899 needs relaunch). Balance 716.44.

## Next action

**s61 opener: self-check (8899 relaunch post-reboot) → peer-mail → founder verdicts (Phase I glance · Phase R GO · ⑬ · contract window) → build as gated; interleave ⑭ Sparkwright on standing approval.**
