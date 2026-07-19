// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  draftC,
  FIXTURE_DRAFT_A_ID,
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

  it("defaults to WAITING work across runs (run-count scoped), never merely the newest run (critique P1 s39; newest-first view s66)", async () => {
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

  it("queue selection drives the detail pane (newest-first: the blocked x draft leads the view)", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);

    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = screen.getByRole("region", { name: "Draft detail" });

    // The first waiting draft in view order (newest-first) auto-selects —
    // the blocked x draft — and its verdict shows.
    await within(detail).findByText("Run2 X draft");
    expect(within(detail).getByText("Blocked — disagreement")).toBeInTheDocument();

    // Selecting the queued sibling swaps the detail.
    await user.click(within(queue).getByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await within(detail).findByText("Run2 LinkedIn draft");

    // Any row is reachable — terminal drafts stay reviewable (the publish door lives here).
    await user.click(
      within(queue).getByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}` }),
    );
    await within(detail).findByText("Run1 LinkedIn draft");
  });

  it("sorts newest-first by default with the order switchable, filters by status, and rows carry the exact creation stamp (founder s66)", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await within(queue).findByText(/list is bounded/);

    const names = () =>
      within(queue)
        .getAllByRole("button", { name: /^Select / })
        .map((row) => row.getAttribute("aria-label") ?? "");
    const indexOf = (id: string) => names().findIndex((n) => n.includes(id));

    // Newest first: draft B (the stable flatten reversed) leads; A sits
    // after C on the tiebreak walk.
    expect(names()[0]).toContain(FIXTURE_DRAFT_B_ID);
    expect(indexOf(FIXTURE_DRAFT_C_ID)).toBeLessThan(indexOf(FIXTURE_DRAFT_A_ID));

    // Every row shows the exact creation date and time, never a relative age.
    expect(within(queue).getAllByText(/2026, \d{2}:\d{2}/)).toHaveLength(names().length);

    // Flip to oldest-first: the walk inverts.
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort order" }), "oldest");
    expect(indexOf(FIXTURE_DRAFT_A_ID)).toBeLessThan(indexOf(FIXTURE_DRAFT_C_ID));
    expect(names()[names().length - 1]).toContain(FIXTURE_DRAFT_B_ID);

    // Filter to waiting (judge-passed) only: the blocked and terminal rows
    // leave the view, and the footer states the honest filtered-of-total count.
    const total = names().length;
    await user.selectOptions(screen.getByRole("combobox", { name: "Status filter" }), "waiting");
    expect(indexOf(FIXTURE_DRAFT_A_ID)).toBeGreaterThanOrEqual(0);
    expect(indexOf(FIXTURE_DRAFT_B_ID)).toBe(-1);
    expect(indexOf(FIXTURE_DRAFT_C_ID)).toBe(-1);
    expect(names().length).toBeLessThan(total);
    expect(within(queue).getByText(new RegExp(`${names().length} of ${total} ·`))).toBeInTheDocument();
  });

  it("the queue list is bounded and states its count (Bounded-List Rule)", async () => {
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await within(queue).findByText(/list is bounded — scrolls internally past 9/);
  });
});
