import { describe, expect, it } from "vitest";
import {
  resolveStagePlan,
  STAGE_PLAN_REGISTRY,
  stagePlanSchema,
  VIDEO_STAGE_PLAN,
} from "../stage-registry";

/**
 * B5.2 (amendment A11): the stage registry is DATA — count is config. These
 * tests pin the shipped default video plan (3 stages, structure →
 * scenes/effects → polish) and prove the schema invariants that keep any
 * configured plan runnable by the one staged pipeline: unique keys, first
 * stage produces storyboard, every later stage produces direction_doc.
 */

describe("shipped video stage plan (the default the A11 charter names)", () => {
  it("is 3 stages in order: structure → scenes_effects → polish", () => {
    expect(VIDEO_STAGE_PLAN.family).toBe("video");
    expect(VIDEO_STAGE_PLAN.stages.map((s) => s.key)).toEqual([
      "structure",
      "scenes_effects",
      "polish",
    ]);
    expect(VIDEO_STAGE_PLAN.stages.map((s) => s.produces)).toEqual([
      "storyboard",
      "direction_doc",
      "direction_doc",
    ]);
  });

  it("pins the versioned prompt slugs (SPINE §3.2 — prompt_version provenance)", () => {
    expect(VIDEO_STAGE_PLAN.stages.map((s) => s.promptSlug)).toEqual([
      "storyboard-stage-structure.v1",
      "direction-stage-scenes.v1",
      "direction-stage-polish.v1",
    ]);
  });

  it("resolveStagePlan returns it for 'video' and is loud on an unknown family", () => {
    expect(resolveStagePlan("video")).toBe(VIDEO_STAGE_PLAN);
    expect(() => resolveStagePlan("podcast")).toThrow(/no stage plan registered/);
    expect(Object.keys(STAGE_PLAN_REGISTRY)).toEqual(["video"]);
  });
});

describe("stage-plan schema (count is config, shape is invariant)", () => {
  const stage = (key: string, produces: string, slug = `${key.replace(/_/g, "-")}-x.v1`) => ({
    key,
    title: key,
    produces,
    promptSlug: slug,
  });

  it("accepts a 2-stage plan — the count is genuinely config", () => {
    const plan = stagePlanSchema.parse({
      family: "video",
      stages: [stage("structure", "storyboard"), stage("finish", "direction_doc")],
    });
    expect(plan.stages).toHaveLength(2);
  });

  it("accepts a 5-stage plan", () => {
    const plan = stagePlanSchema.parse({
      family: "video",
      stages: [
        stage("structure", "storyboard"),
        stage("scenes", "direction_doc"),
        stage("effects", "direction_doc"),
        stage("pacing", "direction_doc"),
        stage("polish", "direction_doc"),
      ],
    });
    expect(plan.stages).toHaveLength(5);
  });

  it("rejects duplicate stage keys", () => {
    expect(() =>
      stagePlanSchema.parse({
        family: "video",
        stages: [stage("structure", "storyboard"), stage("structure", "direction_doc")],
      }),
    ).toThrow(/duplicate stage key/);
  });

  it("rejects a first stage that does not produce storyboard", () => {
    expect(() =>
      stagePlanSchema.parse({
        family: "video",
        stages: [stage("structure", "direction_doc")],
      }),
    ).toThrow(/authors the structure/);
  });

  it("rejects a later stage that produces storyboard (only the first stage authors structure)", () => {
    expect(() =>
      stagePlanSchema.parse({
        family: "video",
        stages: [stage("structure", "storyboard"), stage("restructure", "storyboard")],
      }),
    ).toThrow(/transforms the direction document/);
  });

  it("rejects an unversioned prompt slug — prompt_version flows into generation keys", () => {
    expect(() =>
      stagePlanSchema.parse({
        family: "video",
        stages: [stage("structure", "storyboard", "storyboard-stage-structure")],
      }),
    ).toThrow(/versioned file stems/);
  });
});
