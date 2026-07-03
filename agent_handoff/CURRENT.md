# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-03 · **Sprint 0 complete** (B0.1–B0.5 all merged to main)

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (§ Amendments) → `docs/SPINE.md` → `COORDINATION.md` (board + wrap messages) → `eval/README.md`.

## Delta (this session)

- **B0.4 merged** (PR #4): `eval/` package — override capture proven end-to-end by test (draft → judge → queued → operator edit → `eval_cases` → exported JSONL with provenance), golden seed (only-grows floor test), promptfoo + DeepEval proven keyless, Langfuse `tracing` seam in platform, `evalCases.list` read repo (contract freeze intact).
- Earlier same day: B0.3 (PR #2) and B0.5 (PR #3) merged; first OIDC deploy green.
- Standing directives in force (agent memory): lead drives lane/merge mechanics end-to-end; no AI attribution anywhere on GitHub.
- Housekeeping owed: remove `.claude/worktrees/b05-aws` + local `worktree-b05-aws` branch once the Lane B terminal is closed (was file-locked at wrap).

## Next action

**Founder: Sprint-0 exit glance** (charter exit boxes for B0.x are all deliverable-complete; remaining exit criteria are Sprint-1 items). Then **cut Sprint-1 lanes** per SPINE §5 lane map — engine (`packages/engine/**`, B1.1→B1.2) · judge (`proprietary/judge/**`, B1.3) · ui (`apps/web/**`, B1.4 vs MSW mock) · eval (`eval/**`, arms at B1.5); merge order engine → judge → ui → eval. B1.1 (source-ingest) starts first — it has no upstream dependency now.

## [you] — founder-supplied, outstanding

`AI_GATEWAY_API_KEY` (first real model calls, B1.1 embeddings / B1.2 generation) · Langfuse keys/host (optional until dogfooding).
