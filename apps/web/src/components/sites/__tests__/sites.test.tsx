// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sites } from "@/components/sites/sites";
import type { SiteRecord } from "@/lib/sites/catalog";
import type { SitesSource } from "@/lib/sites/provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/sites",
  useRouter: () => ({ push }),
}));

function site(overrides: Partial<SiteRecord> & Pick<SiteRecord, "slug" | "name">): SiteRecord {
  return {
    vertical: "trade-electrician",
    oneLiner: "",
    axes: { primary: "high-quality-3d" },
    wave: 3,
    assets: [],
    cardImage: `${overrides.slug}/assets/hero.webp`,
    ...overrides,
  };
}

const RECORDS: SiteRecord[] = [
  site({
    slug: "sparkwright",
    name: "Sparkwright Electrical",
    verdict: { status: "approved" },
  }),
  site({
    slug: "ridge-and-valley",
    name: "Ridge & Valley",
    vertical: "trade-roofing",
    axes: { primary: "brutalist-raw", secondary: "cinematic-imagery" },
    wave: 3,
  }),
  site({
    slug: "first-crack",
    name: "First Crack",
    vertical: "food-coffee-roastery",
    axes: { primary: "data-instrument" },
    wave: 2,
    verdict: { status: "fix-round" },
    cardImage: undefined,
  }),
];

const LOCAL: SitesSource = {
  kind: "local",
  records: RECORDS,
  previewOrigin: "http://127.0.0.1:8899",
};

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (pinned structurally
 * below) now carry the real catalog. These pin the honesty rules — a
 * fabricated state word, a dead door, or a read failure dressed as an empty
 * portfolio is a failure.
 */
describe("Sites (exact-mock rebuild — Sites.dc.html)", () => {
  it("renders the sheet's bands with the real portfolio behind them", () => {
    const { container } = render(<Sites source={LOCAL} />);

    expect(container.querySelector(".content.sites-surface")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Sites" })).toBeInTheDocument();
    expect(screen.getByText("3 built")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("1 approved")).toHaveClass("pill", "pill-ok");

    // The grid is the sheet's: a shot over a meta row, the whole card a door.
    const cards = container.querySelectorAll(".site-grid > .site-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("href", "/app/sites/sparkwright");
    expect(within(cards[0] as HTMLElement).getByText("Dossier →")).toHaveClass("card-link");

    // Media-first: a record with a hero shows it; one without keeps the
    // sheet's striped placeholder rather than an empty box.
    expect(cards[0].querySelector("img")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8899/sparkwright/assets/hero.webp",
    );
    expect(cards[2].querySelector("img")).toBeNull();
    expect(within(cards[2] as HTMLElement).getByText("site preview · hero")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Every site carries its record — prompt, plan, mint ledger, verdicts — in its dossier.",
      ),
    ).toHaveClass("t-label");
    // Visible provenance: which origin answered, right on the surface.
    expect(screen.getByText(/local template dir · previews from/)).toHaveClass("t-data");
  });

  it("the state pill says what the catalog RECORDS — the verdict, never an invented deploy state", () => {
    render(<Sites source={LOCAL} />);

    expect(screen.getByText("Approved")).toHaveClass("pill", "pill-ok");
    expect(screen.getByText("Fix round")).toHaveClass("pill", "pill-warn");
    // A site with no verdict is loudly awaiting, never quietly fine.
    expect(screen.getByText("Awaiting verdict")).toHaveClass("pill", "pill-idle");
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("the build door states its seam instead of offering a dead primary button", () => {
    render(<Sites source={LOCAL} />);

    expect(screen.getByRole("button", { name: "Build site" })).toBeDisabled();
    expect(screen.getByLabelText("Describe the site to build")).toBeDisabled();
    expect(screen.getByText(/Building from a prompt isn’t wired to this surface yet/)).toBeInTheDocument();
  });

  it("the chips are the catalog's own vocabulary: they filter, and More → reveals the rest", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sites source={LOCAL} />);

    const chips = () => Array.from(container.querySelectorAll(".cat-chip")).map((c) => c.textContent);
    expect(chips()).toContain("Trade · electrician");
    expect(chips()).toContain("More →");
    // Bounded at rest: the sheet draws five, the rest wait behind More →.
    expect(chips().filter((c) => c !== "More →")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "Trade · electrician" }));
    expect(screen.getByRole("button", { name: "Trade · electrician" })).toHaveClass("cat-chip", "on");
    expect(container.querySelectorAll(".site-grid > .site-card")).toHaveLength(1);
    expect(screen.getByText("1 of 3 built")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More →" }));
    expect(chips()).toContain("Wave 2");
    // Kinds are independent: a wave pick on top of the vertical empties the
    // slice, and the surface says so instead of showing an empty grid.
    await user.click(screen.getByRole("button", { name: "Wave 2" }));
    expect(container.querySelector(".site-grid")).toBeNull();
    expect(screen.getByText(/No sites match these chips/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(container.querySelectorAll(".site-grid > .site-card")).toHaveLength(3);
  });

  it("keeps the one list keyboard grammar — nothing selected at rest, j/k move, ↵ opens", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sites source={LOCAL} />);

    expect(container.querySelector(".site-card.sel")).toBeNull();

    await user.keyboard("j");
    expect(container.querySelectorAll(".site-card")[0]).toHaveClass("sel");
    await user.keyboard("j");
    expect(container.querySelectorAll(".site-card")[1]).toHaveClass("sel");
    await user.keyboard("k");
    expect(container.querySelectorAll(".site-card")[0]).toHaveClass("sel");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/app/sites/sparkwright");
  });

  it("an unconfigured origin is a missing setting that names its fix, never an empty portfolio", () => {
    const { container } = render(<Sites source={{ kind: "unconfigured" }} />);

    expect(screen.getByText("no origin configured")).toHaveClass("pill", "pill-idle");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/a missing setting, not an empty portfolio/);
    expect(within(alert).getByText("SITES_BASE_URL")).toBeInTheDocument();
    expect(container.querySelector(".site-grid")).toBeNull();
    expect(screen.queryByText(/built$/)).not.toBeInTheDocument();
  });

  it("a failing origin shows the error it got — a read failure is never a quiet zero", () => {
    render(<Sites source={{ kind: "error", message: "sites origin answered 502" }} />);

    expect(screen.getByText("origin unreachable")).toHaveClass("pill", "pill-err");
    expect(screen.getByRole("alert")).toHaveTextContent(
      /sites origin answered 502 — a read failure, not an empty portfolio/,
    );
  });

  it("an empty catalog says the origin answered, not that the read failed", () => {
    render(<Sites source={{ kind: "remote", records: [], previewOrigin: "https://sites.example" }} />);

    expect(screen.getByText("0 built")).toBeInTheDocument();
    expect(screen.getByText(/answered with an empty catalog/)).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<Sites source={LOCAL} />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
