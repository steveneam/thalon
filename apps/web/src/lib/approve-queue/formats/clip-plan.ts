import {
  clipPlanDraftMetaSchema,
  DRAFT_FORMAT_REGISTRY,
  type ClipPlanDraftMeta,
} from "@thalon/contracts";

/**
 * B4.2: the canonical `clip_plan` meta schema now lives in the format
 * contract registry (@thalon/contracts — dependency-light by design, so
 * this app no longer keeps a hand-synced mirror of the engine's schema).
 */
export { clipPlanDraftMetaSchema, type ClipPlanDraftMeta };

/** Returns null when `meta` isn't a valid clip_plan meta shape (e.g. absent, or a different format's meta). */
export function parseClipPlanMeta(meta: unknown): ClipPlanDraftMeta | null {
  const result = clipPlanDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}

/**
 * The body a clip_plan draft's structured fields would produce — the
 * registry's judged-body derivation (the same convention that binds
 * `drafts.body`/`body_hash`, invariant I1). An operator edit changes
 * `draft.body` but never this meta, so comparing the two is how
 * `FormatDetail` detects the structured view has gone stale.
 */
export function expectedClipPlanBody(meta: ClipPlanDraftMeta): string {
  return DRAFT_FORMAT_REGISTRY.clip_plan.expectedBody(meta);
}

/** Formats milliseconds as mm:ss (e.g. 65_000 -> "1:05"). Negative/non-finite input clamps to "0:00". */
export function formatMsAsClock(ms: number): string {
  const totalSeconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
