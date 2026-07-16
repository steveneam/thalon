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

describe("save attribution (B-ve.4: every save is attributed, agent saves carry their proposal)", () => {
  const AGENT_ATTRIBUTION = {
    authoredBy: "agent",
    proposal: {
      baseCutId: "3e0f8b0a-0000-4000-8000-000000000000",
      model: "claude-sonnet-5",
      promptName: "edl-diff-proposer",
      promptHash: "abc123",
      ask: "clear the caption off the falcon",
      diff: {
        summary: "move line 1 up",
        ops: [{ op: "caption-move", line: 1, x: 640, y: 610, why: "clears the wing" }],
      },
      decidedBy: "operator",
    },
  };

  it("stamps operator attribution by default — every B-ve.4+ cut says who authored it", () => {
    const planned = planCutSave([], { name: "film", edl: VALID_EDL });
    expect(planned).toMatchObject({
      ok: true,
      input: { meta: { attribution: { authoredBy: "operator" } } },
    });
  });

  it("carries a full agent proposal through to meta.attribution (the replay record)", () => {
    const planned = planCutSave([], {
      name: "film",
      edl: VALID_EDL,
      attribution: AGENT_ATTRIBUTION,
    });
    expect(planned).toMatchObject({
      ok: true,
      input: { meta: { attribution: AGENT_ATTRIBUTION } },
    });
  });

  it("refuses an agent save without its proposal (replayable + attributed is a schema rule)", () => {
    const planned = planCutSave([], {
      name: "film",
      edl: VALID_EDL,
      attribution: { authoredBy: "agent" },
    });
    expect(planned).toMatchObject({ ok: false, status: 400 });
  });

  it("overwrites a spoofed meta.attribution — only the validated field is trusted", () => {
    const planned = planCutSave([], {
      name: "film",
      edl: VALID_EDL,
      meta: { attribution: { authoredBy: "agent" }, keep: "me" },
    });
    expect(planned).toMatchObject({
      ok: true,
      input: { meta: { attribution: { authoredBy: "operator" }, keep: "me" } },
    });
  });
});
