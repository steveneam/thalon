import { describe, expect, it } from "vitest";
import { evenlySpacedIndices, frameFileNames, isFramePattern, resolveFrameRange } from "../frames";

describe("isFramePattern", () => {
  it("recognises a %0Nd pattern and leaves plain filenames alone", () => {
    expect(isFramePattern("season-1-%03d.webp")).toBe(true);
    expect(isFramePattern("hero.webp")).toBe(false);
  });
});

describe("frameFileNames", () => {
  it("expands a pattern to zero-padded names, frame 0 first", () => {
    expect(frameFileNames("s1-%03d.webp", 3)).toEqual(["s1-000.webp", "s1-001.webp", "s1-002.webp"]);
  });

  it("returns exactly `frames` distinct names", () => {
    const names = frameFileNames("s1-%03d.webp", 48);
    expect(names).toHaveLength(48);
    expect(new Set(names).size).toBe(48);
  });

  it("rejects a pattern too narrow for the count, rather than colliding two frames onto one name", () => {
    // %02d tops out at 99: asking for 101 frames would emit "100" over "10"
    // and silently lose a frame from the sequence.
    expect(() => frameFileNames("s1-%02d.webp", 101)).toThrow(/needs 3 digits/);
    expect(() => frameFileNames("s1-%02d.webp", 100)).not.toThrow();
  });

  it("rejects a missing or duplicated placeholder", () => {
    expect(() => frameFileNames("s1.webp", 4)).toThrow(/no %0Nd/);
    expect(() => frameFileNames("s1-%03d-%03d.webp", 4)).toThrow(/more than one/);
  });

  it("rejects a non-positive count", () => {
    expect(() => frameFileNames("s1-%03d.webp", 0)).toThrow(/positive integer/);
  });
});

describe("evenlySpacedIndices", () => {
  it("always includes the first and last source frame", () => {
    // The endpoints are the pinned keyframes the transition was generated
    // between — dropping either lands the scrub on a month the instrument
    // is not reporting.
    const picked = evenlySpacedIndices(121, 40);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(120);
  });

  it("spreads the sample evenly and never goes backwards", () => {
    const picked = evenlySpacedIndices(121, 40);
    expect(picked).toHaveLength(40);
    for (let i = 1; i < picked.length; i++) expect(picked[i]).toBeGreaterThan(picked[i - 1]);
  });

  it("is the identity when every frame is wanted", () => {
    expect(evenlySpacedIndices(5, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("collapses to the first frame when only one is wanted", () => {
    expect(evenlySpacedIndices(121, 1)).toEqual([0]);
  });

  it("refuses to sample more frames than the source has", () => {
    expect(() => evenlySpacedIndices(10, 11)).toThrow(/cannot sample/);
  });
});

describe("resolveFrameRange", () => {
  it("defaults to the whole clip when no range is declared", () => {
    expect(resolveFrameRange(193)).toEqual([0, 192]);
  });

  it("keeps a declared live range inclusive at both ends", () => {
    // Site D's veraison take: the fruit stops changing at native frame ~126 and
    // the last ~65 frames are one still picture. Both ends are shipped.
    expect(resolveFrameRange(193, [0, 126])).toEqual([0, 126]);
  });

  it("narrows the sample so a dead tail is never spent on scroll", () => {
    // The point of the range: sampling within it must land entirely inside it,
    // and must reach its last frame rather than the clip's.
    const [lo, hi] = resolveFrameRange(193, [0, 126]);
    const picked = evenlySpacedIndices(hi - lo + 1, 61).map((i) => i + lo);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(126);
    expect(Math.max(...picked)).toBeLessThanOrEqual(126);
  });

  it("refuses a range that runs past the take's last frame", () => {
    expect(() => resolveFrameRange(193, [0, 193])).toThrow(/past the take's last frame/);
  });

  it("refuses a range that does not ascend", () => {
    expect(() => resolveFrameRange(193, [126, 126])).toThrow(/must ascend/);
    expect(() => resolveFrameRange(193, [126, 10])).toThrow(/must ascend/);
  });

  it("refuses a negative or non-integer range", () => {
    expect(() => resolveFrameRange(193, [-1, 126])).toThrow(/must not be negative/);
    expect(() => resolveFrameRange(193, [0.5, 126])).toThrow(/must be two integers/);
  });
});
