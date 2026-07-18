// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/leads",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("WorkspaceShell", () => {
  it("renders the icon rail (extras only), the topbar chrome, and the needs-you chip", async () => {
    render(
      <WorkspaceShell>
        <p>surface body</p>
      </WorkspaceShell>,
    );

    // The rail carries the extras + the foot — one icon metaphor each.
    for (const label of ["Leads", "Library", "Videos", "Runs", "Profiles", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // Journey surfaces leave the rail entirely (Phase D): no Intel/Create/
    // Approve/Calendar links render in the chrome — they live ON the spine.
    for (const label of ["Intel", "Create", "Approve", "Calendar"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Journey — the spine" })).toHaveAttribute(
      "href",
      "/app",
    );

    // Active surface: /app/leads → the Leads rail icon wears aria-current.
    expect(screen.getByRole("link", { name: "Leads" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Journey — the spine" })).not.toHaveAttribute(
      "aria-current",
    );

    // The topbar h1 names the surface (surfaces carry no chrome h1 of their own).
    expect(screen.getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();

    // Needs-you chip from the pulse fixture (3 = 2 queued + 1 blocked), once, in the topbar.
    expect(
      await screen.findByRole("link", { name: /3 items need you — open the approve queue/i }),
    ).toHaveAttribute("href", "/app/approve");

    // Tenant + active profile in the switcher.
    expect((await screen.findAllByText("v3")).length).toBeGreaterThanOrEqual(1);
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
    fireEvent.click(screen.getByRole("button", { name: /command/i }));
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });
});
