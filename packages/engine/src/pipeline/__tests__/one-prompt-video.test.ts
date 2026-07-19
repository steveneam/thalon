import {
  ASPECT_DIMENSIONS,
  directionDocDraftMetaSchema,
  edlSchema,
  tenantCtx,
  type TenantCtx,
} from "@thalon/contracts";
import {
  InvalidStateError,
  IrrecoverableGenerationError,
  openTestDb,
  type DbHandle,
  type Repos,
} from "@thalon/db";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import { directionDocToSrt } from "../../direction/export";
import {
  createFakeDirectionPolishDriver,
  createFakeDirectionScenesDriver,
  createFakeStoryboardStageDriver,
  type DirectionScenesDriver,
} from "../../direction/shell/generator";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { ONE_PROMPT_CUT_NAME, runOnePromptVideo, type OnePromptVideoDeps } from "../one-prompt-video";
import type { StagedVideoDeps } from "../staged-video";

/**
 * B-vid.7 one-prompt auto-run, keyless + networkless + SPEND-FREE:
 * - happy path: prompt → judged direction doc (queued) → project → takes
 *   plan → compile-gated cut v1 (draft) — all rows verified;
 * - replay is a no-op: same draft/project/cut, zero extra shell/judge calls;
 * - a blocked stage halts with NOTHING project-side persisted;
 * - an irrecoverable generation fails loud (run row carries the error),
 *   nothing downstream of the failure point exists;
 * - the render/mint invariant is pinned structurally: the cut lands status
 *   "draft" with outputRef null — nothing on this path can render.
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

function countCalls<TReq, TOut>(driver: (req: TReq) => Promise<TOut>) {
  const counter = { count: 0 };
  const wrapped = async (req: TReq) => {
    counter.count += 1;
    return driver(req);
  };
  return { driver: wrapped, counter };
}

const PROMPT = "Introduce what the product does.";
/** The fake storyboard driver titles deterministically: `Video: ${operatorPrompt.slice(0, 60)}`. */
const EXPECTED_PROJECT_NAME = `Video: ${PROMPT}`;
const NOW = new Date("2026-07-19T00:00:00.000Z");

async function fixture(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  deps: OnePromptVideoDeps;
  staged: StagedVideoDeps;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const staged: StagedVideoDeps = {
    structureDriver: createFakeStoryboardStageDriver(),
    scenesDriver: createFakeDirectionScenesDriver(),
    polishDriver: createFakeDirectionPolishDriver(),
    capTokens: 1_000_000,
  };
  const deps: OnePromptVideoDeps = {
    ctx,
    repos,
    judge: {
      screenDriver: judgeDriver(JUDGE_PASS),
      finalDriver: judgeDriver(JUDGE_PASS),
      capTokens: 1_000_000,
    },
    staged,
    ingest: { embedder: createFakeEmbeddingDriver(), capTokens: 1_000_000 },
  };
  return { ctx, repos, deps, staged };
}

describe("runOnePromptVideo — the happy path on fakes", () => {
  it("prompt → judged direction doc → project → takes plan → cut, every row persisted and honest", async () => {
    const { ctx, repos, deps } = await fixture();
    const result = await runOnePromptVideo(deps, { prompt: PROMPT }, NOW);
    if (result.status !== "queued") throw new Error(`expected queued, got ${result.status}`);

    // The staged drafts: default 3-stage video plan, every gate green.
    expect(result.stages.map((s) => s.stageKey)).toEqual(["structure", "scenes_effects", "polish"]);
    expect(result.stages.every((s) => s.judge === "queued")).toBe(true);
    expect(result.draft.format).toBe("direction_doc");
    // Queued = the approve queue: the judge's I1-gated transition is the only path here.
    expect(result.draft.status).toBe("queued");
    const meta = directionDocDraftMetaSchema.parse(result.draft.meta);

    // Runs surface honesty: one complete run row per stage.
    const runs = await repos.fanoutRuns.list(ctx);
    expect(runs).toHaveLength(3);
    expect(runs.every((r) => r.status === "complete")).toBe(true);

    // The project — named by the doc, stamped with the auto-run provenance.
    expect(result.project.name).toBe(EXPECTED_PROJECT_NAME);
    expect(result.project.meta).toMatchObject({
      onePrompt: {
        directionDraftId: result.draft.id,
        promptSourceId: result.promptSourceId,
        startedAt: NOW.toISOString(),
      },
    });
    expect(await repos.videoProjects.list(ctx)).toHaveLength(1);

    // The takes plan: one planned take per scene (the fake doc has 3, no CTA),
    // reference-tree slots/refs, the per-beat mint brief in meta, provenance
    // EMPTY — pinned at mint, and no mint happens on this path.
    const takes = await repos.videoTakes.list(ctx, result.project.id);
    expect(takes).toHaveLength(meta.doc.scenes.length);
    expect(result.takes.map((t) => t.slot)).toEqual(["beat-01", "beat-02", "beat-03"]);
    for (const [i, scene] of meta.doc.scenes.entries()) {
      const take = result.takes[i].take;
      expect(take.ref).toBe(`keepers/beat-0${i + 1}.mp4`);
      expect(take.kind).toBe("motion");
      expect(take.provenance).toEqual({});
      expect(take.meta).toMatchObject({
        onePrompt: { planned: true, sceneIndex: i, narration: scene.narration },
      });
    }

    // The cut: v1, compile-gated EDL over the planned refs, aspect-true
    // output — and status "draft"/outputRef null: NOTHING here rendered.
    expect(result.cut.name).toBe(ONE_PROMPT_CUT_NAME);
    expect(result.cut.version).toBe(1);
    expect(result.cut.status).toBe("draft");
    expect(result.cut.outputRef).toBeNull();
    const edl = edlSchema.parse(result.cut.edl);
    expect(edl.video).toHaveLength(meta.doc.scenes.length);
    expect(edl.video.map((clip) => clip.source)).toEqual(
      meta.doc.scenes.map((_, i) => ({ kind: "take", ref: `keepers/beat-0${i + 1}.mp4` })),
    );
    // Beats chain with the crossfade (the compiler's rule — its parse of this
    // EDL already gated the cut's persistence).
    expect(edl.video[0].transitionIn).toBeUndefined();
    for (const clip of edl.video.slice(1)) {
      expect(clip.transitionIn?.type).toBe("xfade");
    }
    const dims = ASPECT_DIMENSIONS[meta.doc.aspect];
    expect(edl.output).toMatchObject({ width: dims.width, height: dims.height, fps: meta.doc.fps });
    // Output duration = the assembled lane: sum of durations minus fade overlaps.
    const totalMs = meta.doc.scenes.reduce((sum, s) => sum + s.durationMs, 0);
    const fades = edl.video
      .slice(1)
      .reduce((sum, clip) => sum + (clip.transitionIn?.duration ?? 0), 0);
    expect(edl.output.duration).toBeCloseTo(totalMs / 1000 - fades, 6);

    // The SRT is the doc's deterministic caption artifact — derived, never stored.
    expect(result.srt).toBe(directionDocToSrt(meta.doc));
  });

  it("a source URL rides the ingested brief and its meta — the grounding trail", async () => {
    const { repos, deps } = await fixture();
    const result = await runOnePromptVideo(
      deps,
      { prompt: PROMPT, sourceUrl: "https://example.com/launch" },
      NOW,
    );
    expect(result.status).toBe("queued");
    const source = await repos.sources.get(deps.ctx, result.promptSourceId);
    expect(source?.meta).toMatchObject({
      origin: "one_prompt_video",
      sourceUrl: "https://example.com/launch",
    });
  });

  it("replay is a full no-op: same draft/project/cut, zero extra shell and judge calls", async () => {
    const { ctx, repos, deps, staged } = await fixture();
    const first = await runOnePromptVideo(deps, { prompt: PROMPT }, NOW);
    if (first.status !== "queued") throw new Error("fixture run must queue");

    const structure = countCalls(staged.structureDriver!);
    const scenes = countCalls(staged.scenesDriver!);
    const polish = countCalls(staged.polishDriver!);
    const screen = countCalls(deps.judge.screenDriver);
    const replay = await runOnePromptVideo(
      {
        ...deps,
        judge: { ...deps.judge, screenDriver: screen.driver as JudgeModelDriver },
        staged: {
          ...staged,
          structureDriver: structure.driver,
          scenesDriver: scenes.driver,
          polishDriver: polish.driver,
        },
      },
      { prompt: PROMPT },
      new Date("2026-07-20T00:00:00.000Z"),
    );
    if (replay.status !== "queued") throw new Error("replay must queue");

    expect(replay.draft.id).toBe(first.draft.id);
    expect(replay.project.id).toBe(first.project.id);
    expect(replay.cut.id).toBe(first.cut.id);
    expect(replay.stages.every((s) => s.judge === "already_passed")).toBe(true);
    expect(structure.counter.count + scenes.counter.count + polish.counter.count).toBe(0);
    expect(screen.counter.count).toBe(0);
    // No duplicate rows anywhere in the project tree.
    expect(await repos.videoProjects.list(ctx)).toHaveLength(1);
    expect(await repos.videoTakes.list(ctx, first.project.id)).toHaveLength(first.takes.length);
    expect(await repos.videoCuts.list(ctx, first.project.id)).toHaveLength(1);
  });
});

describe("runOnePromptVideo — failure honesty", () => {
  it("a blocked stage halts the flow: blocked draft in triage, NOTHING project-side persisted", async () => {
    const { ctx, repos, deps } = await fixture();
    const result = await runOnePromptVideo(
      {
        ...deps,
        judge: {
          screenDriver: judgeDriver(JUDGE_PASS),
          finalDriver: judgeDriver(JUDGE_FAIL), // tier disagreement ⇒ blocked (I3)
          capTokens: 1_000_000,
        },
      },
      { prompt: PROMPT },
      NOW,
    );
    if (result.status !== "blocked") throw new Error(`expected blocked, got ${result.status}`);
    expect(result.blockedStageKey).toBe("structure");
    expect(result.draft.status).toBe("blocked");
    expect(await repos.videoProjects.list(ctx)).toHaveLength(0);
  });

  it("an irrecoverable stage generation fails loud — run row carries the error, no project tree", async () => {
    const { ctx, repos, deps, staged } = await fixture();
    const duplicating: DirectionScenesDriver = async (req) => {
      const base = await createFakeDirectionScenesDriver()(req);
      const scenes = (base.candidate as { scenes: { sceneIndex: number }[] }).scenes;
      return { ...base, candidate: { scenes: scenes.map((s) => ({ ...s, sceneIndex: 0 })) } };
    };
    await expect(
      runOnePromptVideo(
        { ...deps, staged: { ...staged, scenesDriver: duplicating } },
        { prompt: PROMPT },
        NOW,
      ),
    ).rejects.toThrow(IrrecoverableGenerationError);
    const failed = (await repos.fanoutRuns.list(ctx)).find((r) => r.lastError);
    expect(failed?.status).toBe("failed");
    expect(failed?.lastError).toMatch(/duplicate sceneIndex/);
    expect(await repos.videoProjects.list(ctx)).toHaveLength(0);
  });

  it("a project-name collision with a foreign origin refuses loudly — first origin wins, nothing added", async () => {
    const { ctx, repos, deps } = await fixture();
    const { project: foreign } = await repos.videoProjects.create(ctx, {
      name: EXPECTED_PROJECT_NAME,
      meta: { mediaRoot: "/somewhere/else" },
    });
    await expect(runOnePromptVideo(deps, { prompt: PROMPT }, NOW)).rejects.toThrow(
      InvalidStateError,
    );
    // The foreign project is untouched: no takes, no cuts, meta as it was.
    expect(await repos.videoTakes.list(ctx, foreign.id)).toHaveLength(0);
    expect(await repos.videoCuts.list(ctx, foreign.id)).toHaveLength(0);
    expect((await repos.videoProjects.get(ctx, foreign.id))?.meta).toEqual({
      mediaRoot: "/somewhere/else",
    });
  });

  it("an empty prompt is refused before anything runs", async () => {
    const { deps } = await fixture();
    await expect(runOnePromptVideo(deps, { prompt: "   " }, NOW)).rejects.toThrow(
      InvalidStateError,
    );
  });
});
