import type { TenantCtx } from "@thalon/contracts";
import { llmCacheKey, type Repos } from "@thalon/db";
import { getObjectStore, objectKey, withGatewayGuard, type ObjectStore, type Tracer } from "@thalon/platform";
import type { TextChunk } from "./chunk";
import type { EmbeddingDriver } from "./shell/embedder";

export interface EmbedChunksInput {
  chunks: TextChunk[];
  model: string;
  /** Bumps the cache key when the embedding call shape changes; content-addressed alongside model + chunk content_hash (SPINE §2.5). */
  promptVersion?: string;
  capTokens: number;
}

export interface EmbedChunksDeps {
  driver: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  /**
   * Called when a cache row resolved to nothing — the row survives, its object
   * is gone. Treated as a miss and healed, but never silently: a store whose
   * objects keep vanishing re-spends on every ingest, and that deserves a
   * report rather than a shrug. Absent by default so callers opt in.
   */
  onCacheDangling?: (info: { key: string; valueRef: string }) => void;
}

export interface EmbeddedChunk {
  contentHash: string;
  embedding: number[];
  cacheHit: boolean;
}

/**
 * B1.1's first shell caller. Content-addressed cache first (SPINE §2.7):
 * identical chunk text + model + params skips the gateway entirely. Only
 * genuine misses route through the ONE gateway choke point
 * (withGatewayGuard, @thalon/platform) — budget checked before, usage
 * recorded after, tracing spans the call. Cache values live in the object
 * store; llm_cache holds only the reference + hit count (SPINE §2.5).
 */
export async function embedChunks(
  ctx: TenantCtx,
  repos: Repos,
  input: EmbedChunksInput,
  deps: EmbedChunksDeps,
): Promise<EmbeddedChunk[]> {
  const store = deps.objectStore ?? getObjectStore();
  const promptVersion = input.promptVersion ?? "embedding.v1";
  const results: EmbeddedChunk[] = new Array(input.chunks.length);
  const misses: { index: number; text: string; key: string }[] = [];

  for (const [index, chunk] of input.chunks.entries()) {
    const key = llmCacheKey({
      promptVersion,
      model: input.model,
      params: {},
      inputHash: chunk.contentHash,
    });
    const cached = await repos.caches.llm.get(key);
    const raw = cached ? await store.get(cached.valueRef) : null;
    if (cached && raw) {
      results[index] = {
        contentHash: chunk.contentHash,
        embedding: JSON.parse(raw.toString("utf8")) as number[],
        cacheHit: true,
      };
    } else {
      /**
       * A DANGLING CACHE POINTER IS A MISS, NOT A FATAL ERROR (s79).
       *
       * This threw `llm cache row points at a missing object "…"`, which made
       * the failure PERMANENT: the row survives, so every later ingest of the
       * same chunk text hit the same dead pointer and the whole feature stayed
       * broken with no path back. The founder found it by pasting a YouTube URL
       * and asking whether transcription still worked — it did not, and the
       * transcript itself was fine.
       *
       * The split is the point: `llm_cache` (Postgres) holds a POINTER, the
       * object store holds the truth. They can diverge for ordinary reasons —
       * here `THALON_DATA_DIR=.data` is RELATIVE and the store root is resolved
       * against the process's working directory, so the dev server (cwd
       * `apps/web`) and anything run from the repo root share ONE cache index
       * across TWO different stores. Every root-cwd test, script and eval run
       * wrote rows the dev server could never resolve.
       *
       * A pointer whose target is gone is exactly what a cache miss IS. Re-embed
       * and `put` again, which upserts the row and heals it. Spend stays guarded
       * by the same budget assertion every real miss passes through, and the
       * divergence is reported rather than swallowed — silence here would hide a
       * misconfigured store while quietly re-spending on every ingest.
       */
      if (cached) {
        deps.onCacheDangling?.({ key, valueRef: cached.valueRef });
      }
      misses.push({ index, text: chunk.text, key });
    }
  }

  if (misses.length > 0) {
    const vectors = await withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
        recordUsage: (o) => repos.usageLedger.record(ctx, o),
      },
      tracer: deps.tracer,
      capTokens: input.capTokens,
      model: input.model,
      operation: "ingest.embed",
      call: async () => {
        const out = await deps.driver.embed(misses.map((m) => m.text));
        return { result: out.vectors, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

    for (const [i, miss] of misses.entries()) {
      const embedding = vectors[i];
      const embeddingKey = objectKey("embeddings", miss.key, "json");
      await store.put(embeddingKey, JSON.stringify(embedding));
      await repos.caches.llm.put(ctx, { key: miss.key, valueRef: embeddingKey });
      results[miss.index] = {
        contentHash: input.chunks[miss.index].contentHash,
        embedding,
        cacheHit: false,
      };
    }
  }

  return results;
}
