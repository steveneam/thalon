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
  /** false = idempotent replay: the run already existed, no generation ran (SPINE §1: run it twice, get one result). */
  created: boolean;
  drafts: Draft[];
}

/**
 * B1.2 entry point: one source -> N platform-native drafts from tenant #0's
 * runtime config (SPINE §2.2, §2.3 workflow 1). Idempotent on the run's
 * generation key — re-running an identical fan-out returns the original N
 * drafts untouched, without a single generation call (mirrors B1.1's
 * ingestSource fast path). Every draft lands in status "generated" only —
 * the judge harness (B1.3) is the only path onward from here.
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
  // before ever reaching the gateway.
  const existingRun = await repos.fanoutRuns.getByGenerationKey(ctx, generationKey);
  if (existingRun) {
    const drafts = await repos.drafts.listByRun(ctx, existingRun.id);
    return { runId: existingRun.id, created: false, drafts };
  }

  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms,
    promptVersion,
    model,
    generationKey,
  });

  const chunks = await repos.sourceChunks.listBySource(ctx, source.id);
  const sourceText = chunks.map((chunk) => chunk.text).join("\n\n");
  const voice = (profile.voice as Record<string, unknown> | null) ?? {};
  const tenantPlatformProfiles =
    (profile.platformProfiles as Record<string, unknown> | null) ?? {};
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayDraftGenerator();

  const drafts: Draft[] = [];
  for (const platform of platforms) {
    const { platformProfile, profileVersion } = resolvePlatformProfile(
      platform,
      tenantPlatformProfiles,
      profile.version,
    );

    // Core meters the shell: EVERY attempt (including repair retries) routes
    // through the one gateway choke point — budget asserted before, usage
    // recorded after, span traced (SPINE §1; amendment A2). The shell
    // driver itself stays read-only.
    const guardedDriver: DraftGeneratorDriver = (req) =>
      withGatewayGuard({
        usage: {
          assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
          recordUsage: (o) => repos.usageLedger.record(ctx, o),
        },
        capTokens,
        model,
        operation: "fanout.generate",
        call: async () => {
          const out = await rawDriver(req);
          return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
        },
      });

    const result = await generateValidatedDraft(guardedDriver, {
      platform,
      sourceText,
      voice,
      platformProfile,
    });
    if (!result.output) {
      throw new Error(
        `fan-out generation for platform "${platform}" was irrecoverable after ${result.attempts} attempt(s): malformed shell output`,
      );
    }

    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform,
      body: result.output.body,
      format: result.output.format,
      generationKey: sha256Hex(`${run.generationKey}:${platform}`),
      meta: {
        promptVersion,
        brandProfileVersion: profile.version,
        platformProfileVersion: profileVersion,
      },
    });
    drafts.push(draft);
  }

  return { runId: run.id, created: true, drafts };
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
