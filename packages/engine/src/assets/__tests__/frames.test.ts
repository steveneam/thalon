import { describe, expect, it } from "vitest";
import { evenlySpacedIndices, frameFileNames, isFramePattern } from "../frames";

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
