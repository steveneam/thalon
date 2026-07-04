import { z } from "zod";

/**
 * Pinned draft shape — the cross-lane contract with B2.6 (CHARTER B2.5): the
 * queue UI renders EXACTLY this core; this lane may extend it additively but
 * never rename/remove a field. Mirrors ../waterfall/schemas.ts's doc style
 * for `clipPlanDraftMetaSchema`.
 *
 * `drafts.body` = every step's `narration`, joined with `"\n\n"` (the
 * G3-groundable text; `body_hash` binds verdicts to it, invariant I1 —
 * mirrors `clip_plan`'s body convention). `drafts.meta` validates against
 * `demoPlanDraftMetaSchema` below.
 */
export const demoPlanStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  action: z.enum(["goto", "click", "fill", "press", "expect"]),
  /** URL (for goto) or CSS selector (all other actions) — must exist in the flow map */
  target: z.string().min(1),
  /** Text typed / key pressed / assertion text — empty string when N/A */
  value: z.string(),
  /** Operator-facing narration for this step; the joined narrations form drafts.body */
  narration: z.string().min(1),
});

export type DemoPlanStep = z.infer<typeof demoPlanStepSchema>;

export const demoPlanDraftMetaSchema = z.object({
  steps: z.array(demoPlanStepSchema).min(1),
  /** sources.id of the site_crawl this storyboard grounds against */
  crawlSourceId: z.string(),
  /** URLs the storyboard touches, from the flow map */
  pageUrls: z.array(z.string()).min(1),
  captureStatus: z.enum(["planned", "captured", "failed"]),
  /** null until a capture succeeds; then the content-addressed object-store key of the capture bundle */
  captureRef: z.string().nullable(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});

export type DemoPlanDraftMeta = z.infer<typeof demoPlanDraftMetaSchema>;

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
