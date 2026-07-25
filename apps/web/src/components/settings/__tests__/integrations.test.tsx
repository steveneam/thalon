// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Integrations } from "@/components/settings/integrations";

/**
 * STEP 1 of the two-step rebuild: the structural pin of Integrations.dc.html.
 * Every assertion here is a band, a class or a copy line the sheet itself
 * draws — step 2 keeps this shape and puts the engine's card derivation
 * behind it.
 */
describe("Integrations (exact-mock rebuild — Integrations.dc.html, step 1)", () => {
  it("renders the sheet's bands: breadcrumbed headline, destination grid, the AI seat card", () => {
    const { container } = render(<Integrations />);

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.settings-surface")).not.toBeNull();

    expect(screen.getByText("Settings ›")).toHaveClass("t-label");
    expect(screen.getByRole("heading", { name: "Integrations" })).toHaveClass("t-headline");
    expect(screen.getByRole("button", { name: "Published · 4 items →" })).toHaveClass("card-link");

    const cards = container.querySelectorAll(".int-grid > .int-card");
    expect(cards).toHaveLength(9);
    const linkedin = cards[0] as HTMLElement;
    expect(within(linkedin).getByText("in")).toHaveClass("plat-ico");
    expect(within(linkedin).getByText("LinkedIn")).toHaveClass("int-name");
    expect(within(linkedin).getByText("Connected")).toHaveClass("pill", "pill-ok");
    expect(
      within(linkedin).getByText("Posting as Steven · validated against the live API version"),
    ).toHaveClass("int-sub");
    expect(within(linkedin).getByRole("button", { name: "Validate" })).toHaveClass(
      "btn",
      "btn-ghost",
      "btn-sm",
    );
    expect(within(linkedin).getByRole("button", { name: "Disconnect" })).toHaveClass(
      "btn",
      "btn-quiet",
      "btn-sm",
    );

    // The sheet's own state vocabulary, verbatim.
    expect(screen.getByText("Connected via env")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("Not connected")).toHaveClass("pill", "pill-idle");
    expect(screen.getAllByText("Intel connected")).toHaveLength(2);

    expect(screen.getByText("Your AI")).toHaveClass("t-title");
    expect(screen.getByText("3 model seats")).toHaveClass("pill", "pill-idle");
    expect(
      screen.getByText("bring-your-own connect arrives with the BYO-AI bucket"),
    ).toHaveClass("t-label");
    expect(Array.from(container.querySelectorAll(".seat-row")).map((r) => r.firstChild?.textContent)).toEqual([
      "Draft seat",
      "Judge seat",
      "Embed seat",
    ]);
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<Integrations />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
