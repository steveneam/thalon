// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfilesSurface } from "../profiles-surface";

/**
 * STEP 1 of the two-step rebuild: a STRUCTURAL pin of the sheet's own bands
 * (docs/research/mock-sheets/Profiles.dc.html). No data is wired yet — step
 * 2's suite re-pins the same bands over the live profile, plus the config
 * carry the editor must never drop.
 */
describe("Profiles (exact-mock rebuild — Profiles.dc.html, step 1 port)", () => {
  it("renders the sheet's header band: title, the version pill and the provenance line", () => {
    render(<ProfilesSurface />);

    expect(screen.getByRole("heading", { name: "Profiles" })).toHaveClass("t-headline");
    expect(screen.getByText("editing → v5")).toHaveClass("pill", "pill-idle");
    expect(
      screen.getByText("runs pin the version they used — nothing rewrites history"),
    ).toHaveClass("t-label");
  });

  it("renders the sheet's three-column wizard: step rail, step card, powers card", () => {
    const { container } = render(<ProfilesSurface />);

    expect(container.querySelectorAll(".wiz-grid > .card")).toHaveLength(3);
    expect(Array.from(container.querySelectorAll(".step")).map((el) => el.textContent)).toEqual([
      "✓Company",
      "2Voice",
      "3Topics & audience",
      "4Platforms & cadence",
      "5Guardrails",
      "6Review · save v5",
    ]);
    expect(container.querySelector(".step.done")?.textContent).toBe("✓Company");
    expect(container.querySelector(".step.on")?.textContent).toBe("2Voice");
  });

  it("renders the Voice step exactly as the sheet draws it", () => {
    const { container } = render(<ProfilesSurface />);

    expect(screen.getByText("How should Thalon sound?")).toHaveClass("t-title");
    expect(
      Array.from(container.querySelectorAll(".field-label")).map((el) => el.textContent),
    ).toEqual([
      "Tone — pick up to three",
      "Voice sample — paste a post or paragraph that sounds like you",
      "Or point at writing you admire",
    ]);
    const chips = Array.from(container.querySelectorAll(".tone-chip"));
    expect(chips.map((el) => el.textContent)).toEqual([
      "Confident",
      "Concrete",
      "Playful",
      "No hype",
      "Technical",
      "Warm",
      "Contrarian",
    ]);
    expect(chips.filter((el) => el.classList.contains("on"))).toHaveLength(3);
    expect(
      screen.getByText("The engine drafts in this register — it never copies the sample."),
    ).toBeInTheDocument();
    expect(screen.getByText("Continue → Topics")).toHaveClass("btn", "btn-primary");
  });

  it("renders the powers card — what the profile actually arms, and the versioning promise", () => {
    const { container } = render(<ProfilesSurface />);

    expect(screen.getByText("What this profile powers")).toHaveClass("t-title");
    expect(
      Array.from(container.querySelectorAll(".powers-row b")).map((el) => el.textContent),
    ).toEqual(["Intel", "Leads", "Create", "The judge", "Calendar"]);
    expect(
      screen.getByText("Change anything later — a new version, never a rewrite."),
    ).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuilt surface speaks the sheet's classes", () => {
    const { container } = render(<ProfilesSurface />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass("content", "profiles-surface");
  });
});
