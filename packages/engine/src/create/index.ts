/**
 * B-create.2 — the Create run engine (spec `docs/create-engine/spec.md`,
 * APPROVED 2026-07-29). Brief → Plan → Generate, over the s87 frozen
 * contract window; the Composer and the surfaces are B-create.3/.4.
 *
 *  - `plan.ts`      — pure derivation: destinations, refusals, cost preview,
 *                     blog-mirror pairing, variant provenance.
 *  - `dispatch.ts`  — one arm per family over the generation engines that
 *                     already exist and already judge.
 *  - `run.ts`       — the orchestrator: idempotent run row, per-unit failure
 *                     boundaries, child refs.
 *  - `reference.ts` — the reference-describe seam (fake driver only; the
 *                     licensing wall lives in `outputEligible`).
 *
 * Module layout follows SPINE §1: deterministic core, with LLM calls behind
 * injectable drivers. There is no `shell/` folder here because this module
 * makes no model call of its own — every one belongs to a family engine it
 * dispatches to, or to the judge harness it hands drivers to.
 */
export {
  DEFAULT_CREATE_DISPATCH,
  missingLeadError,
  type CreateDispatchInput,
  type CreateDispatchTable,
  type CreateDispatchUnit,
  type CreateFamilyArm,
  type CreateGenerationDeps,
  type CreateJudgeDeps,
  type GroundingMode,
} from "./dispatch";
export {
  CREATE_VARIANT_PLAN_KEY,
  classifyDestination,
  createVariantPlanSchema,
  deriveCreatePlan,
  readCreateContext,
  readVariantPlan,
  type CreateConnectionState,
  type CreatePlanContext,
  type CreateVariantPlan,
} from "./plan";
export {
  REFERENCE_NOT_ANALYSED,
  createFakeReferenceVisionDriver,
  describeReference,
  describeReferences,
  renderReferenceBlock,
  renderReferenceNotes,
  type DescribeReferenceDeps,
  type ReferenceDescription,
  type ReferenceVisionDriver,
  type ReferenceVisionOutput,
  type ReferenceVisionRequest,
} from "./reference";
export {
  createGenerationKey,
  loadPlanContext,
  renderWizardSlots,
  runCreate,
  type CreateRunDeps,
  type CreateRunResult,
} from "./run";
