// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { heatBand, HeatGrade } from "@/components/intel/heat-grade";

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

  it("renders the thermal pill + magnitude bar, with the exact score demoted to tooltip/aria", () => {
    render(<HeatGrade score={0.66} />);
    const grade = screen.getByRole("img", { name: "heat rising — rank score 0.66 of 1" });
    expect(grade).toHaveAttribute("title", "rank score 0.66 (0–1) for this area");
    // The band word rides INSIDE the coloured pill — never colour-alone.
    expect(grade.querySelector(".bg-heat-3.text-heat-ink")).toHaveTextContent("rising");
    // The bar keeps within-band nuance — the fill is 66% of the track.
    expect(grade.querySelector("[data-heat-bar]")).toHaveStyle({ width: "66%" });
    // The number itself is NOT visible text on the card.
    expect(grade).not.toHaveTextContent("0.66");
  });

  it("clamps out-of-range scores instead of overflowing the track", () => {
    render(<HeatGrade score={1.4} />);
    const grade = screen.getByRole("img", { name: "heat hot — rank score 1.00 of 1" });
    expect(grade.querySelector("[data-heat-bar]")).toHaveStyle({ width: "100%" });
    expect(grade.querySelector(".bg-heat-4.text-heat-paper")).toHaveTextContent("hot");
  });
});
