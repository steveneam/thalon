// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  draftC,
  FIXTURE_DRAFT_B_ID,
  FIXTURE_DRAFT_C_ID,
  FIXTURE_RUN_1_ID,
  FIXTURE_RUN_2_ID,
  run,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — flat queue + detail (Phase I design #6)", () => {
  it("consumes a ?run= deep link: selection lands on that run's drafts (provenance lands on the entity)", async () => {
    window.history.replaceState(null, "", `/app/approve?run=${FIXTURE_RUN_1_ID}`);
    try {
      render(<ApproveQueue />);
      const detail = await screen.findByRole("region", { name: "Draft detail" });
      await within(detail).findByText("Run1 LinkedIn draft");
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  it("defaults to the OLDEST waiting draft across runs, not merely the newest run (critique P1, s39)", async () => {
    // The newest run has nothing waiting; the older run holds the operator's work.
    server.use(
      http.get("/api/runs", () =>
        HttpResponse.json({
          runs: [
            run(FIXTURE_RUN_2_ID, "2026-07-04T09:00:00.000Z", true, 0),
            run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z", true, 1),
          ],
        }),
      ),
      http.get(`/api/runs/${FIXTURE_RUN_1_ID}/drafts`, () =>
        HttpResponse.json({ drafts: [{ ...draftC, status: "queued" }] }),
      ),
    );
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Run 1's queued draft is selected — the queue landed on the waiting work.
    const rowC = await within(queue).findByRole("button", {
      name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}`,
    });
    expect(rowC).toHaveAttribute("aria-pressed", "true");
    // The header wears the waiting count on the signal channel, word carried
    // (draft-level truth: run 2's queued draft + run 1's queued draft).
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
  });

  it("queue selection drives the detail pane", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);

    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = screen.getByRole("region", { name: "Draft detail" });

    // The oldest waiting draft auto-selects; the detail shows it.
    await within(detail).findByText("Run2 LinkedIn draft");

    // Selecting the blocked sibling swaps the detail — with its verdict.
    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(detail).findByText("Run2 X draft");
    expect(within(detail).getByText("Blocked — disagreement")).toBeInTheDocument();

    // Any row is reachable — terminal drafts stay reviewable (the publish door lives here).
    await user.click(
      within(queue).getByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}` }),
    );
    await within(detail).findByText("Run1 LinkedIn draft");
  });

  it("the queue list is bounded and states its count (Bounded-List Rule)", async () => {
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await within(queue).findByText(/list is bounded — scrolls internally past 9/);
  });
});
