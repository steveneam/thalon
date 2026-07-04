import { platformProfileSchema, type PlatformProfile, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { loadPlatformProfile } from "./profiles";
import {
  fanoutPromptVersion,
  gatewayDraftGenerator,
  type DraftGeneratorDriver,
} from "./shell/generator";
import { generateValidatedDraft } from "./validate-shell-output";

export interface FanoutRequest {
  sourceId: string;
  platforms: string[];
}

export interface FanoutDeps {
  driver?: DraftGeneratorDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface FanoutResult {
  runId: string;
  /**
   * false whenever the `fanout_runs` row itself already existed — this
   * includes a BACKFILL replay (see below), not just a fully-complete one.
   * true only when this call inserted a brand-new run row.
   */
  created: boolean;
  /**
   * Always complete for `request.platforms` when this function returns
   * successfully. If a prior call generated some platforms and then threw
   * (a later platform's generation was irrecoverable), the next identical
   * call is a BACKFILL replay: it reuses the existing run and its
   * already-generated drafts untouched (zero generation calls for them) and
   * generates ONLY the still-missing platforms — never a silent partial
   * result, and the missing platform is never permanently stuck behind a
   * generation key that can only ever fast-path-return fewer drafts than
   * requested.
   */
  drafts: Draft[];
}

/**
 * B1.2 entry point: one source -> N platform-native drafts from tenant #0's
 * runtime config (SPINE §2.2, §2.3 workflow 1). Idempotent on the run's
 * generation key — re-running an identical fan-out returns the original N
 * drafts untouched, without a single generation call, when they're all
 * already there (mirrors B1.1's ingestSource fast path). When they're not
 * all there (a previous call generated some platforms and then failed on
 * another), a replay backfills exactly the missing ones instead of
 * returning a silently incomplete set. Every draft lands in status
 * "generated" only — the judge harness (B1.3) is the only path onward from
 * here.
 */
export async function runFanout(
  ctx: TenantCtx,
  repos: Repos,
  request: FanoutRequest,
  deps: FanoutDeps = {},
): Promise<FanoutResult> {
  if (request.platforms.length === 0) {
    throw new Error("runFanout requires at least one platform");
  }

  const source = await repos.sources.get(ctx, request.sourceId);
  if (!source) throw new Error(`source "${request.sourceId}" not found for this tenant`);

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const model = modelTiers().draft;
  const promptVersion = fanoutPromptVersion();
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
    }),
  );

  // Fast-path idempotency check (mirrors B1.1's ingestSource ->
  // sources.getByContentHash): a repeat fan-out skips generation entirely,
  // before ever reaching the gateway — UNLESS a prior call left the run
  // incomplete (see backfill below).
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
      // Complete — zero generation calls, exactly like B1.1's fast path.
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
      generationKey,
    });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

  const chunks = await repos.sourceChunks.listBySource(ctx, source.id);
  const sourceText = chunks.map((chunk) => chunk.text).join("\n\n");
  const voice = (profile.voice as Record<string, unknown> | null) ?? {};
  const tenantPlatformProfiles =
    (profile.platformProfiles as Record<string, unknown> | null) ?? {};
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayDraftGenerator();

  const generated: Draft[] = [];
  for (const platform of platformsToGenerate) {
    const draft = await generatePlatformDraft(
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
        platform,
      },
    );
    generated.push(draft);
  }

  return { runId, created, drafts: [...existingDrafts, ...generated] };
}

interface GuardCtx {
  ctx: TenantCtx;
  repos: Repos;
  model: string;
  capTokens: number;
  rawDriver: DraftGeneratorDriver;
}

interface DraftSpec {
  runId: string;
  runGenerationKey: string;
  sourceId: string;
  sourceText: string;
  voice: Record<string, unknown>;
  tenantPlatformProfiles: Record<string, unknown>;
  brandProfileVersion: number;
  promptVersion: string;
  platform: string;
}

/** One platform's generation + validation + persistence — shared by the fresh-run loop and the backfill-replay loop above. */
async function generatePlatformDraft(guard: GuardCtx, spec: DraftSpec): Promise<Draft> {
  const { platformProfile, profileVersion } = resolvePlatformProfile(
    spec.platform,
    spec.tenantPlatformProfiles,
    spec.brandProfileVersion,
  );

  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const guardedDriver: DraftGeneratorDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => guard.repos.usageLedger.assertWithinBudget(guard.ctx, o),
        recordUsage: (o) => guard.repos.usageLedger.record(guard.ctx, o),
      },
      capTokens: guard.capTokens,
      model: guard.model,
      operation: "fanout.generate",
      call: async () => {
        const out = await guard.rawDriver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

  const result = await generateValidatedDraft(guardedDriver, {
    platform: spec.platform,
    sourceText: spec.sourceText,
    voice: spec.voice,
    platformProfile,
  });
  if (!result.output) {
    throw new Error(
      `fan-out generation for platform "${spec.platform}" was irrecoverable after ${result.attempts} attempt(s): malformed shell output`,
    );
  }

  return guard.repos.drafts.create(guard.ctx, {
    fanoutRunId: spec.runId,
    sourceId: spec.sourceId,
    platform: spec.platform,
    body: result.output.body,
    format: result.output.format,
    generationKey: sha256Hex(`${spec.runGenerationKey}:${spec.platform}`),
    meta: {
      promptVersion: spec.promptVersion,
      brandProfileVersion: spec.brandProfileVersion,
      platformProfileVersion: profileVersion,
    },
  });
}

/**
 * A tenant's own `brand_profiles.platformProfiles[platform]` (DB, versioned
 * runtime config) always wins when present — proving config-not-code. The
 * shipped `proprietary/profiles/<platform>.v<N>.json` file is only the
 * generic fallback (the self/demo tenant leans on it; a real tenant never
 * needs it).
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
