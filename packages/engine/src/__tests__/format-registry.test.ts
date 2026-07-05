import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DRAFT_FORMAT_REGISTRY,
  DRAFT_FORMATS,
  resolveDraftFormatSpec,
  tenantCtx,
  type TenantCtx,
} from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import type { CrawlFetchResult, CrawlFetcher } from "../demo/fetcher";
import { runSiteCrawl } from "../demo/ingest-crawl";
import { createFakeStoryboardDriver } from "../demo/shell/generator";
import { generateDemoPlan } from "../demo/storyboard";
import { runFanout } from "../fanout/fanout";
import { createFakeDraftGeneratorDriver } from "../fanout/shell/generator";
import { createFakeEmbeddingDriver } from "../ingest/shell/embedder";
import { runOrigination } from "../origination/origination";
import { createFakePillarScriptDriver } from "../origination/shell/generator";
import { runWaterfall } from "../waterfall/waterfall";
import { createFakeHighlightSelectDriver } from "../waterfall/shell/generator";
import { createFakeWebPageDriver } from "../webpage/shell/generator";
import { runWebPageGeneration } from "../webpage/webpage";

/**
 * B4.2 ratchet (CHARTER A10): every draft any pipeline persists must parse
 * against its format's REGISTERED meta schema
 * (@thalon/contracts/format-registry.ts), and every meta-derivable judged
 * body must reproduce `drafts.body` byte-for-byte (the I1 body_hash
 * convention the registry declares as `expectedBody`). A failure here means
 * a pipeline drifted from the pinned contract — fix the pipeline or open a
 * contract window; never widen the schema ad hoc.
 */

let handle: DbHandle | undefined;
const storeRoots: string[] = [];

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const root of storeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function newStore(tag: string): LocalObjectStore {
  const root = mkdtempSync(path.join(tmpdir(), `thalon-format-registry-${tag}-`));
  storeRoots.push(root);
  return new LocalObjectStore(root);
}

async function db(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return { ctx, repos };
}

async function ingestPrompt(ctx: TenantCtx, repos: Repos): Promise<string> {
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("registry brief"),
    chunks: [{ seq: 0, text: "Introduce what the product does.", tokenCount: 6, contentHash: sha256Hex("registry-brief-0") }],
  });
  return source.id;
}

/** The ratchet assertion: registered spec resolves, meta parses, meta-derived body reproduces drafts.body. */
function assertRegistered(draft: Draft, expectedFormat: string): void {
  const spec = resolveDraftFormatSpec(draft.format);
  expect(spec.format).toBe(expectedFormat);
  const parsed = spec.meta.parse(draft.meta);
  if (spec.expectedBody) {
    expect(spec.expectedBody(parsed)).toBe(draft.body);
  }
}

describe("format contract registry (B4.2 ratchet, keyless + networkless)", () => {
  it("declares a spec for every known draft format", () => {
    for (const format of DRAFT_FORMATS) {
      expect(DRAFT_FORMAT_REGISTRY[format].format).toBe(format);
    }
    // Unknown (platform-native shell-emitted) and null formats resolve to post.
    expect(resolveDraftFormatSpec("tweet_thread").format).toBe("post");
    expect(resolveDraftFormatSpec(null).format).toBe("post");
  });

  it("post: fan-out drafts parse against the registered post meta", async () => {
    const { ctx, repos } = await db();
    const promptSourceId = await ingestPrompt(ctx, repos);
    const result = await runFanout(
      ctx,
      repos,
      { sourceId: promptSourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    expect(result.drafts).toHaveLength(1);
    assertRegistered(result.drafts[0], "post");
  });

  it("clip_plan: waterfall drafts parse and the registered body derivation reproduces drafts.body", async () => {
    const { ctx, repos } = await db();
    const { source } = await repos.sourceChunks.ingest(ctx, {
      kind: "video_transcript",
      contentHash: sha256Hex("registry transcript"),
      chunks: [
        { seq: 0, text: "First idea from the talk.", startMs: 0, endMs: 2_000, tokenCount: 5, contentHash: sha256Hex("rc-0") },
        { seq: 1, text: "A separate second idea.", startMs: 4_500, endMs: 6_500, tokenCount: 4, contentHash: sha256Hex("rc-1") },
      ],
    });
    const result = await runWaterfall(
      ctx,
      repos,
      {
        sourceId: source.id,
        platforms: ["linkedin"],
        windowConfig: { minDurationMs: 1_000, maxDurationMs: 10_000, pauseGapMs: 300 },
      },
      { driver: createFakeHighlightSelectDriver(), capTokens: 1_000_000 },
    );
    expect(result.drafts.length).toBeGreaterThan(0);
    for (const draft of result.drafts) assertRegistered(draft, "clip_plan");
  });

  it("demo_plan: storyboard drafts parse and the registered body derivation reproduces drafts.body", async () => {
    const { ctx, repos } = await db();
    const objectStore = newStore("demo");
    const origin = "https://example.test";
    let clock = 0;
    const responses: Record<string, CrawlFetchResult> = {
      [`${origin}/robots.txt`]: { status: 404, html: "" },
      [`${origin}/`]: { status: 200, html: `<a id="docs-link" href="/docs">Docs</a>` },
      [`${origin}/docs`]: { status: 200, html: `<a href="/">Home</a> Docs content.` },
    };
    const fetcher: CrawlFetcher = { fetch: async (url) => responses[url] ?? { status: 404, html: "" } };
    const crawl = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${origin}/` },
      {
        fetcher,
        objectStore,
        embedder: createFakeEmbeddingDriver(1536),
        capTokens: 1_000_000,
        rateLimiter: { now: () => clock, sleep: async (ms: number) => { clock += ms; } },
      },
    );
    const result = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId: crawl.sourceId, flowName: "open the docs" },
      { driver: createFakeStoryboardDriver(), capTokens: 1_000_000, objectStore },
    );
    assertRegistered(result.draft, "demo_plan");
  });

  it("pillar_script: origination drafts parse and the registered body derivation reproduces drafts.body", async () => {
    const { ctx, repos } = await db();
    const promptSourceId = await ingestPrompt(ctx, repos);
    const result = await runOrigination(
      ctx,
      repos,
      { promptSourceId },
      { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
    );
    assertRegistered(result.draft, "pillar_script");
  });

  it("web_page: webpage drafts parse; body is artifact-derived so the registry declares no expectedBody", async () => {
    const { ctx, repos } = await db();
    const objectStore = newStore("web");
    const promptSourceId = await ingestPrompt(ctx, repos);
    const result = await runWebPageGeneration(
      ctx,
      repos,
      { promptSourceId },
      { driver: createFakeWebPageDriver(), objectStore, capTokens: 1_000_000 },
    );
    assertRegistered(result.draft, "web_page");
    expect(resolveDraftFormatSpec("web_page").expectedBody).toBeUndefined();
  });
});
