// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/workspace/command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CommandPalette", () => {
  it("opens on Ctrl-K, filters, and routes on Enter", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search commands"), "keyword");
    expect(screen.getByText("Add a keyword target")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/app/intel?tab=search");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("arrow keys move the active option; Escape closes without routing", async () => {
    push.mockClear();
    const user = userEvent.setup();
    render(<CommandPalette />);
    await user.keyboard("{Control>}k{/Control}");

    await user.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
