// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadsBoard } from "@/components/leads/leads-board";
import { LEAD_BOARD_COLUMNS, leadColumnLabel } from "@/components/leads/leads-model";

/**
 * STEP 1 of the leads-board rebuild (founder-directed s75): the STRUCTURAL
 * verdict point. These pin the shape and the honesty, not data — step 2 wires
 * it and will replace the placeholder assertions with real-lead ones.
 */
describe("Leads board — step 1 (structure, unwired)", () => {
  it("draws one column per NON-TERMINAL lead status, derived from the contract", () => {
    const { container } = render(<LeadsBoard />);
    const heads = Array.from(container.querySelectorAll(".col-hd span:first-child")).map(
      (el) => el.textContent,
    );
    expect(heads).toEqual(LEAD_BOARD_COLUMNS.map(leadColumnLabel));
    // Terminal states are never columns — they are not drop targets.
    expect(heads).not.toContain("Dismissed");
    expect(heads).not.toContain("Unsubscribed");
    expect(LEAD_BOARD_COLUMNS).toHaveLength(3);
  });

  it("counts read '–' rather than a real-looking zero while unwired", () => {
    const { container } = render(<LeadsBoard />);
    const counts = Array.from(container.querySelectorAll(".col-ct")).map((el) => el.textContent);
    expect(counts).toEqual(["–", "–", "–"]);
    expect(counts).not.toContain("0");
  });

  it("says plainly that it is not wired, so placeholders are never mistaken for data", () => {
    render(<LeadsBoard />);
    expect(screen.getByText(/isn’t wired yet/)).toBeInTheDocument();
    expect(screen.getByText(/the cards above are placeholders/)).toBeInTheDocument();
  });

  it("offers no drag affordance, and states why", () => {
    const { container } = render(<LeadsBoard />);
    expect(container.querySelector("[draggable='true']")).toBeNull();
    expect(screen.getByText(/would fake a control you don’t have/)).toBeInTheDocument();
  });

  it("placeholder cards are hidden from assistive tech — they carry no information", () => {
    const { container } = render(<LeadsBoard />);
    const cards = Array.from(container.querySelectorAll(".l-card"));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card).toHaveAttribute("aria-hidden", "true");
  });

  it("every column body is a real column, so step 2 has somewhere to put cards", () => {
    const { container } = render(<LeadsBoard />);
    const cols = Array.from(container.querySelectorAll(".col"));
    expect(cols).toHaveLength(LEAD_BOARD_COLUMNS.length);
    for (const col of cols) {
      expect(col.querySelector(".col-bd")).not.toBeNull();
      expect(within(col as HTMLElement).getByText("–")).toHaveClass("col-ct");
    }
  });
});
