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
        // The server now runs the judge lane in the SAME request (judge-runner.ts) — a
        // successful response reflects the fully-judged outcome (queued), never "judging".
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
          draft: { ...draftB, body: sentBody, bodyHash: "hash-b-edited", status: "queued" },
        });
      }),
      http.get(`/api/drafts/${FIXTURE_DRAFT_B_ID}`, () => {
        if (!edited) return HttpResponse.json(fixtureDraftDetails[FIXTURE_DRAFT_B_ID]);
        return HttpResponse.json({
          draft: { ...draftB, body: editedBody, bodyHash: "hash-b-edited", status: "queued" },
          judgeResults: [
            { id: "g1", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g1", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3s", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_screen", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3f", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_final", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
          ],
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
    expect(within(panel).getByText("Pass")).toBeInTheDocument();
  });

  it("re-judge retries a blocked draft unmodified through the dedicated action and reaches the fully-judged outcome (queued)", async () => {
    const user = userEvent.setup();
    let reJudged = false;

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/rejudge`, () => {
        reJudged = true;
        return HttpResponse.json({ draft: { ...draftB, status: "queued" } });
      }),
      http.get(`/api/drafts/${FIXTURE_DRAFT_B_ID}`, () => {
        if (!reJudged) return HttpResponse.json(fixtureDraftDetails[FIXTURE_DRAFT_B_ID]);
        return HttpResponse.json({
          draft: { ...draftB, status: "queued" },
          judgeResults: [
            { id: "g1", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g1", verdict: "pass", bodyHash: "hash-b", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3s", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_screen", verdict: "pass", bodyHash: "hash-b", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3f", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_final", verdict: "pass", bodyHash: "hash-b", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
          ],
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

    const reJudgeButton = within(panel).getByRole("button", { name: "Re-judge" });
    expect(reJudgeButton).toBeEnabled();
    await user.click(reJudgeButton);

    await within(panel).findByText("Pass");
    expect(reJudged).toBe(true);
  });

  it("a judge failure (e.g. a budget halt) surfaces loudly in the panel instead of vanishing silently", async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/rejudge`, () =>
        HttpResponse.json({ error: "tenant tenant-fixture is over its daily token budget" }, { status: 400 }),
      ),
    );

    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const panel = screen.getByRole("region", { name: "Approve panel" });

    await within(grid).findByText("Run2 X draft");
    await user.click(within(grid).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(panel).findByText("Run2 X draft");

    await user.click(within(panel).getByRole("button", { name: "Re-judge" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(/over its daily token budget/);
    // No unhandled GET override was registered for this test — the refresh
    // that follows a failed action re-fetches the draft's real current
    // state rather than papering over the failure with stale "success" data.
    expect(within(panel).getByText("Blocked — disagreement")).toBeInTheDocument();
  });
});
