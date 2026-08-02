// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupState } from "@/components/dashboard/dashboard-model";
import { Dashboard } from "@/components/dashboard/dashboard";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn() }),
}));

function renderDashboard() {
  return render(
    <PulseProvider>
      <Dashboard />
    </PulseProvider>,
  );
}

/** The fixture pulse (profile v3 · 4 runs · 5 approvals) leaves CHANNEL the one pending step. */
function useCards(state: string) {
  server.use(http.get("/api/integrations", () => HttpResponse.json({ cards: [{ state }] })));
}

afterEach(() => {
  window.localStorage.clear();
});

describe("setupState — the four steps' truth (W1 sheet, Hex's band)", () => {
  it("counts done steps and shapes the approve door from the live queue", () => {
    const state = setupState({
      channelConnected: true,
      hasProfile: true,
      hasRun: true,
      hasApproval: false,
      needsYou: 4,
    });
    expect(state.doneCount).toBe(3);
    expect(state.allDone).toBe(false);
    expect(state.steps[3].doorLabel).toBe("First approve — 4 waiting →");
  });

  it("an empty queue never invents a waiting count on the approve door", () => {
    const state = setupState({
      channelConnected: false,
      hasProfile: false,
      hasRun: false,
      hasApproval: false,
      needsYou: 0,
    });
    expect(state.doneCount).toBe(0);
    expect(state.steps[3].doorLabel).toBe("Walk the approve queue →");
  });

  it("all four done reads allDone — the band's self-retirement condition", () => {
    expect(
      setupState({
        channelConnected: true,
        hasProfile: true,
        hasRun: true,
        hasApproval: true,
        needsYou: 0,
      }).allDone,
    ).toBe(true);
  });
});

describe("the setup band on the Dashboard", () => {
  it("renders 'N of 4' with done ticks and the FIRST pending step as the one live door", async () => {
    useCards("not_connected");
    renderDashboard();

    const band = await screen.findByRole("status", { name: "Workspace setup" });
    expect(band).toHaveTextContent("Set up your workspace");
    expect(band).toHaveTextContent("3 of 4");
    // Channel is the one pending step — it is the band's door.
    expect(screen.getByRole("link", { name: "Connect a channel →" })).toHaveAttribute(
      "href",
      "/app/settings",
    );
    // The done steps rest as ticks, not doors.
    expect(band).toHaveTextContent("✓ Make a profile");
    expect(band).toHaveTextContent("✓ First create");
    expect(band).toHaveTextContent("✓ First approve");
  });

  it("dismiss hides the band and persists per tenant — it never comes back on reload", async () => {
    const user = userEvent.setup();
    useCards("not_connected");
    renderDashboard();

    await screen.findByRole("status", { name: "Workspace setup" });
    await user.click(screen.getByRole("button", { name: "Dismiss setup band" }));
    expect(screen.queryByRole("status", { name: "Workspace setup" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("thalon:setup-dismissed:self")).toBe("1");
  });

  it("a stored dismissal keeps the band away from mount", async () => {
    window.localStorage.setItem("thalon:setup-dismissed:self", "1");
    useCards("not_connected");
    renderDashboard();

    // Settle the reads, then the band must not be there.
    await screen.findByRole("heading", { name: "Today" });
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Workspace setup" })).not.toBeInTheDocument(),
    );
  });

  it("all steps done — the band retires itself without a dismissal", async () => {
    useCards("connected");
    renderDashboard();

    await screen.findByRole("heading", { name: "Today" });
    // Give the integrations read a beat to land, then: no band.
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Workspace setup" })).not.toBeInTheDocument(),
    );
  });
});
