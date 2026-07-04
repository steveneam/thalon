import type { TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";

export interface GroundingChunk {
  ref: string;
  text: string;
}

/**
 * B3.9: the ONE grounding-evidence assembler, run INSIDE `runJudgePipeline`
 * whenever the caller doesn't pass explicit chunks (the production default).
 * Multi-source drafts (pillar scripts: prompt + site/repo sources) record
 * every contributing source in `meta.groundingSourceIds`; single-source
 * drafts (every format before B3.9) carry no such key and fall back to the
 * draft's own `sourceId` — byte-identical evidence to the pre-B3.9 callers.
 * The B3.8 identity chunk is NOT assembled here — the pipeline appends it
 * separately so an explicit-chunks override still gets identity grounding.
 */
export async function collectGroundingChunks(
  ctx: TenantCtx,
  repos: Repos,
  draft: Draft,
): Promise<GroundingChunk[]> {
  const meta = (draft.meta ?? {}) as Record<string, unknown>;
  const raw = meta.groundingSourceIds;
  const ids =
    Array.isArray(raw) && raw.length > 0 && raw.every((id) => typeof id === "string" && id.length > 0)
      ? (raw as string[])
      : [draft.sourceId];
  const chunks: GroundingChunk[] = [];
  for (const id of [...new Set(ids)]) {
    const rows = await repos.sourceChunks.listBySource(ctx, id);
    chunks.push(...rows.map((chunk) => ({ ref: chunk.id, text: chunk.text })));
  }
  return chunks;
}
