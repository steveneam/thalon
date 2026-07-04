// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { draftB, FIXTURE_DRAFT_B_ID, fixtureDraftDetails } from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — Sprint-1 follow-ups (B2.6)", () => {
  it("panel refreshes to the post-edit, post-re-judge state after save-edit", async () => {
    const user = userEvent.setup();
    const editedBody = "Run2 X draft, now with more detail.";
    let edited = false;

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/edit`, async ({ request }) => {
        const { editedBody: sentBody } = (await request.json()) as { editedBody: string };
        edited = true;
        return HttpResponse.json({
          approval: {
            id: "appr-1",
            tenantId: "tenant-fixture",
            draftId: FIXTURE_DRAFT_B_ID,
            actor: "operator",
            action: "edit",
            editedBody: sentBody,
            createdAt: "2026-07-04T11:00:00.000Z",
          },
          draft: { ...draftB, body: sentBody, bodyHash: "hash-b-edited", status: "judging" },
        });
      }),
      http.get(`/api/drafts/${FIXTURE_DRAFT_B_ID}`, () => {
        if (!edited) return HttpResponse.json(fixtureDraftDetails[FIXTURE_DRAFT_B_ID]);
        // Post-edit: re-judge is in flight — no verdicts for the new hash yet.
        return HttpResponse.json({
          draft: { ...draftB, body: editedBody, bodyHash: "hash-b-edited", status: "judging" },
          judgeResults: [],
        });
      }),
    );

    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const panel = screen.getByRole("region", { name: "Approve panel" });

    await within(grid).findByText("Run2 X draft");
    await user.click(within(grid).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(panel).findByText("Run2 X draft");
    expect(within(panel).getByText("Blocked — disagreement")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Edit" }));
    const textarea = within(panel).getByRole("textbox", { name: "Edit draft body" });
    await user.clear(textarea);
    await user.type(textarea, editedBody);
    await user.click(within(panel).getByRole("button", { name: "Save edit" }));

    await within(panel).findByText(editedBody);
    expect(edited).toBe(true);
    expect(within(panel).queryByText("Blocked — disagreement")).not.toBeInTheDocument();
    expect(within(panel).getByText("Pending")).toBeInTheDocument();
  });

  it("re-judge retries a blocked draft unmodified through the dedicated action, never through edit", async () => {
    const user = userEvent.setup();
    let reJudged = false;

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/rejudge`, () => {
        reJudged = true;
        return HttpResponse.json({ draft: { ...draftB, status: "judging" } });
      }),
      http.get(`/api/drafts/${FIXTURE_DRAFT_B_ID}`, () => {
        if (!reJudged) return HttpResponse.json(fixtureDraftDetails[FIXTURE_DRAFT_B_ID]);
        return HttpResponse.json({ draft: { ...draftB, status: "judging" }, judgeResults: [] });
      }),
    );

    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const panel = screen.getByRole("region", { name: "Approve panel" });

    await within(grid).findByText("Run2 X draft");
    await user.click(within(grid).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(panel).findByText("Run2 X draft");
    expect(within(panel).getByText("Blocked — disagreement")).toBeInTheDocument();

    const reJudgeButton = within(panel).getByRole("button", { name: "Re-judge" });
    expect(reJudgeButton).toBeEnabled();
    await user.click(reJudgeButton);

    await within(panel).findByText("Pending");
    expect(reJudged).toBe(true);
  });
});
