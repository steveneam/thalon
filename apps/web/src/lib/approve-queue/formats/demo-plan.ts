import { z } from "zod";

/**
 * `demo_plan` draft meta (B2.5). This is the pinned cross-lane contract
 * agreed with the demo (B2.5) lane at wave-2 kickoff — B2.5 emits exactly
 * this shape and may only extend it additively, so this mirror deliberately
 * does not reject unknown extra keys (plain `z.object()` already ignores
 * them rather than erroring, which is all "tolerate" requires here).
 */
export const demoPlanStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  action: z.enum(["goto", "click", "fill", "press", "expect"]),
  /** URL (for goto) or CSS selector (all other actions) */
  target: z.string().min(1),
  /** Text typed / key pressed / assertion text — empty string when N/A */
  value: z.string(),
  /** Operator-facing narration; the narrations joined "\n\n" = drafts.body (the judged text) */
  narration: z.string().min(1),
});

export const demoPlanDraftMetaSchema = z.object({
  steps: z.array(demoPlanStepSchema).min(1),
  crawlSourceId: z.string(),
  pageUrls: z.array(z.string()).min(1),
  captureStatus: z.enum(["planned", "captured", "failed"]),
  captureRef: z.string().nullable(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});

export type DemoPlanStep = z.infer<typeof demoPlanStepSchema>;
export type DemoPlanDraftMeta = z.infer<typeof demoPlanDraftMetaSchema>;

/** Returns null when `meta` isn't a valid demo_plan meta shape (e.g. absent, or a different format's meta). */
export function parseDemoPlanMeta(meta: unknown): DemoPlanDraftMeta | null {
  const result = demoPlanDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}

/**
 * The body a demo_plan draft's steps would produce — narrations joined
 * "\n\n" (the pinned contract's body convention). An operator edit changes
 * `draft.body` but never this meta, so comparing the two is how
 * `FormatDetail` detects the step table has gone stale.
 */
export function expectedDemoPlanBody(meta: DemoPlanDraftMeta): string {
  return meta.steps.map((step) => step.narration).join("\n\n");
}
