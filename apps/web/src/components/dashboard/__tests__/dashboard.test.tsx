// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
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

describe("Dashboard", () => {
  it("renders the journey spine: five stations with live state and their one action each", async () => {
    renderDashboard();

    // The page IS the journey.
    expect(screen.getByText("The pipeline, left to right")).toBeInTheDocument();

    // 01 · intel rides the trends read (fixture: demo dataset, honest about it).
    expect(await screen.findByText(/^demo$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open intel" })).toHaveAttribute("href", "/app/intel");
    expect(screen.getByText(/no next sweep until live pollers arm/)).toBeInTheDocument();

    // 02 · pick is a state, not a route — honest about the untracked count.
    expect(screen.getByText(/Pick is a state, not a route/)).toBeInTheDocument();
    expect(screen.getByText(/never retyped/)).toBeInTheDocument();

    // 03 · create exits to the create surface.
    expect(screen.getByRole("link", { name: "Open create" })).toHaveAttribute(
      "href",
      "/app/create",
    );

    // 04 · approve wears the signal channel: pulse fixture has 2 queued + 1 blocked.
    expect(await screen.findByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByText(/1 more blocked by the judge — reasons attached/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review queue" })).toHaveAttribute(
      "href",
      "/app/approve",
    );

    // 05 · fan-out is honest about the unarmed door and exits to the calendar.
    expect(screen.getByText(/publish door unarmed — these are plans, not uploads/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open calendar" })).toHaveAttribute(
      "href",
      "/app/calendar",
    );

    // The needs-you list rows ride the plan read: one queued draft + the blocked fold.
    expect(await screen.findByText("linkedin — your review")).toBeInTheDocument();
    expect(screen.getByText("1 draft blocked — reasons attached")).toBeInTheDocument();
    expect(screen.getByText(/the list is bounded — the page never grows with it/)).toBeInTheDocument();

    // The week strip's honest three-mark legend.
    expect(screen.getByText("waits on you")).toBeInTheDocument();
    expect(screen.getByText("planned slot")).toBeInTheDocument();

    // Seam/driver config lives in Settings; only the degraded gateway surfaces here.
    expect(await screen.findByRole("status")).toHaveTextContent(/gateway key isn.t configured/i);
    expect(screen.getByRole("link", { name: /check settings/i })).toHaveAttribute(
      "href",
      "/app/settings",
    );
  });

  it("renders the first-run tutorial on an unseeded tenant", async () => {
    server.use(
      http.get("/api/app/pulse", () =>
        HttpResponse.json({
          tenant: null,
          profile: null,
          counts: { runs: 0, runsWithErrors: 0, drafts: 0, queued: 0, blocked: 0, approved: 0 },
          needsYou: 0,
        }),
      ),
    );
    renderDashboard();
    expect(await screen.findByText(/three steps to your first draft/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set up your profile/i })).toHaveAttribute(
      "href",
      "/app/profiles",
    );
  });

  it("renders an honest error card — never a real-looking empty state — when the pulse read fails", async () => {
    server.use(http.get("/api/app/pulse", () => HttpResponse.error()));
    renderDashboard();

    // The failure is named, with a retry — not "Queue clear". (The needs-you
    // list raises its own alert for the same outage; both are honest.)
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => /couldn.t reach the engine/i.test(a.textContent ?? ""))).toBe(true);
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/queue clear/i)).not.toBeInTheDocument();

    // Pulse-backed station counts show "–", not zeros.
    expect(screen.getAllByText("not loaded").length).toBeGreaterThanOrEqual(1);
  });
});
