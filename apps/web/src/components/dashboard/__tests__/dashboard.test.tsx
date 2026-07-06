// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/dashboard";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
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

    // Pulse row from the fixture counts.
    expect(await screen.findByText("11")).toBeInTheDocument(); // drafts
    expect(screen.getByText("1 failed")).toBeInTheDocument(); // runsWithErrors

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

    // Seam-status card reads the doctor internals.
    expect(await screen.findByText("hyperframes")).toBeInTheDocument();
    expect(screen.getByText("pglite")).toBeInTheDocument();

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
});
