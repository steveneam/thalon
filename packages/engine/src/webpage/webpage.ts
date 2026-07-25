import {
  brandIdentitySchema,
  renderBrandIdentity,
  type TenantCtx,
} from "@thalon/contracts";
import { sha256Hex, type Draft, type Repos } from "@thalon/db";
import { getObjectStore, modelTiers, objectKey, readEnv, withGatewayGuard, type ObjectStore } from "@thalon/platform";
import { groundingRunParams, resolveGroundingSet } from "../pipeline/grounding-set";
import { runSingleDraftPipeline } from "../pipeline/single-draft";
import { extractVisibleText } from "./html";
import { webPageDraftMetaSchema } from "./schemas";
import {
  gatewayWebPageDriver,
  webPagePromptVersion,
  type WebPageDriver,
} from "./shell/generator";
import { generateValidatedWebPage } from "./validate-shell-output";

/** A landing page isn't a per-social-platform format — this default fills the schema's `platform` (NOT NULL) and `fanout_runs.platforms` columns (mirrors B3.9's PILLAR_PLATFORM). Overridable per request: data, not code. */
const WEB_PLATFORM = "web";
/** No per-tenant/shipped platform-profile file applies to a landing page (it isn't social copy with a tone/char-limit/hashtag policy) — provenance filler, mirrors pillar.v1. */
const WEB_PLATFORM_PROFILE_VERSION = "web.v1";

export interface WebPageRequest {
  /** `sources.id` of the ingested operator prompt (kind "prompt") — the brief. */
  promptSourceId: string;
  /** Extra pre-ingested grounding sources the page may draw claims from (site crawl, repo readme, docs). Prompt-kind ids (a prior brief carried forward on re-brief) are REPLACED by the current brief, never appended — the 491089d0 ratchet (pipeline/grounding-set.ts). */
  groundingSourceIds?: string[];
  /** Overrides the draft's platform label (default "web") — data, not code. */
  platform?: string;
}

export interface WebPageDeps {
  driver?: WebPageDriver;
  objectStore?: ObjectStore;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface WebPageResult {
  runId: string;
  /** false whenever the run row itself already existed (mirrors OriginationResult.created). */
  created: boolean;
  draft: Draft;
}

/**
 * B3.15 entry point: operator prompt (+ active profile identity + optional
 * grounding sources) -> ONE judged-format `web_page` draft (CHARTER B3.15 —
 * the third output family beside social posts and pillar videos, on exactly
 * the same origination→judge→approve→ship spine). Idempotency/backfill
 * semantics live in the shared single-draft spine
 * (../pipeline/single-draft.ts, B4.1).
 *
 * The generated HTML is persisted content-addressed to the object store
 * BEFORE the draft row exists (`web-pages/<sha256(html)>.html` — idempotent
 * on retry, and the draft can never reference bytes that aren't durably
 * there). The draft's `body` — the G1+G3 claim surface — is DERIVED from
 * that artifact via extractVisibleText, so no on-page copy can escape the
 * judge. Every draft lands in status "generated" only — the judge harness
 * is the only path onward, grounding against EVERY source in
 * meta.groundingSourceIds plus the active profile identity (B3.8, appended
 * inside the pipeline itself).
 */
export async function runWebPageGeneration(
  ctx: TenantCtx,
  repos: Repos,
  request: WebPageRequest,
  deps: WebPageDeps = {},
): Promise<WebPageResult> {
  const promptSource = await repos.sources.get(ctx, request.promptSourceId);
  if (!promptSource) {
    throw new Error(`source "${request.promptSourceId}" not found for this tenant`);
  }
  if (promptSource.kind !== "prompt") {
    throw new Error(
      `source "${request.promptSourceId}" is kind "${promptSource.kind}", expected "prompt" — the operator brief must be a prompt source (ingest it first)`,
    );
  }

  // 491089d0 ratchet: the one resolver owns the merge — a prompt-kind id in
  // the request is a prior brief, and THIS brief replaces it (never appends).
  const resolved = await resolveGroundingSet(ctx, repos, request.groundingSourceIds);
  const groundingIds = resolved.groundingIds;

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const platform = request.platform?.trim() || WEB_PLATFORM;
  const model = modelTiers().draft;
  const promptVersion = webPagePromptVersion();
  const objectStore = deps.objectStore ?? getObjectStore();
  const runParams = groundingRunParams(resolved);

  return runSingleDraftPipeline(ctx, repos, {
    format: "web_page",
    keyMaterial: {
      tenantId: ctx.tenantId,
      promptSourceId: promptSource.id,
      groundingSourceIds: groundingIds,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platform,
      promptVersion,
      model,
    },
    run: {
      sourceId: promptSource.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: [platform],
      promptVersion,
      model,
      params: Object.keys(runParams).length > 0 ? runParams : undefined,
    },
    irrecoverableLabel: "web-page generation",
    generate: async () => {
      const promptChunks = await repos.sourceChunks.listBySource(ctx, promptSource.id);
      const operatorPrompt = promptChunks.map((chunk) => chunk.text).join("\n\n");
      const groundingParts: string[] = [];
      for (const id of groundingIds) {
        const chunks = await repos.sourceChunks.listBySource(ctx, id);
        groundingParts.push(chunks.map((chunk) => chunk.text).join("\n\n"));
      }
      const groundingText = groundingParts.filter(Boolean).join("\n\n---\n\n");

      const voice = (profile.voice as Record<string, unknown> | null) ?? {};
      // B3.8: identity rides along automatically — rendered with the SAME
      // contracts function the judge grounds against; empty identity ⇒ absent.
      const identityBlock =
        renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {})) || undefined;
      const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
      const rawDriver = deps.driver ?? gatewayWebPageDriver();

      // Core meters the shell: EVERY attempt (including repair retries) routes
      // through the one gateway choke point — budget asserted before, usage
      // recorded after, span traced (SPINE §1; amendment A2). The shell driver
      // itself stays read-only.
      const guardedDriver: WebPageDriver = (req) =>
        withGatewayGuard({
          usage: {
            assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
            recordUsage: (o) => repos.usageLedger.record(ctx, o),
          },
          capTokens,
          model,
          operation: "webpage.web_page",
          call: async () => {
            const out = await rawDriver(req);
            return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
          },
        });

      return generateValidatedWebPage(guardedDriver, {
        operatorPrompt,
        voice,
        identityBlock,
        groundingText,
      });
    },
    toDraft: async (output) => {
      // The artifact lands first, content-addressed — idempotent on retry, and
      // a draft can never reference bytes that aren't durably in the store.
      const html = output.html;
      const htmlRef = objectKey("web-pages", sha256Hex(html), "html");
      await objectStore.put(htmlRef, html);

      const meta = webPageDraftMetaSchema.parse({
        title: output.title,
        description: output.description,
        htmlRef,
        groundingSourceIds: [promptSource.id, ...groundingIds],
        promptVersion,
        brandProfileVersion: profile.version,
        platformProfileVersion: WEB_PLATFORM_PROFILE_VERSION,
      });
      // The body is the claim surface the judge reads: the page's extracted
      // visible text (title included via its <title>/<h1>), never a parallel
      // authored summary — nothing on the page can escape the judge. The meta
      // description is served (blog index, social previews) without being
      // visible page text, so it joins the claim surface explicitly — the
      // schema's "judged copy like everything else" promise is mechanical,
      // not aspirational.
      const body = `${extractVisibleText(html)}\n\n${output.description}`;
      return { platform, body, meta };
    },
  });
}
