// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrendsTab } from "@/components/intel/trends-tab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("intel trends bulk dismiss (s40 parity, FRONTEND §0)", () => {
  it("multi-select → ONE named confirm with the count → cards leave, toast confirms", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TrendsTab />);
    await screen.findByText(/demo dataset/i);

    const checkboxes = screen.getAllByRole("checkbox", { name: /^select trend from @/i });
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    const before = screen.getAllByTestId(/^trend-card-/).length;
    await user.click(screen.getByRole("button", { name: "Dismiss selected" }));
    expect(confirmSpy).toHaveBeenCalledExactlyOnceWith("Dismiss 2 selected cards?");
    await waitFor(() =>
      expect(screen.getAllByTestId(/^trend-card-/)).toHaveLength(before - 2),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/dismissed 2 cards/i);
    // The bar cleared with the selection.
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
