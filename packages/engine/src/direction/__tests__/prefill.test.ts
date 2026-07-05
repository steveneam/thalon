import { directionDocSchema, type StoryboardDraftMeta } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { derivedCueDurationMs } from "../../render/srt";
import {
  DEFAULT_DIRECTION_ASPECT,
  DEFAULT_DIRECTION_FPS,
  DEFAULT_DIRECTION_MOTION,
  DEFAULT_DIRECTION_PACING,
  directionLineFrom,
  prefillDirectionDoc,
} from "../prefill";

/**
 * B5.2 deterministic-first prefill: everything computable is computed —
 * config-or-default for aspect/fps/pacing/motion, derived-or-hinted
 * durations, storyboard structure verbatim (normalized to direction's
 * single-line contract). The creative slot (`visual`) stays null: that is
 * the scenes/effects stage's job, not prefill's.
 */

function storyboard(
  overrides: Partial<Pick<StoryboardDraftMeta, "title" | "scenes" | "cta">> = {},
): Pick<StoryboardDraftMeta, "title" | "scenes" | "cta"> {
  return {
    title: "What the product does",
    scenes: [
      {
        sceneIndex: 0,
        heading: "Hook",
        narration: "The one thing to know.",
        onScreenText: "One thing",
        visualHint: "close-up of the dashboard",
      },
      {
        sceneIndex: 1,
        heading: "Why it matters",
        narration: "Because it saves the operator an hour a day.",
        durationHintMs: 4200,
      },
    ],
    cta: null,
    ...overrides,
  };
}

describe("prefillDirectionDoc — defaults (no platform config)", () => {
  it("fills every deterministic slot and leaves the creative slot null", () => {
    const doc = prefillDirectionDoc(storyboard());
    expect(doc.aspect).toBe(DEFAULT_DIRECTION_ASPECT);
    expect(doc.fps).toBe(DEFAULT_DIRECTION_FPS);
    expect(doc.pacing).toBe(DEFAULT_DIRECTION_PACING);
    expect(doc.scenes.map((s) => s.motion)).toEqual([
      DEFAULT_DIRECTION_MOTION,
      DEFAULT_DIRECTION_MOTION,
    ]);
    expect(doc.scenes.map((s) => s.visual)).toEqual([null, null]);
    expect(doc.scenes[0].onScreenText).toBe("One thing");
    expect(doc.scenes[1].onScreenText).toBeNull();
    expect(doc.cta).toBeNull();
    // The output is a valid direction doc by construction.
    expect(() => directionDocSchema.parse(doc)).not.toThrow();
  });

  it("respects an authored durationHintMs and derives the rest with the pillar reading-speed math", () => {
    const doc = prefillDirectionDoc(storyboard());
    expect(doc.scenes[0].durationMs).toBe(derivedCueDurationMs("The one thing to know."));
    expect(doc.scenes[1].durationMs).toBe(4200);
  });

  it("is deterministic: same storyboard in, deep-equal doc out", () => {
    expect(prefillDirectionDoc(storyboard())).toEqual(prefillDirectionDoc(storyboard()));
  });

  it("normalizes free-line storyboard text to direction's single-line contract", () => {
    const doc = prefillDirectionDoc(
      storyboard({
        title: "  Two\nline   title ",
        cta: " Try\tit \n today ",
      }),
    );
    expect(doc.title).toBe("Two line title");
    expect(doc.cta).toBe("Try it today");
    expect(directionLineFrom("  a\n\n b\tc ")).toBe("a b c");
  });
});

describe("prefillDirectionDoc — platform config (data, never code)", () => {
  it("honours aspect/fps/pacing/motion from the platform profile", () => {
    const doc = prefillDirectionDoc(storyboard(), {
      platformProfile: { aspect: "9:16", fps: 60, pacing: "fast", motion: "snappy" },
    });
    expect(doc.aspect).toBe("9:16");
    expect(doc.fps).toBe(60);
    expect(doc.pacing).toBe("fast");
    expect(doc.scenes.every((s) => s.motion === "snappy")).toBe(true);
  });

  it("is LOUD on present-but-invalid config — a typo never silently becomes a default", () => {
    expect(() =>
      prefillDirectionDoc(storyboard(), { platformProfile: { aspect: "4:3" } }),
    ).toThrow(/expected one of 16:9/);
    expect(() =>
      prefillDirectionDoc(storyboard(), { platformProfile: { fps: 29.97 } }),
    ).toThrow(/integer 1–120/);
    expect(() =>
      prefillDirectionDoc(storyboard(), { platformProfile: { motion: ["smooth"] } }),
    ).toThrow(/expected one of smooth/);
    expect(() =>
      prefillDirectionDoc(storyboard(), { platformProfile: { pacing: "frantic" } }),
    ).toThrow(/expected one of fast/);
  });
});
