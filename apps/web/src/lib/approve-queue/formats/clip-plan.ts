import { z } from "zod";

/**
 * `clip_plan` draft meta (B2.3 waterfall). Local zod mirror of the canonical
 * schema in `packages/engine/src/waterfall/schemas.ts` (`clipPlanDraftMetaSchema`)
 * — apps/web stays dependency-light (no `@thalon/engine`, which would also
 * pull in the gateway/AI SDK code that package transitively depends on) by
 * mirroring the shape here instead. Keep in sync with the canonical file.
 */
export const clipPlanDraftMetaSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  windowIndex: z.number().int().min(0),
  chunkSeqs: z.array(z.number().int()),
  hook: z.string(),
  captions: z.string(),
  platformCopy: z.string(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});

export type ClipPlanDraftMeta = z.infer<typeof clipPlanDraftMetaSchema>;

/** Returns null when `meta` isn't a valid clip_plan meta shape (e.g. absent, or a different format's meta). */
export function parseClipPlanMeta(meta: unknown): ClipPlanDraftMeta | null {
  const result = clipPlanDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}

/**
 * The body a clip_plan draft's structured fields would produce —
 * `hook + "\n\n" + captions + "\n\n" + platformCopy` (the same convention
 * that binds `drafts.body`/`body_hash`, invariant I1). An operator edit
 * changes `draft.body` but never this meta, so comparing the two is how
 * `FormatDetail` detects the structured view has gone stale.
 */
export function expectedClipPlanBody(meta: ClipPlanDraftMeta): string {
  return [meta.hook, meta.captions, meta.platformCopy].join("\n\n");
}

/** Formats milliseconds as mm:ss (e.g. 65_000 -> "1:05"). Negative/non-finite input clamps to "0:00". */
export function formatMsAsClock(ms: number): string {
  const totalSeconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
