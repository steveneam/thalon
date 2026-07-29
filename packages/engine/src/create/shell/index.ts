/**
 * The Create module's own shell — the two model calls it makes itself
 * (SPINE §1: shell is read-only; core meters it):
 *
 *  - `describe-reference.ts` — `create.describe_reference`, the ONE call in
 *    this repo that hands a model an image. Metered from `../reference.ts`.
 *  - `ai-edit.ts` — `create.ai_edit`, the R8 rewrite. Metered from
 *    `../edit.ts`.
 *
 * Neither imports `@thalon/db`; neither writes anywhere. Both ship with a
 * deterministic fake so the suite stays keyless and networkless.
 */
export {
  aiEditPromptContext,
  aiEditPromptText,
  aiEditPromptVersion,
  createFakeAiEditDriver,
  gatewayAiEditDriver,
  type AiEditCall,
  type AiEditDriver,
  type AiEditRequest,
} from "./ai-edit";
export {
  createFakeReferenceVisionCallDriver,
  describeReferencePromptText,
  describeReferencePromptVersion,
  gatewayReferenceVisionDriver,
  referenceVisionOutputSchema,
  type GatewayReferenceVisionDeps,
  type ReferenceVisionCall,
  type ReferenceVisionCallDriver,
} from "./describe-reference";
