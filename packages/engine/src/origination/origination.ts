import {
  brandIdentitySchema,
  renderBrandIdentity,
  type TenantCtx,
} from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
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
  /** Extra pre-ingested grounding sources the script may draw claims from (site crawl, repo readme, docs). */
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
 * Mirrors ../demo/storyboard.ts's idempotency/backfill semantics (N=1): a
 * repeat call with an identical generation key and the draft already
 * persisted is a zero-shell-call fast path; a repeat call after a prior
 * irrecoverable failure (run row exists, draft never persisted) regenerates
 * the single missing draft, reusing the same run. Every draft lands in
 * status "generated" only — the judge harness is the only path onward, and
 * it grounds against EVERY source recorded in meta.groundingSourceIds (the
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

  const groundingIds = [...new Set(request.groundingSourceIds ?? [])].sort();
  for (const id of groundingIds) {
    const source = await repos.sources.get(ctx, id);
    if (!source) throw new Error(`grounding source "${id}" not found for this tenant`);
  }

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const platform = request.platform?.trim() || PILLAR_PLATFORM;
  const model = modelTiers().draft;
  const promptVersion = pillarScriptPromptVersion();
  const generationKey = sha256Hex(
    stableStringify({
      tenantId: ctx.tenantId,
      promptSourceId: promptSource.id,
      groundingSourceIds: groundingIds,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platform,
      promptVersion,
      model,
    }),
  );

  // Fast-path idempotency check (mirrors storyboard): a repeat call skips
  // generation entirely, before ever reaching the gateway — UNLESS a prior
  // call created the run but never persisted its draft (backfill below).
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
      sourceId: promptSource.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: [platform],
      promptVersion,
      model,
      params: groundingIds.length > 0 ? { groundingSourceIds: groundingIds } : undefined,
      generationKey,
    });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

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

  const result = await generateValidatedPillarScript(guardedDriver, {
    operatorPrompt,
    voice,
    identityBlock,
    groundingText,
  });
  if (!result.output) {
    throw new Error(
      `pillar-script generation was irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
    );
  }

  const beats = result.output.beats.map((beat, beatIndex) => ({ ...beat, beatIndex }));
  const meta = pillarScriptDraftMetaSchema.parse({
    title: result.output.title,
    hook: result.output.hook,
    beats,
    cta: result.output.cta ?? null,
    groundingSourceIds: [promptSource.id, ...groundingIds],
    promptVersion,
    brandProfileVersion: profile.version,
    platformProfileVersion: PILLAR_PLATFORM_PROFILE_VERSION,
  });
  // The body is the claim surface the judge reads: title + hook + narration
  // in beat order (+ CTA). The SRT at B3.10 derives from these same lines.
  const body = [
    result.output.title,
    result.output.hook,
    ...beats.map((beat) => beat.narration),
    ...(result.output.cta ? [result.output.cta] : []),
  ].join("\n\n");

  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: runId,
    sourceId: promptSource.id,
    platform,
    body,
    format: "pillar_script",
    generationKey: sha256Hex(`${runGenerationKey}:pillar_script`),
    meta,
  });

  return { runId, created, draft };
}
