import {
  brandIdentitySchema,
  platformProfileSchema,
  renderBrandIdentity,
  type PlatformProfile,
  type TenantCtx,
} from "@thalon/contracts";
import {
  IrrecoverableGenerationError,
  sha256Hex,
  stableStringify,
  type Draft,
  type Repos,
} from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard, type ObjectStore } from "@thalon/platform";
import { retrieveExemplarContext, runExemplarOverlapGate, type ExemplarContext } from "../exemplar";
import type { EmbeddingDriver } from "../ingest";
import { loadPlatformProfile } from "./profiles";
import { resolveRoutedPlatforms } from "./routing";
import {
  exemplarPromptVersion,
  fanoutPromptVersion,
  gatewayDraftGenerator,
  identityPromptVersion,
  type DraftGeneratorDriver,
} from "./shell/generator";
import { generateValidatedDraft } from "./validate-shell-output";

export interface FanoutRequest {
  sourceId: string;
  /**
   * The default platform set — and, when `bucket` is set and the active
   * profile's routing table routes it, the fallback for an unrouted bucket.
   */
  platforms: string[];
  /**
   * B7.e: the content bucket this fan-out belongs to (tenant vocabulary —
   * topics, pillars). When the active profile carries a routing entry for
   * it, that entry REPLACES `platforms`; an unrouted bucket (or no routing
   * config) keeps `platforms`, and the whole request stays byte-identical
   * to pre-B7.e. Provenance only beyond platform selection: the bucket is
   * recorded on the run's params, never folded into the generation key —
   * the effective platform list already fully captures its effect, so an
   * explicit-platforms run and a routed run producing the same list are
   * the SAME run (idempotency by outputs, not by request shape).
   */
  bucket?: string;
  /**
   * B2.4: opt-in exemplar/voice-sample-aware generation. Absent (the
   * default) means this fan-out is byte-identical to a pre-B2.4 run — no
   * retrieval, no prompt addition, no overlap gate. `k` overrides the
   * default top-k retrieved into context.
   */
  exemplar?: { k?: number };
}

export interface FanoutDeps {
  driver?: DraftGeneratorDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
  /** B2.4: overrides the embedding driver used to embed the exemplar retrieval query (tests only — keeps exemplar-aware fan-out tests keyless/networkless too). */
  exemplarEmbedder?: EmbeddingDriver;
  /** B2.4: overrides the object store backing the exemplar query-embedding cache (tests only). */
  exemplarObjectStore?: ObjectStore;
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
  // B7.e: the routing table (per-tenant config data) may replace the
  // caller's platform list for this bucket — resolved before the generation
  // key so idempotency operates on the EFFECTIVE platforms.
  const routing = resolveRoutedPlatforms(profile.routing, request.bucket, request.platforms);
  const platforms = [...new Set(routing.platforms)].sort();
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;

  // B2.4: exemplar retrieval runs BEFORE the generation key is computed —
  // exemplar ids fold into the key below so an exemplar-aware run can never
  // fast-path-collide with a plain run sharing every other input. Absent
  // request.exemplar this block never runs: zero extra reads, zero extra
  // gateway calls — byte-identical to the pre-B2.4 fan-out.
  let precomputedSourceText: string | undefined;
  let exemplarContext: ExemplarContext | undefined;
  if (request.exemplar) {
    const queryChunks = await repos.sourceChunks.listBySource(ctx, source.id);
    precomputedSourceText = queryChunks.map((chunk) => chunk.text).join("\n\n");
    exemplarContext = await retrieveExemplarContext(
      ctx,
      repos,
      { queryText: precomputedSourceText, k: request.exemplar.k, capTokens },
      { embedder: deps.exemplarEmbedder, objectStore: deps.exemplarObjectStore },
    );
  }

  const generationKey = sha256Hex(
    stableStringify({
      tenantId: ctx.tenantId,
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms,
      promptVersion,
      model,
      exemplar: exemplarContext
        ? {
            promptVersion: exemplarPromptVersion(),
            ids: [...exemplarContext.exemplarIds].map((e) => `${e.sourceId}:${e.chunkId}`).sort(),
          }
        : undefined,
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
    const runParams = {
      ...(exemplarContext ? { exemplarIds: exemplarContext.exemplarIds } : {}),
      // B7.e provenance: which bucket asked for this run and whether the
      // routing table actually decided the platform list.
      ...(request.bucket ? { bucket: request.bucket, routed: routing.routed } : {}),
    };
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms,
      promptVersion,
      model,
      generationKey,
      params: Object.keys(runParams).length > 0 ? runParams : undefined,
    });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

  const chunks = await repos.sourceChunks.listBySource(ctx, source.id);
  const sourceText = precomputedSourceText ?? chunks.map((chunk) => chunk.text).join("\n\n");
  const voice = (profile.voice as Record<string, unknown> | null) ?? {};
  const tenantPlatformProfiles =
    (profile.platformProfiles as Record<string, unknown> | null) ?? {};
  // B3.8: the profile's identity rides along automatically — the operator
  // never re-supplies company context per run. Rendered once here with the
  // SAME contracts function the judge grounds against; empty identity ⇒
  // undefined ⇒ the prompt stays byte-identical to pre-B3.8. No generation-key
  // input: identity lives inside the profile, so brandProfileVersion (already
  // in the key) fully determines it.
  const identityBlock =
    renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {})) || undefined;
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
        identityBlock,
        brandProfileVersion: profile.version,
        promptVersion,
        platform,
        exemplarContext,
      },
    );
    generated.push(draft);
  }

  // B4.5: a completed backfill clears the stale failure record (only the
  // backfill path can carry one — a freshly created run never had it).
  if (existingRun?.lastError) {
    await repos.fanoutRuns.recordLastError(ctx, runId, null);
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
  /** B3.8: rendered identity block from the active profile — absent when the profile has no identity content. */
  identityBlock?: string;
  brandProfileVersion: number;
  promptVersion: string;
  platform: string;
  /** B2.4: present only for an exemplar-aware run — threaded into the prompt, recorded as draft provenance, and checked by the overlap gate immediately after generation. */
  exemplarContext?: ExemplarContext;
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
    exemplarContext: spec.exemplarContext?.contextBlock,
    identityBlock: spec.identityBlock,
  });
  if (!result.output) {
    const error = new IrrecoverableGenerationError(
      `fan-out generation for platform "${spec.platform}" was irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
      result.attempts,
      result.lastError,
    );
    // B4.5: the run row keeps the failure for operator triage — recorded
    // BEFORE the throw so a caller that crashes still leaves the trail.
    await guard.repos.fanoutRuns.recordLastError(guard.ctx, spec.runId, error.message);
    throw error;
  }

  const draft = await guard.repos.drafts.create(guard.ctx, {
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
      ...(spec.identityBlock ? { identityPromptVersion: identityPromptVersion() } : {}),
      ...(spec.exemplarContext ? { exemplarIds: spec.exemplarContext.exemplarIds } : {}),
    },
  });

  // B2.4 invariant (ADR 0002 decision 4): exemplars are grounding-only,
  // never republished. Runs immediately post-generation, only for
  // exemplar-aware drafts; a breach drives the draft to `blocked` through
  // the ONE transition function before it can ever reach the judge harness
  // or the queue.
  if (spec.exemplarContext) {
    await runExemplarOverlapGate(guard.repos, {
      ctx: guard.ctx,
      draftId: draft.id,
      exemplarChunks: spec.exemplarContext.chunks,
    });
  }

  return draft;
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
