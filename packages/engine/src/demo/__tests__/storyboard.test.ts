import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, InvalidTransitionError, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import type { CrawlFetchResult, CrawlFetcher } from "../fetcher";
import { runSiteCrawl } from "../ingest-crawl";
import { createFakeStoryboardDriver, type StoryboardDriver } from "../shell/generator";
import { generateDemoPlan } from "../storyboard";

const ORIGIN = "https://example.test";

class FixtureCrawlFetcher implements CrawlFetcher {
  constructor(private readonly responses: Record<string, CrawlFetchResult>) {}
  async fetch(url: string): Promise<CrawlFetchResult> {
    return this.responses[url] ?? { status: 404, html: "" };
  }
}

function fastRateLimiterDeps() {
  let clock = 0;
  return { now: () => clock, sleep: async (ms: number) => { clock += ms; } };
}

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

async function setup(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  crawlSourceId: string;
  objectStore: LocalObjectStore;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-demo-storyboard-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  const fetcher = new FixtureCrawlFetcher({
    [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
    [`${ORIGIN}/`]: { status: 200, html: `<a id="docs-link" href="/docs">Docs</a>` },
    [`${ORIGIN}/docs`]: { status: 200, html: `<a href="/">Home</a> Docs content.` },
  });
  const crawl = await runSiteCrawl(
    ctx,
    repos,
    { seedUrl: `${ORIGIN}/` },
    { fetcher, objectStore, embedder, capTokens: 1_000_000, rateLimiter: fastRateLimiterDeps() },
  );
  return { ctx, repos, crawlSourceId: crawl.sourceId, objectStore };
}

describe("generateDemoPlan (B2.5 stage 3 end-to-end, keyless + networkless)", () => {
  it("persists one demo_plan draft in status generated with the pinned meta shape", async () => {
    const { ctx, repos, crawlSourceId, objectStore } = await setup();
    const result = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId, flowName: "open the docs" },
      { driver: createFakeStoryboardDriver(), capTokens: 1_000_000, objectStore },
    );

    expect(result.created).toBe(true);
    expect(result.draft.status).toBe("generated");
    expect(result.draft.format).toBe("demo_plan");
    expect(result.draft.platform).toBe("web");
    expect(result.draft.sourceId).toBe(crawlSourceId);

    const meta = result.draft.meta as Record<string, unknown>;
    expect(meta.crawlSourceId).toBe(crawlSourceId);
    expect(meta.captureStatus).toBe("planned");
    expect(meta.captureRef).toBeNull();
    expect(meta.promptVersion).toBe("storyboard-generate.v1");
    expect(meta.brandProfileVersion).toBe(1);
    expect(Array.isArray(meta.pageUrls)).toBe(true);
    expect((meta.pageUrls as string[]).length).toBeGreaterThan(0);

    const steps = meta.steps as { stepIndex: number; narration: string }[];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.map((s) => s.stepIndex)).toEqual(steps.map((_, i) => i));
    expect(result.draft.body).toBe(steps.map((s) => s.narration).join("\n\n"));
  });

  it("is idempotent: a repeat call with an identical request makes zero shell calls", async () => {
    const { ctx, repos, crawlSourceId, objectStore } = await setup();
    let calls = 0;
    const countingDriver: StoryboardDriver = (req) => {
      calls += 1;
      return createFakeStoryboardDriver()(req);
    };

    const first = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId, flowName: "open the docs" },
      { driver: countingDriver, capTokens: 1_000_000, objectStore },
    );
    expect(calls).toBe(1);

    const second = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId, flowName: "open the docs" },
      { driver: countingDriver, capTokens: 1_000_000, objectStore },
    );
    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(second.draft.id).toBe(first.draft.id);
    expect(calls).toBe(1); // no new shell call on replay
  });

  it("backfills the single missing draft after a prior irrecoverable failure, reusing the same run", async () => {
    const { ctx, repos, crawlSourceId, objectStore } = await setup();
    const alwaysInvalidDriver: StoryboardDriver = async () => ({
      candidate: { steps: [] }, // fails schema min(1) on every attempt
      tokensIn: 1,
      tokensOut: 1,
    });

    await expect(
      generateDemoPlan(
        ctx,
        repos,
        { crawlSourceId, flowName: "open the docs" },
        { driver: alwaysInvalidDriver, capTokens: 1_000_000, objectStore },
      ),
    ).rejects.toThrow(/irrecoverable/);

    // Nothing persisted for an always-invalid shell (waterfall's lesson) —
    // except the run row's lastError triage record (B4.5), audited.
    const draftEventsBefore = await repos.events.list(ctx, { entityType: "draft" });
    expect(draftEventsBefore).toHaveLength(0);
    const runEvents = await repos.events.list(ctx, { entityType: "fanout_run" });
    expect(runEvents.map((e) => e.event)).toEqual([
      "fanout_run.created",
      "fanout_run.last_error_recorded",
    ]);

    const second = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId, flowName: "open the docs" },
      { driver: createFakeStoryboardDriver(), capTokens: 1_000_000, objectStore },
    );
    expect(second.created).toBe(false);
    expect(second.runId).toBe(runEvents[0].entityId);
    expect(second.draft.status).toBe("generated");
  });

  it("throws when the source is not kind site_crawl", async () => {
    const { ctx, repos } = await setup();
    const other = await repos.sources.create(ctx, { kind: "prompt", contentHash: "abc123" });
    await expect(
      generateDemoPlan(
        ctx,
        repos,
        { crawlSourceId: other.id, flowName: "open the docs" },
        { driver: createFakeStoryboardDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/expected "site_crawl"/);
  });

  it("a demo_plan draft cannot reach queued or approved without passing through the judge", async () => {
    const { ctx, repos, crawlSourceId, objectStore } = await setup();
    const result = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId, flowName: "open the docs" },
      { driver: createFakeStoryboardDriver(), capTokens: 1_000_000, objectStore },
    );
    await expect(repos.drafts.transition(ctx, result.draft.id, "queued")).rejects.toThrow(
      InvalidTransitionError,
    );
    await expect(repos.drafts.transition(ctx, result.draft.id, "approved")).rejects.toThrow(
      InvalidTransitionError,
    );
  });
});
