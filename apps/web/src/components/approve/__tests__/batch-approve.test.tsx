// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  draftA,
  draftB,
  FIXTURE_DRAFT_A_ID,
  FIXTURE_RUN_2_ID,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — batch approve (B6.2)", () => {
  it("approves every QUEUED draft in the run through the single-draft endpoint; blocked drafts untouched", async () => {
    const user = userEvent.setup();
    const approved: string[] = [];

    server.use(
      http.post("/api/drafts/:draftId/approve", ({ params }) => {
        approved.push(params.draftId as string);
        return HttpResponse.json({
          approval: {
            id: `appr-${params.draftId}`,
            tenantId: "tenant-fixture",
            draftId: params.draftId,
            actor: "operator",
            action: "approve",
            editedBody: null,
            createdAt: "2026-07-04T11:00:00.000Z",
          },
          draft: { ...draftA, status: "approved" },
        });
      }),
      http.get(`/api/runs/${FIXTURE_RUN_2_ID}/drafts`, () => {
        const a = approved.includes(FIXTURE_DRAFT_A_ID) ? { ...draftA, status: "approved" } : draftA;
        return HttpResponse.json({ drafts: [a, draftB] });
      }),
    );

    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });

    // Run 2 auto-selects: draft A is queued, draft B is blocked → count 1.
    const batchButton = await within(grid).findByRole("button", { name: "Approve all queued (1)" });
    await user.click(batchButton);

    await waitFor(() => expect(approved).toEqual([FIXTURE_DRAFT_A_ID]));
    // Grid refreshed to the post-approve state; nothing left to batch.
    await within(grid).findByRole("button", { name: "Approve all queued (0)" });
    expect(within(grid).getByRole("button", { name: "Approve all queued (0)" })).toBeDisabled();
  });

  it("stays disabled when the run has no queued drafts", async () => {
    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const feed = screen.getByRole("region", { name: "Fan-out run feed" });
    const user = userEvent.setup();

    // Run 1 holds only an approved draft.
    await within(feed).findAllByRole("button");
    await user.click(within(feed).getByRole("button", { name: /Select run 11111111/ }));
    const batchButton = await within(grid).findByRole("button", { name: "Approve all queued (0)" });
    expect(batchButton).toBeDisabled();
  });
});
