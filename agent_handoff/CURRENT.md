# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-18 (session 63 close, syd4 — the pre-reboot window session, wrapped clear-safe BEFORE the 18:30 UTC box reboot; founder live at the tail with one doctrine addition) · **the W-audit engine finding FIXED (`e2b0708`: `fanout_runs.status` lifecycle finally has its ONE writer; three dev legacy rows healed with audit rows)** · **the three audit micro-passes SHIPPED (`a39831a`: typeset named-steps sweep · 11-field id/name harden · toast z-scale)** · **⑰ FERN & CRUMB + ⑱ STRATA SCIENTIFIC PREPLAN.md BOTH WRITTEN (`25bdc56`, `3a1d167` — wave-4 paper stage done for two of three; builds stay one-at-a-time)** · **motionsites.ai ratcheted into meta-prompt look-first step 0 (founder addition, live; `427648c`)** · **portfolio ratchet amended: PREPLAN-only dirs = the recognized pre-plan stage (the full-suite run CAUGHT the new class — exactly the ratchet working; garbage dirs still fail)** · balance **710.08** API-verified, zero mints this session · Actions still billing-dead (renewal NOT landed — verified on the push signatures) · locally verified: full root suite 1568 passed with the one preplan-class catch, fixed + repo-ratchets re-verified green; db/engine/web also green standalone post-change · guard clean at every commit.

## Resume prompt (session 64, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-18, s63 close. **The box reboot (18:30 UTC 2026-07-18) is expected between s63 and s64** — after it, tmux + Postgres auto-start but 8899 does NOT (relaunch below). GitHub Actions stays billing-dead BY FOUNDER DECISION until the monthly renewal — verify every push locally (suite + guard).

**Resume · Thalon** — session 64, syd4:

0. **Self-check:** `tmux attach -A -t thalon` · `pg_isready` · 8899 up (relaunch: `setsid nohup python3 scripts/preview-server.py 8899 &`) · `git status` + this stamp · balance API-verify (expect ≈710.08).
1. **Opener:** peer-mail — swordfish tails STILL open at s63 close: step-8 dump confirm (overdue since 15:00 UTC 07-18) · rotated basicauth pair (CI `STAGING_EDGE_AUTH` swap queued on arrival) · FILM-IMPORT confirm (closes W-audit (a) staging half). NEEDS-STEVEN check: renewal landed? (if yes: matrix re-run green on main, staging auto-redeploys resume, arm the templates catalog origin) · ⑯ re-glance + audit glance · credit call · live-send GO.
2. **Main line: BUILD ⑰ FERN & CRUMB** — the pre-plan is written and committed: `proprietary/templates/sites/fern-and-crumb/PREPLAN.md` (type-that-proofs concept, 6 slots, casting decided, fonts named, no text-precise seat). Build straight off it: scaffold per the sites contract → code-drawn type system first (Fraunces variable + Karla, verify vendored) → mints per the slot table (get_cost preflight; compose-out notes in-table) → iteration passes → 8899. **⑱ Strata Scientific's PREPLAN.md is ALSO already written** (`proprietary/templates/sites/strata-scientific/PREPLAN.md` — CATALOGUE No. 7 slide-tray concept, zero people, focus-rack system) — after ⑰ ships, build ⑱ straight off it. ⑲ Tsukimi still needs its own pre-plan (own look-first sweep — **THREE named sources now: Dribbble · Pinterest · motionsites.ai (founder addition s63; weight it up for ⑲'s cinematic/drenched draw)**). Builds ONE AT A TIME. Checkpoint remainder unchanged: A+ family · B-sitegen charter · the landing; PLAN-OF-RECORD for Sprint 8 = `docs/research/arming-plan-sprint8.md`.
3. **Queued small work: NONE — the s62 queue is EMPTY** (engine look + all three micro-passes closed s63, see COORDINATION s63 record). Next engine-side candidates live in the arming plan only.
4. **Standing tails:** live-send GO + stealth pick · credit call · db-dump route removal (checkpoint cleanup).

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md (s63 + s62 records) → `agent_handoff/NEEDS-STEVEN.md` → the ⑰ PREPLAN.

▎ ▸ **State:** main = origin @ s63 wrap head (no PRs; no worktrees; no lanes; 1 tmux window) · migrations through 0015, contract frozen (the s63 status fix needed NO migration — check bytes unchanged) · portfolio: 17 sites (16 verdicted + ⑯ awaiting re-glance) · workspace: Phase I + Sites + audit fixes + saved-views + the s63 micro-passes LIVE · dev runs surface now shows honest run statuses · balance 710.08 · suite green local at wrap.

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** ⑯ re-glance + audit glance · Actions = wait-for-renewal · Sites + Phase I glances · Dokploy templates service + arm flag · credit call · live-send GO + stealth pick.

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · founder blanket workspace grant (no per-item asks; lanes/subagents still announce) · founder-live ⇒ open calls stated FIRST · get_cost preflight per mint · hero = best roster model · text-in-scene = text-precise seat · printable surfaces compose OUT (bucket bodies/gift boxes/arrangement cards/wrap collars/vehicle glass · machine bodies · vintage livery · worn fabric→KNIT · grade stamps · breaker faces · flat metal blanks · CAFÉ LIVERY: cups/bags/aprons/boards — ⑰ mints keep every surface plain, all lettering code-drawn; count-anchor) · casting archetypes + nature-vs-dread + social-register dial + food-casting corollary · **pre-plan = the mandatory stage; look-first = Dribbble + Pinterest + motionsites.ai** · design authored by Fable 5 directly · at wrap: guard + commit + push + LOCAL verify while Actions is dead.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no in-flight renders/vendor jobs (zero mints this session); guard green at HEAD; all commits pushed + locally verified; the 18:30 reboot is expected and survivable.

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (s63 record) → `agent_handoff/NEEDS-STEVEN.md` → `proprietary/templates/sites/fern-and-crumb/PREPLAN.md`.

## Delta (session 63)

**The s62 queued-small-work list went to zero and wave 4 opened on paper — twice.** The engine finding was real and structural: `fanout_runs.status` had lifecycle words in its check constraint and NO writer anywhere — `setStatus` is now the one writer (audited, no transition graph on purpose: telemetry never vetoes a run), all three orchestrators transition honestly, fast paths self-heal legacy rows, and the dev Runs surface stopped lying the same hour. The three audit micro-passes (typeset/harden/z-scale) closed the report's follow-up list. **⑰ Fern & Crumb AND ⑱ Strata Scientific got full pre-plans** (type-that-proofs / the CATALOGUE No. 7 slide tray — every casting/compose-out decision made before a single mint), the founder, live at the tail, added **motionsites.ai** as the third look-first source (ratcheted into the meta-prompt same change, read double-edged: motion reference AND the map of the default to refuse), and the full-suite wrap run caught that the portfolio ratchet didn't yet know the PREPLAN-only dir shape — amended so the pre-plan stage is recognized and anything else without a built site still fails. Lesson re-learned in the same run: a piped `tail` swallowed vitest's exit code — the numbers were read, which is why the red was seen at all.

## Next action

**s64 opener: self-check (8899 relaunch post-reboot) → peer-mail (the three overdue swordfish tails) → founder calls first if live → then BUILD ⑰ off the committed pre-plan.**
