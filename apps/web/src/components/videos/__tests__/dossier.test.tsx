// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoDossier } from "@/components/videos/dossier";

/**
 * STEP 1 of the two-step rebuild: the structural pin of Video
 * Dossier.dc.html. Every assertion here is a band, a class or a copy line
 * the sheet itself draws — step 2 keeps this shape and puts the real
 * project record behind it.
 */
describe("VideoDossier (exact-mock rebuild — Video Dossier.dc.html, step 1)", () => {
  it("renders the sheet's bands: title row, version strip, player + clips, the record", () => {
    const { container } = render(<VideoDossier />);

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.dossier-surface")).not.toBeNull();

    expect(screen.getByRole("link", { name: "← Videos" })).toHaveAttribute("href", "/app/videos");
    expect(screen.getByRole("heading", { name: "One-prompt launch film" })).toBeInTheDocument();
    // "in Approve" appears twice in the sheet — the project's own state pill
    // and one clip's platform chip — so this one is pinned by its band.
    expect(
      screen.getByRole("heading", { name: "One-prompt launch film" }).nextElementSibling,
    ).toHaveClass("pill", "pill-warn");
    expect(screen.getByRole("button", { name: "Open in editor" })).toHaveClass("btn", "btn-ghost");
    expect(screen.getByRole("button", { name: "Send cut to Approve" })).toHaveClass(
      "btn",
      "btn-primary",
    );

    // The attributed version strip — three versions, the picked one marked,
    // two arrows between them, and the re-brief tile last.
    expect(screen.getByText("attributed — every version names what changed it")).toHaveClass(
      "t-label",
    );
    expect(container.querySelectorAll(".ver-strip .ver")).toHaveLength(4);
    expect(container.querySelectorAll(".ver-strip .ver.on")).toHaveLength(1);
    expect(container.querySelectorAll(".ver-strip .ver-arrow")).toHaveLength(2);
    expect(screen.getByText("Cut v1 · 42.3s").closest(".ver")).toHaveClass("on");
    expect(screen.getByText("one-prompt run · 9 takes · today")).toHaveClass("ver-a");
    expect(screen.getByText("+ Re-brief")).toBeInTheDocument();

    // Player: the sheet's own resting scrub — 0:00 of 0:42.3, nothing played.
    const player = container.querySelector(".player")!;
    expect(within(player as HTMLElement).getByText("0:00.0")).toHaveClass("t-data");
    expect(player.querySelector(".play-btn .play-tri")).not.toBeNull();
    expect(player.querySelector<HTMLElement>(".bar-fill")?.style.width).toBe("0%");

    // Clips strip — four cards, each a thumb + caption + kind + platform chips.
    expect(container.querySelectorAll(".strip .clipcard")).toHaveLength(4);
    expect(screen.getByText("Hook clip · 0:09")).toHaveClass("clip-cap");
    expect(screen.getByText("cut-down · beats 01–02")).toHaveClass("clip-kind");
    expect(screen.getByText("LinkedIn ✓ live")).toHaveClass("pchip", "pill-ok");

    // The record — six facts, every one a door.
    expect(screen.getByText("every fact is a door")).toHaveClass("t-label");
    expect(container.querySelectorAll(".fact-row")).toHaveLength(6);
    expect(screen.getByText("Judge")).toHaveClass("fact-k");
    expect(screen.getByText(/gates, never rewrites/)).toHaveClass("fact-v");

    expect(screen.getByText(/One dimension per band/)).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<VideoDossier />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
