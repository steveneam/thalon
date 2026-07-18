// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrendsTab } from "@/components/intel/trends-tab";
import { fixtureTrendCards } from "@/lib/intel/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const ranked = [...fixtureTrendCards].sort((a, b) => b.score - a.score);

describe("intel keyboard grammar (useListKeys — j/k card · enter expand · d dismiss)", () => {
  it("j/k move the cursor with an sr-only announcement; enter expands the cursor card", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    // The cursor starts on the launchpad and announces itself.
    expect(screen.getByText(`Selected: ${ranked[0].text}`)).toBeInTheDocument();

    await user.keyboard("j");
    expect(screen.getByText(`Selected: ${ranked[1].text}`)).toBeInTheDocument();
    await user.keyboard("j");
    expect(screen.getByText(`Selected: ${ranked[2].text}`)).toBeInTheDocument();
    await user.keyboard("k");
    expect(screen.getByText(`Selected: ${ranked[1].text}`)).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByTestId(`trend-card-${ranked[1].id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`trend-card-${ranked[0].id}`)).not.toBeInTheDocument();
  });

  it("d dismisses the cursor card and the cursor hands over to a neighbour", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    await user.keyboard("d");
    await waitFor(() =>
      expect(screen.queryByTestId(`trend-card-${ranked[0].id}`)).not.toBeInTheDocument(),
    );
    // Next-ranked card takes the launchpad; the bound restates its count.
    expect(screen.getByTestId(`trend-card-${ranked[1].id}`)).toBeInTheDocument();
    expect(screen.getByText(/2 more rising/)).toBeInTheDocument();
  });

  it("keys never fire while typing (the isTypingTarget guard)", async () => {
    const user = userEvent.setup();
    render(<TrendsTab />);
    await screen.findByText("4 rising");

    await user.click(screen.getByRole("button", { name: /add area or keyword/i }));
    await user.type(screen.getByLabelText("Area name"), "jjdd");
    // Typing j/d into the input dismissed nothing.
    expect(screen.getByText("4 rising")).toBeInTheDocument();
    expect(screen.getByLabelText("Area name")).toHaveValue("jjdd");
  });
});
