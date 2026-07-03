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
import { chunkText, DEFAULT_CHUNK_CONFIG, type ChunkConfig, type TextChunk } from "./chunk";
import { embedChunks, type EmbeddedChunk } from "./embed";
import { extractDoc, extractHtml, extractPrompt } from "./extract";
import { getFetcher, type Fetcher } from "./fetcher";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "./shell/embedder";

export type IngestRequest =
  | { kind: "url"; url: string; meta?: Record<string, unknown> }
  | { kind: "prompt"; prompt: string; meta?: Record<string, unknown> }
  | { kind: "doc"; doc: string | Buffer; meta?: Record<string, unknown> };

export interface IngestDeps {
  fetcher?: Fetcher;
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface IngestResult {
  sourceId: string;
  created: boolean;
  chunkCount: number;
  cacheHits: number;
}

interface RawContent {
  buffer: Buffer;
  text: string;
}

/**
 * B1.1 entry point: URL / prompt / dropped doc -> `sources` +
 * chunked/embedded `source_chunks`. Idempotent on content_hash — re-ingesting
 * identical content returns the original rows untouched, without a single
 * extraction, chunking, or gateway call (SPINE §1: run it twice, get one
 * result).
 */
export async function ingestSource(
  ctx: TenantCtx,
  repos: Repos,
  request: IngestRequest,
  deps: IngestDeps = {},
): Promise<IngestResult> {
  const fetcher = deps.fetcher ?? getFetcher();
  const raw = await readRaw(request, fetcher);
  const contentHash = sha256Hex(raw.buffer);

  const existing = await repos.sources.getByContentHash(ctx, contentHash);
  if (existing) {
    const chunks = await repos.sourceChunks.listBySource(ctx, existing.id);
    return { sourceId: existing.id, created: false, chunkCount: chunks.length, cacheHits: 0 };
  }

  const extracted = extractForKind(request, raw.text);
  const chunks: TextChunk[] = chunkText(extracted.text, deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG);

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

  const rawRef =
    request.kind === "prompt" ? undefined : await storeRaw(objectStore, contentHash, raw.buffer);

  const { source, chunks: persisted } = await repos.sourceChunks.ingest(ctx, {
    kind: request.kind,
    contentHash,
    uri: request.kind === "url" ? request.url : undefined,
    rawRef,
    meta: request.meta,
    chunks: chunks.map((chunk, i) => ({
      seq: chunk.seq,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      contentHash: chunk.contentHash,
      embedding: embedded[i]?.embedding,
    })),
  });

  return {
    sourceId: source.id,
    created: true,
    chunkCount: persisted.length,
    cacheHits: embedded.filter((e) => e.cacheHit).length,
  };
}

async function readRaw(request: IngestRequest, fetcher: Fetcher): Promise<RawContent> {
  if (request.kind === "prompt") {
    return { buffer: Buffer.from(request.prompt, "utf8"), text: request.prompt };
  }
  if (request.kind === "doc") {
    const buffer = typeof request.doc === "string" ? Buffer.from(request.doc, "utf8") : request.doc;
    return { buffer, text: buffer.toString("utf8") };
  }
  const page = await fetcher.fetch(request.url);
  return { buffer: Buffer.from(page.html, "utf8"), text: page.html };
}

function extractForKind(request: IngestRequest, rawText: string): { text: string } {
  if (request.kind === "prompt") return extractPrompt(rawText);
  if (request.kind === "doc") return extractDoc(rawText);
  return extractHtml(rawText);
}

async function storeRaw(store: ObjectStore, contentHash: string, buffer: Buffer): Promise<string> {
  const key = `sources/${contentHash}`;
  await store.put(key, buffer);
  return key;
}
