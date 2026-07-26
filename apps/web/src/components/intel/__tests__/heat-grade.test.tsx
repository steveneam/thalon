import { describe, expect, it } from "vitest";
import { heatBand } from "@/components/intel/heat-grade";

/**
 * The band boundaries are the shared truth three surfaces read (board cards,
 * Create's picks, the lead score bar), so they stay pinned exactly.
 *
 * The render assertions that stood beside these went with the `HeatGrade`
 * component in s76: the exact-mock rebuild moved that visual grammar into
 * Intel's own `pill pill-heat-*` chrome, which Intel's surface tests cover.
 * Nothing here needs a DOM any more.
 */
describe("heat grading (founder direction 2026-07-07)", () => {
  it("bands are pinned at their boundaries", () => {
    expect(heatBand(1)).toBe("hot");
    expect(heatBand(0.8)).toBe("hot");
    expect(heatBand(0.79)).toBe("rising");
    expect(heatBand(0.6)).toBe("rising");
    expect(heatBand(0.59)).toBe("warm");
    expect(heatBand(0.4)).toBe("warm");
    expect(heatBand(0.39)).toBe("cool");
    expect(heatBand(0)).toBe("cool");
  });

  it("scores outside 0–1 still band rather than falling through", () => {
    expect(heatBand(1.4)).toBe("hot");
    expect(heatBand(-0.2)).toBe("cool");
  });
});
