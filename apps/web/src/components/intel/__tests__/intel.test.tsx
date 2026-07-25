// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Intel } from "@/components/intel/intel";

describe("Intel (exact-mock rebuild, Intel.dc.html — step 1: the pure port)", () => {
  it("renders the sheet's bands: header + tabs, watching chips, dossier, more rising", () => {
    render(<Intel />);

    // Header band: headline, the rising pill, both tabs, the sweep stamp.
    expect(screen.getByRole("heading", { name: "Intel", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("4 rising")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trends" })).toHaveClass("tab", "on");
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText(/Swept 2h ago · next in 4h/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sweep now" })).toBeInTheDocument();

    // Watching band: one chip per area + the dashed add chip.
    expect(screen.getByText("Watching")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI content automation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add area or keyword" })).toBeInTheDocument();

    // Dossier card: thermal word-in-pill, outlier, catchable stamp, exits.
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.getByText("Outlier")).toBeInTheDocument();
    expect(screen.getByText("rising 3h · catchable")).toBeInTheDocument();
    expect(screen.getByText("Why it’s moving")).toBeInTheDocument();
    expect(screen.getByText("Velocity 0.92")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create video · suggested/ })).toBeInTheDocument();
    expect(screen.getByText(/the pick rides along/)).toBeInTheDocument();

    // The sheet marks the first title and leaves the angle unmarked.
    const titles = screen.getAllByRole("radio", { name: /Video as a build step/ });
    expect(titles[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Angle · editor-vs-pipeline/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // More rising: the bounded row list with its count.
    expect(screen.getByText("More rising")).toBeInTheDocument();
    expect(screen.getByText("3 cards")).toBeInTheDocument();
    expect(screen.getByText("YouTube · 12.1k · 5h ago")).toBeInTheDocument();
  });
});
