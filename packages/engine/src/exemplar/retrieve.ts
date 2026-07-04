import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import {
  getObjectStore,
  getTracer,
  modelTiers,
  type ObjectStore,
  type Tracer,
} from "@thalon/platform";
import { embedChunks, topKSimilarChunks, type RetrievedChunk } from "../ingest";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "../ingest/shell/embedder";
import { EXEMPLAR_KINDS, type ExemplarKind } from "./ingest-exemplar";

export interface RetrieveExemplarContextInput {
  /** The fan-out's source text, embedded as the retrieval query — same embedding model + content-addressed cache path as ingest (SPINE §2.7). */
  queryText: string;
  k?: number;
  kinds?: readonly ExemplarKind[];
  /** Tenant daily token budget cap for the query-embedding call — no default; callers already compute this for the surrounding fan-out/ingest call. */
  capTokens: number;
}

export interface RetrieveExemplarContextDeps {
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
}

export interface ExemplarContext {
  /** Joined chunk texts — ready to thread straight into the generation prompt. Empty string when no exemplar/voice_sample sources exist for this tenant yet. */
  contextBlock: string;
  chunks: RetrievedChunk[];
  exemplarIds: { sourceId: string; chunkId: string }[];
}

/**
 * B2.4 retrieval (ADR 0002 decision 4: exemplar library as retrieval, not
 * fine-tuning). Scopes `topKSimilarChunks` to ONLY this tenant's
 * exemplar/voice_sample sources — never the fan-out's own pillar source or
 * any other kind — then reuses `embedChunks` (the same cache/budget/tracing
 * path ingest uses) to embed the query. Every id returned here is
 * provenance: the caller records it on the run + draft, and the overlap
 * gate reads `chunks` to guard against verbatim reuse.
 */
export async function retrieveExemplarContext(
  ctx: TenantCtx,
  repos: Repos,
  input: RetrieveExemplarContextInput,
  deps: RetrieveExemplarContextDeps = {},
): Promise<ExemplarContext> {
  const kinds = input.kinds ?? EXEMPLAR_KINDS;
  const sources = await repos.sources.listByKind(ctx, [...kinds]);
  if (sources.length === 0) {
    return { contextBlock: "", chunks: [], exemplarIds: [] };
  }

  const model = modelTiers().embedding;
  const queryChunk = {
    seq: 0,
    text: input.queryText,
    tokenCount: input.queryText.split(/\s+/).filter(Boolean).length,
    contentHash: sha256Hex(input.queryText),
  };
  const [embedded] = await embedChunks(
    ctx,
    repos,
    { chunks: [queryChunk], model, capTokens: input.capTokens },
    {
      driver: deps.embedder ?? createGatewayEmbeddingDriver(model),
      tracer: deps.tracer ?? getTracer(),
      objectStore: deps.objectStore ?? getObjectStore(),
    },
  );

  const chunks = await topKSimilarChunks(ctx, repos, {
    sourceIds: sources.map((s) => s.id),
    queryEmbedding: embedded.embedding,
    k: input.k,
  });

  return {
    contextBlock: chunks.map((c) => c.text).join("\n\n"),
    chunks,
    exemplarIds: chunks.map((c) => ({ sourceId: c.sourceId, chunkId: c.chunkId })),
  };
}
