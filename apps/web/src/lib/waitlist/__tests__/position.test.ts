import { describe, expect, it } from "vitest";
import { effectivePosition, SPOTS_PER_REFERRAL } from "../position";

describe("effectivePosition (B6.1 skip-the-line math)", () => {
  it("moves a signup up SPOTS_PER_REFERRAL per referral", () => {
    expect(effectivePosition(20, 0)).toBe(20);
    expect(effectivePosition(20, 1)).toBe(20 - SPOTS_PER_REFERRAL);
    expect(effectivePosition(20, 3)).toBe(20 - 3 * SPOTS_PER_REFERRAL);
  });

  it("floors at position 1, never 0 or negative", () => {
    expect(effectivePosition(3, 1)).toBe(1);
    expect(effectivePosition(1, 50)).toBe(1);
  });

  it("rejects non-positive or fractional positions and negative referral counts", () => {
    expect(() => effectivePosition(0, 0)).toThrow(/positive integer/);
    expect(() => effectivePosition(2.5, 0)).toThrow(/positive integer/);
    expect(() => effectivePosition(5, -1)).toThrow(/non-negative/);
  });
});
