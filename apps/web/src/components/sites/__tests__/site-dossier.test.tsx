// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SiteDossier } from "@/components/sites/site-dossier";
import type { SiteRecord } from "@/lib/sites/catalog";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/sites/sparkwright",
  useRouter: () => ({ push: vi.fn() }),
}));

const SITE: SiteRecord = {
  slug: "sparkwright",
  name: "Sparkwright Electrical",
  vertical: "trade-electrician",
  oneLiner: "The switchboard people, after dark.",
  axes: { primary: "high-quality-3d", secondary: "cinematic-imagery" },
  axisNote: "the house is the instrument",
  paletteSeed: "dusk copper",
  typeDirection: "grotesque, tight",
  motionBudget: "one CSS-3D scene",
  wave: 3,
  built: "2026-07-16",
  verdict: { status: "fix-round", note: "grade stamp reads flat" },
  cardImage: "sparkwright/assets/hero-dusk.webp",
  assets: [
    { file: "hero-dusk.webp", width: 1920, height: 1080, hashTail: "a1b2c3d4" },
    { file: "portrait.webp", width: 1280, height: 1600, hashTail: "e5f6a7b8" },
  ],
};

/**
 * The dossier has NO sheet in the mock, so it is DESIGNED in the sheets'
 * language (the s74 Search precedent) using `Video Dossier.dc.html`'s
 * grammar. These pin two things: that it speaks that language, and that the
 * s61 dossier's every capability survived the re-expression.
 */
describe("SiteDossier (designed in the sheets' language — no Site Dossier sheet exists)", () => {
  it("wears the sheets' own chrome: headline doors, the dgrid, the record card", () => {
    const { container } = render(<SiteDossier site={SITE} />);

    expect(container.querySelector(".content.site-dossier-surface")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Sparkwright Electrical" })).toHaveClass(
      "t-headline",
    );
    expect(screen.getByRole("link", { name: "← Sites" })).toHaveAttribute("href", "/app/sites");
    expect(screen.getByText("Fix round")).toHaveClass("pill", "pill-warn");
    expect(screen.getByText("The switchboard people, after dark.")).toHaveClass("t-label");
    expect(container.querySelector(".dgrid")).not.toBeNull();
    expect(container.querySelectorAll(".dgrid > * .card-head")).not.toHaveLength(0);
  });

  it("keeps the live preview and its desktop/390 toggles", async () => {
    const user = userEvent.setup();
    const { container } = render(<SiteDossier site={SITE} />);

    const frame = container.querySelector("iframe")!;
    expect(frame).toHaveAttribute("src", "/api/sites/preview/sparkwright/index.html");
    expect(frame).toHaveAttribute("title", "Sparkwright Electrical — live preview");
    // Same-origin bytes, so the frame is sandboxed OUT of the workspace.
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame).toHaveClass("stage-frame");
    expect(frame).not.toHaveClass("phone");

    await user.click(screen.getByRole("button", { name: "390 px" }));
    expect(container.querySelector("iframe")).toHaveClass("stage-frame", "phone");
    expect(screen.getByRole("button", { name: "390 px" })).toHaveClass("seg-opt", "on");
  });

  it("keeps the manifest's mint facts — dimensions and the pinned-hash tail — now media-first", () => {
    const { container } = render(<SiteDossier site={SITE} />);

    const strip = container.querySelector(".strip")!;
    const tiles = strip.querySelectorAll(".clipcard");
    expect(tiles).toHaveLength(2);
    expect(screen.getByText("2 · each a deterministic derive of a pinned original")).toBeInTheDocument();

    expect(within(tiles[0] as HTMLElement).getByText("hero-dusk.webp")).toHaveClass("clip-cap");
    expect(within(tiles[0] as HTMLElement).getByText("1920×1080 · …a1b2c3d4")).toHaveClass(
      "clip-kind",
    );
    expect(tiles[0].querySelector("img")).toHaveAttribute(
      "src",
      "/api/sites/preview/sparkwright/assets/hero-dusk.webp",
    );
  });

  it("keeps the /guide links — the credits story stays on the page's own guide", () => {
    render(<SiteDossier site={SITE} />);

    const guide = screen.getByRole("link", { name: "How it was made" });
    expect(guide).toHaveAttribute("href", "/api/sites/preview/sparkwright/guide/index.html");
    expect(guide).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Open the site" })).toHaveAttribute(
      "href",
      "/api/sites/preview/sparkwright/index.html",
    );
  });

  it("states the whole record as one-line facts, and the verdict note verbatim", () => {
    const { container } = render(<SiteDossier site={SITE} />);

    const keys = Array.from(container.querySelectorAll(".fact-k")).map((k) => k.textContent);
    expect(keys).toEqual([
      "Vertical",
      "Primary axis",
      "Secondary axis",
      "Wave",
      "Built",
      "Verdict",
      "How it was made",
    ]);
    expect(screen.getByText("Fix round — grade stamp reads flat")).toHaveClass("fact-v");
  });

  it("gives the design brief its own card — a .fact-row holds a line, not a paragraph", () => {
    // The catalog's axis note / palette seed / type / motion budget run to
    // hundreds of characters each. In the 320px rail they keep the class and
    // destroy the density it exists for, so they read in the wide column.
    const { container } = render(<SiteDossier site={SITE} />);

    const rows = Array.from(container.querySelectorAll(".brief-row"));
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual([
      "Axis note",
      "Palette seed",
      "Type",
      "Motion budget",
    ]);
    // Nothing is dropped and nothing is truncated on the way across.
    expect(screen.getByText("the house is the instrument")).toHaveClass("t-body", "muted");
    expect(screen.getByText("one CSS-3D scene")).toBeInTheDocument();
    // …and none of it leaks back into the rail's one-line facts.
    expect(container.querySelector(".dgrid > .card .brief-row")).toBeNull();
  });

  it("drops the brief card entirely when the record carries no brief", () => {
    const { container } = render(
      <SiteDossier
        site={{
          ...SITE,
          axisNote: undefined,
          paletteSeed: undefined,
          typeDirection: undefined,
          motionBudget: undefined,
        }}
      />,
    );

    expect(container.querySelector(".brief-row")).toBeNull();
    expect(screen.queryByText("The design brief")).not.toBeInTheDocument();
  });

  it("marks a fact as a door only when it opens something", () => {
    const { container } = render(<SiteDossier site={SITE} />);

    const doors = Array.from(container.querySelectorAll("a.fact-row")).map((row) => [
      row.querySelector(".fact-k")?.textContent,
      row.getAttribute("href"),
    ]);
    expect(doors).toEqual([
      ["Vertical", "/app/sites?vertical=trade-electrician"],
      ["Primary axis", "/app/sites?axis=high-quality-3d"],
      ["Secondary axis", "/app/sites?axis=cinematic-imagery"],
      ["Wave", "/app/sites?wave=3"],
      ["How it was made", "/api/sites/preview/sparkwright/guide/index.html"],
    ]);
    // A row with nothing behind it never wears an arrow.
    for (const row of container.querySelectorAll("div.fact-row")) {
      expect(row.querySelector(".tile-arrow")).toBeNull();
    }
  });

  it("says a page with no minted assets draws itself, rather than showing an empty strip", () => {
    const { container } = render(<SiteDossier site={{ ...SITE, assets: [] }} />);

    expect(screen.getByText(/none on the manifest — this page draws everything in code/)).toBeInTheDocument();
    expect(container.querySelector(".strip")).toBeNull();
  });

  it("defaults an unverdicted site DOWN to awaiting, never quietly fine", () => {
    render(<SiteDossier site={{ ...SITE, verdict: undefined }} />);

    expect(screen.getAllByText("Awaiting verdict")[0]).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheets' own classes", () => {
    const { container } = render(<SiteDossier site={SITE} />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
    expect(container.innerHTML).not.toContain("127.0.0.1");
  });
});
