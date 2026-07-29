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

---

## THE WINDOW AS FROZEN (s87 lead, merge `ff55f0f`) — read before you plan

The contract window is **on main and frozen**. Consume it; never edit it.
Several shapes differ from the spec's prose sketch — the differences are
deliberate and grounded, so treat THIS section as the truth and do not stop
to report these as surprises.

**Contracts — `@thalon/contracts`, `src/create-run.ts`:**
- `CREATE_FAMILIES` = `post | video | page | email` (closed; the dispatch key).
  `CREATE_MODES` = `prompt | wizard`. `CREATE_RUN_STATUSES` = the same four
  words as `FANOUT_RUN_STATUSES`, with the same "telemetry, never control
  flow" doctrine.
- `createBriefSchema` / `createPlanSchema` — parse at your boundaries; the
  repo parses again at the write door.
- **`platformPlanSchema` binds `admitted` and `refusal` to each other**: a
  refused platform WITHOUT a reason is unstorable, and an admitted one WITH
  a reason is too (`createPlanSchema.superRefine`). R10 is structural here,
  so your derivation must always produce the sentence. `CREATE_REFUSAL_CODES`
  = `unknown_platform | channel_not_connected | family_platform_mismatch |
  media_required` — the codes your tests pin; messages stay free prose.
- `costPreviewSchema.unestimated` is the honesty valve: when you cannot
  price something, NAME why rather than emitting a 0.
- **`CREATE_CHILD_KINDS` = `fanout_run | draft | video_project` — THREE, not
  the four-way per-family set the spec sketched.** Ground truth: every
  family lands through the shared single-draft spine or the fan-out, and
  `drafts.fanout_run_id` is NOT NULL, so page and email produce a
  `fanout_run` anchor + `draft` exactly like a post does
  (`runWebPageGeneration`/`runOutreachEmail` both return `runId` + `draft`).
  Only staged video additionally owns a `video_project`.
- `platformRoutingSchema` + `DEFAULT_PLATFORM_ROUTING` — **family → default
  destinations**, on `brand_profiles.config.platformRouting`. This is NOT
  the existing `routing` field (bucket → platforms, read by `fanout/routing.ts`);
  both may coexist. It is a `partialRecord`: `z.record()` over an enum key is
  EXHAUSTIVE in zod 4 and refused every partial map — pinned by a test.
  The demo default ships only reachable destinations; `page`/`email` are
  absent on purpose and there is **no `youtube` key anywhere** (no platform
  key, no capability row, no driver — see `SETTINGS_DEFERRED`).

**Media roles — `src/media.ts`:**
- `MEDIA_ROLES` = `use | reference`. Optional on `mediaRefEnvelopeSchema`
  (pre-window media parses byte-identically; absent reads as `use` via
  `mediaRole()`), and **REQUIRED** on `createBriefMediaSchema` — the attach
  door demands the choice.
- **Use `outputEligible()` for the licensing wall — do not hand-roll
  `role !== "reference"`.** It is the one filter, so a future third role
  cannot land on the publish side. Your criterion-4 test pins the engine
  half: reference bytes never reach draft `mediaRefs`.

**Storage — `@thalon/db`:**
- `repos.createRuns`: `create` (idempotent by `generationKey` — a Create run
  SPENDS, so a double-clicked Generate must return the first run),
  `recordPlan`, `recordChildren` (**replaces the full set**, so a retried
  dispatch converges instead of doubling), `recordLastError`, `setStatus`,
  `get`, `getByGenerationKey`, `list`. Per-child failure rides
  `children[].error` verbatim; run-level failure rides `lastError`.
- `create_runs` deliberately holds no brand-profile id/version and no judge
  state — the child fan-out row already carries that provenance.

**D3 settings slice** (`src/platform-settings.ts`) ships in this window but
has **no consumer in your lane** — it is the Composer's rail (B-create.3/.4)
and the video arc's shared slice. Do not wire it.
