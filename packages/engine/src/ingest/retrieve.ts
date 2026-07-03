import type { TenantCtx } from "@thalon/contracts";
import { retrievalCacheKey, sha256Hex, stableStringify, type Repos } from "@thalon/db";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  seq: number;
  text: string;
  score: number;
}

export interface TopKInput {
  sourceIds: string[];
  queryEmbedding: number[];
  k?: number;
}

/**
 * Grounding retrieval (SPINE §2.7: materialized at ingest, never re-embedded
 * per judge call). The judge lane (B1.3) consumes this for G3
 * grounding-to-provided-sources. retrieval_cache is keyed on the source set
 * + the query, so a repeated query against the same sources is free.
 */
export async function topKSimilarChunks(
  ctx: TenantCtx,
  repos: Repos,
  input: TopKInput,
): Promise<RetrievedChunk[]> {
  const k = input.k ?? 5;
  const sourceSetHash = sha256Hex(stableStringify([...input.sourceIds].sort()));
  const queryHash = sha256Hex(stableStringify(input.queryEmbedding));
  const cacheKey = retrievalCacheKey({ sourceSetHash, queryHash });

  const cached = await repos.caches.retrieval.get(cacheKey);
  if (cached) return cached.result as RetrievedChunk[];

  const result = await repos.sourceChunks.topKBySimilarity(ctx, {
    sourceIds: input.sourceIds,
    queryEmbedding: input.queryEmbedding,
    k,
  });
  await repos.caches.retrieval.put(ctx, { key: cacheKey, result });
  return result;
}
