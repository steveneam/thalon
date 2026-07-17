import { afterEach, describe, expect, it } from "vitest";
import {
  edlDiffSchema,
  edlSchema,
  tenantCtx,
  type EdlDiff,
  type EdlInput,
} from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { applyEdlDiff, EdlDiffApplyError } from "../diff";
import { EdlProposeError, proposeEdlDiff, validateEdlDiffCandidate } from "../propose";
import { createFakeEdlDiffDriver, edlDiffPromptContext } from "../shell/generator";

/**
 * B-ve.4 (ADR 0010): the diff transform both sides share — the editor's
 * preview and the save door's replay verification run this exact function.
 */

const BASE_INPUT: EdlInput = {
  name: "diff-fixture",
  output: { width: 1280, height: 720, fps: 24, duration: 20 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/b1.mp4" }, duration: 10 },
    {
      name: "b2",
      source: { kind: "take", ref: "motion/keepers/b2.mp4" },
      duration: 10.4,
      transitionIn: { type: "xfade", duration: 0.4 },
    },
  ],
  audio: [
    {
      source: { kind: "audio", ref: "music/score.mp3" },
      offset: 30,
      fadeOut: { start: 18, duration: 1.2 },
    },
  ],
  captions: {
    style: { pointsize: 40 },
    lines: [
      { text: "always watching", x: 640, y: 622, fadeIn: 0.9, fadeOut: 4 },
      { text: "carried home", x: 640, y: 90, fadeIn: 5, fadeOut: 9 },
    ],
  },
};
const base = () => edlSchema.parse(BASE_INPUT);

describe("applyEdlDiff", () => {
  it("applies caption moves, caption text, and music alignment; the base is untouched", () => {
    const b = base();
    const diff: EdlDiff = {
      version: 1,
      summary: "full vocabulary pass",
      ops: [
        { op: "caption-move", line: 0, x: 640, y: 614, why: "clears the wing" },
        { op: "caption-text", line: 1, text: "carried for you", why: "hook, not process" },
        {
          op: "music-align",
          cue: 0,
          offset: 105,
          fadeIn: { duration: 1.2 },
          why: "crest astride the takeoff",
        },
      ],
    };
    const next = applyEdlDiff(b, diff);
    expect(next.captions?.lines[0]).toMatchObject({ x: 640, y: 614, text: "always watching" });
    expect(next.captions?.lines[1].text).toBe("carried for you");
    expect(next.audio[0]).toMatchObject({ offset: 105, fadeIn: { duration: 1.2 } });
    // Untouched knobs survive; the base EDL is not mutated.
    expect(next.audio[0].fadeOut).toEqual({ start: 18, duration: 1.2 });
    expect(b.captions?.lines[0].y).toBe(622);
    expect(b.audio[0].offset).toBe(30);
  });

  it("is deterministic: same base + same diff ⇒ byte-identical EDLs (the replay check's foundation)", () => {
    const diff: EdlDiff = {
      version: 1,
      summary: "s",
      ops: [{ op: "caption-move", line: 0, x: 100, y: 200, why: "w" }],
    };
    expect(JSON.stringify(applyEdlDiff(base(), diff))).toBe(
      JSON.stringify(applyEdlDiff(base(), diff)),
    );
  });

  it("refuses ops that point at nothing, with the op index in the message", () => {
    expect(() =>
      applyEdlDiff(base(), {
        version: 1,
        summary: "s",
        ops: [{ op: "caption-move", line: 7, x: 0, y: 0, why: "w" }],
      }),
    ).toThrow(EdlDiffApplyError);
    expect(() =>
      applyEdlDiff(base(), {
        version: 1,
        summary: "s",
        ops: [{ op: "music-align", cue: 3, offset: 1, why: "w" }],
      }),
    ).toThrow(/op 0: audio cue 3 does not exist/);
  });

  it("refuses an op kind that has no engine arm — never a silent no-op", () => {
    // Fabricated kind: pins the default arm forever, however the union grows.
    const alien = {
      version: 1,
      summary: "s",
      ops: [{ op: "sky-hook", why: "w" }],
    } as unknown as EdlDiff;
    expect(() => applyEdlDiff(base(), alien)).toThrow(EdlDiffApplyError);
  });

  it("applies a clip-crop: the full replacement window lands on the target clip only (B-ve.7)", () => {
    const b = base();
    const diff = edlDiffSchema.parse({
      summary: "recenter b1",
      ops: [
        {
          op: "clip-crop",
          clip: 0,
          crop: { width: 405, height: 720, x: 300, y: 0 },
          why: "measured recenter",
        },
      ],
    });
    const next = applyEdlDiff(b, diff);
    expect(next.video[0].crop).toEqual({ width: 405, height: 720, x: 300, y: 0 });
    expect(next.video[1].crop).toBeUndefined();
    // The base EDL is not mutated.
    expect(b.video[0].crop).toBeUndefined();
  });

  it("applies a clip-crop with a from/to pan axis (the propose alphabet's sweep arm)", () => {
    const diff = edlDiffSchema.parse({
      summary: "sweep b2 toward the desk",
      ops: [
        {
          op: "clip-crop",
          clip: 1,
          crop: { width: 405, height: 720, x: { from: 220, to: 440 }, y: 0 },
          why: "measured sweep",
        },
      ],
    });
    expect(applyEdlDiff(base(), diff).video[1].crop).toEqual({
      width: 405,
      height: 720,
      x: { from: 220, to: 440 },
      y: 0,
    });
  });

  it("refuses a clip-crop that points at nothing, with the op index and lane size verbatim", () => {
    expect(() =>
      applyEdlDiff(base(), {
        version: 1,
        summary: "s",
        ops: [
          { op: "clip-crop", clip: 7, crop: { width: 10, height: 10, x: 0, y: 0 }, why: "w" },
        ],
      }),
    ).toThrow(/op 0: video clip 7 does not exist \(the cut has 2\)/);
  });

  it("refuses a clip-crop on a copy-mode cut — typed refusal, not a downstream schema error", () => {
    const copyCut = edlSchema.parse({
      name: "scored-master",
      output: { width: 1280, height: 720, fps: 24, duration: 20, video: { mode: "copy" } },
      video: [{ name: "master", source: { kind: "cut", ref: "cuts/master.mp4" }, duration: 20 }],
      audio: [{ source: { kind: "audio", ref: "music/score.mp3" } }],
    });
    expect(() =>
      applyEdlDiff(copyCut, {
        version: 1,
        summary: "s",
        ops: [
          { op: "clip-crop", clip: 0, crop: { width: 405, height: 720, x: 0, y: 0 }, why: "w" },
        ],
      }),
    ).toThrow(/op 0: the picture is stream-copied — a crop window needs an encode timeline/);
  });

  it("refuses alignment knobs on a stream-copied cue (they need an encode cue)", () => {
    const copyCue = edlSchema.parse({
      ...BASE_INPUT,
      audio: [{ source: { kind: "cut", ref: "cuts/master.mp4" }, mode: "copy" }],
    });
    expect(() =>
      applyEdlDiff(copyCue, {
        version: 1,
        summary: "s",
        ops: [{ op: "music-align", cue: 0, offset: 1, why: "w" }],
      }),
    ).toThrow(/stream-copied/);
  });
});

describe("validateEdlDiffCandidate (the pure half: zod boundary + dry-apply gate)", () => {
  it("returns the validated diff + applied preview", () => {
    const { diff, preview } = validateEdlDiffCandidate(base(), {
      summary: "nudge line 0",
      ops: [{ op: "caption-move", line: 0, x: 640, y: 614, why: "clears the wing" }],
    });
    expect(diff.ops).toHaveLength(1);
    expect(preview.captions?.lines[0].y).toBe(614);
  });

  it("refuses a candidate that is not a diff (the zod boundary)", () => {
    expect(() => validateEdlDiffCandidate(base(), { summary: "no ops key" })).toThrow(
      EdlProposeError,
    );
  });

  it("surfaces 'no changes' with the agent's own summary — an honest outcome, not a schema error", () => {
    expect(() =>
      validateEdlDiffCandidate(base(), { summary: "the captions already read well", ops: [] }),
    ).toThrow(/proposes no changes: the captions already read well/);
  });

  it("refuses a schema-valid diff that does not apply to THIS cut (dry-apply gate)", () => {
    expect(() =>
      validateEdlDiffCandidate(base(), {
        summary: "points at a line this cut does not have",
        ops: [{ op: "caption-text", line: 9, text: "x", why: "w" }],
      }),
    ).toThrow(/does not apply to this cut/);
  });

  // B-ve.7: the measured-bounds gate — "measured, never estimated" binds the
  // agent's crop windows at the same door that dry-applies them.
  const DIMS = {
    "motion/keepers/b1.mp4": { width: 1280, height: 720 },
    "motion/keepers/b2.mp4": { width: 1920, height: 1080 },
  };
  const cropCandidate = (crop: unknown, clip = 0) => ({
    summary: "reframe",
    ops: [{ op: "clip-crop", clip, crop, why: "measured against the probed source" }],
  });

  it("accepts a crop op inside the measured source, at every pan endpoint", () => {
    const { preview } = validateEdlDiffCandidate(
      base(),
      cropCandidate({ width: 405, height: 720, x: { from: 0, to: 875 }, y: 0 }),
      DIMS,
    );
    expect(preview.video[0].crop).toEqual({ width: 405, height: 720, x: { from: 0, to: 875 }, y: 0 });
  });

  it("refuses a crop op when no dims were provided — a bound you cannot check is a guess", () => {
    expect(() =>
      validateEdlDiffCandidate(base(), cropCandidate({ width: 405, height: 720, x: 0, y: 0 })),
    ).toThrow(/crop op 0: no measured dimensions for source "motion\/keepers\/b1\.mp4"/);
  });

  it("refuses a crop op whose specific source was never probed", () => {
    const onlyB2 = { "motion/keepers/b2.mp4": DIMS["motion/keepers/b2.mp4"] };
    expect(() =>
      validateEdlDiffCandidate(
        base(),
        cropCandidate({ width: 405, height: 720, x: 0, y: 0 }),
        onlyB2,
      ),
    ).toThrow(/no measured dimensions for source "motion\/keepers\/b1\.mp4"/);
  });

  it("refuses a window that leaves the measured source, naming the measurement", () => {
    expect(() =>
      validateEdlDiffCandidate(
        base(),
        cropCandidate({ width: 405, height: 720, x: 900, y: 0 }),
        DIMS,
      ),
    ).toThrow(
      /crop op 0: x 900 puts the 405×720 window outside the measured source 1280×720 \("motion\/keepers\/b1\.mp4"\)/,
    );
  });

  it("refuses a from/to pan whose far endpoint sweeps out of the source", () => {
    expect(() =>
      validateEdlDiffCandidate(
        base(),
        cropCandidate({ width: 405, height: 720, x: { from: 0, to: 876 }, y: 0 }),
        DIMS,
      ),
    ).toThrow(/x 876 puts the 405×720 window outside the measured source 1280×720/);
  });

  it("refuses a negative origin and a window taller than the source", () => {
    expect(() =>
      validateEdlDiffCandidate(
        base(),
        cropCandidate({ width: 405, height: 720, x: 0, y: -2 }),
        DIMS,
      ),
    ).toThrow(/y -2 puts the 405×720 window outside/);
    expect(() =>
      validateEdlDiffCandidate(
        base(),
        cropCandidate({ width: 405, height: 800, x: 0, y: 0 }),
        DIMS,
      ),
    ).toThrow(/y 0 puts the 405×800 window outside the measured source 1280×720/);
  });

  it("bounds-checks each crop op against ITS clip's source (per-ref dims, not one global)", () => {
    // 1500 leaves b1's 1280 but fits b2's 1920 — legal only on clip 1.
    const wide = { width: 405, height: 720, x: 1500, y: 0 };
    expect(() => validateEdlDiffCandidate(base(), cropCandidate(wide, 0), DIMS)).toThrow(
      /outside the measured source 1280×720/,
    );
    const { preview } = validateEdlDiffCandidate(base(), cropCandidate(wide, 1), DIMS);
    expect(preview.video[1].crop).toEqual(wide);
  });
});

describe("proposeEdlDiff (metered core: guard wraps the driver, pins ride out)", () => {
  let handle: DbHandle | undefined;
  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it("returns diff + preview + attribution pins, and records the spend in the usage ledger", async () => {
    handle = await openTestDb();
    const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);

    const proposal = await proposeEdlDiff(
      ctx,
      handle.repos,
      { edl: base(), ask: "nudge the first caption" },
      { driver: createFakeEdlDiffDriver(), capTokens: 100_000 },
    );
    expect(proposal.diff.ops).toHaveLength(1);
    expect(proposal.preview.captions?.lines[0].y).toBe(614);
    expect(proposal.promptName).toBe("edl-diff-propose.v2");
    expect(proposal.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal.model.length).toBeGreaterThan(0);
    expect(proposal.tokensOut).toBeGreaterThan(0);

    // The B4.4 boundary: the call was metered — budget asserted, usage recorded.
    const spent = await handle.repos.usageLedger.totalForDay(ctx);
    expect(spent.tokensOut).toBeGreaterThan(0);
  });

  it("proposes a valid crop op from a reframe ask when dims travel with the request (B-ve.7)", async () => {
    handle = await openTestDb();
    const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);

    const proposal = await proposeEdlDiff(
      ctx,
      handle.repos,
      {
        edl: base(),
        ask: "recenter the opening beat on the desk",
        dims: { "motion/keepers/b1.mp4": { width: 1280, height: 720 } },
      },
      { driver: createFakeEdlDiffDriver(), capTokens: 100_000 },
    );
    // The fake is measured and deterministic: centered half-width window of
    // the probed 1280×720 source — and it passed the bounds gate to get here.
    expect(proposal.diff.ops[0]).toMatchObject({
      op: "clip-crop",
      clip: 0,
      crop: { width: 640, height: 720, x: 320, y: 0 },
    });
    expect(proposal.diff.ops[0].why).toMatch(/measured 1280×720 source/);
    expect(proposal.preview.video[0].crop).toEqual({ width: 640, height: 720, x: 320, y: 0 });
  });
});

describe("edlDiffPromptContext (what the model actually sees — the measured-dims wire)", () => {
  it("carries the measured dims block and the operator ask", () => {
    const prompt = edlDiffPromptContext({
      edl: base(),
      ask: "keep the flame in frame",
      dims: { "motion/keepers/b1.mp4": { width: 1280, height: 720 } },
    });
    expect(prompt).toContain("MEASURED SOURCE DIMENSIONS (ffprobe, source pixels");
    expect(prompt).toContain('"motion/keepers/b1.mp4"');
    expect(prompt).toContain('"width": 1280');
    expect(prompt).toContain("OPERATOR ASK:\nkeep the flame in frame");
  });

  it("says crop is off the table when nothing was probed — never a silent omission", () => {
    for (const dims of [undefined, {}]) {
      const prompt = edlDiffPromptContext({ edl: base(), dims });
      expect(prompt).toContain(
        "MEASURED SOURCE DIMENSIONS: none probed on this box — clip-crop ops are OFF the table",
      );
    }
  });
});
