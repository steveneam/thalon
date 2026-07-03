# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 · **Sprint 1: B1.1 + B1.3 + B1.4 merged (PRs #5–#7) — B1.2 fan-out next, then B1.5**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` → `docs/SPINE.md` (§5) → `COORDINATION.md` (Sprint-1 board + 2026-07-04 wrap message — ratchets and follow-ups live there).

## Delta (this session)

- Three parallel lanes built and merged in order: **B1.1 source-ingest** (grounding index + the `withGatewayGuard` gateway choke point) · **B1.3 judge harness** (G1 + two-tier G3, I1/I3 test-proven; lead commit wired its G3 calls through the choke point) · **B1.4 Approve queue** (3-zone UI, edit⇒capture⇒re-judge; lead commit fixed 2 effect-setState lint errors). 100/100 tests green on main; CI green on every merge.
- Lanes were paused/resumed once mid-run (usage window) — no loss.
- Standing rule reaffirmed and in force: launching lanes/subagents needs fresh founder approval each time.

## Next action

**Session start: present the B1.2 fan-out launch plan to the founder as an explicit approve/defer choice** (founder-requested 2026-07-04; launching lanes always needs fresh approval). The plan: engine lane, one worktree subagent, branch `agent/engine/b12-fanout` — one source → N drafts in `packages/engine/src/fanout/`; LinkedIn+X niche profiles as pure data in `proprietary/profiles/`; versioned fan-out prompts; generation through `withGatewayGuard`; run-twice idempotency; drafts land `generated` only (negative test: can't reach queue without judge). On approval, launch; after B1.2 merges: **B1.5** — dogfood on tenant #0, green eval suite arms as the ship gate.

## [you] — founder-supplied, outstanding

`AI_GATEWAY_API_KEY` — Vercel dashboard → AI Gateway → API Keys → create → paste into `apps/web/.env.local` (copy `.env.example`). Needed for the first live model calls (B1.5 dogfood at the latest). Langfuse keys/host still optional until dogfooding.
