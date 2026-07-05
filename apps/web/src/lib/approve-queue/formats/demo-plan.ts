import {
  demoPlanDraftMetaSchema,
  demoPlanStepSchema,
  DRAFT_FORMAT_REGISTRY,
  type DemoPlanDraftMeta,
  type DemoPlanStep,
} from "@thalon/contracts";

/**
 * B4.2: the canonical `demo_plan` step + meta schemas now live in the
 * format contract registry (@thalon/contracts — dependency-light by design,
 * so this app no longer keeps a hand-synced mirror of the pinned cross-lane
 * contract). Plain `z.object()` ignores unknown extra keys, which is all
 * the "tolerate additive extension" contract requires here.
 */
export { demoPlanDraftMetaSchema, demoPlanStepSchema, type DemoPlanDraftMeta, type DemoPlanStep };

/** Returns null when `meta` isn't a valid demo_plan meta shape (e.g. absent, or a different format's meta). */
export function parseDemoPlanMeta(meta: unknown): DemoPlanDraftMeta | null {
  const result = demoPlanDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}

/**
 * The body a demo_plan draft's steps would produce — the registry's
 * judged-body derivation (narrations joined "\n\n", the pinned contract's
 * body convention). An operator edit changes `draft.body` but never this
 * meta, so comparing the two is how `FormatDetail` detects the step table
 * has gone stale.
 */
export function expectedDemoPlanBody(meta: DemoPlanDraftMeta): string {
  return DRAFT_FORMAT_REGISTRY.demo_plan.expectedBody(meta);
}
