import { describe, expect, it } from "vitest";
import { expectedClipPlanBody, formatMsAsClock, parseClipPlanMeta } from "../clip-plan";

const VALID_META = {
  startMs: 12_000,
  endMs: 45_000,
  durationMs: 33_000,
  windowIndex: 2,
  chunkSeqs: [4, 5, 6],
  hook: "You won't believe this",
  captions: "Line one\nLine two",
  platformCopy: "Check out this clip",
  promptVersion: "highlight-select.v1",
  brandProfileVersion: 3,
  platformProfileVersion: "brand-profile.v3",
};

describe("parseClipPlanMeta", () => {
  it("parses a valid clip_plan meta shape", () => {
    expect(parseClipPlanMeta(VALID_META)).toEqual(VALID_META);
  });

  it("returns null for meta missing required fields (e.g. a plain post draft's {})", () => {
    expect(parseClipPlanMeta({})).toBeNull();
  });

  it("returns null for a different format's meta", () => {
    expect(parseClipPlanMeta({ steps: [] })).toBeNull();
  });
});

describe("formatMsAsClock", () => {
  it("formats sub-minute durations", () => {
    expect(formatMsAsClock(0)).toBe("0:00");
    expect(formatMsAsClock(5_000)).toBe("0:05");
  });

  it("formats multi-minute durations with zero-padded seconds", () => {
    expect(formatMsAsClock(65_000)).toBe("1:05");
    expect(formatMsAsClock(600_000)).toBe("10:00");
  });

  it("clamps negative/non-finite input to 0:00", () => {
    expect(formatMsAsClock(-1)).toBe("0:00");
    expect(formatMsAsClock(NaN)).toBe("0:00");
  });
});

describe("expectedClipPlanBody", () => {
  it("joins hook, captions, and platformCopy with \\n\\n — the same convention that binds body_hash (I1)", () => {
    expect(expectedClipPlanBody(VALID_META)).toBe(
      "You won't believe this\n\nLine one\nLine two\n\nCheck out this clip",
    );
  });
});
