// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/intel",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("WorkspaceShell", () => {
  it("renders every surface from the nav registry, marks the active one, and shows the needs-you badge", async () => {
    render(
      <WorkspaceShell>
        <p>surface body</p>
      </WorkspaceShell>,
    );

    // All seven surfaces, from the ONE registry (sidebar + mobile strip both render).
    for (const label of ["Dashboard", "Intel", "Create", "Approve", "Profiles", "Runs", "Settings"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThanOrEqual(1);
    }
    // Active surface (longest prefix match): /app/intel → Intel, not Dashboard.
    const intelLinks = screen.getAllByRole("link", { name: "Intel" });
    expect(intelLinks.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);
    const dashLinks = screen.getAllByRole("link", { name: "Dashboard" });
    expect(dashLinks.every((l) => l.getAttribute("aria-current") !== "page")).toBe(true);

    // Needs-you badge from the pulse fixture (3 = 2 queued + 1 blocked) —
    // once in the desktop sidebar AND once in the mobile strip (the strip
    // must not hide the count; critique 2026-07-14).
    expect(await screen.findAllByLabelText("3 drafts need you")).toHaveLength(2);
    expect(
      await screen.findByRole("link", { name: /3 drafts need you — open the approve queue/i }),
    ).toBeInTheDocument();

    // Tenant + active profile in the topbar switcher ("Thalon" also appears
    // in the brand wordmark; "v3" renders in the summary chip AND the menu).
    expect((await screen.findAllByText("v3")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Thalon").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("surface body")).toBeInTheDocument();
  });
});
