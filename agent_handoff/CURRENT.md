# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 (session 2) · **Sprint 1: B1.1 + B1.3 + B1.4 merged — B1.2 launch presented and deferred by founder; awaiting go**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` → `docs/SPINE.md` (§5) → `COORDINATION.md` (Sprint-1 board + 2026-07-04 wrap message — ratchets and follow-ups live there).

## Delta (this session)

- B1.2 fan-out launch plan presented to the founder per the standing fresh-approval rule; founder chose **defer**. No lane launched; board unchanged (`b12 pending founder go`). No code changes this session.
- Founder-shared repos evaluated and parked per pulled-not-pushed (recorded in agent memory, `future-tooling-candidates`): **Remotion** → natural fit for B3.3/B3.4 when chartered, special license = recorded launch gate with swap path; **PixelRAG** (Apache-2.0 visual RAG) → candidate visual-ingest tier behind the existing ingest seam, no current bucket needs it.

## Next action

**Session start: ask the founder whether to launch B1.2 fan-out** (launching lanes needs fresh approval every time — a prior defer does not carry over). Plan unchanged: engine lane, one worktree subagent, branch `agent/engine/b12-fanout` — one source → N drafts in `packages/engine/src/fanout/`; LinkedIn+X niche profiles as pure data in `proprietary/profiles/`; versioned fan-out prompts (B1.2-blocking per SPINE §6.6); generation through `withGatewayGuard`; run-twice idempotency on `fanout_runs`; drafts land `generated` only (negative test: can't reach queue without judge); lane aliases `@thalon/*` to its own worktree src (engine's configs are the reference). On merge: **B1.5** — dogfood on tenant #0, green eval suite arms as the ship gate.

## [you] — founder-supplied, outstanding

`AI_GATEWAY_API_KEY` — Vercel dashboard → AI Gateway → API Keys → create → paste into `apps/web/.env.local` (copy `.env.example`). Doesn't block B1.2 (tests keyless); needed by B1.5 dogfood at the latest. Langfuse keys/host still optional until dogfooding.
