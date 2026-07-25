// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sites } from "@/components/sites/sites";

/**
 * STEP 1 of the two-step rebuild: the structural pin of Sites.dc.html. Every
 * assertion here is a band, a class or a copy line the sheet itself draws —
 * step 2 keeps this shape and puts the real catalog behind it.
 */
describe("Sites (exact-mock rebuild — Sites.dc.html, step 1)", () => {
  it("renders the sheet's bands: headline pills, build card, site grid, record line", () => {
    const { container } = render(<Sites />);

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.sites-surface")).not.toBeNull();

    expect(screen.getByRole("heading", { name: "Sites" })).toBeInTheDocument();
    expect(screen.getByText("17 built")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("2 live")).toHaveClass("pill", "pill-ok");

    expect(container.querySelector(".prompt-box")?.textContent).toContain(
      "A landing page for…",
    );
    expect(screen.getByRole("button", { name: "Build site" })).toHaveClass("btn", "btn-primary");
    expect(screen.getByText("Or start from the portfolio —")).toHaveClass("t-label");
    expect(Array.from(container.querySelectorAll(".cat-chip")).map((el) => el.textContent)).toEqual([
      "Café · warm",
      "Trades · competence",
      "Restaurant · cinematic",
      "Distributor · editorial",
      "Studio · kinetic",
      "More →",
    ]);

    expect(container.querySelectorAll(".site-grid > .site-card")).toHaveLength(6);
    expect(screen.getAllByText("site preview · hero")).toHaveLength(6);
    expect(screen.getAllByText("Dossier →")).toHaveLength(6);
    expect(screen.getByText("Sparkwright").nextElementSibling).toHaveClass("pill", "pill-ok");
    expect(screen.getByText("First Crack").nextElementSibling).toHaveClass("pill", "pill-idle");

    expect(
      screen.getByText(
        "Every site carries its record — prompt, plan, mint ledger, verdicts — in its dossier.",
      ),
    ).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<Sites />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
