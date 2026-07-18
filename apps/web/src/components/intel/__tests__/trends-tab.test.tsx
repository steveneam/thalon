// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrendsTab } from "@/components/intel/trends-tab";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { listIntelCaptures } from "@/lib/intel/store";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// The launchpad sorts by rank score (presentation-side): demo-trend-3 (0.90)
// leads, then -1 (0.87), -2 (0.66), -4 (0.48).
const ranked = [...fixtureTrendCards].sort((a, b) => b.score - a.score);

describe("TrendsTab (dossier launchpad, Phase D design #4)", () => {
  it("expands the top-ranked card as the dossier; the rest are bounded rising rows with a stated count", async () => {
    render(<TrendsTab />);

    expect(await screen.findByText("4 rising")).toBeInTheDocument();
    const card = screen.getByTestId(`trend-card-${ranked[0].id}`);
    // The dossier headline is the trend text; reasons render VERBATIM.
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent(ranked[0].text);
    expect(within(card).getByText(ranked[0].reasons[0])).toBeInTheDocument();
    // Provenance: the original link + the area, on the card.
    expect(within(card).getByRole("link", { name: /original post/i })).toHaveAttribute(
      "href",
      ranked[0].url,
    );
    expect(within(card).getByText(`area: ${ranked[0].areaName}`)).toBeInTheDocument();
    expect(within(card).getByText("outlier")).toBeInTheDocument();

    // Everything else is a compact row inside the bounded region, count stated.
    expect(
      screen.getByText(/3 more rising · list is bounded — scrolls internally past 6/),
    ).toBeInTheDocument();
    for (const row of ranked.slice(1)) {
      expect(screen.getByTestId(`trend-row-${row.id}`)).toBeInTheDocument();
    }
  });

  it("every rising row with a url wears its own way back — not just the expanded dossier (Source-Link Rule)", async () => {
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    for (const row of ranked.slice(1)) {
      if (!row.url) continue;
      const link = screen.getByRole("link", { name: `Open the original post from @${row.account}` });
      expect(link).toHaveAttribute("href", row.url);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("a rising row click expands that card — one dossier at a time", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    await user.click(screen.getByRole("button", { name: `Expand trend from @${ranked[2].account}` }));
    expect(screen.getByTestId(`trend-card-${ranked[2].id}`)).toBeInTheDocument();
    // The previous launchpad went back to being a row.
    expect(screen.queryByTestId(`trend-card-${ranked[0].id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`trend-row-${ranked[0].id}`)).toBeInTheDocument();
  });

  it("a per-family exit routes to Create with a capture id — the context spine, not a prompt string", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    const card = screen.getByTestId(`trend-card-${ranked[0].id}`);
    await user.click(within(card).getByRole("button", { name: /create video from this/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls.at(-1)![0])).toContain("/app/create?ctx=");

    // The capture carries the exit family + the default dossier picks.
    const capture = listIntelCaptures().at(-1)!;
    expect(capture.payload).toMatchObject({
      family: "video",
      title: ranked[0].dossier!.titles[0],
      hook: ranked[0].dossier!.hook,
    });
  });

  it("a picked title rides the exit, and the suggested door wears the word — never color alone", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    const card = screen.getByTestId(`trend-card-${ranked[0].id}`);
    await user.click(within(card).getByRole("radio", { name: ranked[0].dossier!.titles[1] }));
    // Thread-shaped source → the Post exit carries the suggested emphasis,
    // as a WORD in the accessible name (a default, not a gate).
    const postExit = within(card).getByRole("button", { name: /create post from this — suggested/i });
    await user.click(postExit);
    await waitFor(() => expect(push).toHaveBeenCalled());
    const capture = listIntelCaptures().at(-1)!;
    expect(capture.payload).toMatchObject({
      family: "post",
      title: ranked[0].dossier!.titles[1],
    });
  });

  it("dismiss hands the launchpad to the next card — captured, not deleted", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    const card = screen.getByTestId(`trend-card-${ranked[0].id}`);
    await user.click(within(card).getByRole("button", { name: /dismiss/i }));
    await waitFor(() =>
      expect(screen.queryByTestId(`trend-card-${ranked[0].id}`)).not.toBeInTheDocument(),
    );
    // The next-ranked card takes the launchpad slot; the dismissal is a capture row.
    expect(screen.getByTestId(`trend-card-${ranked[1].id}`)).toBeInTheDocument();
    expect(listIntelCaptures().at(-1)!.kind).toBe("trend_dismiss");
    expect(await screen.findByRole("status")).toHaveTextContent(/card dismissed/i);
  });

  it("stamps the sweep cadence honestly — demo drivers named, sweep-now armed", async () => {
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    expect(screen.getByText(/sweeps every 4h — run the first one now/i)).toBeInTheDocument();
    expect(screen.getByText(/demo drivers until B6\.5 arms/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sweep now/i })).toBeEnabled();
  });

  it("watchlist adds an area in place; the zero-card chip stays visible (the live-poll seam)", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    await user.click(screen.getByRole("button", { name: /add area or keyword/i }));
    await user.type(screen.getByLabelText("Area name"), "Answer engines");
    await user.type(
      screen.getByLabelText("Area description"),
      "AEO/GEO — how AI assistants cite and recommend products",
    );
    await user.click(screen.getByRole("button", { name: "Add area" }));

    // The chip renders even though no card ranks against it yet.
    expect(await screen.findByRole("button", { name: "Edit area Answer engines" })).toBeInTheDocument();
  });

  it("watchlist × pauses — never deletes — and the paused chip can resume", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    await user.click(screen.getByRole("button", { name: /add area or keyword/i }));
    await user.type(screen.getByLabelText("Area name"), "Voice cloning");
    await user.type(screen.getByLabelText("Area description"), "Founder-voice cloning tools and backlash");
    await user.click(screen.getByRole("button", { name: "Add area" }));
    await screen.findByRole("button", { name: "Edit area Voice cloning" });

    await user.click(screen.getByRole("button", { name: "Pause area Voice cloning" }));
    expect(await screen.findByText("paused")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume area Voice cloning" }));
    expect(await screen.findByRole("button", { name: "Pause area Voice cloning" })).toBeInTheDocument();
  });
});
