import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Repos } from "@thalon/db";
import {
  getObjectStore,
  getTracer,
  modelTiers,
  objectKey,
  readEnv,
  type ObjectStore,
  type Tracer,
} from "@thalon/platform";
import { scoreAreaRelevance } from "./area-relevance";
import type { CaptionFormat } from "./captions";
import { chunkTimedSegments, DEFAULT_CHUNK_CONFIG, type ChunkConfig } from "./chunk";
import { embedChunks, type EmbeddedChunk } from "./embed";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "./shell/embedder";
import { getTranscriptProvider, type TranscriptProvider } from "./transcript";
import { youTubeOEmbedTitleFetcher, type VideoTitleFetcher } from "./video-title";

/**
 * B4.8 (B3.13 pass-2 thin cut): the video-URL ingest surface — paste a URL
 * → a timed `video_transcript` source (the kind that has existed since
 * B2.2), via whichever `TranscriptProvider` the registry selects. This is
 * the surface both core features feed on: the operator's own videos
 * (whisper-local over local media) → B2.3 waterfall; trending third-party
 * videos (hosted-vendor) → B3.12 spoken-hook intel.
 *
 * Content identity is the FETCHED TRANSCRIPT, not the URL:
 * sha256(stableStringify(segments)) — re-ingesting the same video is a
 * zero-embed fast path even from a different URL mirror, and a changed
 * transcript re-keys automatically. (ingestSource's caption path keeps its
 * own byte-stable hash-of-captions identity — untouched.) The segments
 * bundle persists to `transcripts/<hash>.json` as the source's `raw_ref`
 * (B4.6 key scheme; swept as referenced). Live provider runs are pass 3 —
 * everything here is fake-driver-tested, zero spend.
 *
 * B6.6 rider (session-19 Library UX mini-contract — additive meta keys the
 * web Library reads; pre-rider rows simply lack them, degrading honestly):
 * `meta.title` (YouTube oEmbed, keyless/quota-free; the URL on any
 * failure), `meta.thumbnailUrl` (same oEmbed call — the Source-Link Rule's
 * visual identity; absent when the platform offers none),
 * `meta.thumbnailWidth`/`meta.thumbnailHeight` (B-media.0 s77 — the SAME
 * oEmbed reply carried them all along; they let the resolver derive
 * orientation, and they ride together or not at all),
 * `meta.tags` (operator-set, stored verbatim),
 * `meta.areaRelevance` (the transcript's chunk-embedding centroid scored
 * against the tenant's active monitored areas via the B6.4 ranker's
 * embedding path — ./area-relevance.ts).
 */

export interface VideoUrlIngestRequest {
  /** The video's canonical URL — recorded as the source `uri` (provenance). */
  url: string;
  /** Operator-supplied captions (caption-file provider); fetching providers ignore this. */
  captions?: string;
  captionFormat?: CaptionFormat;
  /** Operator-set library tags — stored verbatim as `meta.tags` (session-19 mini-contract). */
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface VideoUrlIngestDeps {
  /** Explicit provider override (tests / callers); defaults to the env-selected registry driver. */
  transcriptProvider?: TranscriptProvider;
  /** Display-metadata seam — title + thumbnail (tests inject; default = keyless YouTube oEmbed). */
  titleFetcher?: VideoTitleFetcher;
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  capTokens?: number;
}

export interface VideoUrlIngestResult {
  sourceId: string;
  created: boolean;
  chunkCount: number;
  provider: string;
}

export async function ingestVideoUrl(
  ctx: TenantCtx,
  repos: Repos,
  request: VideoUrlIngestRequest,
  deps: VideoUrlIngestDeps = {},
): Promise<VideoUrlIngestResult> {
  const provider = deps.transcriptProvider ?? getTranscriptProvider();
  const segments = await provider.fetchTranscript({
    captions: request.captions,
    captionFormat: request.captionFormat,
    uri: request.url,
  });
  if (segments.length === 0) {
    throw new Error(
      `transcript provider "${provider.name}" returned no segments for "${request.url}" — nothing to ingest`,
    );
  }

  const transcriptJson = stableStringify(segments);
  const contentHash = sha256Hex(transcriptJson);
  const existing = await repos.sources.getByContentHash(ctx, contentHash);
  if (existing) {
    const chunks = await repos.sourceChunks.listBySource(ctx, existing.id);
    return { sourceId: existing.id, created: false, chunkCount: chunks.length, provider: provider.name };
  }

  const chunkConfig = deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG;
  const chunks = chunkTimedSegments(segments, chunkConfig);

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

  const rawRef = objectKey("transcripts", contentHash, "json");
  await objectStore.put(rawRef, transcriptJson);

  // B6.6 rider metadata — NEVER blocks ingest: the oEmbed seam degrades to
  // the URL / no thumbnail (belt-and-braces catch in case an injected fetcher
  // throws), and areaRelevance is absent when there are no active areas / no
  // embeddings.
  let fetchedTitle: string | null;
  let fetchedThumbnail: string | null;
  let fetchedThumbnailWidth: number | null;
  let fetchedThumbnailHeight: number | null;
  try {
    const oembed = await (deps.titleFetcher ?? youTubeOEmbedTitleFetcher()).fetchMeta(request.url);
    fetchedTitle = oembed.title;
    fetchedThumbnail = oembed.thumbnailUrl;
    fetchedThumbnailWidth = oembed.thumbnailWidth;
    fetchedThumbnailHeight = oembed.thumbnailHeight;
  } catch {
    fetchedTitle = null;
    fetchedThumbnail = null;
    fetchedThumbnailWidth = null;
    fetchedThumbnailHeight = null;
  }
  // The dimensions ride together or not at all (the contract helper enforces
  // the same rule on the read side) — and never without the URL they measure.
  const measuredThumbnail =
    fetchedThumbnail !== null && fetchedThumbnailWidth !== null && fetchedThumbnailHeight !== null;
  const areaRelevance = await scoreAreaRelevance(
    ctx,
    repos,
    { vectors: embedded.map((e) => e.embedding), capTokens },
    { embedder: deps.embedder, tracer: deps.tracer, objectStore },
  );

  const { source, chunks: persisted } = await repos.sourceChunks.ingest(ctx, {
    kind: "video_transcript",
    contentHash,
    uri: request.url,
    rawRef,
    meta: {
      transcriptProvider: provider.name,
      segmentCount: segments.length,
      title: fetchedTitle ?? request.url,
      ...(fetchedThumbnail ? { thumbnailUrl: fetchedThumbnail } : {}),
      ...(measuredThumbnail
        ? { thumbnailWidth: fetchedThumbnailWidth, thumbnailHeight: fetchedThumbnailHeight }
        : {}),
      ...(request.tags?.length ? { tags: request.tags } : {}),
      ...(areaRelevance ? { areaRelevance } : {}),
      ...request.meta,
    },
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
    provider: provider.name,
  };
}
