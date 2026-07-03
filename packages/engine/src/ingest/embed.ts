import type { TenantCtx } from "@thalon/contracts";
import { llmCacheKey, type Repos } from "@thalon/db";
import { getObjectStore, withGatewayGuard, type ObjectStore, type Tracer } from "@thalon/platform";
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
    if (cached) {
      const raw = await store.get(cached.valueRef);
      if (!raw) {
        throw new Error(`llm cache row points at a missing object "${cached.valueRef}"`);
      }
      results[index] = {
        contentHash: chunk.contentHash,
        embedding: JSON.parse(raw.toString("utf8")) as number[],
        cacheHit: true,
      };
    } else {
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
      const objectKey = `embeddings/${miss.key}.json`;
      await store.put(objectKey, JSON.stringify(embedding));
      await repos.caches.llm.put(ctx, { key: miss.key, valueRef: objectKey });
      results[miss.index] = {
        contentHash: input.chunks[miss.index].contentHash,
        embedding,
        cacheHit: false,
      };
    }
  }

  return results;
}
