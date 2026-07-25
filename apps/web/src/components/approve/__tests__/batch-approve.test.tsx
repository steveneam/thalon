// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  draftA,
  draftB,
  draftC,
  FIXTURE_DRAFT_A_ID,
  FIXTURE_RUN_1_ID,
  FIXTURE_RUN_2_ID,
  run,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveSurface } from "../approve-surface";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApproveQueue — batch approve", () => {
  it("approves every WAITING draft in queue order behind one named confirm; blocked and staged drafts untouched", async () => {
    const user = userEvent.setup();
    const approved: string[] = [];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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

    render(<ApproveSurface />);

    // The classic fixtures hold ONE waiting draft (A queued; B blocked; the
    // staged storyboard is queued but advances through its own staged flow,
    // never a batch approve).
    const batchButton = await screen.findByRole("button", { name: "Approve all waiting (1)" });
    await user.click(batchButton);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Approve all 1 waiting draft/));
    await waitFor(() => expect(approved).toEqual([FIXTURE_DRAFT_A_ID]));
    // Queue refreshed to the post-approve state; nothing left to batch.
    const drained = await screen.findByRole("button", { name: "Approve all waiting (0)" });
    expect(drained).toBeDisabled();
  });

  it("a declined confirm approves nothing", async () => {
    const user = userEvent.setup();
    const approved: string[] = [];
    vi.spyOn(window, "confirm").mockReturnValue(false);
    server.use(
      http.post("/api/drafts/:draftId/approve", ({ params }) => {
        approved.push(params.draftId as string);
        return HttpResponse.json({});
      }),
    );

    render(<ApproveSurface />);
    await user.click(await screen.findByRole("button", { name: "Approve all waiting (1)" }));
    expect(approved).toHaveLength(0);
  });

  it("stays disabled when nothing waits", async () => {
    server.use(
      http.get("/api/runs", () =>
        HttpResponse.json({ runs: [run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z")] }),
      ),
      http.get(`/api/runs/${FIXTURE_RUN_1_ID}/drafts`, () => HttpResponse.json({ drafts: [draftC] })),
    );
    render(<ApproveSurface />);
    const batchButton = await screen.findByRole("button", { name: "Approve all waiting (0)" });
    expect(batchButton).toBeDisabled();
  });
});
