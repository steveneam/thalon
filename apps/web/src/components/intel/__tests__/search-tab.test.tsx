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

  it("leads with the end-point significance, scored by the engine's own fired-rule count", async () => {
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);

    // All three rules fired: act on it now, in the operator's words.
    const opportunity = screen.getByTestId("horizon-what is content automation");
    expect(within(opportunity).getByText("Worth targeting now")).toBeInTheDocument();
    expect(within(opportunity).getByText("3 of 3 signals")).toBeInTheDocument();
    expect(within(opportunity).getByText("page 1 is in reach")).toBeInTheDocument();
    expect(within(opportunity).getByText(/under-clicked for where you rank/)).toBeInTheDocument();

    // One rule ≠ act now.
    const partial = screen.getByTestId("horizon-ai video from prompt");
    expect(within(partial).getByText("Worth watching")).toBeInTheDocument();
    expect(within(partial).getByText("1 of 3 signals")).toBeInTheDocument();

    // No rules fired AND already on page 1 — that is a different sentence
    // from "too far back", and neither is a bare "no signal".
    const ranking = screen.getByTestId("horizon-acme motion studio");
    expect(within(ranking).getByText("Already ranking well")).toBeInTheDocument();
    expect(within(ranking).getByText("0 of 3 signals")).toBeInTheDocument();
  });

  it("the technical read survives one level down — numbers and the ranker's own sentences", async () => {
    const user = userEvent.setup();
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);
    const opportunity = screen.getByTestId("horizon-what is content automation");

    // Hidden until asked for — the founder's call (s74).
    expect(
      within(opportunity).queryByText(
        "position 9 is inside the horizon window 8–20 — page 1 is within reach",
      ),
    ).not.toBeInTheDocument();

    await user.click(within(opportunity).getByRole("button", { name: /the numbers/i }));

    // The plain metric line AND the verbatim reason are both reachable.
    expect(within(opportunity).getByText("Ranks #9.0")).toBeInTheDocument();
    expect(within(opportunity).getByText(/180 impressions, up 1.64×/)).toBeInTheDocument();
    expect(
      within(opportunity).getByText(
        "position 9 is inside the horizon window 8–20 — page 1 is within reach",
      ),
    ).toBeInTheDocument();
  });

  it("target-this routes to Create with a capture id carrying the keyword context", async () => {
    const user = userEvent.setup();
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);

    const opportunity = screen.getByTestId("horizon-what is content automation");
    await user.click(within(opportunity).getByRole("button", { name: /target this/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls.at(-1)![0])).toContain("/app/create?ctx=");
  });

  /**
   * s77/s79 I3 — reproduced live on the most opportune card ("Worth
   * targeting now", 3 of 3 signals): Target this hands Create `page`, whose
   * Generate is refused, and the footer's only promise was "no retyping at
   * Create". The handoff is still worth making; what was missing is what
   * happens at the other end.
   */
  it("says at the control that page generation is not wired where the query lands", async () => {
    render(<SearchTab />);
    await screen.findByText(/peering over the horizon/i);

    const opportunity = screen.getByTestId("horizon-what is content automation");
    expect(within(opportunity).getByText(/the query rides along — no retyping at Create/)).toHaveTextContent(
      /page generation isn’t wired there yet, so the capture waits with your brief/,
    );
  });
});
