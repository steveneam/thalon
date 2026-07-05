import {
  stagePlanSchema,
  storyboardDraftMetaSchema,
  directionDocDraftMetaSchema,
  resolveDraftFormatSpec,
  tenantCtx,
  type StagePlan,
  type TenantCtx,
} from "@thalon/contracts";
import {
  InvalidStateError,
  IrrecoverableGenerationError,
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type Repos,
} from "@thalon/db";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFakeDirectionPolishDriver,
  createFakeDirectionScenesDriver,
  createFakeStoryboardStageDriver,
  type DirectionScenesDriver,
} from "../../direction/shell/generator";
import {
  advanceVideoStage,
  runVideoStagesOnePrompt,
  startVideoStages,
  type StagedVideoDeps,
} from "../staged-video";

/**
 * B5.2 staged video pipeline (amendment A11), keyless + networkless:
 * - THE STAGE GATE: an unjudged/blocked stage draft cannot advance — in
 *   either mode, structurally (queued/approved are only reachable through
 *   the judge's I1-gated transition).
 * - ONE CODE PATH, TWO MODES: one-prompt replay over an advanced-mode run
 *   returns the SAME drafts with zero shell and zero judge calls.
 * - Count is config: a 2-stage plan runs through the same functions.
 * - A blocked stage HALTS one-prompt mode with nothing generated past it.
 */

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const JUDGE_PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "grounded", supported: true, chunkRef: "c1" }],
};
const JUDGE_FAIL = {
  verdict: "fail" as const,
  claims: [{ claim: "ungrounded", supported: false }],
};

function judgeDriver(candidate: unknown): JudgeModelDriver {
  return async () => ({ candidate, tokensIn: 1, tokensOut: 1 });
}
const passJudge = () => ({
  screenDriver: judgeDriver(JUDGE_PASS),
  finalDriver: judgeDriver(JUDGE_PASS),
  capTokens: 1_000_000,
});

function countCalls<TReq, TOut>(driver: (req: TReq) => Promise<TOut>) {
  const counter = { count: 0 };
  const wrapped = async (req: TReq) => {
    counter.count += 1;
    return driver(req);
  };
  return { driver: wrapped, counter };
}

async function fixture(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  promptSourceId: string;
  docSourceId: string;
  deps: StagedVideoDeps;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const { source: prompt } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("staged brief"),
    chunks: [
      { seq: 0, text: "Introduce what the product does.", tokenCount: 6, contentHash: sha256Hex("staged-brief-0") },
    ],
  });
  const { source: doc } = await repos.sourceChunks.ingest(ctx, {
    kind: "doc",
    contentHash: sha256Hex("staged doc"),
    chunks: [
      { seq: 0, text: "The product saves the operator an hour a day.", tokenCount: 9, contentHash: sha256Hex("staged-doc-0") },
    ],
  });
  return {
    ctx,
    repos,
    promptSourceId: prompt.id,
    docSourceId: doc.id,
    deps: {
      structureDriver: createFakeStoryboardStageDriver(),
      scenesDriver: createFakeDirectionScenesDriver(),
      polishDriver: createFakeDirectionPolishDriver(),
      capTokens: 1_000_000,
    },
  };
}

/** Walks a stage draft through the judge fakes to `queued` via the real pipeline (I1-gated). */
async function judgeToQueued(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
  const { runJudgePipeline } = await import("@thalon/judge");
  const outcome = await runJudgePipeline(repos, {
    ctx,
    draftId: draft.id,
    screenDriver: judgeDriver(JUDGE_PASS),
    finalDriver: judgeDriver(JUDGE_PASS),
    capTokens: 1_000_000,
  });
  expect(outcome.status).toBe("queued");
  return outcome.draft;
}

describe("advanced mode — stage by stage (default 3-stage plan)", () => {
  it("structure → scenes/effects → polish, judged between stages; final stage refuses to advance", async () => {
    const { ctx, repos, promptSourceId, docSourceId, deps } = await fixture();

    const start = await startVideoStages(
      ctx,
      repos,
      { promptSourceId, groundingSourceIds: [docSourceId] },
      deps,
    );
    expect(start.created).toBe(true);
    expect(start.draft.format).toBe("storyboard");
    expect(start.draft.status).toBe("generated");
    expect(start.stage.key).toBe("structure");
    const storyboardMeta = storyboardDraftMetaSchema.parse(start.draft.meta);
    expect(storyboardMeta.stageIndex).toBe(0);
    expect(storyboardMeta.groundingSourceIds).toEqual([promptSourceId, docSourceId]);
    // Registry ratchet: meta parses AND the registered body derivation reproduces drafts.body.
    const spec = resolveDraftFormatSpec("storyboard");
    expect(spec.expectedBody!(storyboardMeta)).toBe(start.draft.body);

    const queuedStoryboard = await judgeToQueued(ctx, repos, start.draft);

    const scenes = await advanceVideoStage(ctx, repos, { draftId: queuedStoryboard.id }, deps);
    expect(scenes.draft.format).toBe("direction_doc");
    expect(scenes.draft.status).toBe("generated");
    expect(scenes.stage.key).toBe("scenes_effects");
    const scenesMeta = directionDocDraftMetaSchema.parse(scenes.draft.meta);
    expect(scenesMeta.priorDraftId).toBe(queuedStoryboard.id);
    expect(scenesMeta.stageIndex).toBe(1);
    // Prefill pinned the deterministic fields; the fake filled every creative slot.
    expect(scenesMeta.doc.aspect).toBe("16:9");
    expect(scenesMeta.doc.fps).toBe(30);
    expect(scenesMeta.doc.scenes.every((s) => s.visual !== null)).toBe(true);
    expect(scenesMeta.doc.scenes[0].motion).toBe("snappy");
    expect(resolveDraftFormatSpec("direction_doc").expectedBody!(scenesMeta)).toBe(
      scenes.draft.body,
    );

    const queuedScenes = await judgeToQueued(ctx, repos, scenes.draft);

    const polish = await advanceVideoStage(ctx, repos, { draftId: queuedScenes.id }, deps);
    expect(polish.stage.key).toBe("polish");
    const polishMeta = directionDocDraftMetaSchema.parse(polish.draft.meta);
    expect(polishMeta.stageIndex).toBe(2);
    expect(polishMeta.priorDraftId).toBe(queuedScenes.id);
    // Identity-polish fake: the document survives byte-identically.
    expect(polishMeta.doc).toEqual(scenesMeta.doc);
    expect(polish.draft.generationKey).not.toBe(scenes.draft.generationKey);

    const queuedPolish = await judgeToQueued(ctx, repos, polish.draft);
    await expect(
      advanceVideoStage(ctx, repos, { draftId: queuedPolish.id }, deps),
    ).rejects.toThrow(/final stage/);
  });

  it("THE STAGE GATE: an unjudged or blocked stage draft cannot advance", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const start = await startVideoStages(ctx, repos, { promptSourceId }, deps);

    await expect(
      advanceVideoStage(ctx, repos, { draftId: start.draft.id }, deps),
    ).rejects.toThrow(InvalidStateError);
    await expect(
      advanceVideoStage(ctx, repos, { draftId: start.draft.id }, deps),
    ).rejects.toThrow(/passes the judge/);

    // Blocked (judge fail) is equally unadvanceable.
    const { runJudgePipeline } = await import("@thalon/judge");
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: start.draft.id,
      screenDriver: judgeDriver(JUDGE_FAIL),
      finalDriver: judgeDriver(JUDGE_FAIL),
      capTokens: 1_000_000,
    });
    expect(outcome.status).toBe("blocked");
    await expect(
      advanceVideoStage(ctx, repos, { draftId: start.draft.id }, deps),
    ).rejects.toThrow(InvalidStateError);
  });

  it("only stage artifacts advance — a pillar_script (or any other format) is refused", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const start = await startVideoStages(ctx, repos, { promptSourceId }, deps);
    await judgeToQueued(ctx, repos, start.draft);
    // Forge a non-stage draft on the same run to try to advance it.
    const rogue = await repos.drafts.create(ctx, {
      fanoutRunId: start.runId,
      sourceId: promptSourceId,
      platform: "video",
      body: "not a stage artifact",
      format: "pillar_script",
      generationKey: `${start.draft.generationKey}:rogue`,
      meta: {},
    });
    await expect(advanceVideoStage(ctx, repos, { draftId: rogue.id }, deps)).rejects.toThrow(
      /only stage artifacts/,
    );
  });
});

describe("one-prompt mode — the SAME stages auto-advanced", () => {
  it("runs the full default plan on prefill defaults, judging every stage", async () => {
    const { ctx, repos, promptSourceId, docSourceId, deps } = await fixture();
    const result = await runVideoStagesOnePrompt(
      ctx,
      repos,
      { promptSourceId, groundingSourceIds: [docSourceId] },
      passJudge(),
      deps,
    );
    expect(result.status).toBe("queued");
    expect(result.stages.map((s) => s.stageKey)).toEqual([
      "structure",
      "scenes_effects",
      "polish",
    ]);
    expect(result.stages.every((s) => s.judge === "queued")).toBe(true);
    expect(result.draft.format).toBe("direction_doc");
    expect(result.draft.status).toBe("queued");
  });

  it("ONE CODE PATH: replay after an advanced-mode run returns the SAME drafts — zero shell, zero judge calls", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();

    // Advanced-mode run first (manual stage-at-a-time).
    const start = await startVideoStages(ctx, repos, { promptSourceId }, deps);
    const queued0 = await judgeToQueued(ctx, repos, start.draft);
    const s1 = await advanceVideoStage(ctx, repos, { draftId: queued0.id }, deps);
    const queued1 = await judgeToQueued(ctx, repos, s1.draft);
    const s2 = await advanceVideoStage(ctx, repos, { draftId: queued1.id }, deps);
    await judgeToQueued(ctx, repos, s2.draft);

    // One-prompt replay with CALL-COUNTED drivers everywhere.
    const structure = countCalls(createFakeStoryboardStageDriver());
    const scenes = countCalls(createFakeDirectionScenesDriver());
    const polish = countCalls(createFakeDirectionPolishDriver());
    const screen = countCalls(judgeDriver(JUDGE_PASS));
    const final = countCalls(judgeDriver(JUDGE_PASS));

    const replay = await runVideoStagesOnePrompt(
      ctx,
      repos,
      { promptSourceId },
      { screenDriver: screen.driver, finalDriver: final.driver, capTokens: 1_000_000 },
      {
        structureDriver: structure.driver,
        scenesDriver: scenes.driver,
        polishDriver: polish.driver,
        capTokens: 1_000_000,
      },
    );

    expect(replay.status).toBe("queued");
    expect(replay.stages.map((s) => s.draft.id)).toEqual([
      start.draft.id,
      s1.draft.id,
      s2.draft.id,
    ]);
    expect(replay.stages.every((s) => s.judge === "already_passed")).toBe(true);
    expect(structure.counter.count).toBe(0);
    expect(scenes.counter.count).toBe(0);
    expect(polish.counter.count).toBe(0);
    expect(screen.counter.count).toBe(0);
    expect(final.counter.count).toBe(0);
  });

  it("a blocked stage HALTS the flow — nothing generates past the failed gate", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const scenes = countCalls(deps.scenesDriver as DirectionScenesDriver);
    const result = await runVideoStagesOnePrompt(
      ctx,
      repos,
      { promptSourceId },
      {
        screenDriver: judgeDriver(JUDGE_PASS),
        finalDriver: judgeDriver(JUDGE_FAIL), // tier disagreement ⇒ blocked (I3)
        capTokens: 1_000_000,
      },
      { ...deps, scenesDriver: scenes.driver },
    );
    expect(result.status).toBe("blocked");
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].stageKey).toBe("structure");
    expect(result.draft.status).toBe("blocked");
    expect(scenes.counter.count).toBe(0);
    // No stage-2 draft exists anywhere for this tenant.
    const all = await repos.drafts.listByRun(ctx, result.stages[0].draft.fanoutRunId);
    expect(all).toHaveLength(1);
  });

  it("COUNT IS CONFIG: a 2-stage plan runs through the same functions", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const twoStage: StagePlan = stagePlanSchema.parse({
      family: "video",
      stages: [
        {
          key: "structure",
          title: "Structure",
          produces: "storyboard",
          promptSlug: "storyboard-stage-structure.v1",
        },
        {
          key: "finish",
          title: "Finish",
          produces: "direction_doc",
          promptSlug: "direction-stage-scenes.v1",
        },
      ],
    });
    const result = await runVideoStagesOnePrompt(
      ctx,
      repos,
      { promptSourceId },
      passJudge(),
      { ...deps, plan: twoStage },
    );
    expect(result.status).toBe("queued");
    expect(result.stages.map((s) => s.stageKey)).toEqual(["structure", "finish"]);
    const meta = directionDocDraftMetaSchema.parse(result.draft.meta);
    expect(meta.stageKey).toBe("finish");
    // Advancing FROM a storyboard is a scenes fill regardless of stage key —
    // the creative slots are filled.
    expect(meta.doc.scenes.every((s) => s.visual !== null)).toBe(true);
  });
});

describe("stage generation failure paths", () => {
  it("an irrecoverable scenes fill records lastError on the run and a later good replay backfills the SAME run", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const start = await startVideoStages(ctx, repos, { promptSourceId }, deps);
    const queued = await judgeToQueued(ctx, repos, start.draft);

    const badScenes: DirectionScenesDriver = async () => ({
      candidate: { scenes: [] }, // schema-invalid every attempt
      tokensIn: 1,
      tokensOut: 1,
    });
    await expect(
      advanceVideoStage(ctx, repos, { draftId: queued.id }, { ...deps, scenesDriver: badScenes }),
    ).rejects.toThrow(IrrecoverableGenerationError);

    const failedRuns = await repos.fanoutRuns.list(ctx);
    const stageRun = failedRuns.find((r) => r.lastError);
    expect(stageRun?.lastError).toMatch(/scenes_effects/);

    const retry = await advanceVideoStage(ctx, repos, { draftId: queued.id }, deps);
    expect(retry.runId).toBe(stageRun!.id);
    expect(retry.created).toBe(false);
    expect(retry.draft.format).toBe("direction_doc");
    const cleared = await repos.fanoutRuns.getByGenerationKey(ctx, stageRun!.generationKey);
    expect(cleared?.lastError).toBeNull();
  });

  it("a duplicate-sceneIndex fill is a malformed candidate — an always-duplicating shell persists nothing", async () => {
    const { ctx, repos, promptSourceId, deps } = await fixture();
    const start = await startVideoStages(ctx, repos, { promptSourceId }, deps);
    const queued = await judgeToQueued(ctx, repos, start.draft);

    const duplicating: DirectionScenesDriver = async (req) => {
      const base = await createFakeDirectionScenesDriver()(req);
      const scenes = (base.candidate as { scenes: { sceneIndex: number }[] }).scenes;
      return { ...base, candidate: { scenes: scenes.map((s) => ({ ...s, sceneIndex: 0 })) } };
    };
    await expect(
      advanceVideoStage(ctx, repos, { draftId: queued.id }, { ...deps, scenesDriver: duplicating }),
    ).rejects.toThrow(IrrecoverableGenerationError);
    const runs = await repos.fanoutRuns.list(ctx);
    const stageRun = runs.find((r) => r.lastError);
    expect(stageRun?.lastError).toMatch(/duplicate sceneIndex/);
    expect(await repos.drafts.listByRun(ctx, stageRun!.id)).toHaveLength(0);
  });
});
