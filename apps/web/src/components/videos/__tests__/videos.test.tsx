// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideosOverview } from "@/components/videos/videos";

/**
 * STEP 1 of the two-step rebuild: the structural pin of Videos
 * Overview.dc.html. Every assertion here is a band, a class or a copy line
 * the sheet itself draws — step 2 keeps this shape and puts the real
 * project list behind it.
 */
describe("VideosOverview (exact-mock rebuild — Videos Overview.dc.html, step 1)", () => {
  it("renders the sheet's bands: headline row, import band, project grid, record line", () => {
    const { container } = render(<VideosOverview />);

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.videos-surface")).not.toBeNull();

    expect(screen.getByRole("heading", { name: "Videos" })).toBeInTheDocument();
    expect(screen.getByText("5 projects")).toHaveClass("pill", "pill-idle");
    expect(Array.from(container.querySelectorAll(".seg .seg-opt")).map((el) => el.textContent)).toEqual(
      ["All", "Published", "In review", "Drafts"],
    );
    expect(container.querySelector(".seg .seg-opt.on")?.textContent).toBe("All");
    expect(screen.getByRole("button", { name: "Import media" })).toHaveClass("btn", "btn-ghost");
    expect(screen.getByRole("button", { name: "+ New video" })).toHaveClass("btn", "btn-primary");

    expect(container.querySelector(".imp .imp-box")?.textContent).toContain("Bring your own.");
    expect(screen.getByRole("button", { name: "Browse files" })).toHaveClass("btn", "btn-ghost");

    // Five fixture cards + the new-project card.
    expect(container.querySelectorAll(".vgrid > .vcard")).toHaveLength(5);
    expect(container.querySelectorAll(".vgrid > .newcard")).toHaveLength(1);
    expect(screen.getByText("One prompt → a full cut")).toHaveClass("t-label");

    // The thumbnail stays the sheet's striped placeholder (founder s75).
    expect(screen.getByText("poster · beat 04").closest(".thumb-lg")).not.toBeNull();
    expect(screen.getByText("0:42")).toHaveClass("dur");
    // A project with no assembled runtime draws no badge at all.
    expect(screen.getByText("composing · beat 4/8").parentElement?.querySelector(".dur")).toBeNull();

    expect(screen.getByText("One-prompt launch film")).toHaveClass("t-title");
    expect(screen.getByText("in Approve")).toHaveClass("pill", "pill-warn");
    expect(screen.getByText("published")).toHaveClass("pill", "pill-ok");
    expect(screen.getByText("one-prompt · kling3 turbo")).toHaveClass("prov");
    // The family line: doors dotted, a stateless fact plainly subtle.
    expect(screen.getByText("2 versions")).toHaveClass("fam-link");
    expect(screen.getByText("clips follow the cut")).toHaveClass("subtle");

    expect(
      screen.getByText(/Derivatives never clutter this grid/),
    ).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<VideosOverview />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
