import {
  brandIdentitySchema,
  directionDocDraftMetaSchema,
  platformProfileSchema,
  renderBrandIdentity,
  renderDirectionMd,
  resolveStagePlan,
  storyboardDraftMetaSchema,
  type StageDef,
  type StagePlan,
  type TenantCtx,
} from "@thalon/contracts";
import {
  InvalidStateError,
  sha256Hex,
  stableStringify,
  type Draft,
  type Repos,
} from "@thalon/db";
import { runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { modelTiers, readEnv, withGatewayGuard, type UsageGuard } from "@thalon/platform";
import { prefillDirectionDoc } from "../direction/prefill";
import { applyPolishStage, applyScenesStage } from "../direction/merge";
import {
  gatewayDirectionPolishDriver,
  gatewayDirectionScenesDriver,
  gatewayStoryboardStageDriver,
  type DirectionPolishDriver,
  type DirectionScenesDriver,
  type StoryboardStageDriver,
} from "../direction/shell/generator";
import {
  generateValidatedPolishStage,
  generateValidatedScenesStage,
  generateValidatedStoryboardStage,
} from "../direction/validate-shell-output";
import { groundingRunParams, resolveGroundingSet } from "./grounding-set";
import { runSingleDraftPipeline } from "./single-draft";

/**
 * THE staged video pipeline (B5.2, amendment A11): the stage plan
 * (@thalon/contracts stage-registry — count is config, default 3) run as a
 * chain of judged drafts. ONE CODE PATH, TWO MODES:
 *
 *   advanced  — the B5.4 UI calls `startVideoStages` / `advanceVideoStage`
 *               one stage at a time; the operator reviews/tweaks each stage
 *               artifact (edits re-judge via the existing queue paths)
 *               before advancing.
 *   one-prompt — `runVideoStagesOnePrompt` auto-advances the SAME functions
 *               on prefill defaults, judging between stages.
 *
 * THE STAGE GATE IS STRUCTURAL: `advanceVideoStage` refuses unless the
 * prior stage's draft is `queued`/`approved` — states only reachable
 * through the judge pipeline's I1-gated transition. An unjudged (or
 * blocked) stage artifact cannot advance, in either mode, by construction.
 *
 * Driver selection is by the PRIOR draft's format, not stage position —
 * what keeps the code path plan-shape-agnostic: advancing FROM a
 * storyboard is a scenes/effects fill; advancing FROM a direction_doc is a
 * polish refinement. Export (direction doc → timeline/SRT/render manifest)
 * is deterministic core (../direction/export.ts), never a stage.
 *
 * Idempotency/backfill live in the shared single-draft spine per stage;
 * every stage draft lands in status "generated" only — the judge harness
 * is the only path onward. `pillar_script` (B3.9 one-shot origination) is
 * untouched: staging lands AROUND it as new formats (A11).
 */

/** Mirrors PILLAR_PLATFORM: fills the NOT NULL platform column and names the platformProfiles config key prefill reads. Overridable per request — data, not code. */
const STAGED_VIDEO_PLATFORM = "video";
/** Provenance filler (mirrors pillar.v1/demo.v1): no per-platform social profile applies to a stage artifact. */
const STAGED_PLATFORM_PROFILE_VERSION = "staged-video.v1";

export interface StartVideoStagesRequest {
  /** `sources.id` of the ingested operator prompt (kind "prompt") — the brief. */
  promptSourceId: string;
  /** Extra pre-ingested grounding sources (site crawl, repo readme, docs). Prompt-kind ids (a prior brief carried forward on re-brief) are REPLACED by the current brief, never appended — the 491089d0 ratchet (./grounding-set.ts). */
  groundingSourceIds?: string[];
  /** Overrides the draft platform label AND the platformProfiles key prefill reads (default "video"). */
  platform?: string;
  /** Stage-plan family (default "video"). */
  family?: string;
}

export interface StagedVideoDeps {
  /** Overrides the registered stage plan — the "count is config" seam (tests, future per-tenant plans). */
  plan?: StagePlan;
  structureDriver?: StoryboardStageDriver;
  scenesDriver?: DirectionScenesDriver;
  polishDriver?: DirectionPolishDriver;
  /** Overrides the tenant daily token budget cap (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface StageResult {
  runId: string;
  /** false whenever the stage's run row already existed (idempotent replay). */
  created: boolean;
  draft: Draft;
  stage: StageDef;
  plan: StagePlan;
}

/** Statuses a stage draft may hold for the NEXT stage to generate — reachable only through the judge's I1-gated transitions. */
const ADVANCE_READY: readonly string[] = ["queued", "approved"];

export async function startVideoStages(
  ctx: TenantCtx,
  repos: Repos,
  request: StartVideoStagesRequest,
  deps: StagedVideoDeps = {},
): Promise<StageResult> {
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
  // Later stages carry this stage-0 set forward verbatim, so the whole chain
  // inherits the replacement.
  const resolved = await resolveGroundingSet(ctx, repos, request.groundingSourceIds);
  const groundingIds = resolved.groundingIds;
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const plan = deps.plan ?? resolveStagePlan(request.family?.trim() || "video");
  const stage = plan.stages[0];
  const platform = request.platform?.trim() || STAGED_VIDEO_PLATFORM;
  const model = modelTiers().draft;
  const promptVersion = stage.promptSlug;

  return {
    ...(await runSingleDraftPipeline(ctx, repos, {
      format: stage.produces,
      keyMaterial: {
        tenantId: ctx.tenantId,
        family: plan.family,
        stageKey: stage.key,
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
        params: {
          family: plan.family,
          stageKey: stage.key,
          ...groundingRunParams(resolved),
        },
      },
      irrecoverableLabel: `staged-video "${stage.key}" generation`,
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
        const identityBlock =
          renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {})) || undefined;
        const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
        const rawDriver = deps.structureDriver ?? gatewayStoryboardStageDriver(stage.promptSlug);
        const guardedDriver: StoryboardStageDriver = (req) =>
          withGatewayGuard({
            usage: {
              assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
              recordUsage: (o) => repos.usageLedger.record(ctx, o),
            },
            capTokens,
            model,
            operation: "staged_video.structure",
            call: async () => {
              const out = await rawDriver(req);
              return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
            },
          });
        return generateValidatedStoryboardStage(guardedDriver, {
          operatorPrompt,
          voice,
          identityBlock,
          groundingText,
        });
      },
      toDraft: async (output) => {
        const scenes = output.scenes.map((scene, sceneIndex) => ({ ...scene, sceneIndex }));
        const meta = storyboardDraftMetaSchema.parse({
          title: output.title,
          scenes,
          cta: output.cta ?? null,
          family: plan.family,
          stageKey: stage.key,
          stageIndex: 0,
          groundingSourceIds: [promptSource.id, ...groundingIds],
          promptVersion,
          brandProfileVersion: profile.version,
          platformProfileVersion: STAGED_PLATFORM_PROFILE_VERSION,
        });
        const body = [
          output.title,
          ...scenes.map((scene) => scene.narration),
          ...(output.cta ? [output.cta] : []),
        ].join("\n\n");
        return { platform, body, meta };
      },
    })),
    stage,
    plan,
  };
}

export interface AdvanceVideoStageRequest {
  /** The CURRENT stage's draft (storyboard or direction_doc) — must be judge-passed (queued/approved). */
  draftId: string;
}

export async function advanceVideoStage(
  ctx: TenantCtx,
  repos: Repos,
  request: AdvanceVideoStageRequest,
  deps: StagedVideoDeps = {},
): Promise<StageResult> {
  const prior = await repos.drafts.get(ctx, request.draftId);
  if (prior.format !== "storyboard" && prior.format !== "direction_doc") {
    throw new InvalidStateError(
      `draft "${prior.id}" is format "${prior.format}" — only stage artifacts (storyboard/direction_doc) advance`,
    );
  }

  const parsedPrior =
    prior.format === "storyboard"
      ? ({ kind: "storyboard", meta: storyboardDraftMetaSchema.parse(prior.meta) } as const)
      : ({ kind: "direction_doc", meta: directionDocDraftMetaSchema.parse(prior.meta) } as const);
  const priorMeta = parsedPrior.meta;
  const plan = deps.plan ?? resolveStagePlan(priorMeta.family);
  const priorStage = plan.stages[priorMeta.stageIndex];
  if (!priorStage || priorStage.key !== priorMeta.stageKey) {
    throw new InvalidStateError(
      `draft "${prior.id}" was produced by stage "${priorMeta.stageKey}" (index ${priorMeta.stageIndex}), which does not match the ${plan.family} plan — the plan changed under a live run; restart the flow or supply the original plan`,
    );
  }
  const stage = plan.stages[priorMeta.stageIndex + 1];
  if (!stage) {
    throw new InvalidStateError(
      `draft "${prior.id}" is the final stage ("${priorMeta.stageKey}") — there is nothing to advance to; export is deterministic core (direction/export.ts), never a stage`,
    );
  }
  // THE STAGE GATE: queued/approved are reachable only through the judge
  // pipeline's I1-gated transition, so this check IS "judged before it
  // advances" — structurally, in both modes.
  if (!ADVANCE_READY.includes(prior.status)) {
    throw new InvalidStateError(
      `stage "${priorMeta.stageKey}" draft "${prior.id}" is status "${prior.status}" — a stage advances only after its draft passes the judge (queued/approved)`,
    );
  }

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const model = modelTiers().draft;
  const promptVersion = stage.promptSlug;
  const groundingSourceIds = priorMeta.groundingSourceIds;

  return {
    ...(await runSingleDraftPipeline(ctx, repos, {
      format: stage.produces,
      keyMaterial: {
        tenantId: ctx.tenantId,
        family: plan.family,
        stageKey: stage.key,
        priorDraftId: prior.id,
        priorContentHash: sha256Hex(stableStringify({ body: prior.body, meta: prior.meta })),
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: prior.platform,
        promptVersion,
        model,
      },
      run: {
        sourceId: prior.sourceId,
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platforms: [prior.platform],
        promptVersion,
        model,
        params: { family: plan.family, stageKey: stage.key, priorDraftId: prior.id },
      },
      irrecoverableLabel: `staged-video "${stage.key}" generation`,
      generate: async () => {
        const voice = (profile.voice as Record<string, unknown> | null) ?? {};
        const identityBlock =
          renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {})) || undefined;
        const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
        const usage: UsageGuard = {
          assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
          recordUsage: (o) => repos.usageLedger.record(ctx, o),
        };

        if (parsedPrior.kind === "storyboard") {
          // Scenes/effects fill: deterministic core prefills the document
          // (config-or-default + derived durations), the shell fills ONLY
          // the creative slots, core merges around the pinned fields.
          const storyboard = parsedPrior.meta;
          const platformProfiles =
            (profile.platformProfiles as Record<string, unknown> | null) ?? {};
          const rawPlatformProfile = platformProfiles[prior.platform];
          const prefill = prefillDirectionDoc(storyboard, {
            platformProfile:
              rawPlatformProfile === undefined
                ? undefined
                : platformProfileSchema.parse(rawPlatformProfile),
          });
          const visualHints = storyboard.scenes.flatMap((scene) =>
            scene.visualHint ? [{ sceneIndex: scene.sceneIndex, hint: scene.visualHint }] : [],
          );
          const rawDriver = deps.scenesDriver ?? gatewayDirectionScenesDriver(stage.promptSlug);
          const guardedDriver: DirectionScenesDriver = (req) =>
            withGatewayGuard({
              usage,
              capTokens,
              model,
              operation: "staged_video.scenes",
              call: async () => {
                const out = await rawDriver(req);
                return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
              },
            });
          const result = await generateValidatedScenesStage(
            guardedDriver,
            { prefilledMd: renderDirectionMd(prefill), visualHints, voice, identityBlock },
            prefill,
          );
          return {
            output: result.output ? applyScenesStage(prefill, result.output) : null,
            attempts: result.attempts,
            lastError: result.lastError,
          };
        }

        // Polish refinement: the shell proposes the full creative surface;
        // core rebuilds around the pinned aspect/fps/pacing + scene set.
        const current = parsedPrior.meta.doc;
        const groundingParts: string[] = [];
        for (const id of groundingSourceIds) {
          const chunks = await repos.sourceChunks.listBySource(ctx, id);
          groundingParts.push(chunks.map((chunk) => chunk.text).join("\n\n"));
        }
        const groundingText = groundingParts.filter(Boolean).join("\n\n---\n\n");
        const rawDriver = deps.polishDriver ?? gatewayDirectionPolishDriver(stage.promptSlug);
        const guardedDriver: DirectionPolishDriver = (req) =>
          withGatewayGuard({
            usage,
            capTokens,
            model,
            operation: "staged_video.polish",
            call: async () => {
              const out = await rawDriver(req);
              return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
            },
          });
        const result = await generateValidatedPolishStage(
          guardedDriver,
          { currentMd: renderDirectionMd(current), voice, identityBlock, groundingText },
          current,
        );
        return {
          output: result.output ? applyPolishStage(current, result.output) : null,
          attempts: result.attempts,
          lastError: result.lastError,
        };
      },
      toDraft: async (doc) => {
        const meta = directionDocDraftMetaSchema.parse({
          doc,
          family: plan.family,
          stageKey: stage.key,
          stageIndex: priorMeta.stageIndex + 1,
          priorDraftId: prior.id,
          groundingSourceIds,
          promptVersion,
          brandProfileVersion: profile.version,
          platformProfileVersion: STAGED_PLATFORM_PROFILE_VERSION,
        });
        const body = [
          doc.title,
          ...doc.scenes.map((scene) => scene.narration),
          ...(doc.cta ? [doc.cta] : []),
        ].join("\n\n");
        return { platform: prior.platform, body, meta };
      },
    })),
    stage,
    plan,
  };
}

export interface OnePromptJudgeDeps {
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap for judge runs (tests only). */
  capTokens?: number;
}

export interface StagedVideoStageOutcome {
  stageKey: string;
  draft: Draft;
  /** "already_passed": an idempotent replay found the stage already judge-passed — zero judge calls. */
  judge: "queued" | "blocked" | "already_passed";
}

export interface OnePromptResult {
  status: "queued" | "blocked";
  stages: StagedVideoStageOutcome[];
  /** The final stage's draft when every stage passed; the blocked stage's draft otherwise. */
  draft: Draft;
}

/**
 * ONE-PROMPT MODE = the same stages auto-advanced on prefill defaults: this
 * loop calls exactly `startVideoStages`/`advanceVideoStage` (one code path,
 * two modes) with the judge run inline between stages. A blocked stage
 * HALTS the flow with the blocked draft in the operator's triage queue —
 * one-prompt mode never advances past a failed gate, by the same
 * structural check advanced mode hits.
 */
export async function runVideoStagesOnePrompt(
  ctx: TenantCtx,
  repos: Repos,
  request: StartVideoStagesRequest,
  judge: OnePromptJudgeDeps,
  deps: StagedVideoDeps = {},
): Promise<OnePromptResult> {
  const stages: StagedVideoStageOutcome[] = [];

  const judgeStage = async (stageKey: string, draft: Draft): Promise<StagedVideoStageOutcome> => {
    if (ADVANCE_READY.includes(draft.status)) {
      // Idempotent replay: the stage already passed — never re-spend judge calls.
      return { stageKey, draft, judge: "already_passed" };
    }
    if (!["generated", "judging", "blocked"].includes(draft.status)) {
      throw new InvalidStateError(
        `stage "${stageKey}" draft "${draft.id}" is status "${draft.status}" — one-prompt mode cannot judge it (operator action required)`,
      );
    }
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: draft.id,
      screenDriver: judge.screenDriver,
      finalDriver: judge.finalDriver,
      capTokens: judge.capTokens,
    });
    return { stageKey, draft: outcome.draft, judge: outcome.status };
  };

  const start = await startVideoStages(ctx, repos, request, deps);
  const plan = start.plan;
  let outcome = await judgeStage(start.stage.key, start.draft);
  stages.push(outcome);
  if (outcome.judge === "blocked") return { status: "blocked", stages, draft: outcome.draft };

  let current = outcome.draft;
  for (let i = 1; i < plan.stages.length; i++) {
    const advanced = await advanceVideoStage(ctx, repos, { draftId: current.id }, deps);
    outcome = await judgeStage(advanced.stage.key, advanced.draft);
    stages.push(outcome);
    if (outcome.judge === "blocked") return { status: "blocked", stages, draft: outcome.draft };
    current = outcome.draft;
  }

  return { status: "queued", stages, draft: current };
}
