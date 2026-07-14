// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  FIXTURE_DRAFT_B_ID,
  FIXTURE_RUN_1_ID,
} from "@/lib/approve-queue/fixtures";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — 3-zone layout", () => {
  it("consumes a ?run= deep link: the linked run is selected instead of the newest (provenance lands on the entity)", async () => {
    window.history.replaceState(null, "", `/app/approve?run=${FIXTURE_RUN_1_ID}`);
    try {
      render(<ApproveQueue />);
      const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
      await within(grid).findByText("Run1 LinkedIn draft");
      expect(within(grid).queryByText("Run2 LinkedIn draft")).not.toBeInTheDocument();
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  it("feed selection drives the grid, and grid selection drives the panel", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);

    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const panel = screen.getByRole("region", { name: "Approve panel" });

    // Newest run auto-selects; zone 2 renders its drafts and zone 3 shows the first one.
    await within(grid).findByText("Run2 LinkedIn draft");
    expect(within(grid).queryByText("Run1 LinkedIn draft")).not.toBeInTheDocument();
    await within(panel).findByText("Run2 LinkedIn draft");

    // Zone 2 -> zone 3: selecting the other draft in this run swaps the panel.
    await user.click(within(grid).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(panel).findByText("Run2 X draft");
    expect(within(panel).getByText("Blocked — disagreement")).toBeInTheDocument();

    // Zone 1 -> zone 2: selecting the older run swaps the grid (and the panel with it).
    await user.click(screen.getByRole("button", { name: `Select run ${FIXTURE_RUN_1_ID}` }));
    await within(grid).findByText("Run1 LinkedIn draft");
    expect(within(grid).queryByText("Run2 LinkedIn draft")).not.toBeInTheDocument();
    await within(panel).findByText("Run1 LinkedIn draft");
  });
});
