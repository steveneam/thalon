# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-13 (session 27, syd4) · **THE LEADS ENGINE SHIPPED: contract window 1 opened+frozen (PR #38) with two RECORDED amendments (1a eval-origin/pin PR #39 · 1b pain_point PR #40, founder mid-session direction) → B-crm.1 intake + B-crm.2 deterministic scoring + ranked queue MERGED (PR #41) and auto-deployed.** The founder's ask is live end-to-end: CSV/waitlist + ICP → ranked queue with readable reasons — zero LLM calls (embeds via the metered choke point). Founder shaped the feature live all session; every direction is recorded in the leads proposal §Session-27 addendum. Scoring-algorithm survey (approved single research run) filed at `docs/research/lead-scoring-algorithms.md`. Suite of record **1063/3/0**; guard clean; CI green.

## Resume prompt (session 28, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-13, session-27 wrap.

**Resume · Thalon** — session 28, syd4 — **Sprint 7 continues: B7.a/e features, then dogfood the leads queue.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `COORDINATION.md` Sprint-7 board + session-27 messages → `docs/proposals/2026-07-13-leads-engine-gated-crm.md` §Session-27 addendum → `docs/research/lead-scoring-algorithms.md` (§5 recommendations).

▎ ▸ **State:** main = origin @ session-27 wrap · suite **1063/3/0** · leads engine live on staging behind the edge (every main push auto-deploys) · contract windows 1/1a/1b all frozen · B7.a cadence + B7.e routing **config schemas already in the frozen contract** (optional blocks on `brandProfileConfigSchema`; absence disarms) · vendor-visual block still gated on the founder's meta-prompt.

▎ ▸ **Session-28 plan:** (1) **B7.a cadence gate** — judge-harness rule beside denylist/grounding consuming `cadence` config (counting queued/approved drafts per platform per window — derivable from existing tables, no new schema); (2) **B7.e routing table** — bucket→platform map consumed at fan-out; both on the `features` lane branch `agent/features/b7ae` (sequential lead work); (3) **dogfood the leads queue on staging** — seed tenant #0's ICP (verbatim from proposal §ICP seed draft, founder edits pending) via the profiles POST, import a real prospect CSV, first real ranked queue → founder review; (4) if room: B7.c persona-brief editor (apps/web is free — leads lane merged).

▎ ▸ **[founder] queue:** the build-method video meta-prompt + Higgsfield tier (STILL the vendor-visual trigger, his timing) · ICP seed edit (non-blocking — the draft ships as-is to tenant #0 at dogfood) · gateway top-up before first real judged generation ($4.9) · B-crm.3 enrichment-provider shortlist + B-crm.4 outreach mailbox decisions land at the next checkpoint (with the B-crm.5 learn-loop shortlist from the research brief).

▎ ▸ **Standing:** stealth holds · founder `.env.local` edits arrive BOM+CRLF — normalize · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · any lane/subagent launch needs fresh founder go (session-27's research agent was a founder-named single run).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: all work merged to main via PRs #38–41 (windows + amendments + B-crm.1/2); board/proposal/memory updated; guard passing; suite 1063/3/0; local = remote on main; no open PRs; no worktrees; no mid-edit state.

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-7 board + session-27 wrap message) → leads proposal §Build plan + §Session-27 addendum → `docs/research/lead-scoring-algorithms.md`.

## Delta (session 27)

- **Contract window 1 opened AND frozen same session** (PR #38): `leads` + `lead_scores` + ICP block — plus B7.a/e config schemas (scope call recorded honestly on the board: the features lane depends on w1 frozen and zod strips unknown keys; A13 one-window lesson over a mid-sprint edit). Two recorded re-plan amendments: **1a** `lead_triage` eval origin + `leads.setPinned` (PR #39) · **1b** `leads.pain_point` (PR #40, founder direction — outreach's anchor, first-class not meta).
- **B-crm.1 + B-crm.2 merged** (PR #41, four bucket commits): idempotent waitlist bridge · zero-dep RFC-4180 CSV import speaking HubSpot/Salesforce/Pipedrive/snake_case headers (verified against vendor docs) with per-row honest reports · trend-ranker-shaped scorer (armed-signals-only, dealbreaker hard zeros, reasons verbatim) · scoring job with ICP-drift re-score, metered embeds, empty-text exclusion (8a2bbba) · Leads queue surface (thermal pills, one-door single/bulk triage → eval rows, per-family exits through the ONE intel capture door — the founder's composition requirement — CSV import + template + waitlist sync + Score now).
- **Founder shaped the feature live** — all recorded in the proposal §Session-27 addendum: composition requirement · pain_point first-class · B-crm.4 = email+DM both gated, auto-approve = B7.b earned ladder · lead-DNA warmth over machine metrics · pipeline-as-framework confirmation.
- **Research brief filed** (approved single agent run): `docs/research/lead-scoring-algorithms.md` — Beta-posterior learn loop + Wilson bounds (the B-crm.5 shape, zero new data) · two-axis grading · HN-gravity sort; events-blocked and graph items deferred with reasons.
- **Ratchets:** hermetic `THALON_DATA_DIR` in web test setup (dev `.data` leaked into blog seam tests on PGlite race wins — 3 local-only failures reproduced on clean main, fixed) · root eslint ignores gitignored `.context/` (local lint now matches CI; it was failing on dropped-in files) · tenancy/events/additivity ratchet lists all extended in-window.

## Next action

Session 28: B7.a cadence gate + B7.e routing table (features lane, config already frozen) → leads-queue dogfood on staging (seed ICP, real CSV, founder reviews the first ranked queue). Founder, at his own pace: meta-prompt + tier (vendor-visual trigger) · ICP edit · top-up.
