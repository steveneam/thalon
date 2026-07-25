import {
  brandIdentitySchema,
  renderBrandIdentity,
  type TenantCtx,
} from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { groundingRunParams, resolveGroundingSet } from "../pipeline/grounding-set";
import { runSingleDraftPipeline } from "../pipeline/single-draft";
import { pillarScriptDraftMetaSchema } from "./schemas";
import {
  gatewayPillarScriptDriver,
  pillarScriptPromptVersion,
  type PillarScriptDriver,
} from "./shell/generator";
import { generateValidatedPillarScript } from "./validate-shell-output";

/** A pillar script isn't a per-social-platform format — this default fills the schema's `platform` (NOT NULL) and `fanout_runs.platforms` columns (mirrors B2.5's DEMO_PLATFORM). Overridable per request: data, not code. */
const PILLAR_PLATFORM = "video";
/** No per-tenant/shipped platform-profile file applies to a pillar script (it isn't social copy with a tone/char-limit/hashtag policy) — provenance filler, mirrors demo.v1. */
const PILLAR_PLATFORM_PROFILE_VERSION = "pillar.v1";

export interface OriginationRequest {
  /** `sources.id` of the ingested operator prompt (kind "prompt") — the brief. */
  promptSourceId: string;
  /** Extra pre-ingested grounding sources the script may draw claims from (site crawl, repo readme, docs). Prompt-kind ids (a prior brief carried forward on re-brief) are REPLACED by the current brief, never appended — the 491089d0 ratchet (pipeline/grounding-set.ts). */
  groundingSourceIds?: string[];
  /** Overrides the draft's platform label (default "video") — data, not code. */
  platform?: string;
}

export interface OriginationDeps {
  driver?: PillarScriptDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface OriginationResult {
  runId: string;
  /** false whenever the run row itself already existed (mirrors DemoPlanResult.created). */
  created: boolean;
  draft: Draft;
}

/**
 * B3.9 entry point: operator prompt (+ active profile identity + optional
 * grounding sources) -> ONE judged-format `pillar_script` draft (CHARTER
 * Sprint 3, A6). The engine's missing first stage — content the tenant does
 * not have yet originates here; B3.10 renders the approved script into the
 * pillar video + SRT, and B2.3 waterfalls that.
 *
 * Idempotency/backfill semantics live in the shared single-draft spine
 * (../pipeline/single-draft.ts, B4.1). Every draft lands in status
 * "generated" only — the judge harness is the only path onward, and it
 * grounds against EVERY source recorded in meta.groundingSourceIds (the
 * prompt source + all extra grounding) via collectGroundingChunks, plus the
 * active profile identity (B3.8, appended inside the pipeline itself).
 */
export async function runOrigination(
  ctx: TenantCtx,
  repos: Repos,
  request: OriginationRequest,
  deps: OriginationDeps = {},
): Promise<OriginationResult> {
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

  const platform = request.platform?.trim() || PILLAR_PLATFORM;
  const model = modelTiers().draft;
  const promptVersion = pillarScriptPromptVersion();
  const runParams = groundingRunParams(resolved);

  return runSingleDraftPipeline(ctx, repos, {
    format: "pillar_script",
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
    irrecoverableLabel: "pillar-script generation",
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
      const rawDriver = deps.driver ?? gatewayPillarScriptDriver();

      // Core meters the shell: EVERY attempt (including repair retries) routes
      // through the one gateway choke point — budget asserted before, usage
      // recorded after, span traced (SPINE §1; amendment A2). The shell driver
      // itself stays read-only.
      const guardedDriver: PillarScriptDriver = (req) =>
        withGatewayGuard({
          usage: {
            assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
            recordUsage: (o) => repos.usageLedger.record(ctx, o),
          },
          capTokens,
          model,
          operation: "origination.pillar_script",
          call: async () => {
            const out = await rawDriver(req);
            return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
          },
        });

      return generateValidatedPillarScript(guardedDriver, {
        operatorPrompt,
        voice,
        identityBlock,
        groundingText,
      });
    },
    toDraft: async (output) => {
      const beats = output.beats.map((beat, beatIndex) => ({ ...beat, beatIndex }));
      const meta = pillarScriptDraftMetaSchema.parse({
        title: output.title,
        hook: output.hook,
        beats,
        cta: output.cta ?? null,
        groundingSourceIds: [promptSource.id, ...groundingIds],
        promptVersion,
        brandProfileVersion: profile.version,
        platformProfileVersion: PILLAR_PLATFORM_PROFILE_VERSION,
      });
      // The body is the claim surface the judge reads: title + hook + narration
      // in beat order (+ CTA). The SRT at B3.10 derives from these same lines.
      const body = [
        output.title,
        output.hook,
        ...beats.map((beat) => beat.narration),
        ...(output.cta ? [output.cta] : []),
      ].join("\n\n");
      return { platform, body, meta };
    },
  });
}
