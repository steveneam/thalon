import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import {
  openTestDb,
  sha256Hex,
  stableStringify,
  type DbHandle,
  type Draft,
  type Repos,
} from "@thalon/db";
import { LocalObjectStore, modelTiers } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { driveDemoCapture } from "../demo/capture";
import type { CrawlFetchResult, CrawlFetcher } from "../demo/fetcher";
import { createFakeDemoDriver } from "../demo/fake-driver";
import { runSiteCrawl } from "../demo/ingest-crawl";
import { demoPlanDraftMetaSchema, type DemoPlanDraftMeta } from "../demo/schemas";
import { createFakeStoryboardDriver, storyboardPromptVersion } from "../demo/shell/generator";
import { generateDemoPlan } from "../demo/storyboard";
import { createFakeEmbeddingDriver } from "../ingest/shell/embedder";
import { runOrigination } from "../origination/origination";
import {
  pillarScriptDraftMetaSchema,
  type PillarScriptDraftMeta,
} from "../origination/schemas";
import {
  createFakePillarScriptDriver,
  pillarScriptPromptVersion,
} from "../origination/shell/generator";
import {
  createFakeDirectionScenesDriver,
  createFakeStoryboardStageDriver,
} from "../direction/shell/generator";
import { advanceVideoStage, startVideoStages } from "../pipeline/staged-video";
import { createFakeRenderTarget } from "../render/fake-target";
import { renderPillar } from "../render/render";
import { extractVisibleText } from "../webpage/html";
import { webPageDraftMetaSchema } from "../webpage/schemas";
import { createFakeWebPageDriver, webPagePromptVersion } from "../webpage/shell/generator";
import { runWebPageGeneration } from "../webpage/webpage";

/**
 * B4.1 key-stability pins (CHARTER A10 standing invariant): generation keys,
 * content hashes, artifact key schemes, and judged-body derivations stay
 * BYTE-STABLE through every Sprint-4 refactor — idempotency and every
 * content-addressed cache depend on these exact bytes. Each test freezes
 * today's key material and composition: the literal hash vectors, the exact
 * field set fed to stableStringify per format, the `:format` draft-key
 * suffixes, the object-store key conventions (B4.6 unifies these three), and
 * the body strings the judge binds to (I1 body_hash). A failing pin means a
 * refactor changed bytes it must not change — fix the code, never the pin.
 */

let handle: DbHandle | undefined;
const storeRoots: string[] = [];

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const root of storeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function newStore(tag: string): LocalObjectStore {
  const root = mkdtempSync(path.join(tmpdir(), `thalon-key-pins-${tag}-`));
  storeRoots.push(root);
  return new LocalObjectStore(root);
}

async function db(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  profile: { id: string; version: number };
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return { ctx, repos, profile };
}

async function ingestPrompt(ctx: TenantCtx, repos: Repos): Promise<string> {
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("pin brief"),
    chunks: [{ seq: 0, text: "Introduce what the product does.", tokenCount: 6, contentHash: sha256Hex("pin-brief-0") }],
  });
  return source.id;
}

async function ingestDoc(ctx: TenantCtx, repos: Repos, tag: string): Promise<string> {
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "doc",
    contentHash: sha256Hex(`pin doc ${tag}`),
    chunks: [{ seq: 0, text: `Fact ${tag}.`, tokenCount: 2, contentHash: sha256Hex(`pin-doc-${tag}`) }],
  });
  return source.id;
}

describe("hash primitives (literal vectors)", () => {
  it("sha256Hex is plain SHA-256 hex", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("thalon-key-stability-pin")).toBe(
      "d94ed19a386987f5e3d1971bcdc1bf9c40e6647d48506de2f38abd3eaa2b2178",
    );
  });

  it("stableStringify sorts object keys recursively, preserves array order, keeps null, DROPS undefined properties", () => {
    const vector = { b: 1, a: { d: [2, 1], c: null }, z: undefined };
    expect(stableStringify(vector)).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
    expect(sha256Hex(stableStringify(vector))).toBe(
      "bc9ad11b7850575d46b7bdd04896acccd62c7015fa4291f222935e5b95c11d48",
    );
  });
});

describe("origination (pillar_script) key material", () => {
  it("run key = sha256(stableStringify(pinned field set)); grounding ids deduped+sorted; draft key = sha256(runKey + ':pillar_script'); body = title/hook/narrations/cta joined by blank lines", async () => {
    const { ctx, repos, profile } = await db();
    const promptSourceId = await ingestPrompt(ctx, repos);
    const docA = await ingestDoc(ctx, repos, "a");
    const docB = await ingestDoc(ctx, repos, "b");

    const result = await runOrigination(
      ctx,
      repos,
      // Unsorted + duplicated on purpose: dedupe-then-lexicographic-sort is
      // part of the pinned key contract.
      { promptSourceId, groundingSourceIds: [docB, docA, docB] },
      { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
    );

    expect(pillarScriptPromptVersion()).toBe("pillar-script-generate.v1");
    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        promptSourceId,
        groundingSourceIds: [docA, docB].sort(),
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: "video",
        promptVersion: "pillar-script-generate.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(result.runId);
    expect(result.draft.generationKey).toBe(sha256Hex(`${expectedRunKey}:pillar_script`));

    const meta: PillarScriptDraftMeta = pillarScriptDraftMetaSchema.parse(result.draft.meta);
    expect(result.draft.body).toBe(
      [
        meta.title,
        meta.hook,
        ...meta.beats.map((beat) => beat.narration),
        ...(meta.cta ? [meta.cta] : []),
      ].join("\n\n"),
    );
  });
});

describe("webpage (web_page) key material + artifact scheme", () => {
  it("run key field set pinned; draft key suffix ':web_page'; htmlRef = web-pages/<sha256(html)>.html; body = extractVisibleText(stored html)", async () => {
    const { ctx, repos, profile } = await db();
    const objectStore = newStore("web");
    const promptSourceId = await ingestPrompt(ctx, repos);
    const docA = await ingestDoc(ctx, repos, "a");

    const result = await runWebPageGeneration(
      ctx,
      repos,
      { promptSourceId, groundingSourceIds: [docA] },
      { driver: createFakeWebPageDriver(), objectStore, capTokens: 1_000_000 },
    );

    expect(webPagePromptVersion()).toBe("web-page-generate.v1");
    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        promptSourceId,
        groundingSourceIds: [docA],
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: "web",
        promptVersion: "web-page-generate.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(result.runId);
    expect(result.draft.generationKey).toBe(sha256Hex(`${expectedRunKey}:web_page`));

    const meta = webPageDraftMetaSchema.parse(result.draft.meta);
    const stored = await objectStore.get(meta.htmlRef);
    expect(stored).not.toBeNull();
    const html = stored!.toString("utf8");
    expect(meta.htmlRef).toBe(`web-pages/${sha256Hex(html)}.html`);
    // The claim surface = visible text + the served-but-not-visible meta description.
    expect(result.draft.body).toBe(`${extractVisibleText(html)}\n\n${meta.description}`);
  });
});

describe("storyboard (demo_plan) key material", () => {
  class FixtureCrawlFetcher implements CrawlFetcher {
    constructor(private readonly responses: Record<string, CrawlFetchResult>) {}
    async fetch(url: string): Promise<CrawlFetchResult> {
      return this.responses[url] ?? { status: 404, html: "" };
    }
  }

  it("run key field set pinned (flowName verbatim, no platform field); draft key suffix ':demo_plan'; body = step narrations joined by blank lines", async () => {
    const { ctx, repos, profile } = await db();
    const objectStore = newStore("demo");
    const origin = "https://example.test";
    let clock = 0;
    const crawl = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${origin}/` },
      {
        fetcher: new FixtureCrawlFetcher({
          [`${origin}/robots.txt`]: { status: 404, html: "" },
          [`${origin}/`]: { status: 200, html: `<a id="docs-link" href="/docs">Docs</a>` },
          [`${origin}/docs`]: { status: 200, html: `<a href="/">Home</a> Docs content.` },
        }),
        objectStore,
        embedder: createFakeEmbeddingDriver(1536),
        capTokens: 1_000_000,
        rateLimiter: { now: () => clock, sleep: async (ms: number) => { clock += ms; } },
      },
    );

    const flowName = "open the docs";
    const result = await generateDemoPlan(
      ctx,
      repos,
      { crawlSourceId: crawl.sourceId, flowName },
      { driver: createFakeStoryboardDriver(), capTokens: 1_000_000, objectStore },
    );

    expect(storyboardPromptVersion()).toBe("storyboard-generate.v1");
    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        crawlSourceId: crawl.sourceId,
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        flowName,
        promptVersion: "storyboard-generate.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(result.runId);
    expect(result.draft.generationKey).toBe(sha256Hex(`${expectedRunKey}:demo_plan`));

    const meta = result.draft.meta as { steps: { narration: string }[] };
    expect(result.draft.body).toBe(meta.steps.map((step) => step.narration).join("\n\n"));
  });
});

describe("staged video (storyboard + direction_doc) key material (B5.2)", () => {
  /** Walks a stage draft to `queued` through the one transition fn (I1 satisfied by a final-gate pass) — the judge-passed state advanceVideoStage gates on. */
  async function queueStage(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
    await repos.drafts.transition(ctx, draft.id, "judging");
    await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
    return repos.drafts.transition(ctx, draft.id, "queued");
  }

  it("structure run key = sha256(stableStringify(pinned field set incl. family+stageKey)); draft key = sha256(runKey + ':storyboard'); body = title/narrations/cta joined by blank lines", async () => {
    const { ctx, repos, profile } = await db();
    const promptSourceId = await ingestPrompt(ctx, repos);
    const docA = await ingestDoc(ctx, repos, "a");
    const docB = await ingestDoc(ctx, repos, "b");

    const result = await startVideoStages(
      ctx,
      repos,
      // Unsorted + duplicated on purpose: dedupe-then-lexicographic-sort is
      // part of the pinned key contract (mirrors origination).
      { promptSourceId, groundingSourceIds: [docB, docA, docB] },
      { structureDriver: createFakeStoryboardStageDriver(), capTokens: 1_000_000 },
    );

    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        family: "video",
        stageKey: "structure",
        promptSourceId,
        groundingSourceIds: [docA, docB].sort(),
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: "video",
        promptVersion: "storyboard-stage-structure.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(result.runId);
    expect(result.draft.generationKey).toBe(sha256Hex(`${expectedRunKey}:storyboard`));

    const meta = result.draft.meta as { title: string; scenes: { narration: string }[]; cta: string | null };
    expect(result.draft.body).toBe(
      [meta.title, ...meta.scenes.map((s) => s.narration), ...(meta.cta ? [meta.cta] : [])].join(
        "\n\n",
      ),
    );
  });

  it("advance run key pins priorDraftId + priorContentHash = sha256(stableStringify({body, meta})); draft key = sha256(runKey + ':direction_doc')", async () => {
    const { ctx, repos, profile } = await db();
    const promptSourceId = await ingestPrompt(ctx, repos);
    const start = await startVideoStages(
      ctx,
      repos,
      { promptSourceId },
      { structureDriver: createFakeStoryboardStageDriver(), capTokens: 1_000_000 },
    );
    await queueStage(ctx, repos, start.draft);
    const prior = await repos.drafts.get(ctx, start.draft.id);

    const result = await advanceVideoStage(
      ctx,
      repos,
      { draftId: prior.id },
      { scenesDriver: createFakeDirectionScenesDriver(), capTokens: 1_000_000 },
    );

    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        family: "video",
        stageKey: "scenes_effects",
        priorDraftId: prior.id,
        priorContentHash: sha256Hex(stableStringify({ body: prior.body, meta: prior.meta })),
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: "video",
        promptVersion: "direction-stage-scenes.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(result.runId);
    expect(result.draft.generationKey).toBe(sha256Hex(`${expectedRunKey}:direction_doc`));

    const meta = result.draft.meta as { doc: { title: string; scenes: { narration: string }[]; cta: string | null } };
    expect(result.draft.body).toBe(
      [
        meta.doc.title,
        ...meta.doc.scenes.map((s) => s.narration),
        ...(meta.doc.cta ? [meta.doc.cta] : []),
      ].join("\n\n"),
    );
  });
});

describe("post-approval artifact key schemes (the three conventions B4.6 unifies)", () => {
  /** Walks a draft to `approved` through the one transition fn (I1 gate satisfied by a final-gate pass). */
  async function approve(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
    await repos.drafts.transition(ctx, draft.id, "judging");
    await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
    await repos.drafts.transition(ctx, draft.id, "queued");
    return repos.drafts.transition(ctx, draft.id, "approved");
  }

  it("render: renderRef = renders/pillar/<sha256(manifest bytes)>/manifest.json with pinned sibling names and manifestVersion", async () => {
    const { ctx, repos, profile } = await db();
    const objectStore = newStore("render");
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "pin" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["video"],
      promptVersion: "pillar-script-generate.v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:pin-render-run`,
    });
    const meta: PillarScriptDraftMeta = pillarScriptDraftMetaSchema.parse({
      title: "Pinned title",
      hook: "Pinned hook?",
      beats: [{ beatIndex: 0, narration: "Pinned narration." }],
      cta: "Pinned CTA.",
      groundingSourceIds: [source.id],
      promptVersion: "pillar-script-generate.v1",
      brandProfileVersion: profile.version,
      platformProfileVersion: "pillar.v1",
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "video",
      body: [meta.title, meta.hook, "Pinned narration.", meta.cta].join("\n\n"),
      format: "pillar_script",
      generationKey: `${ctx.tenantId}:pin-render-draft`,
      meta,
    });
    await approve(ctx, repos, draft);

    const result = await renderPillar(ctx, repos, draft.id, createFakeRenderTarget(), { objectStore });
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") throw new Error("unreachable");

    const manifestBytes = await objectStore.get(result.renderRef);
    expect(manifestBytes).not.toBeNull();
    const manifestJson = manifestBytes!.toString("utf8");
    // The content-addressing is independently verifiable: the manifest's own
    // bytes hash to the prefix segment, and the prefix scheme is pinned.
    expect(result.renderRef).toBe(`renders/pillar/${sha256Hex(manifestJson)}/manifest.json`);
    expect(JSON.parse(manifestJson).manifestVersion).toBe("pillar-render.v1");
    const prefix = result.renderRef.replace(/\/manifest\.json$/, "");
    expect(await objectStore.get(`${prefix}/captions.srt`)).not.toBeNull();
    expect(await objectStore.get(`${prefix}/artifacts.json`)).not.toBeNull();
  });

  it("capture: captureRef = demo-captures/<sha256(bundle bytes)>.json", async () => {
    const { ctx, repos, profile } = await db();
    const objectStore = newStore("capture");
    const source = await repos.sources.create(ctx, { kind: "site_crawl", contentHash: "pin" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["web"],
      promptVersion: "storyboard-generate.v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:pin-capture-run`,
    });
    const meta: DemoPlanDraftMeta = demoPlanDraftMetaSchema.parse({
      steps: [
        { stepIndex: 0, action: "goto", target: "https://example.test/", value: "", narration: "Open the homepage." },
      ],
      crawlSourceId: source.id,
      pageUrls: ["https://example.test/"],
      captureStatus: "planned",
      captureRef: null,
      promptVersion: "storyboard-generate.v1",
      brandProfileVersion: profile.version,
      platformProfileVersion: "demo.v1",
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "web",
      body: "Open the homepage.",
      format: "demo_plan",
      generationKey: `${ctx.tenantId}:pin-capture-draft`,
      meta,
    });
    await approve(ctx, repos, draft);

    const result = await driveDemoCapture(ctx, repos, draft.id, createFakeDemoDriver(), { objectStore });
    expect(result.status).toBe("captured");
    if (result.status !== "captured") throw new Error("unreachable");

    const stored = await objectStore.get(result.captureRef);
    expect(stored).not.toBeNull();
    expect(result.captureRef).toBe(`demo-captures/${sha256Hex(stored!.toString("utf8"))}.json`);
  });
});
