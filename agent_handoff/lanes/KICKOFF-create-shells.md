# KICKOFF — lane `create-shells` (B-create.2 follow-through: the Create engine's two chartered LLM shells)

**Charter: `docs/create-engine/spec.md` (APPROVED)** — §Design/The engine
("a `describeReference` step: gateway vision call, metered, plan-visible") and
**R8** ("AI edit (instruction → regenerate that variant) — both re-judge before
the variant can leave the Composer. The judge gates; it never rewrites unasked")
with its Error Behavior clause ("AI-edit judge rejection: the variant keeps its
prior body; the refusal shows at the control — never a silent revert"). Read the
spec AND `agent_handoff/lanes/WRAP-create-engine.md` in full first — §6 of that
wrap names exactly what was deliberately left for you and why.

Launch is Mode B in the `thalon` tmux session. You own `agent/create-shells`,
worktree `.claude/worktrees/create-shells`.

**Why this lane exists:** B-create.2 shipped the deterministic core with every
LLM seat injectable and fake. The Composer build (B-create.4) needs two of those
seats REAL: the wizard's reference role is honest-but-inert until something can
describe a reference, and the Composer's AI-edit door is its central interaction.
Both are pure engine work, zero UI — which is what makes this laneable while the
lead draws the Create sheets.

**Ships disarmed, zero spend in tests.** Live drivers exist behind
`AI_GATEWAY_API_KEY` and are never constructed in tests; every test injects the
deterministic fake. No publish-path change, no UI, no routes.

---

## What you build

### 1. The real reference-describe driver

`packages/engine/src/create/shell/` (new folder — the house shell pattern; copy
the shape of `edl/shell/generator.ts`): a `ReferenceVisionDriver` implementation
over the gateway, metered through `withGatewayGuard` under the NEW operation
label **`"create.describe_reference"`**.

- **Edit `packages/engine/src/__tests__/shell-inventory.test.ts` to add the
  label, and refresh the SPINE §1 shell-inventory sentence (`docs/SPINE.md`) in
  the same change** — the ratchet's own header tells you this. That edit is the
  deliberate, review-visible act the ratchet exists to force; the s87 lane
  refused to make it from outside its file set, and it is IN yours.
- **Scope: STORED image refs only** (bytes from the content-addressed object
  store; the gateway rides AI SDK v5, which accepts image content parts —
  verify your chosen model tier does too, and record the check). An EXTERNAL
  ref stays honestly "attached, not yet analysed" through the existing degrade
  path — fetching a stranger's bytes at describe time is a different decision
  with licensing texture, and it is deliberately NOT this lane's. Audio-family
  refs refuse with the reason in words.
- **Model tier: report first** (deliverable 1). `modelTiers()` has no vision
  tier. Either the `draft` tier's model is vision-capable and you use it, or you
  add an OPTIONAL `MODEL_VISION` env (defaulting to the draft tier) — in which
  case `packages/platform/src/env.ts` + `gateway.ts` enter your file set for
  that one additive var, and you say so in the report BEFORE building.
- The describer's output threads through the EXISTING `reference.ts` seam
  untouched — the one canonical notes rendering, the honest degradation, the
  licensing wall (reference bytes/notes never become draft media) all stay
  test-pinned. If `deriveCreatePlan`'s cost preview does not yet count describe
  calls in `meteredCalls`, make it count them (that is what "plan-visible"
  means in the spec).

### 2. The R8 AI-edit verb

**Deliverable 1, REPORTED before building** (one paragraph in your
wrap-in-progress — the seam-decision-first discipline that produced the s87
analytics lane's best work): the shape. Ground it in what exists — the drafts
state machine (`repos/drafts.ts`, its single transition function), `edit_diffs`
(the existing operator-edit path and its I1 body-hash discipline), and
`runJudgePipeline` (how `create/run.ts` already re-judges still-`generated`
drafts). Your report answers: where the verb lives, which draft statuses it
accepts, how the edit is recorded (an `edit_diffs` row? whose conventions?),
and what the judge-refusal path writes (nothing on the draft — but is the
refused attempt itself recorded, and where?). **If the state machine lacks a
transition you need, STOP and report — the transition function is not yours to
edit.**

Then build `packages/engine/src/create/edit.ts`:

- `aiEditDraft(ctx, repos, {draftId, instruction}, deps)` — shell rewrite under
  the NEW label **`"create.ai_edit"`** (second shell-inventory entry, same
  deliberate act) → judge re-run through the SAME harness with the caller's own
  drivers → on pass, the edit lands through the existing edit path; on judge
  refusal, **the draft keeps its prior body byte-for-byte and the refusal
  returns verbatim** (spec Error Behavior — pin this with a test that asserts
  the body hash is unchanged).
- The orchestrator's rule holds here too: **this module makes no judge call of
  its own outside the shared harness, and a test proves the judge deps were
  threaded intact** (the s87 `run.test.ts` pattern — a fake that records
  whether it was called with its judge deps).
- Variant provenance (spec R13): an AI edit marks the variant diverged from its
  master exactly as a hand edit would — derivation groundwork only, no UI.

### What you do NOT build

Any surface, route, or Composer wiring (B-create.3/.4, lead-gated) · media
upload doors · persisting describe outcomes beyond what `CreateRunResult`
already returns (a durable home is a future window decision, per the
create-engine wrap §6) · promotion of `createVariantPlanSchema` into contracts
(window work) · anything in `social/**` (a second lane is live there).

## File set — DISJOINT, hard boundary

Yours: `packages/engine/src/create/**` (incl. the new `shell/`) ·
`packages/engine/src/__tests__/shell-inventory.test.ts` (the two labels) ·
`docs/SPINE.md` (§1 sentence only) · `packages/platform/src/env.ts` +
`packages/platform/src/gateway.ts` ONLY if your reported model decision adds
the optional vision var. **NOT yours:** contracts, `packages/db/**` (repos are
frozen for you — consume; missing verb = STOP and report),
`repos/drafts.ts`'s transition function, `packages/engine/src/social/**`,
sheets. Outside the set = STOP and report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` (a second lane is live) · **never
  `pkill -f vitest`** · `npm run typecheck` (vitest does not) · done =
  `npm run verify` green on EXIT CODE in your worktree · never `npm install`
  in a worktree.

## Wrap

`agent_handoff/lanes/WRAP-create-shells.md`: both reported decisions and what
survived contact with the code, the two shell entries as merged, the model-tier
choice with its vision-capability check, the judge-refusal semantics AS
test-pinned, any spec point you disagreed with (say it, don't substitute), what
you deliberately did not build. Commit on your branch, push, stop. **The lead
rebases/merges — you do not.**
