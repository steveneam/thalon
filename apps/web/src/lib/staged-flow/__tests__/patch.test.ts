import { directionDocSchema, type DirectionDoc } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  applyPatch,
  buildFieldReplaceOps,
  buildSceneReorderOps,
  diffDirectionDocs,
  PatchError,
  pointer,
} from "../patch";

const doc = (overrides: Partial<DirectionDoc> = {}): DirectionDoc =>
  directionDocSchema.parse({
    docVersion: "direction.v1",
    title: "Fernwood in 60 seconds",
    aspect: "16:9",
    fps: 30,
    pacing: "medium",
    scenes: [
      {
        sceneIndex: 0,
        heading: "Hook",
        narration: "Your metrics don't sleep.",
        onScreenText: "Never sleeps",
        visual: "dark dashboard glow",
        motion: "smooth",
        durationMs: 4000,
      },
      {
        sceneIndex: 1,
        heading: "Problem",
        narration: "Five tools, one question.",
        onScreenText: null,
        visual: "tab collage",
        motion: "smooth",
        durationMs: 6000,
      },
      {
        sceneIndex: 2,
        heading: "Solution",
        narration: "One live view for the whole team.",
        onScreenText: "One live view",
        visual: "single pane assembling",
        motion: "smooth",
        durationMs: 7000,
      },
    ],
    cta: "Start free",
    ...overrides,
  });

describe("applyPatch", () => {
  it("never mutates its input", () => {
    const before = doc();
    const snapshot = JSON.parse(JSON.stringify(before));
    applyPatch(before, [{ op: "replace", path: "/title", value: "Changed" }]);
    expect(before).toEqual(snapshot);
  });

  it("applies replace / add / remove / move / copy / test", () => {
    const result = applyPatch({ a: [1, 2, 3], b: "x" }, [
      { op: "test", path: "/b", value: "x" },
      { op: "replace", path: "/b", value: "y" },
      { op: "add", path: "/a/1", value: 99 },
      { op: "remove", path: "/a/0" },
      { op: "move", from: "/a/0", path: "/a/2" },
      { op: "copy", from: "/b", path: "/c" },
    ]);
    expect(result).toEqual({ a: [2, 3, 99], b: "y", c: "y" });
  });

  it('replaces the whole document at path ""', () => {
    expect(applyPatch({ a: 1 }, [{ op: "replace", path: "", value: { b: 2 } }])).toEqual({ b: 2 });
    expect(applyPatch(null, [{ op: "add", path: "", value: { b: 2 } }])).toEqual({ b: 2 });
  });

  it("fails loudly with the op index on a missing path, replace-of-nothing, bad index, or failed test", () => {
    expect(() => applyPatch({ a: 1 }, [{ op: "replace", path: "/nope", value: 1 }])).toThrow(PatchError);
    expect(() => applyPatch({ a: [1] }, [{ op: "add", path: "/a/9", value: 1 }])).toThrow(/out of bounds/);
    expect(() => applyPatch({ a: 1 }, [{ op: "test", path: "/a", value: 2 }])).toThrow(/test failed/);
    expect(() => applyPatch({ a: 1 }, [
      { op: "replace", path: "/a", value: 2 },
      { op: "remove", path: "/gone" },
    ])).toThrow(/op 1/);
  });

  it("escapes ~ and / in pointer segments", () => {
    expect(pointer("a/b", "c~d")).toBe("/a~1b/c~0d");
    expect(applyPatch({ "a/b": 1 }, [{ op: "replace", path: "/a~1b", value: 2 }])).toEqual({ "a/b": 2 });
  });
});

describe("buildFieldReplaceOps", () => {
  it("emits one replace per changed field under the base path", () => {
    expect(buildFieldReplaceOps(pointer("scenes", 1), { narration: "New line", visual: null })).toEqual([
      { op: "replace", path: "/scenes/1/narration", value: "New line" },
      { op: "replace", path: "/scenes/1/visual", value: null },
    ]);
  });
});

describe("buildSceneReorderOps", () => {
  it("moves the scene and repairs every displaced sceneIndex so the patched doc stays schema-valid", () => {
    const before = doc();
    const ops = buildSceneReorderOps(3, 2, 0);
    const after = applyPatch(before, ops) as DirectionDoc;
    expect(after.scenes.map((s) => s.heading)).toEqual(["Solution", "Hook", "Problem"]);
    // Contiguity is contract-enforced — the verbatim patch alone must satisfy it.
    expect(() => directionDocSchema.parse(after)).not.toThrow();
    expect(ops[0]).toEqual({ op: "move", from: "/scenes/2", path: "/scenes/0" });
  });

  it("is empty for a no-op and loud out of bounds", () => {
    expect(buildSceneReorderOps(3, 1, 1)).toEqual([]);
    expect(() => buildSceneReorderOps(3, 0, 3)).toThrow(PatchError);
  });
});

describe("diffDirectionDocs", () => {
  it("round-trips: applyPatch(before, diff(before, after)) equals after", () => {
    const before = doc();
    const after = doc({
      title: "Fernwood, in one minute",
      pacing: "fast",
      cta: null,
      scenes: [
        { ...before.scenes[0], narration: "Metrics never sleep.", motion: "snappy" },
        { ...before.scenes[1] },
      ],
    });
    const ops = diffDirectionDocs(before, after);
    expect(applyPatch(before, ops)).toEqual(after);
  });

  it("adds scenes positionally when the doc grew", () => {
    const before = doc();
    const extra = { ...before.scenes[2], sceneIndex: 3, heading: "CTA beat" };
    const after = doc({ scenes: [...before.scenes, extra] });
    const ops = diffDirectionDocs(before, after);
    expect(ops).toContainEqual({ op: "add", path: "/scenes/3", value: extra });
    expect(applyPatch(before, ops)).toEqual(after);
  });

  it("returns no ops for identical documents", () => {
    expect(diffDirectionDocs(doc(), doc())).toEqual([]);
  });
});
