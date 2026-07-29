# KICKOFF — lane `create-engine` (B-create.2: the Create run engine)

**Spec APPROVED by the founder, s86 close** (`docs/create-engine/spec.md` — read it
FIRST and in full; it is your charter). Launch is Mode B in the `thalon` tmux session.
You own `agent/create-engine`, worktree `.claude/worktrees/create-engine`.

**Ships disarmed, zero spend.** No live gateway calls (every AI/vision step is behind
an injectable driver, fake in tests), no publish-path changes, no UI.

---

## What you build — and what you do NOT

You build **B-create.2 from the spec**: plan derivation + the run orchestrator +
the reference-describe seam. The contract window (B-create.1: `create_runs`, media
`role`, `platform_routing`, the D3 settings slice) **lands FIRST at the session boot,
by the lead — it will be frozen on main before you launch**. Build on it; if a schema
you need is missing or wrong, STOP and report — a lane never edits the contract
mid-flight.

You do NOT build: any surface (B-create.3/.4 are sheets-first, lead-direct), the
Composer, media upload routes, D2 analytics, or any new generation code — the family
engines exist and you dispatch to them.

## The shape (spec §Design/The engine — acceptance criteria)

1. `packages/engine/src/create/plan.ts` — **pure** plan derivation:
   `deriveCreatePlan(brief, {routing, matrix, profile})` → `CreatePlan` or refusals
   with reasons (unknown platform · disconnected channel · family/platform mismatch
   per the D0 capability matrix). Every refusal reason pinned by a test (spec R3,
   Error Behavior).
2. `packages/engine/src/create/run.ts` — `runCreate(brief, deps)`: plan → dispatch
   (post→`fanout` · video one-prompt→`origination` · video staged→`direction` ·
   email→compose · page→`webpage`) → `create_runs` row with child refs. **Judging
   stays inside the family engines — the orchestrator must be shown by test to never
   bypass it** (a fake family engine that records whether it was called with its
   judge deps intact).
3. Partial failure: one family/platform child failing is RECORDED (status + verbatim
   reason), the others proceed (spec Error Behavior). Test-pinned.
4. `packages/engine/src/create/reference.ts` — the reference-describe seam:
   `describeReference(ref, deps)` behind an injectable vision driver (fake only).
   **Reference-role media never reaches draft `mediaRefs`** — pin with a test whose
   comment says this is the licensing wall (spec R4, Invariants).
5. Blog-mirror pairing (spec R-design): a post-family plan that includes the blog
   destination records the article↔social pairing in the plan; test the derivation.
6. Variant provenance groundwork (spec R13): the run row records the master/variant
   relationship the Composer will read — derivation only, no UI.

## File set — DISJOINT, hard boundary

Yours: `packages/engine/src/create/**` (new) + its tests. Read-only everywhere else.
A second lane (`analytics-spine`) is live on `packages/engine/src/social/` +
`packages/engine/src/integrations/` + `packages/db/src/repos/publication-metrics*` —
**touch none of it**. The contracts/db files from the window are FROZEN — consume,
never edit. Needing a file outside your set = STOP and report (re-plan, not ad-hoc).

## Gates, and the box

- `npx vitest run --maxWorkers=2` (two lanes live; unbounded pool OOMs the box —
  measured s82) · **never `pkill -f vitest`** (kills the neighbour's suite; s82: it
  did) · vitest does NOT typecheck — run `npm run typecheck` · done = `npm run
  verify` green on EXIT CODE in your worktree · never `npm install` in a worktree.

## Wrap

`agent_handoff/lanes/WRAP-create-engine.md`: what shipped, the dispatch table as
built, any spec point you disagreed with (say it, don't silently substitute), what
you deliberately did not build. Commit on your branch, push, stop. **The lead
rebases/merges — you do not.**
