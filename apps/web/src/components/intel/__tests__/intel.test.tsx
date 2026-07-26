// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Intel } from "@/components/intel/intel";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { server } from "@/lib/testing/server";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/intel",
  useRouter: () => ({ push }),
}));

/** The live era: a merged read across two swept sources, no demo dataset. */
function liveTrends() {
  return http.get("/api/intel/trends", () =>
    HttpResponse.json({
      areas: [],
      cards: [{ ...fixtureTrendCards[2], source: "youtube", thumbnailUrl: "https://i.example/t.jpg" }],
      demo: false,
      sweep: {
        lastSweptAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        intervalHours: 4,
        nextSweepAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      },
      sources: [
        { source: "youtube", lastSweptAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), cards: 1 },
        { source: "bluesky", lastSweptAt: new Date(Date.now() - 9 * 3_600_000).toISOString(), cards: 0 },
      ],
    }),
  );
}

describe("Intel (exact-mock rebuild, Intel.dc.html)", () => {
  it("renders the sheet's bands on the real read: header, watching, dossier, more rising", async () => {
    render(<Intel />);

    // Header: headline, the live count pill, both tabs, the sweep stamp.
    expect(screen.getByRole("heading", { name: "Intel", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("4 rising")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trends" })).toHaveClass("tab", "on");
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sweep now" })).toBeEnabled();

    // Watching band: the sheet's dashed add chip is the door to the areas.
    expect(screen.getByText("Watching")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add area or keyword" })).toBeInTheDocument();

    // The dossier is the TOP-RANKED card (0.90), with the sheet's own bands.
    const dossier = within(screen.getByLabelText("Top rising trend"));
    expect(dossier.getByText("Hot")).toBeInTheDocument();
    expect(dossier.getByText("Outlier")).toBeInTheDocument();
    expect(dossier.getByText(/Rendered our whole launch video from HTML/)).toBeInTheDocument();
    expect(dossier.getByText("@framecraft.example")).toBeInTheDocument();
    expect(dossier.getByText("24.6k views")).toBeInTheDocument();
    expect(dossier.getByRole("link", { name: /Original post/ })).toHaveAttribute(
      "href",
      "https://example.com/demo/3kx3",
    );

    // Why it's moving: the ranker's own signals, verbatim in the hover title.
    expect(dossier.getByText("Why it’s moving")).toBeInTheDocument();
    expect(dossier.getByText("Velocity 0.92")).toBeInTheDocument();
    expect(screen.getByTitle(/velocity 0.92 \(sweep 8210.5 views\/h/)).toBeInTheDocument();

    // More rising: the other three cards, bounded, each with its data stamp.
    expect(screen.getByText("More rising")).toBeInTheDocument();
    expect(screen.getByText("3 cards")).toBeInTheDocument();
    expect(screen.getByText(/Bluesky · 27.7k · /)).toBeInTheDocument();
  });

  it("names the demo era in the stamp — a fake driver is never implied live", async () => {
    render(<Intel />);
    expect(await screen.findByText(/demo dataset — no live sweep yet/)).toBeInTheDocument();
  });

  it("names the swept platforms once the sweeps are real, per-source truth in the title", async () => {
    server.use(liveTrends());
    render(<Intel />);
    const stamp = await screen.findByText(/YouTube \+ Bluesky/);
    expect(stamp).toHaveAttribute(
      "title",
      "YouTube: 1 cards, swept 2h ago\nBluesky: 0 cards, swept 9h ago",
    );
    expect(stamp.textContent).toMatch(/^Swept 2h ago · next in 2h/);
  });

  it("shows platform media when the driver captured it, the placeholder when it didn't", async () => {
    server.use(liveTrends());
    const live = render(<Intel />);
    await screen.findByText(/YouTube \+ Bluesky/);
    // Decorative by design (alt=""), so it is queried structurally.
    expect(live.container.querySelector("img")).toHaveAttribute("src", "https://i.example/t.jpg");
    live.unmount();

    // The demo dataset carries no thumbnails — nothing is synthesized, and the
    // sheet's striped placeholder keeps its legend instead.
    server.resetHandlers();
    const demo = render(<Intel />);
    expect(await screen.findByText("post media")).toBeInTheDocument();
    expect(demo.container.querySelector("img")).toBeNull();
  });

  it("promotes through the capture door — the pre-picked exit follows the DATA, not the sheet", async () => {
    const user = userEvent.setup();
    render(<Intel />);
    // The top card is a Bluesky post, so the suggested exit is Post (the
    // sheet's own card was video-native and drew "Create video · suggested").
    const suggested = await screen.findByRole("button", { name: "Create post · suggested" });
    expect(suggested).toHaveAttribute(
      "title",
      "pre-picked: thread-shaped topics compose best as posts",
    );
    await user.click(suggested);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/app/create?ctx=intel-capture-"));
  });

  it("dismisses through the capture door and hands the dossier to the next card", async () => {
    const user = userEvent.setup();
    render(<Intel />);
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));
    // The 0.90 card is gone; the 0.87 card takes the dossier and the count drops.
    expect(await screen.findByText("3 rising")).toBeInTheDocument();
    expect(screen.queryByText(/Rendered our whole launch video from HTML/)).not.toBeInTheDocument();
    expect(screen.getByText(/We let an agent draft every product update/)).toBeInTheDocument();
  });

  it("carries the one list keyboard grammar: j/k select a rising row, ↵ opens it", async () => {
    render(<Intel />);
    expect(await screen.findByText("More rising")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "j" });
    const rows = within(screen.getByLabelText("More rising"));
    // j lands on the first rising row (0.87), k would walk back up.
    const first = rows.getByText(/We let an agent draft every product update/);
    // Selection is the sheet's own .row.sel — never a bespoke recipe.
    expect(first.closest(".row")).toHaveClass("sel");

    fireEvent.keyDown(window, { key: "Enter" });
    // ↵ opens it into the dossier above, where it carries the full band set.
    const dossier = within(await screen.findByLabelText("Top rising trend"));
    expect(dossier.getByText(/We let an agent draft every product update/)).toBeInTheDocument();
    expect(dossier.getByText("Ready to create")).toBeInTheDocument();
  });

  it("a failed read is an alert with retry, never an empty watch", async () => {
    server.use(http.get("/api/intel/trends", () => HttpResponse.error()));
    render(<Intel />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/read failure, not a quiet watch/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("surfaces a driver refusal verbatim instead of a fake spinner", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/intel/sweep", () =>
        HttpResponse.json({ error: "bluesky driver refused: no credentials" }, { status: 502 }),
      ),
    );
    render(<Intel />);
    await user.click(await screen.findByRole("button", { name: "Sweep now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "bluesky driver refused: no credentials",
    );
  });

  it("keeps Search reachable behind the sheet's second tab", async () => {
    const user = userEvent.setup();
    render(<Intel />);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("tab", "on");
    expect(await screen.findByText("Keyword targets")).toBeInTheDocument();
    // Trends-only chrome leaves with the tab — no stamp for a surface it can't stamp.
    expect(screen.queryByRole("button", { name: "Sweep now" })).not.toBeInTheDocument();
  });

  /**
   * Founder-reported, s77: "the buttons cant be deselected and so on".
   * An angle is the operator's OPTIONAL extra — this component said so in
   * prose while making unpicked unreachable once anything was picked.
   */
  it("lets an angle be UNPICKED, because riding without one is a real choice", async () => {
    const user = userEvent.setup();
    render(<Intel />);
    const angles = await screen.findByRole("radiogroup", { name: "Suggested angles" });
    const angle = within(angles).getAllByRole("radio")[0];
    expect(angle).toHaveAttribute("aria-checked", "false");

    await user.click(angle);
    expect(angle).toHaveAttribute("aria-checked", "true");

    await user.click(angle);
    expect(angle).toHaveAttribute("aria-checked", "false");
  });

  /** A title always rides, so exactly one stays marked — clicking it again is a no-op. */
  it("keeps a title always picked — the required half of the pair does not toggle off", async () => {
    const user = userEvent.setup();
    render(<Intel />);
    const group = await screen.findByRole("radiogroup", { name: "Ready titles" });
    const first = within(group).getAllByRole("radio")[0];
    expect(first).toHaveAttribute("aria-checked", "true");
    await user.click(first);
    expect(first).toHaveAttribute("aria-checked", "true");
  });

});
