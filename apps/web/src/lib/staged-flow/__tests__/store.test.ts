import {
  DRAFT_FORMAT_REGISTRY,
  directionDocDraftMetaSchema,
  storyboardDraftMetaSchema,
} from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURE_STORYBOARD_DRAFT_ID, FIXTURE_STAGED_RUN_ID, fixtureStylePresets } from "../fixtures";
import { buildFieldReplaceOps, buildSceneReorderOps, pointer } from "../patch";
import {
  advanceStagedFlow,
  applyStagedEdit,
  getStagedDraftDetail,
  getStagedFlow,
  getStagedRunForFeed,
  listStagedRunDrafts,
  pickStagedCandidate,
  resetStagedFlowStore,
  StagedFlowError,
} from "../store";

afterEach(() => resetStagedFlowStore());

const ANCHOR = FIXTURE_STORYBOARD_DRAFT_ID;

/** Walk the fixture chain to a picked scenes/effects draft. */
function pickScenes() {
  const flow = getStagedFlow(ANCHOR)!;
  const candidate = flow.stages[1].candidates![0];
  return { flow: pickStagedCandidate(ANCHOR, candidate.id), candidate };
}

describe("staged-flow store — seed shape (the contract mocks)", () => {
  it("seeds a judged structure stage, scenes candidates on offer, presets from the profile", () => {
    const flow = getStagedFlow(ANCHOR)!;
    expect(flow.plan.stages.map((s) => s.key)).toEqual(["structure", "scenes_effects", "polish"]);
    expect(flow.currentIndex).toBe(1);
    expect(flow.stages.map((s) => s.status)).toEqual(["done", "current", "locked"]);
    expect(flow.stages[0].draft?.status).toBe("queued");
    expect(flow.stages[1].draft).toBeNull();
    expect(flow.stages[1].candidates).toHaveLength(3);
    expect(flow.presets).toEqual(fixtureStylePresets);
    expect(flow.captures).toEqual([]);
  });

  it("every stage artifact parses against its FROZEN pinned schema and derives its body through the registry (I1)", () => {
    const flow = getStagedFlow(ANCHOR)!;
    const storyboard = flow.stages[0].draft!;
    const meta = storyboardDraftMetaSchema.parse(storyboard.meta);
    expect(DRAFT_FORMAT_REGISTRY.storyboard.expectedBody(meta)).toBe(storyboard.body);

    const { flow: picked } = pickScenes();
    const direction = picked.stages[1].draft!;
    const directionMeta = directionDocDraftMetaSchema.parse(direction.meta);
    expect(DRAFT_FORMAT_REGISTRY.direction_doc.expectedBody(directionMeta)).toBe(direction.body);
    expect(directionMeta.priorDraftId).toBe(storyboard.id);
    expect(directionMeta.stageKey).toBe("scenes_effects");
    expect(directionMeta.stageIndex).toBe(1);
  });

  it("serves the feed/grid/detail projections for the staged run and null for foreign ids", () => {
    expect(getStagedRunForFeed().id).toBe(FIXTURE_STAGED_RUN_ID);
    expect(listStagedRunDrafts(FIXTURE_STAGED_RUN_ID)?.map((d) => d.format)).toEqual(["storyboard"]);
    expect(listStagedRunDrafts("some-other-run")).toBeNull();
    expect(getStagedDraftDetail(ANCHOR)?.judgeResults).toHaveLength(3);
    expect(getStagedDraftDetail("some-other-draft")).toBeNull();
    expect(getStagedFlow("some-other-draft")).toBeNull();
  });
});

describe("pick-from-candidates", () => {
  it("resolves the stage: draft judged to queued, candidates cleared, pick captured as a whole-document patch", () => {
    const { flow, candidate } = pickScenes();
    const stage = flow.stages[1];
    expect(stage.draft?.status).toBe("queued");
    expect(stage.draft?.format).toBe("direction_doc");
    expect(stage.candidates).toBeNull();
    expect(stage.judgeResults.every((r) => r.verdict === "pass" && r.bodyHash === stage.draft?.bodyHash)).toBe(true);

    const capture = flow.captures.at(-1)!;
    expect(capture.kind).toBe("pick");
    expect(capture.stageKey).toBe("scenes_effects");
    expect(capture.note).toContain(candidate.id);
    expect(capture.patch).toEqual([{ op: "add", path: "", value: candidate.doc }]);
  });

  it("is loud for unknown candidates", () => {
    expect(() => pickStagedCandidate(ANCHOR, "cand-nope")).toThrow(StagedFlowError);
  });
});

describe("applyStagedEdit — every interaction persists a verbatim patch", () => {
  it("tweak on the storyboard re-derives the body (registry) and re-judges against the new hash", () => {
    const before = getStagedFlow(ANCHOR)!.stages[0].draft!;
    const patch = buildFieldReplaceOps(pointer("scenes", 0), { narration: "Metrics never sleep." });
    const flow = applyStagedEdit(ANCHOR, { kind: "tweak", patch, note: "beat 0" });
    const after = flow.stages[0].draft!;
    expect(after.body).toContain("Metrics never sleep.");
    expect(after.bodyHash).not.toBe(before.bodyHash);
    expect(after.status).toBe("queued");
    expect(flow.stages[0].judgeResults[0].bodyHash).toBe(after.bodyHash);
    const capture = flow.captures.at(-1)!;
    expect(capture).toMatchObject({ kind: "tweak", draftId: ANCHOR, note: "beat 0" });
    expect(capture.patch).toEqual(patch);
  });

  it("reorder patch (move + sceneIndex repairs) round-trips through the frozen schema", () => {
    const flow = applyStagedEdit(ANCHOR, { kind: "reorder", patch: buildSceneReorderOps(4, 3, 1) });
    const meta = storyboardDraftMetaSchema.parse(flow.stages[0].draft!.meta);
    expect(meta.scenes.map((s) => s.heading)).toEqual([
      "Hook — the 3am dashboard",
      "Proof",
      "Problem",
      "Solution",
    ]);
    expect(meta.scenes.map((s) => s.sceneIndex)).toEqual([0, 1, 2, 3]);
  });

  it("accept is capture-only: empty patch recorded, content and hash untouched", () => {
    const before = getStagedFlow(ANCHOR)!.stages[0].draft!;
    const flow = applyStagedEdit(ANCHOR, { kind: "accept", patch: [], note: "beat 2" });
    expect(flow.stages[0].draft).toEqual(before);
    expect(flow.captures.at(-1)).toMatchObject({ kind: "accept", patch: [], note: "beat 2" });
    expect(() => applyStagedEdit(ANCHOR, { kind: "accept", patch: buildSceneReorderOps(4, 0, 1) })).toThrow(
      /no-change signal/,
    );
  });

  it("a patch that would break the frozen contract is rejected loudly and captures nothing", () => {
    const captureCount = getStagedFlow(ANCHOR)!.captures.length;
    expect(() =>
      applyStagedEdit(ANCHOR, {
        kind: "tweak",
        patch: [{ op: "replace", path: "/scenes/0/narration", value: "" }],
      }),
    ).toThrow();
    expect(getStagedFlow(ANCHOR)!.captures).toHaveLength(captureCount);
  });

  it("preset ops on a direction doc replace the pinned style fields", () => {
    pickScenes();
    const directionId = getStagedFlow(ANCHOR)!.stages[1].draft!.id;
    const flow = applyStagedEdit(directionId, {
      kind: "preset",
      patch: [
        { op: "replace", path: "/aspect", value: "9:16" },
        { op: "replace", path: "/fps", value: 30 },
        { op: "replace", path: "/pacing", value: "fast" },
      ],
      note: "short-vertical",
    });
    const meta = directionDocDraftMetaSchema.parse(flow.stages[1].draft!.meta);
    expect(meta.doc.aspect).toBe("9:16");
    expect(meta.doc.pacing).toBe("fast");
  });
});

describe("advance — the structural stage gate", () => {
  it("refuses while the current stage awaits a pick", () => {
    expect(() => advanceStagedFlow(ANCHOR)).toThrow(/pick a candidate first/);
  });

  it("after a pick, advances to polish candidates built over the CURRENT doc; the final stage refuses with the export doctrine", () => {
    pickScenes();
    const flow = advanceStagedFlow(ANCHOR);
    expect(flow.currentIndex).toBe(2);
    expect(flow.stages[2].candidates).toHaveLength(2);
    // Polish candidates refine the picked doc, not a stale fixture.
    const pickedDoc = directionDocDraftMetaSchema.parse(flow.stages[1].draft!.meta).doc;
    expect(flow.stages[2].candidates![0].doc?.scenes).toHaveLength(pickedDoc.scenes.length);

    const candidateId = flow.stages[2].candidates![1].id;
    pickStagedCandidate(ANCHOR, candidateId);
    expect(() => advanceStagedFlow(ANCHOR)).toThrow(/export is deterministic core, never a stage/);
  });

  it("polish candidates skip refinements for scenes the operator removed (raw-md editing shrank the doc)", () => {
    pickScenes();
    const directionId = getStagedFlow(ANCHOR)!.stages[1].draft!.id;
    // Drop the last scene, then advance — refinements keyed to sceneIndex 3 must not crash.
    applyStagedEdit(directionId, { kind: "raw_md", patch: [{ op: "remove", path: "/scenes/3" }] });
    const flow = advanceStagedFlow(ANCHOR);
    expect(flow.stages[2].candidates![0].doc?.scenes).toHaveLength(3);
  });
});
