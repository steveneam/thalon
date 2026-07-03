# ADR 0001 — Adopt the spine (DCPS doctrine + B0.3 amendment bundle)

- **Status:** accepted (founder, 2026-07-03)
- **Context home:** `docs/SPINE.md` (the full architecture & operating blueprint this ADR ratifies)

## Context

At the pre-B0.3 checkpoint the founder commissioned a design pass integrating three engineering references (a deterministic-core/probabilistic-shell blueprint, an AI-codebase-optimisation guide, and a multi-agent coordination primer) with the approved charter and the B0.1–B0.2 build state. The pass surfaced five structural weaknesses: engine logic accreting into `apps/web`, a dev/prod SQL-dialect drift trap (SQLite vs Postgres), no cost guardrail, override→eval capture as a habit rather than a mechanism, and missing provenance/audit primitives (fan-out runs, events, versioned prompts).

## Decision

1. **DCPS doctrine is binding** (`docs/SPINE.md` §1): LLM calls live only in designated `shell/` modules, are read-only against the DB, and cross into the core exclusively through Zod schemas in `packages/contracts`. Draft lifecycle is an explicit state machine with a single-writer transition function; judge verdicts bind to `body_hash`; deterministic work is never delegated to a model.
2. **A1 — PGlite dev seam.** The dev DB driver becomes embedded Postgres (PGlite, Apache-2.0), replacing better-sqlite3: one dialect and one migration set dev→prod, dev-side pgvector, per-worktree isolation preserved. Swap-back risk is contained to one driver file behind the existing seam.
3. **A2 — three schema additions** at B0.3: `fanout_runs` (idempotency + fan-out batch anchor), `events` (append-only audit spine), `usage_ledger` (+ per-tenant daily budget caps enforced in the gateway wrapper).
4. **A3 — package extraction** at B0.3: `packages/{contracts,db,platform,engine}` + `proprietary/{judge,prompts,profiles}` skeleton, with three enforcement ratchets — import-boundary lint, tenant-id schema test, state-machine property test.
5. **A4 — parallel plumbing:** `COORDINATION.md` lane board, `.worktreeinclude`, tracked worktree settings, and `agent_handoff/CURRENT.md` (single-file session handoff, overwritten each wrap; pointer + delta + next action, never a state dump).
6. **Draft status vocabulary** approved as SPINE §1.1: `generated → judging → queued|blocked → approved|rejected → scheduled → published`, edit ⇒ re-judge.

## Consequences

- B0.3 grows by ~1.5 days but the schema lands in its permanent home with provenance, audit, and cost-control primitives that would be expensive to retrofit.
- Build coordination state lives in git-tracked markdown (`COORDINATION.md`, `agent_handoff/CURRENT.md`); product runtime state lives in DB tables — deliberately split; neither duplicates the other.
- Deliberately deferred (revisit only on demonstrated need): Redis, Turborepo, LangGraph/AutoGen runtimes, RLS timing (B0.5+), microservices, projection tables.
