# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 (session 3) · **SPRINT 1 COMPLETE — B1.2 (PR #8) + B1.5 (PR #9) merged, dogfooded live end to end; claude-cli dev transport added (PR #10)**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` → `docs/SPINE.md` (§5) → `COORDINATION.md` (Sprint-1 board + the 2026-07-04 B1.5 wrap message — live-run ratchets and follow-ups live there).

## Delta (this session)

- **B1.2 fan-out merged (PR #8)**: one source → N drafts, profiles/prompts as versioned data, idempotent + self-healing replay (lead review caught the silent-partial-replay bug pre-merge).
- **B1.5 exit gate merged (PR #9)**: dogfood slice runner (`npm run -w @thalon/eval dogfood`), keyless chain test, CI `eval-gate` job armed (deterministic suite = ship gate), golden-G3 live runner (first run 6/6). **Dogfooded live on tenant #0**: generate → judge-block → operator edits (5 eval rows captured + exported) → re-judge → queued → **human-approved**. The judge caught a genuine embellishment live (sonnet final failed an added ungrounded rationale the haiku screen passed — ratified decision 2 proven).
- **claude-cli dev transport (PR #10, founder-requested)**: `claude-cli/<alias>` model tiers run on the founder's Claude subscription via headless Claude Code — build/test only, embeddings stay on gateway. Founder's `.env.local`: draft/final=claude-cli/sonnet, screen=claude-cli/haiku (restores ratified two-tier strength without gateway credits).
- Ratchets landed with their lessons (see the board message): judge/fanout `lastError` surfacing (operational vs editorial fails), PGlite single-writer CLI guard, export data-dir fix, Turbopack `new URL(rel, import.meta.url)` ban in db client.

## Next action

**Session start: present the Sprint-1 exit review to the founder** — walk the charter exit criteria (all code-side criteria verified this session; the operational-mirror item is founder-side), then propose **B2.1** (fictional tenant #2 as pure runtime config; exit criterion: zero code changes). One queued and one blocked draft sit in the approve queue as real triage items (`npm run dev` → /approve).

## [you] — founder-supplied, outstanding

- Optional: AI Gateway credit top-up (dashboard → AI Gateway → top-up) — restores the ratified `anthropic/claude-sonnet-4.5` final-judge default via config; required before any production traffic (Sprint 3+). Build/test currently runs on the claude-cli seam instead.
- Optional until dogfood needs tracing: Langfuse keys/host (`eval/README.md`).
