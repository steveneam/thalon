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
 *  - `reference.ts` — the reference-describe seam and its metering (the
 *                     licensing wall lives in `outputEligible`).
 *  - `edit.ts`      — R8: propose an AI edit (writes nothing) and apply it
 *                     through the existing edit door, re-judged.
 *  - `shell/`       — the module's two OWN model calls, read-only:
 *                     `create.describe_reference` and `create.ai_edit`.
 *
 * Module layout follows SPINE §1: deterministic core, with LLM calls behind
 * injectable drivers, metered from core. Every OTHER model call this module
 * causes belongs to a family engine it dispatches to, or to the judge
 * harness it hands drivers to — it makes none of those itself.
 */
export {
  AI_EDIT_ACTOR,
  AI_EDIT_STATUSES,
  aiEditDraft,
  applyAiEdit,
  createFakeAiEditDriver,
  gatewayAiEditDriver,
  markVariantDiverged,
  type AiEditDeps,
  type AiEditDriver,
  type AiEditProposal,
  type AiEditProposalResult,
  type AiEditRequestInput,
  type ApplyAiEditDeps,
  type ApplyAiEditInput,
  type ApplyAiEditResult,
} from "./edit";
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
  meteredReferenceVisionDriver,
  renderReferenceBlock,
  renderReferenceNotes,
  type DescribeReferenceDeps,
  type MeteredReferenceVisionDeps,
  type ReferenceDescription,
  type ReferenceVisionDriver,
  type ReferenceVisionOutput,
  type ReferenceVisionRequest,
} from "./reference";
export {
  referenceDescribability,
  type ReferenceDescribability,
} from "./reference-scope";
export {
  aiEditPromptContext,
  aiEditPromptVersion,
  createFakeReferenceVisionCallDriver,
  describeReferencePromptVersion,
  gatewayReferenceVisionDriver,
  referenceVisionOutputSchema,
  type AiEditCall,
  type AiEditRequest,
  type GatewayReferenceVisionDeps,
  type ReferenceVisionCall,
  type ReferenceVisionCallDriver,
} from "./shell";
export {
  createGenerationKey,
  loadPlanContext,
  renderWizardSlots,
  runCreate,
  type CreateRunDeps,
  type CreateRunResult,
} from "./run";
