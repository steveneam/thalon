import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import {
  getObjectStore,
  getTracer,
  modelTiers,
  objectPrefix,
  readEnv,
  type ObjectStore,
  type Tracer,
} from "@thalon/platform";
import type { CaptionFormat } from "./captions";
import {
  chunkText,
  chunkTimedSegments,
  DEFAULT_CHUNK_CONFIG,
  type ChunkConfig,
  type TimedTextChunk,
} from "./chunk";
import { embedChunks, type EmbeddedChunk } from "./embed";
import { extractDoc, extractHtml, extractPrompt } from "./extract";
import { getFetcher, type Fetcher } from "./fetcher";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "./shell/embedder";
import { getTranscriptProvider, type TranscriptProvider } from "./transcript";

export type IngestRequest =
  | { kind: "url"; url: string; meta?: Record<string, unknown> }
  | { kind: "prompt"; prompt: string; meta?: Record<string, unknown> }
  | { kind: "doc"; doc: string | Buffer; meta?: Record<string, unknown> }
  /** B2.2: operator-supplied captions (SRT/WebVTT/plain); `uri` is the media reference for provenance and for fetching providers behind the transcript seam. */
  | {
      kind: "video_transcript";
      captions: string;
      captionFormat?: CaptionFormat;
      uri?: string;
      meta?: Record<string, unknown>;
    };

/** The ingest kinds that chunk via plain-text extraction (everything except the timed transcript path). */
type UntimedIngestRequest = Exclude<IngestRequest, { kind: "video_transcript" }>;

export interface IngestDeps {
  fetcher?: Fetcher;
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  /** B2.2 transcript seam override (tests / future drivers); defaults to the caption-file provider. */
  transcriptProvider?: TranscriptProvider;
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

  const chunkConfig = deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG;
  let chunks: TimedTextChunk[];
  let sourceMeta = request.meta;
  if (request.kind === "video_transcript") {
    const provider = deps.transcriptProvider ?? getTranscriptProvider();
    const segments = await provider.fetchTranscript({
      captions: request.captions,
      captionFormat: request.captionFormat,
      uri: request.uri,
    });
    chunks = chunkTimedSegments(segments, chunkConfig);
    sourceMeta = { transcriptProvider: provider.name, segmentCount: segments.length, ...request.meta };
  } else {
    chunks = chunkText(extractForKind(request, raw.text).text, chunkConfig);
  }

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
    uri:
      request.kind === "url"
        ? request.url
        : request.kind === "video_transcript"
          ? request.uri
          : undefined,
    rawRef,
    meta: sourceMeta,
    chunks: chunks.map((chunk, i) => ({
      seq: chunk.seq,
      text: chunk.text,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
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
  if (request.kind === "video_transcript") {
    return { buffer: Buffer.from(request.captions, "utf8"), text: request.captions };
  }
  if (request.kind === "doc") {
    const buffer = typeof request.doc === "string" ? Buffer.from(request.doc, "utf8") : request.doc;
    return { buffer, text: buffer.toString("utf8") };
  }
  const page = await fetcher.fetch(request.url);
  return { buffer: Buffer.from(page.html, "utf8"), text: page.html };
}

function extractForKind(request: UntimedIngestRequest, rawText: string): { text: string } {
  if (request.kind === "prompt") return extractPrompt(rawText);
  if (request.kind === "doc") return extractDoc(rawText);
  return extractHtml(rawText);
}

async function storeRaw(store: ObjectStore, contentHash: string, buffer: Buffer): Promise<string> {
  // B4.6 key scheme (byte-identical to the pre-helper literal).
  const key = objectPrefix("sources", contentHash);
  await store.put(key, buffer);
  return key;
}
