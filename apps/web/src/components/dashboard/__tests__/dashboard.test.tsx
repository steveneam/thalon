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
  it("answers the 10-second questions: what needs me, what the engine did, what to do next", async () => {
    renderDashboard();

    // The schematic spine carries the fixture counts at their stations.
    expect(await screen.findByText("1 failed — triage")).toBeInTheDocument(); // create station alert
    expect(screen.getByText("wait on your review")).toBeInTheDocument(); // approve station, 2 queued
    expect(screen.getByText("need your edit")).toBeInTheDocument(); // judge station, 1 blocked
    // Plan-backed stations: intel (areas + next sweep) and distribute (honest publish scope).
    expect(await screen.findByText(/next sweep in \d+h/)).toBeInTheDocument();
    expect(screen.getByText("own site today · social lands later")).toBeInTheDocument();

    // Needs-you card: 3 = 2 queued + 1 blocked, with the queue as the action.
    expect(await screen.findByText(/drafts wait/)).toBeInTheDocument();
    expect(screen.getByText("queued for review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review queue/i })).toHaveAttribute(
      "href",
      "/app/approve",
    );

    // Activity feed attributes work to the engine, linked to its surface.
    expect(
      await screen.findByText("Judge passed a draft — it's in your queue"),
    ).toBeInTheDocument();
    expect(screen.getByText("Engine drafted for linkedin")).toBeInTheDocument();

    // Seam/driver config lives in Settings now (founder direction 2026-07-14);
    // the dashboard only surfaces degraded health — the fixture's gateway is
    // unconfigured, so the one health notice shows and links to Settings.
    expect(await screen.findByRole("status")).toHaveTextContent(/gateway key isn.t configured/i);
    expect(screen.getByRole("link", { name: /check settings/i })).toHaveAttribute(
      "href",
      "/app/settings",
    );
    expect(screen.queryByText("hyperframes")).not.toBeInTheDocument();

    // Schematic stations are doorways, not just counters.
    expect(screen.getByRole("link", { name: /recent runs/i })).toHaveAttribute("href", "/app/runs");
    expect(screen.getByRole("link", { name: /01 · Intel/i })).toHaveAttribute("href", "/app/intel");

    // Quick actions cover the families.
    expect(screen.getByRole("link", { name: /create from a prompt/i })).toHaveAttribute(
      "href",
      "/app/create",
    );
  });

  it("renders the first-run tutorial instead of the needs-you card on an unseeded tenant", async () => {
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
    expect(
      await screen.findByText(/three steps to your first draft/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set up your profile/i })).toHaveAttribute(
      "href",
      "/app/profiles",
    );
    expect(screen.queryByText(/drafts wait/)).not.toBeInTheDocument();
  });

  it("renders an honest error card — never a real-looking empty state — when the pulse read fails", async () => {
    server.use(http.get("/api/app/pulse", () => HttpResponse.error()));
    renderDashboard();

    // The failure is named, with a retry — not "Queue clear".
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn.t reach the engine/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/queue clear/i)).not.toBeInTheDocument();

    // Tiles show "–", not zeros.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
