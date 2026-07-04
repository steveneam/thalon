import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard, type ObjectStore } from "@thalon/platform";
import { deriveFlowMap, flowMapPageUrls, type FlowMap } from "./flow-map";
import { loadCrawlPages } from "./ingest-crawl";
import { demoPlanDraftMetaSchema } from "./schemas";
import {
  gatewayStoryboardDriver,
  storyboardPromptVersion,
  type StoryboardDriver,
} from "./shell/generator";
import { generateValidatedStoryboard } from "./validate-shell-output";

/** `demo_plan` drafts aren't a per-social-platform format (no LinkedIn/X variant) — this fixed value fills the schema's `platform` (NOT NULL) and `fanout_runs.platforms` columns, mirroring the "one platform" shape those tables expect. */
const DEMO_PLATFORM = "web";
/** No per-tenant/shipped platform-profile file applies to a demo storyboard (it isn't social copy with a tone/char-limit/hashtag policy) — this constant fills `platformProfileVersion`'s provenance field, which every other draft format also records. */
const DEMO_PLATFORM_PROFILE_VERSION = "demo.v1";

export interface DemoPlanRequest {
  /** `sources.id` of a `site_crawl` source (../ingest-crawl.ts's `runSiteCrawl` output). */
  crawlSourceId: string;
  /** Operator-named flow to storyboard, e.g. "search the docs for X and open a result". */
  flowName: string;
}

export interface DemoPlanDeps {
  driver?: StoryboardDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
  /** Overrides the object store `loadCrawlPages` reads the crawl's raw page bundle from (tests only — must match whatever store `runSiteCrawl` was given). */
  objectStore?: ObjectStore;
}

export interface DemoPlanResult {
  runId: string;
  /** false whenever the run row itself already existed (mirrors WaterfallResult.created). */
  created: boolean;
  draft: Draft;
}

/**
 * B2.5 stage 3 entry point: a `site_crawl` source's flow map (stage 2,
 * ./flow-map.ts, derived from ./ingest-crawl.ts's `loadCrawlPages`) ->
 * storyboard (shell, ./shell/generator.ts) -> one `demo_plan` draft for the
 * named flow (CHARTER B2.5). Mirrors ../waterfall/waterfall.ts's
 * idempotency/backfill semantics collapsed to N=1 (one storyboard per run,
 * instead of one clip per candidate window per platform): a repeat call with
 * an identical generation key and the draft already persisted is a
 * zero-shell-call fast path; a repeat call after a prior irrecoverable
 * failure (a run row exists but its one draft was never persisted)
 * regenerates the single missing draft, reusing the same run. Every draft
 * lands in status "generated" only — the judge harness is the only path
 * onward from here.
 */
export async function generateDemoPlan(
  ctx: TenantCtx,
  repos: Repos,
  request: DemoPlanRequest,
  deps: DemoPlanDeps = {},
): Promise<DemoPlanResult> {
  const source = await repos.sources.get(ctx, request.crawlSourceId);
  if (!source) throw new Error(`source "${request.crawlSourceId}" not found for this tenant`);
  if (source.kind !== "site_crawl") {
    throw new Error(
      `source "${request.crawlSourceId}" is kind "${source.kind}", expected "site_crawl"`,
    );
  }

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const model = modelTiers().draft;
  const promptVersion = storyboardPromptVersion();
  const generationKey = sha256Hex(
    stableStringify({
      tenantId: ctx.tenantId,
      crawlSourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      flowName: request.flowName,
      promptVersion,
      model,
    }),
  );

  // Fast-path idempotency check (mirrors waterfall): a repeat call skips
  // generation entirely, before ever reaching the gateway — UNLESS a prior
  // call created the run but never persisted its draft (see backfill below).
  const existingRun = await repos.fanoutRuns.getByGenerationKey(ctx, generationKey);

  let runId: string;
  let runGenerationKey: string;
  let created: boolean;

  if (existingRun) {
    const existingDrafts = await repos.drafts.listByRun(ctx, existingRun.id);
    if (existingDrafts.length > 0) {
      return { runId: existingRun.id, created: false, draft: existingDrafts[0] };
    }
    runId = existingRun.id;
    runGenerationKey = existingRun.generationKey;
    created = false;
  } else {
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: [DEMO_PLATFORM],
      promptVersion,
      model,
      params: { flowName: request.flowName },
      generationKey,
    });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

  const pages = await loadCrawlPages(ctx, repos, source.id, { objectStore: deps.objectStore });
  const flowMap: FlowMap = deriveFlowMap(pages);
  const pageUrls = flowMapPageUrls(flowMap);
  if (pageUrls.length === 0) {
    throw new Error(`site_crawl source "${source.id}" produced no pages — nothing to storyboard`);
  }

  const chunks = await repos.sourceChunks.listBySource(ctx, source.id);
  const crawlContext = chunks.map((chunk) => chunk.text).join("\n\n");
  const voice = (profile.voice as Record<string, unknown> | null) ?? {};
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayStoryboardDriver();

  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const guardedDriver: StoryboardDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
        recordUsage: (o) => repos.usageLedger.record(ctx, o),
      },
      capTokens,
      model,
      operation: "demo.storyboard",
      call: async () => {
        const out = await rawDriver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

  const result = await generateValidatedStoryboard(
    guardedDriver,
    { flowName: request.flowName, voice, flowMap, crawlContext },
    flowMap,
  );
  if (!result.output) {
    throw new Error(
      `storyboard generation for flow "${request.flowName}" was irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
    );
  }

  const steps = result.output.steps.map((step, stepIndex) => ({ ...step, stepIndex }));
  const meta = demoPlanDraftMetaSchema.parse({
    steps,
    crawlSourceId: source.id,
    pageUrls,
    captureStatus: "planned",
    captureRef: null,
    promptVersion,
    brandProfileVersion: profile.version,
    platformProfileVersion: DEMO_PLATFORM_PROFILE_VERSION,
  });
  const body = steps.map((step) => step.narration).join("\n\n");

  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: runId,
    sourceId: source.id,
    platform: DEMO_PLATFORM,
    body,
    format: "demo_plan",
    generationKey: sha256Hex(`${runGenerationKey}:demo_plan`),
    meta,
  });

  return { runId, created, draft };
}
