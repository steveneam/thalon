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
import {
  chunkText,
  DEFAULT_CHUNK_CONFIG,
  embedChunks,
  type ChunkConfig,
  type EmbeddedChunk,
  type TextChunk,
} from "../ingest";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "../ingest/shell/embedder";
import { crawlSite, DEFAULT_CRAWL_CONFIG, type CrawlConfig, type CrawlDeps } from "./crawl";

export interface RunSiteCrawlRequest {
  seedUrl: string;
  config?: Partial<CrawlConfig>;
  meta?: Record<string, unknown>;
}

export interface RunSiteCrawlDeps extends CrawlDeps {
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
  chunkConfig?: ChunkConfig;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface RunSiteCrawlResult {
  sourceId: string;
  created: boolean;
  pageUrls: string[];
  chunkCount: number;
}

interface PageChunk {
  pageUrl: string;
  chunk: TextChunk;
}

function chunkPages(
  pages: readonly { url: string; text: string }[],
  config: ChunkConfig,
): PageChunk[] {
  const pageChunks: PageChunk[] = [];
  let seq = 0;
  for (const page of pages) {
    for (const chunk of chunkText(page.text, config)) {
      pageChunks.push({ pageUrl: page.url, chunk: { ...chunk, seq: seq++ } });
    }
  }
  return pageChunks;
}

/** `sources.meta.pages` provenance: which `source_chunks.seq` range came from which crawled URL. */
function summarizePageRanges(
  pageChunks: readonly PageChunk[],
): { url: string; seqStart: number; seqEnd: number }[] {
  const ranges = new Map<string, { seqStart: number; seqEnd: number }>();
  for (const pc of pageChunks) {
    const existing = ranges.get(pc.pageUrl);
    if (!existing) ranges.set(pc.pageUrl, { seqStart: pc.chunk.seq, seqEnd: pc.chunk.seq });
    else existing.seqEnd = pc.chunk.seq;
  }
  return [...ranges.entries()].map(([url, range]) => ({ url, ...range }));
}

/**
 * B2.5 stage 1 entry point: seed URL -> deterministic site crawl (robots.txt
 * + rate-limit honored in core, ./crawl.ts) -> one `sources` row (kind
 * "site_crawl") + chunked/embedded `source_chunks`, through the SAME
 * chunk+embed path B1.1's `ingestSource` uses — so G3 grounds against the
 * crawl via the standard retrieval machinery (CHARTER B2.5). The crawl's raw
 * pages (url + html) are stored as ONE JSON payload at `sources.rawRef` (the
 * same column `ingestSource` uses for a fetched page's raw bytes, generalized
 * here to a multi-page bundle) so stage 3 (../storyboard.ts, via
 * `loadCrawlPages` below) can re-derive the flow map later without
 * re-crawling the network.
 *
 * Unlike `ingestSource`, there is no cheap pre-hash fast path: the content
 * hash covers every crawled page's HTML, which is only known once the crawl
 * has actually run. Re-running this against an unchanged site still avoids a
 * second `sources`/`source_chunks` row (content-addressed, `(tenant_id,
 * content_hash)` unique) and a second embedding pass — the crawl fetch itself
 * is simply unavoidable network work here, not a violation of "run it twice,
 * get one result" (that guarantee covers the DB write, not the fetch).
 */
export async function runSiteCrawl(
  ctx: TenantCtx,
  repos: Repos,
  request: RunSiteCrawlRequest,
  deps: RunSiteCrawlDeps = {},
): Promise<RunSiteCrawlResult> {
  const config: CrawlConfig = { ...DEFAULT_CRAWL_CONFIG, ...request.config };
  const crawl = await crawlSite(request.seedUrl, config, deps);
  const pageUrls = crawl.pages.map((p) => p.url);

  const contentHash = sha256Hex(
    stableStringify({
      seedUrl: crawl.seedUrl,
      config,
      pages: crawl.pages.map((p) => ({ url: p.url, html: p.html })),
    }),
  );

  const existing = await repos.sources.getByContentHash(ctx, contentHash);
  if (existing) {
    const chunks = await repos.sourceChunks.listBySource(ctx, existing.id);
    return { sourceId: existing.id, created: false, pageUrls, chunkCount: chunks.length };
  }

  const objectStore = deps.objectStore ?? getObjectStore();
  const rawRef = objectKey("crawl-pages", contentHash, "json");
  await objectStore.put(
    rawRef,
    JSON.stringify(crawl.pages.map((p) => ({ url: p.url, html: p.html }))),
  );

  const chunkConfig = deps.chunkConfig ?? DEFAULT_CHUNK_CONFIG;
  const pageChunks = chunkPages(crawl.pages, chunkConfig);

  const model = modelTiers().embedding;
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const embedded: EmbeddedChunk[] = pageChunks.length
    ? await embedChunks(
        ctx,
        repos,
        { chunks: pageChunks.map((pc) => pc.chunk), model, capTokens },
        {
          driver: deps.embedder ?? createGatewayEmbeddingDriver(model),
          tracer: deps.tracer ?? getTracer(),
          objectStore,
        },
      )
    : [];

  const { source, chunks: persisted } = await repos.sourceChunks.ingest(ctx, {
    kind: "site_crawl",
    contentHash,
    uri: crawl.seedUrl,
    rawRef,
    meta: {
      seedUrl: crawl.seedUrl,
      config,
      pageUrls,
      pages: summarizePageRanges(pageChunks),
      ...request.meta,
    },
    chunks: pageChunks.map((pc, i) => ({
      seq: pc.chunk.seq,
      text: pc.chunk.text,
      tokenCount: pc.chunk.tokenCount,
      contentHash: pc.chunk.contentHash,
      embedding: embedded[i]?.embedding,
    })),
  });

  return { sourceId: source.id, created: true, pageUrls, chunkCount: persisted.length };
}

export interface CrawlRawPage {
  url: string;
  html: string;
}

export interface LoadCrawlPagesDeps {
  objectStore?: ObjectStore;
}

/**
 * Reconstructs a `site_crawl` source's raw pages from its stored bundle
 * (`sources.rawRef`) without re-crawling the network — stage 3
 * (../storyboard.ts) uses this to derive the flow map from a crawl that may
 * have run long before the storyboard call.
 */
export async function loadCrawlPages(
  ctx: TenantCtx,
  repos: Repos,
  sourceId: string,
  deps: LoadCrawlPagesDeps = {},
): Promise<CrawlRawPage[]> {
  const source = await repos.sources.get(ctx, sourceId);
  if (!source) throw new Error(`source "${sourceId}" not found for this tenant`);
  if (source.kind !== "site_crawl") {
    throw new Error(`source "${sourceId}" is kind "${source.kind}", expected "site_crawl"`);
  }
  if (!source.rawRef) {
    throw new Error(`site_crawl source "${sourceId}" has no stored raw page bundle`);
  }
  const objectStore = deps.objectStore ?? getObjectStore();
  const raw = await objectStore.get(source.rawRef);
  if (!raw) {
    throw new Error(
      `site_crawl source "${sourceId}" raw page bundle "${source.rawRef}" is missing from the object store`,
    );
  }
  return JSON.parse(raw.toString("utf8")) as CrawlRawPage[];
}
