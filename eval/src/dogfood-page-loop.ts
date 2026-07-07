import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  brandProfileConfigSchema,
  tenantCtx,
  type BrandProfileConfigInput,
} from "@thalon/contracts";
import { openDb, type Repos } from "@thalon/db";
import {
  ingestWebUrl,
  pageLoopContextSchema,
  publishWebPageToSite,
  runPageLoop,
  type PageLoopContextInput,
  type PageLoopDeps,
  type WebUrlIngestDeps,
} from "@thalon/engine";
import { gatewayJudgeDriver, runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { TENANT_ZERO } from "./dogfood";
import { assertSoleDbWriter, loadEnvLocal, useWebAppDataDir } from "./env-local";

/**
 * B6.6: the page-loop dogfood — the WHOLE origination live loop as one
 * chained run, every stage the same library entry point the product uses
 * (the B1.5 dogfood doctrine: wiring only, no new pipeline logic):
 *
 *   intel context → (optional) grounding web-ingest → page draft → judge
 *   → approve → own-site publish → posts bundle
 *
 *   npm run -w @thalon/eval dogfood:page-loop            # tenant #0, built-in Thalon context
 *   npm run -w @thalon/eval dogfood:page-loop -- run.json # any tenant/context as DATA (B2.1)
 *
 * The CLI reaches for the live gateway drivers (judge-tier spend — the
 * top-up-gated lead-side run); the library function takes injected drivers
 * so tests and rehearsals stay keyless. Approval honesty: `autoApprove`
 * rides the INPUT — running the loop with it set IS the operator's approve
 * touch (recorded with the input's actor); set it false to stop at
 * "queued" and triage in the web queue instead.
 */

export const pageLoopDogfoodInputSchema = z.object({
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1),
  brandConfig: brandProfileConfigSchema,
  context: pageLoopContextSchema,
  /** Operator site / docs URL ingested as grounding before generation (the web-ingest door). */
  groundingUrl: z.string().min(1).optional(),
  /** Web-ingest driver name for groundingUrl (default "fetch-extract"; "crawl4ai" needs the local user-scope install). */
  webIngestDriver: z.string().min(1).optional(),
  /** Blog tags recorded in the posts bundle at publish. */
  tags: z.array(z.string().min(1)).optional(),
  autoApprove: z.boolean().default(false),
  actor: z.string().min(1).default("page-loop-dogfood"),
});
export type PageLoopDogfoodInput = z.infer<typeof pageLoopDogfoodInputSchema>;

export interface PageLoopDogfoodDeps {
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** The run's "now", ms epoch — the publish stamp (the clock is an argument in core). */
  nowMs: number;
  pageLoop?: PageLoopDeps;
  webIngest?: WebUrlIngestDeps;
  capTokens?: number;
}

export interface PageLoopDogfoodResult {
  tenantId: string;
  draftId: string;
  status: string;
  reason?: string;
  groundingSourceId?: string;
  slug?: string;
  url?: string;
  bundlePosts?: number;
}

export async function runPageLoopDogfood(
  repos: Repos,
  input: PageLoopDogfoodInput,
  deps: PageLoopDogfoodDeps,
): Promise<PageLoopDogfoodResult> {
  const tenant =
    (await repos.tenants.getBySlug(input.tenantSlug)) ??
    (await repos.tenants.create({ slug: input.tenantSlug, name: input.tenantName }));
  const ctx = tenantCtx(tenant.id);

  const activeProfile = await repos.brandProfiles.getActive(ctx);
  if (!activeProfile) {
    await repos.brandProfiles.create(ctx, { config: input.brandConfig, activate: true });
  }

  let groundingSourceId: string | undefined;
  if (input.groundingUrl) {
    const grounding = await ingestWebUrl(
      ctx,
      repos,
      { url: input.groundingUrl, driver: input.webIngestDriver },
      { ...deps.webIngest, capTokens: deps.webIngest?.capTokens ?? deps.capTokens },
    );
    groundingSourceId = grounding.sourceId;
  }

  const loop = await runPageLoop(
    ctx,
    repos,
    {
      context: input.context,
      groundingSourceIds: groundingSourceId ? [groundingSourceId] : undefined,
    },
    { ...deps.pageLoop, capTokens: deps.pageLoop?.capTokens ?? deps.capTokens },
  );

  // Same replay discipline as the B1.5 dogfood: only generated/judging
  // drafts are judged; anything else reports where it stands.
  let draft = loop.draft;
  if (draft.status === "generated" || draft.status === "judging") {
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: draft.id,
      screenDriver: deps.screenDriver,
      finalDriver: deps.finalDriver,
      capTokens: deps.capTokens,
    });
    draft = outcome.draft;
    if (outcome.status === "blocked") {
      return { tenantId: tenant.id, draftId: draft.id, status: draft.status, reason: outcome.reason, groundingSourceId };
    }
  }

  if (draft.status === "queued" && input.autoApprove) {
    ({ draft } = await repos.approvals.record(ctx, {
      draftId: draft.id,
      actor: input.actor,
      action: "approve",
    }));
  }

  if (draft.status !== "approved") {
    return { tenantId: tenant.id, draftId: draft.id, status: draft.status, groundingSourceId };
  }

  const published = await publishWebPageToSite(
    ctx,
    repos,
    { draftId: draft.id, nowMs: deps.nowMs, tags: input.tags },
    { objectStore: deps.pageLoop?.objectStore },
  );
  if (published.status === "failed") {
    return {
      tenantId: tenant.id,
      draftId: draft.id,
      status: "publish_failed",
      reason: published.error,
      groundingSourceId,
    };
  }
  return {
    tenantId: tenant.id,
    draftId: draft.id,
    status: "published",
    groundingSourceId,
    slug: published.slug,
    url: published.url,
    bundlePosts: published.bundle.posts.length,
  };
}

export function loadPageLoopDogfoodInput(path: string): PageLoopDogfoodInput {
  return pageLoopDogfoodInputSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** Tenant #0's built-in run: a Thalon-topic page grounded on nothing extra (grounding URL is a per-run choice), approve-on-run. */
export const PAGE_LOOP_TENANT_ZERO: PageLoopDogfoodInput = pageLoopDogfoodInputSchema.parse({
  tenantSlug: TENANT_ZERO.tenantSlug,
  tenantName: TENANT_ZERO.tenantName,
  brandConfig: TENANT_ZERO.brandConfig as BrandProfileConfigInput,
  context: {
    kind: "trend_promote",
    family: "page",
    title: "Why judged content pipelines beat unguarded generation",
    angle: "every draft passes a denylist and grounding gate before an operator ever sees it",
    hook: "Generation is cheap; trust is the product.",
    areaName: "AI video tooling",
  } satisfies PageLoopContextInput,
  tags: ["thalon", "content-engineering"],
  autoApprove: true,
});

async function main(): Promise<void> {
  loadEnvLocal();
  useWebAppDataDir();
  await assertSoleDbWriter();
  const inputPath = process.argv[2];
  const input = inputPath ? loadPageLoopDogfoodInput(inputPath) : PAGE_LOOP_TENANT_ZERO;
  console.error(
    `dogfood:page-loop: tenant "${input.tenantSlug}"${inputPath ? ` (from ${inputPath})` : " (built-in tenant #0)"}`,
  );
  const handle = await openDb();
  try {
    const result = await runPageLoopDogfood(handle.repos, input, {
      screenDriver: gatewayJudgeDriver(),
      finalDriver: gatewayJudgeDriver(),
      nowMs: Date.now(),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
