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
import { createFakeEdlDiffDriver } from "../shell/generator";

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

    // The inter-merge state: clip-crop parses at the contract (B-ve.7
    // half-window) but its engine arm is B-ve.7 lane work — until it lands,
    // dry-apply refuses. B-ve.7 lane: DELETE this second pin when the crop
    // arm lands; your apply/refusal suite replaces it.
    const crop = edlDiffSchema.parse({
      summary: "s",
      ops: [{ op: "clip-crop", clip: 0, crop: { width: 10, height: 10 }, why: "w" }],
    });
    expect(() => applyEdlDiff(base(), crop)).toThrow(/no engine arm/);
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
    expect(proposal.promptName).toBe("edl-diff-propose.v1");
    expect(proposal.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal.model.length).toBeGreaterThan(0);
    expect(proposal.tokensOut).toBeGreaterThan(0);

    // The B4.4 boundary: the call was metered — budget asserted, usage recorded.
    const spent = await handle.repos.usageLedger.totalForDay(ctx);
    expect(spent.tokensOut).toBeGreaterThan(0);
  });
});
