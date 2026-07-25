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

describe("Dashboard (exact-mock rebuild, Dashboard.dc.html)", () => {
  it("renders the sheet's bands: Today header, four tiles, home grid, published strip", async () => {
    renderDashboard();

    // Today header (the surface owns its headline in the sheet's grammar).
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    // The Board option is a real door since the pipeline board's rebuild —
    // it was a dead label ("lands with its exact-mock rebuild") before it.
    const board = screen.getByRole("button", { name: "Board" });
    expect(board).toHaveClass("seg-opt");
    expect(board).not.toHaveAttribute("aria-disabled");

    // The four tiles wear the sheet's labels and are doors.
    expect(screen.getByText("Rising trends").closest("a")).toHaveAttribute("href", "/app/intel");
    expect(screen.getByText("Composing").closest("a")).toHaveAttribute("href", "/app/runs");
    expect(screen.getByText("Planned slots").closest("a")).toHaveAttribute(
      "href",
      "/app/calendar",
    );
    expect(screen.getByText(/door unarmed — plans, not uploads/)).toBeInTheDocument();

    // Needs-you card: fixture rows arrive with the pulse count (2 queued + 1
    // blocked = 3) and the blocked row shows the judge's reason honestly.
    expect(await screen.findByText(/oldest first/)).toBeInTheDocument();
    expect(await screen.findByText(/Blocked by the judge/)).toBeInTheDocument();
    expect(screen.getByText(/no provided source supports this claim/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open approve →" })).toHaveAttribute(
      "href",
      "/app/approve",
    );

    // Week card: the sheet's seg + local-times note + calendar door.
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("all times local")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open calendar →" })).toHaveAttribute(
      "href",
      "/app/calendar",
    );

    // Published strip: the fixture's deployed blog post carries its live link.
    expect(await screen.findByText("Latest published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view live ↗/ })).toHaveAttribute(
      "href",
      "/blog/fixture-post",
    );
  });

  it("a failed pulse read is an alert with retry, never a real-looking empty state", async () => {
    server.use(http.get("/api/app/pulse", () => HttpResponse.error()));
    renderDashboard();
    // Two honest alerts: the engine card AND the needs-you card's read failure.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((el) => /Couldn’t reach the engine/.test(el.textContent ?? ""))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Try again" }).length).toBeGreaterThanOrEqual(1);
  });

  it("unresolved reads show '–', never a fabricated zero", async () => {
    server.use(
      http.get("/api/intel/trends", () => HttpResponse.error()),
      http.get("/api/app/plan", () => HttpResponse.error()),
    );
    renderDashboard();
    // The trends tile stays unresolved when its read fails.
    expect(await screen.findAllByText("–")).not.toHaveLength(0);
  });
});
