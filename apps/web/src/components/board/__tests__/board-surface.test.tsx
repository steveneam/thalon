// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardSurface } from "@/components/board/board-surface";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/board",
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * STEP 1 of the two-step rebuild: this pins the PURE PORT of
 * docs/research/mock-sheets/Board.dc.html — the sheet's bands, in the sheet's
 * own classes, with the sheet's placeholder content. It is deliberately
 * structural: there is no data wiring to assert yet.
 *
 * This surface had no old implementation to replace: the Dashboard drew the
 * Board option as a dead label ("lands with its exact-mock rebuild") until
 * this commit made it a door.
 *
 * Step 2 wires the six columns to the real pipeline read.
 */
describe("Pipeline board (exact-mock rebuild step 1 — pure port of Board.dc.html)", () => {
  it("renders the sheet's header: Today, the Overview·Board control, the column line", () => {
    const { container } = render(<BoardSurface />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual([
      "Overview",
      "Board",
    ]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("Board");
    expect(
      screen.getByText("the pipeline as columns — cards move when the work moves"),
    ).toBeInTheDocument();
  });

  it("renders the sheet's six columns, in order, with their counts", () => {
    const { container } = render(<BoardSurface />);

    const heads = Array.from(container.querySelectorAll(".col-hd"));
    expect(heads.map((el) => el.firstChild?.textContent)).toEqual([
      "Intel picks",
      "Composing",
      "At the judge",
      "Waiting on you",
      "Approved",
      "Planned",
    ]);
    expect(heads.map((el) => el.querySelector(".col-ct")?.textContent)).toEqual([
      "2",
      "1",
      "1",
      "4",
      "2",
      "3",
    ]);
    expect(container.querySelectorAll(".cols > .col")).toHaveLength(6);
  });

  it("renders the sheet's card grammar: media where media exists, heat on intel picks", () => {
    const { container } = render(<BoardSurface />);

    // Thirteen cards; the five that reference media carry the striped thumb
    // with its mono explainer (the media-first grammar).
    expect(container.querySelectorAll(".k-card")).toHaveLength(13);
    expect(
      Array.from(container.querySelectorAll(".k-thumb span")).map((el) => el.textContent),
    ).toEqual(["post media", "yt thumb", "clip frame", "post image", "page hero"]);

    expect(screen.getByText("Hot")).toHaveClass("pill", "pill-heat-hot");
    expect(screen.getByText("Rising")).toHaveClass("pill", "pill-heat-rising");
    expect(screen.getAllByText("door unarmed — a plan")).toHaveLength(3);
  });

  it("dresses the waiting column in the needs-you signal — amber is needs-you ONLY", () => {
    const { container } = render(<BoardSurface />);

    const waiting = Array.from(container.querySelectorAll(".col")).find((col) =>
      col.querySelector(".col-hd")?.textContent?.startsWith("Waiting on you"),
    ) as HTMLElement;
    expect(waiting).toHaveStyle({ borderColor: "color-mix(in oklab, var(--warn) 35%, var(--n-400))" });
    expect(waiting.querySelector(".col-ct")).toHaveStyle({ color: "var(--warn)" });
    // A blocked card states it in the error channel, not in amber.
    expect(screen.getByText("Works with every platform — blocked")).toHaveStyle({
      color: "var(--err)",
    });
  });

  it("carries no legacy bridge styling — the port is the sheet's classes only", () => {
    const { container } = render(<BoardSurface />);
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    // Rule 6: the surface root carries its scope class beside .content.
    expect(container.querySelector(".content.board-surface")).not.toBeNull();
  });
});
