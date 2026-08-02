// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/dashboard";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { fixturePulse } from "@/lib/workspace/fixtures";
import { server } from "@/lib/testing/server";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push }),
}));

function renderDashboard() {
  return render(
    <PulseProvider>
      <Dashboard />
    </PulseProvider>,
  );
}

async function openBoard(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/oldest first/);
  await user.click(screen.getByRole("button", { name: "Board" }));
  await screen.findByText("Intel picks");
}

/**
 * The Dashboard's BOARD state (the s91 pipeline-board redraw, verdicted
 * s91b) wired in place of the retired /app/board route: the toggle is a
 * lens over the same day, the columns run in loop order, and every count
 * on screen is real or visibly unresolved.
 */
describe("Dashboard board state — the pipeline board", () => {
  beforeEach(() => {
    push.mockClear();
    window.history.replaceState(null, "", "/app");
  });

  it("the toggle switches Home's state in place and stamps the URL", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    expect(push).toHaveBeenCalledWith("/app?view=board");
    // The board replaced Overview's furniture rather than stacking under it.
    expect(screen.queryByText("Rising trends")).toBeNull();
    expect(screen.getByText("left to right is the loop", { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(push).toHaveBeenCalledWith("/app");
    await screen.findByText("Rising trends");
  });

  it("draws the six loop-order columns with their feet", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    for (const label of [
      "Intel picks",
      "Generating",
      "At the judge",
      "In Approve",
      "Scheduled",
      "Published",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Every column's foot carries the day's line.
    expect(screen.getAllByText("today").length).toBe(6);
  });

  it("In Approve reports the pulse's needs-you number — one number for one fact", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    const head = screen.getByText("In Approve").closest(".col-hd");
    await waitFor(() =>
      expect(head?.querySelector(".col-ct-warn")?.textContent).toBe(
        String(fixturePulse.needsYou),
      ),
    );
  });

  it("a blocked card carries the judge's failing line VERBATIM and the ✗ chip", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    await screen.findByText("✗ judge");
    // The fixture's own recorded reason, word for word (rule 5).
    expect(
      screen.getByText(
        "Grounding — final: Ships every platform — no provided source supports this claim.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("✓ judge").length).toBeGreaterThan(0);
  });

  it("the picks read failing marks ITS column only — the pipeline still renders", async () => {
    server.use(
      http.get("/api/intel/picks", () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    const picksColumn = screen.getByText("Intel picks").closest(".col") as HTMLElement;
    await waitFor(() =>
      expect(picksColumn.textContent).toContain("couldn’t read this column"),
    );
    // Its count and foot are visibly unresolved, never a real-looking zero…
    expect(picksColumn.querySelector(".col-ct")?.textContent).toBe("–");
    expect(picksColumn.querySelector(".col-ft .t-data")?.textContent).toBe("–");
    // …while the plan-backed columns carry on.
    await screen.findByText("✗ judge");
  });

  it("an empty picks column says what would land there — picks only, never unpicked trends", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openBoard(user);

    const picksColumn = screen.getByText("Intel picks").closest(".col") as HTMLElement;
    await waitFor(() =>
      expect(picksColumn.textContent).toContain("No picks yet — promote a trend on Intel"),
    );
  });
});
