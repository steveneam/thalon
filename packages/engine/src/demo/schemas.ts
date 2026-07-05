import { z } from "zod";

/**
 * B4.2: the PINNED `demo_plan` step + draft-meta contract (the cross-lane
 * contract with B2.6 from wave-2 kickoff) lives in the format contract
 * registry — @thalon/contracts/format-registry.ts — beside every other
 * format's meta schema and capabilities. Re-exported here so engine call
 * sites keep their import paths.
 *
 * `drafts.body` = every step's `narration`, joined with `"\n\n"` (the
 * G3-groundable text; `body_hash` binds verdicts to it, invariant I1 —
 * mirrors `clip_plan`'s body convention) — declared as the registry entry's
 * `expectedBody`.
 */
export {
  demoPlanDraftMetaSchema,
  demoPlanStepSchema,
  type DemoPlanDraftMeta,
  type DemoPlanStep,
} from "@thalon/contracts";

/**
 * Shell-output validation boundary (SPINE §1: every shell output crosses
 * into the core through a Zod schema) for the B2.5 storyboard step — mirrors
 * ../waterfall/schemas.ts's `highlightSelectShellOutputSchema`. The shell
 * emits steps WITHOUT `stepIndex` (core assigns it from array order once the
 * candidate survives validation) and without the capture/provenance fields
 * (core fills those in when it builds `demoPlanDraftMetaSchema`). Structural
 * checks Zod can't express — a `goto` target must be a crawled page, every
 * other target must be a flow-map affordance selector, and no
 * duplicate/contradictory steps — are enforced in ./validate-shell-output.ts.
 */
export const storyboardShellOutputSchema = z.object({
  steps: z
    .array(
      z.object({
        action: z.enum(["goto", "click", "fill", "press", "expect"]),
        target: z.string().min(1),
        value: z.string(),
        narration: z.string().min(1),
      }),
    )
    .min(1),
});

export type StoryboardShellOutput = z.infer<typeof storyboardShellOutputSchema>;
export type StoryboardStepCandidate = StoryboardShellOutput["steps"][number];
