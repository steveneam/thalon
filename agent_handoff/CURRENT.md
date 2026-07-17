# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-17 (session 53, syd4 — the parallel slate; wrap completed by the follow-up session after a tmux-server crash killed s53 mid-wrap at 16:36Z) · **ORCHARD HOUSE SHIPPED (`fc222ab`, 8cr, 4/4 first-take) + founder-APPROVED live post-wrap (no fix round — ⑧ ungated)** · **Lane A B-crm.5 learn loop MERGED (PR #54, migration 0012)** · **Lane B RLS ratchet + tenant-pg migration prep MERGED (PR #55, migration 0013; cutover choreography filed in ASK-BACKS)** · call scripts + B-crm.4 back-half proposal done · spend 8cr (balance ≈730.1) · guard clean.

## Resume prompt (session 54, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-17, session-53 wrap (completed post-crash). **The s52 parallel grant covered exactly the s53 slate and is now SPENT — any s54 lane/subagent launch needs fresh founder approval.**

**Resume · Thalon** — session 54, syd4:

1. **Staging smoke compose FIRST (gate OPEN, founder-directed s54 opener):** the model-seat env edit LANDED late s53 (swordfish mail ~17:00Z, ack'd — both seats verified on the staging service + redeployed): run the smoke compose (seat = openai/gpt-5-mini, dev-verified s52) + the deferred judge-gate spend check, then the B-crm.5 staging first-run. Still open with `bash scripts/peer-mail-check.sh` — expected next: cutover step-0 confirmations + a window (top of swordfish's Next list) → lead runs steps 1–4/6–7 of the ASK-BACKS choreography (`scripts/migrate-pglite-to-tenant-pg.ts`, dry-run first, always).
2. **⑧ CRATELINE — UNGATED** (Orchard House founder-approved live at s53-close, no fix round): logistics / brutalist primary via the proven loop; commit+push immediately on ship; founder review, then ⑨ ⑩.
3. **B-crm.5 follow-ups:** weights UI surface (learned-weight provenance in the leads queue) + staging first-run (rides 1a).
4. **Fillers:** transcript bulk-delete pass (founder GO stands; s53 deferred it and the recorded reason died with the crash — re-scope at pickup, duplicates live in the library) · B-crm.4 back-half = proposal filed (`5fe8807`), BUILD WAITS on the founder verdict.
5. **Next checkpoint items (lane-B opens, full detail in COORDINATION-ARCHIVE.md s53 record):** ratify the cache exemption · B-rls.2 charter candidate (withTenantSession adoption → non-owner app role → FORCE) · standing scratch-admin role for the gated pg test · ms-fidelity caveat.

▎ ▸ **Read first:** `CLAUDE.md` → this file → `bash scripts/peer-mail-check.sh` → COORDINATION.md (the live board — pruned 2026-07-17; s53 close record = COORDINATION-ARCHIVE.md tail) → memories `higgsfield-kompozy-assignment` + `crm-lead-scoring-candidate` + `vps-deploy-swordfish` (s53 entries) → `.context/notes/lane-wrap-b-rls-s53.md` (full lane-B record incl. the honest RLS scope statement).

▎ ▸ **State:** main = origin @ s53-wrap commit (PR #55 rebase-merged on `5fe8807`; branch + worktree GC'd; no open PRs) · migrations through **0013** — neither shared DB has applied 0012/0013 yet; dev PG picks them up on its next migrate · **RLS is a LATENT second belt** (binds only non-owner roles; FORCE off until B-rls.2 — primary enforcement stays the TenantCtx repo layer) · wave-2: ⑥ ⑦ + the Orchard House insert all shipped + founder-approved; ⑧ ⑨ ⑩ remain · outreach prompt = v3 · staging: 8 pinned / 16 active leads; model seats LIVE (gpt-5-mini ×2, swordfish-verified) · dev server STOPPED · static server 8899 serves `sites/` (Orchard House review rides it) · claude-design projects: T6 Houselights, T7 Vance & Alder, T8 Orchard House.

▎ ▸ **s53 ratchets/lessons (full list in COORDINATION-ARCHIVE.md s53 record):** rls-ratchet executable invariant (new table without `tenantIsolation()` fails the suite) · pg-pool discards errored connections — session state must be transaction-scoped (pinned in code) · vendor coerces nano_banana_pro→NB2/flash on Plus (record the TRUE model) · claude-design https serve blocks localhost assets → 8899 static server · tmux-server death detection = `git log origin/main..main` + `git status` + CURRENT stamp at session start (memory ratchet); root cause per swordfish = kernel OOM (s53 claude at 3.7 GiB; `OOMPolicy=stop` took the whole unit) — `OOMPolicy=continue` now live fleet-wide, a future OOM kills one process only · inbound peer mail can carry guard tokens into tracked files — the pre-commit guard is the net (caught one live; redact on arrival).

▎ ▸ **[founder] queue (NEEDS-STEVEN.md):** s40 re-critique launch approval · month-end credit call · B6.7 domains (none pre-authorized). Closed live at s53-close: Orchard House review (APPROVED) + staging seats (swordfish landed them).

▎ ▸ **Standing:** stealth holds · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · get_cost preflight per mint, ≥40cr = ping · hero = best roster model; text-in-scene = text-precise seat · templates judged IN MOTION · aspect variants = own-engine recut · design authored by Fable 5 directly, never delegated · lead drives lanes/tmux/interactive flows · dev = real Postgres · PGlite single-process (stop the app before any volume copy) · **at wrap: "message me when you're done" = append `## Wrap ping for the founder (s54)` to ASK-BACKS-FOR-SWORDFISH.md + guard + commit + push (Telegram ≤10 min).**

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no open PRs; no worktrees; no lanes; no Monitors; no in-flight renders/vendor jobs; dev server stopped; guard green at HEAD; CI green through PR #55's checks — the post-merge main run (rebased PR tree + docs commits) rides the same suite.

## Pointer

Read in order: `CLAUDE.md` → this file → COORDINATION.md (live board) + COORDINATION-ARCHIVE.md tail (s53 close record) → `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` (cutover choreography + staging env ask) → `.context/notes/lane-wrap-b-rls-s53.md` → `proprietary/templates/sites/orchard-house/` (newest reference build) → `docs/proposals` §Session-53 addendum (B-crm.4 back-half).

## Delta (session 53 — full record in COORDINATION-ARCHIVE.md)

- Orchard House shipped (`fc222ab`) · Lane A merged (PR #54: learn loop + 0012) · Lane B merged (PR #55: RLS 0013 on 25 tables + verified PGlite→PG copy CLI; latent-belt honest scope; FORCE off until B-rls.2) · cutover choreography filed in ASK-BACKS · call scripts → `.context/leads-dogfood/call-scripts-s53.md` · B-crm.4 back-half proposal (`5fe8807`) · staging smoke still blocked (no env reply) · transcript bulk-delete deferred to s54 · **s53 died in the 16:36Z agent-tmux server crash mid-wrap; follow-up session pushed the stranded commit, merged #55, GC'd the lane, and wrote this stamp.**

## Next action

Session 54 = staging smoke compose first (gate open, founder-directed opener), then ⑧ Crateline (approved + ungated); cutover unblocks on swordfish's step-0 + window; transcript bulk-delete re-scope rides the first app boot. No standing lane grant — ask before launching. Founder-gated backlog unchanged: re-critique, credit call, B6.7 domains, ⑨ ⑩, post-wave-2 design phase.
