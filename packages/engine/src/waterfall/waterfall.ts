import { platformProfileSchema, type PlatformProfile, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { loadPlatformProfile } from "../fanout/profiles";
import { clipPlanDraftMetaSchema } from "./schemas";
import {
  highlightSelectPromptVersion,
  gatewayHighlightSelectDriver,
  type HighlightSelectDriver,
} from "./shell/generator";
import { generateValidatedHighlightSelect } from "./validate-shell-output";
import {
  deriveCandidateWindows,
  DEFAULT_WINDOW_CONFIG,
  type CandidateWindow,
  type WaterfallChunkInput,
  type WindowConfig,
} from "./windows";

export interface WaterfallRequest {
  sourceId: string;
  platforms: string[];
  /** Overrides the default candidate-window bounds (min/max clip duration, pause-gap threshold). */
  windowConfig?: Partial<WindowConfig>;
}

export interface WaterfallDeps {
  driver?: HighlightSelectDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface WaterfallResult {
  runId: string;
  /**
   * false whenever the run row itself already existed — this includes a
   * BACKFILL replay (see below), not just a fully-complete one (mirrors
   * FanoutResult.created).
   */
  created: boolean;
  /**
   * Always complete for `request.platforms` when this function returns
   * successfully. If a prior call generated some platforms and then threw (a
   * later platform's highlight-select was irrecoverable), the next identical
   * call is a BACKFILL replay: it reuses the existing run and its
   * already-generated platforms' drafts untouched (zero shell calls for
   * them) and generates ONLY the still-missing platforms.
   */
  drafts: Draft[];
}

/**
 * B2.3 entry point: a `video_transcript` source's timed chunks -> deterministic
 * candidate clip windows (core, ./windows.ts) -> highlight-select (shell,
 * ./shell/generator.ts) -> one `clip_plan` draft per selected clip per
 * platform (SPINE §2.3; ADR 0002 §3). Mirrors runFanout's idempotency and
 * backfill semantics exactly, at the same platform granularity: a repeat
 * call with an identical generation key and every platform already generated
 * is a zero-shell-call fast path; a repeat call after a mid-run failure
 * backfills only the platforms still missing, reusing every already-
 * persisted draft untouched. Every draft lands in status "generated" only —
 * the judge harness is the only path onward from here.
 */
export async function runWaterfall(
  ctx: TenantCtx,
  repos: Repos,
  request: WaterfallRequest,
  deps: WaterfallDeps = {},
): Promise<WaterfallResult> {
  if (request.platforms.length === 0) {
    throw new Error("runWaterfall requires at least one platform");
  }

  const source = await repos.sources.get(ctx, request.sourceId);
  if (!source) throw new Error(`source "${request.sourceId}" not found for this tenant`);

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const windowConfig: WindowConfig = { ...DEFAULT_WINDOW_CONFIG, ...request.windowConfig };
  const model = modelTiers().draft;
  const promptVersion = highlightSelectPromptVersion();
  const platforms = [...new Set(request.platforms)].sort();
  const generationKey = sha256Hex(
    stableStringify({
      tenantId: ctx.tenantId,
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms,
      promptVersion,
      model,
      windowConfig,
    }),
  );

  // Fast-path idempotency check (mirrors runFanout): a repeat call skips
  // generation entirely, before ever reaching the gateway — UNLESS a prior
  // call left the run incomplete (see backfill below).
  const existingRun = await repos.fanoutRuns.getByGenerationKey(ctx, generationKey);

  let runId: string;
  let runGenerationKey: string;
  let created: boolean;
  let existingDrafts: Draft[] = [];
  let platformsToGenerate: string[] = platforms;

  if (existingRun) {
    existingDrafts = await repos.drafts.listByRun(ctx, existingRun.id);
    const existingPlatforms = new Set(existingDrafts.map((d) => d.platform));
    platformsToGenerate = platforms.filter((p) => !existingPlatforms.has(p));
    if (platformsToGenerate.length === 0) {
      // Complete — zero shell calls, exactly like runFanout's fast path.
      return { runId: existingRun.id, created: false, drafts: existingDrafts };
    }
    runId = existingRun.id;
    runGenerationKey = existingRun.generationKey;
    created = false;
  } else {
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms,
      promptVersion,
      model,
      params: { windowConfig },
      generationKey,
    });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

  const chunks = await repos.sourceChunks.listBySource(ctx, source.id);
  const sourceText = chunks.map((chunk) => chunk.text).join("\n\n");
  const chunkInputs: WaterfallChunkInput[] = chunks.map((chunk) => ({
    seq: chunk.seq,
    text: chunk.text,
    startMs: chunk.startMs,
    endMs: chunk.endMs,
  }));
  const candidateWindows = deriveCandidateWindows(chunkInputs, windowConfig);
  if (candidateWindows.length === 0) {
    throw new Error(
      `source "${source.id}" produced no candidate clip windows from its timed chunks — nothing to generate (needs timed chunks meeting the configured minimum duration)`,
    );
  }

  const voice = (profile.voice as Record<string, unknown> | null) ?? {};
  const tenantPlatformProfiles =
    (profile.platformProfiles as Record<string, unknown> | null) ?? {};
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayHighlightSelectDriver();

  const generated: Draft[] = [];
  for (const platform of platformsToGenerate) {
    const platformDrafts = await generatePlatformClipPlans(
      { ctx, repos, model, capTokens, rawDriver },
      {
        runId,
        runGenerationKey,
        sourceId: source.id,
        sourceText,
        voice,
        tenantPlatformProfiles,
        brandProfileVersion: profile.version,
        promptVersion,
        candidateWindows,
        platform,
      },
    );
    generated.push(...platformDrafts);
  }

  return { runId, created, drafts: [...existingDrafts, ...generated] };
}

interface GuardCtx {
  ctx: TenantCtx;
  repos: Repos;
  model: string;
  capTokens: number;
  rawDriver: HighlightSelectDriver;
}

interface PlatformClipSpec {
  runId: string;
  runGenerationKey: string;
  sourceId: string;
  sourceText: string;
  voice: Record<string, unknown>;
  tenantPlatformProfiles: Record<string, unknown>;
  brandProfileVersion: number;
  promptVersion: string;
  candidateWindows: CandidateWindow[];
  platform: string;
}

/** One platform's highlight-select call + validation + persistence of every selected clip — shared by the fresh-run loop and the backfill-replay loop above. */
async function generatePlatformClipPlans(
  guard: GuardCtx,
  spec: PlatformClipSpec,
): Promise<Draft[]> {
  const { platformProfile, profileVersion } = resolvePlatformProfile(
    spec.platform,
    spec.tenantPlatformProfiles,
    spec.brandProfileVersion,
  );

  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const guardedDriver: HighlightSelectDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => guard.repos.usageLedger.assertWithinBudget(guard.ctx, o),
        recordUsage: (o) => guard.repos.usageLedger.record(guard.ctx, o),
      },
      capTokens: guard.capTokens,
      model: guard.model,
      operation: "waterfall.highlight_select",
      call: async () => {
        const out = await guard.rawDriver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

  const result = await generateValidatedHighlightSelect(guardedDriver, {
    platform: spec.platform,
    sourceText: spec.sourceText,
    voice: spec.voice,
    platformProfile,
    candidateWindows: spec.candidateWindows,
  });
  if (!result.output) {
    throw new Error(
      `highlight-select for platform "${spec.platform}" was irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
    );
  }

  const drafts: Draft[] = [];
  for (const clip of result.output.clips) {
    const window = spec.candidateWindows[clip.windowIndex];
    const meta = clipPlanDraftMetaSchema.parse({
      startMs: window.startMs,
      endMs: window.endMs,
      durationMs: window.durationMs,
      windowIndex: clip.windowIndex,
      chunkSeqs: window.chunkSeqs,
      hook: clip.hook,
      captions: clip.captions,
      platformCopy: clip.platformCopy,
      promptVersion: spec.promptVersion,
      brandProfileVersion: spec.brandProfileVersion,
      platformProfileVersion: profileVersion,
    });
    const body = [clip.hook, clip.captions, clip.platformCopy].join("\n\n");
    const draft = await guard.repos.drafts.create(guard.ctx, {
      fanoutRunId: spec.runId,
      sourceId: spec.sourceId,
      platform: spec.platform,
      body,
      format: "clip_plan",
      generationKey: sha256Hex(
        `${spec.runGenerationKey}:${spec.platform}:${window.startMs}-${window.endMs}`,
      ),
      meta,
    });
    drafts.push(draft);
  }
  return drafts;
}

/**
 * A tenant's own `brand_profiles.platformProfiles[platform]` (DB, versioned
 * runtime config) always wins when present — proving config-not-code. The
 * shipped `proprietary/profiles/<platform>.v<N>.json` file is only the
 * generic fallback. Mirrors ../fanout/fanout.ts's resolvePlatformProfile.
 */
function resolvePlatformProfile(
  platform: string,
  tenantPlatformProfiles: Record<string, unknown>,
  brandProfileVersion: number,
): { platformProfile: PlatformProfile; profileVersion: string } {
  const tenantRaw = tenantPlatformProfiles[platform];
  if (tenantRaw !== undefined) {
    return {
      platformProfile: platformProfileSchema.parse(tenantRaw),
      profileVersion: `brand-profile.v${brandProfileVersion}`,
    };
  }
  const shipped = loadPlatformProfile(platform);
  if (!shipped) {
    throw new Error(
      `no platform profile configured for "${platform}" — set one on the tenant's brand_profiles.platformProfiles, or ship a proprietary/profiles/${platform}.v1.json default`,
    );
  }
  return { platformProfile: shipped.profile, profileVersion: shipped.profileVersion };
}
