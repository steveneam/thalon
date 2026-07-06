// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchTab } from "@/components/intel/search-tab";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("SearchTab", () => {
  it("shows the tutorial empty state, then adds an operator target with its origin badge", async () => {
    const user = userEvent.setup();
    render(<SearchTab />);

    expect(await screen.findByText(/no targets yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("New keyword target"), "ai content automation");
    await user.click(screen.getByRole("button", { name: /add target/i }));

    expect(await screen.findByText("ai content automation")).toBeInTheDocument();
    expect(screen.getByText("operator")).toBeInTheDocument();
  });

  it("dismisses and reactivates a target — dismissed stays visible, never deleted", async () => {
    const user = userEvent.setup();
    render(<SearchTab />);
    await screen.findByText(/no targets yet/i);
    await user.type(screen.getByLabelText("New keyword target"), "grounded generation");
    await user.click(screen.getByRole("button", { name: /add target/i }));
    await screen.findByText("grounded generation");

    await user.click(screen.getByRole("button", { name: "Dismiss target grounded generation" }));
    expect(await screen.findByText("dismissed")).toBeInTheDocument();
    expect(screen.getByText("grounded generation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reactivate target grounded generation" }));
    await waitFor(() => expect(screen.queryByText("dismissed")).not.toBeInTheDocument());
  });

  it("renders horizon cards: the opportunity badge only when all three rules fired, reasons verbatim", async () => {
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);

    const opportunity = screen.getByTestId("horizon-what is content automation");
    expect(within(opportunity).getByText("horizon opportunity")).toBeInTheDocument();
    expect(
      within(opportunity).getByText(
        "position 9 is inside the horizon window 8–20 — page 1 is within reach",
      ),
    ).toBeInTheDocument();

    // One rule ≠ opportunity — partial signal reads differently.
    const partial = screen.getByTestId("horizon-ai video from prompt");
    expect(within(partial).getByText("partial signal")).toBeInTheDocument();
    // Already ranking: no signal at all.
    const ranking = screen.getByTestId("horizon-acme motion studio");
    expect(within(ranking).getByText("no signal")).toBeInTheDocument();
  });

  it("target-this routes to Create with the query as generation context", async () => {
    const user = userEvent.setup();
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);

    const opportunity = screen.getByTestId("horizon-what is content automation");
    await user.click(within(opportunity).getByRole("button", { name: /target this/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls.at(-1)![0])).toContain("/app/create?keyword=");
  });
});
