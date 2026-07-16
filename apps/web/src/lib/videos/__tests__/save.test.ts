import { describe, expect, it } from "vitest";
import { planCutSave } from "../save";

const VALID_EDL = {
  name: "mini",
  output: { width: 1280, height: 720, fps: 24, duration: 9.5 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, duration: 5 },
    {
      name: "b2",
      source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
      duration: 5,
      transitionIn: { type: "xfade", duration: 0.5 },
    },
  ],
};

describe("planCutSave (the version is DERIVED — a re-edit is always a new version)", () => {
  it("derives max(name)+1 from the project's existing cuts", () => {
    const planned = planCutSave(
      [
        { name: "film", version: 3 },
        { name: "other", version: 9 },
      ],
      { name: "film", edl: VALID_EDL },
    );
    expect(planned).toMatchObject({ ok: true, input: { name: "film", version: 4 } });
  });

  it("refuses a malformed body with 400 (schema refusal, readable)", () => {
    const planned = planCutSave([], { name: "", edl: VALID_EDL });
    expect(planned).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a schema-valid EDL the compiler's honest caps reject, 422 verbatim", () => {
    const twoCues = {
      ...VALID_EDL,
      audio: [
        { source: { kind: "audio", ref: "music/a.mp3" } },
        { source: { kind: "audio", ref: "music/b.mp3" } },
      ],
    };
    const planned = planCutSave([], { name: "film", edl: twoCues });
    expect(planned).toMatchObject({ ok: false, status: 422 });
    if (!planned.ok) expect(planned.error).toMatch(/at most one audio cue/);
  });

  it("refuses an unsafe ref at the contract door (the compiler never sees it)", () => {
    const traversal = {
      ...VALID_EDL,
      video: [{ name: "b1", source: { kind: "take", ref: "../../etc/passwd" }, duration: 5 }],
    };
    expect(planCutSave([], { name: "film", edl: traversal })).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
