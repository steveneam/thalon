import { z } from "zod";

/**
 * Exemplar-aware fan-out drafts (B2.4) carry `meta.exemplarIds` — provenance
 * for the exemplar/voice_sample chunks retrieved into that draft's
 * generation context. Absent entirely on a plain run. Mirrors the shape
 * produced by `packages/engine/src/exemplar/retrieve.ts` (`ExemplarContext.exemplarIds`).
 */
export const exemplarIdSchema = z.object({
  sourceId: z.string(),
  chunkId: z.string(),
});

export const exemplarIdsMetaSchema = z.object({
  exemplarIds: z.array(exemplarIdSchema).min(1),
});

export type ExemplarId = z.infer<typeof exemplarIdSchema>;

/** Returns null when `meta.exemplarIds` is absent or not a valid non-empty array — i.e. a plain, non-exemplar-aware run. */
export function parseExemplarIds(meta: unknown): ExemplarId[] | null {
  const result = exemplarIdsMetaSchema.safeParse(meta);
  return result.success ? result.data.exemplarIds : null;
}

/**
 * `judge_results.gate` value written by the deterministic overlap gate.
 * Mirrors `packages/engine/src/exemplar/overlap-gate.ts`'s
 * `EXEMPLAR_OVERLAP_GATE` constant — not part of contracts' `KNOWN_JUDGE_GATES`
 * (that vocabulary is frozen), so it's re-declared here rather than imported.
 */
export const EXEMPLAR_OVERLAP_GATE = "exemplar_overlap";
