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
import { getCrawlFetcher, type CrawlFetcher } from "../demo/fetcher";
import { createRateLimiter, type RateLimiterDeps } from "../demo/rate-limiter";
import { ALLOW_ALL_ROBOTS, assertPathAllowed, parseRobotsTxt, type RobotsRules } from "../demo/robots";
import { chunkText, DEFAULT_CHUNK_CONFIG, type ChunkConfig } from "./chunk";
import { embedChunks, type EmbeddedChunk } from "./embed";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "./shell/embedder";
import { getWebIngestDriver, type WebIngestDriver } from "./web-ingest";

/**
 * B6.6: the grounding web-ingest surface — operator site / docs URL →
 * clean text via the env-free web-ingest seam (./web-ingest.ts; Crawl4AI
 * or the zero-dep fetch-extract default) → a chunked/embedded `url` source
 * the page loop grounds against. Mirrors ./ingest-video-url.ts stage for
 * stage.
 *
 * Safety runs in CORE, before any driver (the B2.5 precedent, reusing its
 * tested robots/rate-limit primitives): robots.txt is fetched and parsed
 * first and a disallowed target throws RobotsDisallowedError — loudly, by
 * construction, no matter which driver was selected — and the configured
 * minimum delay spaces EVERY request this function causes (the robots
 * fetch, then the driver's page fetch/subprocess).
 *
 * Content identity is the FETCHED CONTENT, not the URL: sha256(content) —
 * re-ingesting an unchanged page is a zero-embed fast path even from a
 * mirror URL, and a changed page re-keys automatically. The raw content
 * persists under the existing `sources/<contentHash>` family as the
 * source's `raw_ref` (the same home ingestSource's url path uses).
 *
 * THIS SURFACE STILL EMBEDS BY DEFAULT, deliberately — it is NOT the
 * transcription path. The s79 free-by-default ruling is about the operator's
 * knowledge tool (./ingest-video-url.ts); a page ingested here exists only to
 * be RETRIEVED — the page loop grounds its drafts on `topKSimilarChunks`,
 * which ranks on these vectors and skips chunks without one. Making this free
 * by default would leave grounding silently unretrievable, i.e. a source that
 * still counts as grounding while citing nothing. If a per-ingest toggle is
 * ever wanted here it needs its own honest story on the page-loop surface.
 */

export interface WebIngestConfig {
  minDelayMs: number;
  userAgent: string;
}

/** Sane defaults for a polite single-page grounding fetch (the B2.5 crawl defaults, sans crawl-only knobs). */
export const DEFAULT_WEB_INGEST_CONFIG: WebIngestConfig = {
  minDelayMs: 250,
  userAgent: "ThalonIngestBot",
};

export interface WebUrlIngestRequest {
  /** The page's canonical URL — recorded as the source `uri` (provenance). */
  url: string;
  /** Web-ingest driver name (./web-ingest.ts registry) — default "fetch-extract"; "crawl4ai" needs the local user-scope install. */
  driver?: string;
  config?: Partial<WebIngestConfig>;
  meta?: Record<string, unknown>;
}

export interface WebUrlIngestDeps {
  /** Explicit driver override (tests / callers); wins over request.driver. */
  webIngestDriver?: WebIngestDriver;
  /** robots.txt fetch seam — status-aware (a 404 means "no rules", never an abort). */
  robotsFetcher?: CrawlFetcher;
  rateLimiter?: RateLimiterDeps;
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  capTokens?: number;
}

export interface WebUrlIngestResult {
  sourceId: string;
  created: boolean;
  chunkCount: number;
  driver: string;
}

export async function ingestWebUrl(
  ctx: TenantCtx,
  repos: Repos,
  request: WebUrlIngestRequest,
  deps: WebUrlIngestDeps = {},
): Promise<WebUrlIngestResult> {
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`web ingest requires an http(s) URL, got "${request.url}"`);
  }
  const config: WebIngestConfig = { ...DEFAULT_WEB_INGEST_CONFIG, ...request.config };
  const driver = deps.webIngestDriver ?? getWebIngestDriver(request.driver);

  // Safety first, in core: robots.txt (status-aware — non-2xx = allow-all),
  // then the loud permission gate; the limiter spaces both requests.
  const rateLimiter = createRateLimiter(config.minDelayMs, deps.rateLimiter);
  const robotsFetcher = deps.robotsFetcher ?? getCrawlFetcher();
  await rateLimiter.beforeRequest();
  const robotsRes = await robotsFetcher.fetch(`${url.origin}/robots.txt`);
  const robots: RobotsRules =
    robotsRes.status >= 200 && robotsRes.status < 300
      ? parseRobotsTxt(robotsRes.html)
      : ALLOW_ALL_ROBOTS;
  assertPathAllowed(robots, config.userAgent, url.pathname + url.search, request.url);

  await rateLimiter.beforeRequest();
  const page = await driver.fetchPage({ url: request.url });
  const content = page.content.trim();
  if (!content) {
    throw new Error(
      `web-ingest driver "${driver.name}" returned no content for "${request.url}" — nothing to ingest`,
    );
  }

  const contentHash = sha256Hex(content);
  const existing = await repos.sources.getByContentHash(ctx, contentHash);
  if (existing) {
    const chunks = await repos.sourceChunks.listBySource(ctx, existing.id);
    return { sourceId: existing.id, created: false, chunkCount: chunks.length, driver: driver.name };
  }

  const chunkConfig = deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG;
  const chunks = chunkText(content, chunkConfig);

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

  // B4.6 key scheme — the same `sources/<contentHash>` home ingestSource uses.
  const rawRef = objectPrefix("sources", contentHash);
  await objectStore.put(rawRef, content);

  const { source, chunks: persisted } = await repos.sourceChunks.ingest(ctx, {
    kind: "url",
    contentHash,
    uri: request.url,
    rawRef,
    meta: {
      webIngestDriver: driver.name,
      ...request.meta,
    },
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
    driver: driver.name,
  };
}
