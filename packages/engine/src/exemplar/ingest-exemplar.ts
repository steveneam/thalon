import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import {
  getObjectStore,
  getTracer,
  modelTiers,
  readEnv,
  type ObjectStore,
  type Tracer,
} from "@thalon/platform";
import {
  chunkText,
  DEFAULT_CHUNK_CONFIG,
  embedChunks,
  type ChunkConfig,
  type EmbeddedChunk,
} from "../ingest";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "../ingest/shell/embedder";
import { stripPii, type PiiStripStats } from "./pii-strip";

/** The two B2.2 source kinds this module ingests (ADR 0002 decision 4: retrieval, not fine-tuning). */
export const EXEMPLAR_KINDS = ["exemplar", "voice_sample"] as const;
export type ExemplarKind = (typeof EXEMPLAR_KINDS)[number];

export interface ExemplarMetricInput {
  /** Caller-supplied metric name (e.g. "likes", "impressions") — NEVER hard-coded here; the engine stays platform-generic (SPINE §4.1, source_metrics is open name/value pairs). */
  name: string;
  value: number;
}

export interface IngestExemplarInput {
  kind: ExemplarKind;
  /** Raw exemplar/voice-sample text, BEFORE PII stripping — this function strips it before anything is stored or embedded. */
  text: string;
  uri?: string;
  meta?: Record<string, unknown>;
  metrics?: ExemplarMetricInput[];
}

export interface IngestExemplarDeps {
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface IngestExemplarResult {
  sourceId: string;
  created: boolean;
  chunkCount: number;
  cacheHits: number;
  /** Proof the strip actually ran, and what it found — for operator/eval visibility. Never the raw PII itself. */
  redactions: PiiStripStats;
}

/**
 * B2.4 entry point (ADR 0002 decision 4): exemplar/voice-sample ingest.
 * Delegates to the SAME building blocks B1.1's ingestSource uses
 * (chunkText, embedChunks, sourceChunksRepo.ingest) — ../ingest/ingest.ts
 * itself is untouched; its IngestRequest union only models the
 * url/prompt/doc/video_transcript shapes, so this module calls the shared
 * core pieces directly with kind "exemplar"/"voice_sample" instead of
 * routing through that function.
 *
 * PII is stripped BEFORE the content hash is computed and BEFORE anything
 * reaches the embedder or a table — the invariant is "PII never enters
 * storage," not "PII is redacted after the fact."
 */
export async function ingestExemplar(
  ctx: TenantCtx,
  repos: Repos,
  input: IngestExemplarInput,
  deps: IngestExemplarDeps = {},
): Promise<IngestExemplarResult> {
  const stripped = stripPii(input.text);
  const contentHash = sha256Hex(stripped.text);

  const existing = await repos.sources.getByContentHash(ctx, contentHash);
  let sourceId: string;
  let created: boolean;
  let chunkCount: number;
  let cacheHits = 0;

  if (existing) {
    const chunks = await repos.sourceChunks.listBySource(ctx, existing.id);
    sourceId = existing.id;
    created = false;
    chunkCount = chunks.length;
  } else {
    const chunkConfig = deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG;
    const chunks = chunkText(stripped.text, chunkConfig);
    const model = modelTiers().embedding;
    const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
    const objectStore = deps.objectStore ?? getObjectStore();

    const embedded: EmbeddedChunk[] = chunks.length
      ? await embedChunks(
          ctx,
          repos,
          { chunks, model, capTokens },
          {
            driver: deps.embedder ?? createGatewayEmbeddingDriver(model),
            tracer: deps.tracer ?? getTracer(),
            objectStore,
          },
        )
      : [];

    const { source, chunks: persisted } = await repos.sourceChunks.ingest(ctx, {
      kind: input.kind,
      contentHash,
      uri: input.uri,
      meta: { ...input.meta, piiRedactions: stripped.stats },
      chunks: chunks.map((chunk, i) => ({
        seq: chunk.seq,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        contentHash: chunk.contentHash,
        embedding: embedded[i]?.embedding,
      })),
    });
    sourceId = source.id;
    created = true;
    chunkCount = persisted.length;
    cacheHits = embedded.filter((e) => e.cacheHit).length;
  }

  // Metrics are decoupled from content idempotency — re-ingesting the same
  // exemplar text later with fresh engagement numbers still records them
  // (source_metrics is append-only; @thalon/db repos/source-metrics.ts).
  for (const metric of input.metrics ?? []) {
    await repos.sourceMetrics.add(ctx, {
      sourceId,
      metricName: metric.name,
      metricValue: metric.value,
    });
  }

  return { sourceId, created, chunkCount, cacheHits, redactions: stripped.stats };
}
