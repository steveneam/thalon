// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { NAV_SURFACES } from "@/lib/workspace/nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/leads",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("WorkspaceShell (exact-mock chrome, DOCTRINE 0)", () => {
  it("renders the sheet's rail — every surface wears its word, mock order", async () => {
    render(
      <WorkspaceShell>
        <p>surface body</p>
      </WorkspaceShell>,
    );

    // The rail: all twelve surfaces render icon + word.
    const nav = within(screen.getByRole("navigation", { name: /side/i }));
    for (const surface of NAV_SURFACES) {
      expect(
        nav.getAllByRole("link", { name: new RegExp(`^${surface.label}`) }).length,
      ).toBeGreaterThanOrEqual(1);
    }

    // Order and labels exactly as the mock: Home leads (Dashboard is
    // retired as a label), Settings closes.
    const labels = NAV_SURFACES.map((s) => s.label);
    expect(labels).toEqual([
      "Home",
      "Intel",
      "Create",
      "Approve",
      "Calendar",
      "Leads",
      "Transcription",
      "Videos",
      "Sites",
      "Runs",
      "Profiles",
      "Settings",
    ]);
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();

    // Active surface: /app/leads → the Leads item is marked current.
    const leadsLinks = nav.getAllByRole("link", { name: /^Leads/ });
    expect(leadsLinks.some((el) => el.getAttribute("aria-current") === "page")).toBe(true);

    // The topbar carries no visible surface title (the sheet's grammar —
    // surfaces own their headline); the sr-only h1 keeps the page named.
    expect(screen.getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();

    // Needs-you pill from the pulse fixture (3 = 2 queued + 1 blocked) in
    // the topbar — the amber signal channel carries over.
    expect(
      await screen.findByRole("link", { name: /3 items need you — open the approve queue/i }),
    ).toHaveAttribute("href", "/app/approve");
    expect(await screen.findByText("Needs you · 3")).toBeInTheDocument();

    // The Approve rail row carries the same count.
    expect((await nav.findAllByText("3")).length).toBeGreaterThanOrEqual(1);

    // + Create carries over into the topbar.
    expect(screen.getByRole("link", { name: "+ Create" })).toHaveAttribute("href", "/app/create");

    // Dark is the default; light mode ships as the switcher-panel toggle (keeper).
    expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();

    // Tenant + active profile in the topbar.
    expect((await screen.findAllByText(/profile v3/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Thalon").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("surface body")).toBeInTheDocument();
  });

  it("opens the command palette from the topbar ⌘K button", () => {
    render(
      <WorkspaceShell>
        <p>surface body</p>
      </WorkspaceShell>,
    );
    expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /command palette/i }));
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("stamps the theme attributes on <html> while mounted and removes them on unmount", () => {
    const { unmount } = render(
      <WorkspaceShell>
        <p>surface body</p>
      </WorkspaceShell>,
    );
    expect(document.documentElement.getAttribute("data-astryx-theme")).toBe("thalon");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    unmount();
    expect(document.documentElement.getAttribute("data-astryx-theme")).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
