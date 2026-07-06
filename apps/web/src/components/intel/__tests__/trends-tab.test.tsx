// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrendsTab } from "@/components/intel/trends-tab";
import { fixtureTrendCards } from "@/lib/intel/fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("TrendsTab", () => {
  it("renders demo cards with outlier badges, reason strings, and engagement ratios", async () => {
    render(<TrendsTab />);

    expect(await screen.findByText(/demo dataset/i)).toBeInTheDocument();
    // Outlier badge on the outlier cards only.
    expect(screen.getAllByText("outlier")).toHaveLength(
      fixtureTrendCards.filter((c) => c.isOutlier).length,
    );
    // A reason string renders verbatim (the ranker.ts grammar).
    expect(
      screen.getByText('relevance 0.81 to area "AI content automation" (embedding cosine 0.62)'),
    ).toBeInTheDocument();
    // Engagement ratios in the stat strip.
    expect(screen.getAllByText("2.5%").length).toBeGreaterThanOrEqual(1);
  });

  it("filters cards client-side by area chip", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText(/demo dataset/i);

    const chip = screen.getByRole("button", { name: /Short-form video tooling/ });
    await user.click(chip);
    expect(screen.queryByTestId("trend-card-demo-trend-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("trend-card-demo-trend-3")).toBeInTheDocument();

    // Toggling the chip off restores everything.
    await user.click(chip);
    expect(screen.getByTestId("trend-card-demo-trend-1")).toBeInTheDocument();
  });

  it("dismiss removes the card; the dismissal is captured, not deleted", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText(/demo dataset/i);

    const card = screen.getByTestId("trend-card-demo-trend-2");
    await user.click(within(card).getByRole("button", { name: /dismiss/i }));
    await waitFor(() =>
      expect(screen.queryByTestId("trend-card-demo-trend-2")).not.toBeInTheDocument(),
    );
  });

  it("generate-from-this routes to Create with the item text as prompt seed", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText(/demo dataset/i);

    const card = screen.getByTestId("trend-card-demo-trend-1");
    await user.click(within(card).getByRole("button", { name: /generate from this/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls.at(-1)![0])).toContain("/app/create?prompt=");
  });

  it("adds a monitored area through the manager and shows it with a zero-card chip", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText(/demo dataset/i);

    await user.type(screen.getByLabelText("Area name"), "Answer engines");
    await user.type(
      screen.getByLabelText("Area description"),
      "AEO/GEO — how AI assistants cite and recommend products",
    );
    await user.click(screen.getByRole("button", { name: /add area/i }));

    // The row AND its filter chip both render the new area's name.
    expect(await screen.findAllByText("Answer engines")).toHaveLength(2);
    // The chip carries 0 cards — the B6.5 seam stays visible.
    expect(screen.getByRole("button", { name: /Answer engines 0/ })).toBeInTheDocument();
  });
});
