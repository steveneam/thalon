// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { draftB, FIXTURE_DRAFT_B_ID, fixtureDraftDetails } from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveSurface } from "../approve-surface";

describe("Approve — operator actions", () => {
  it("the card refreshes to the post-edit, post-re-judge state after save-edit", async () => {
    const user = userEvent.setup();
    const editedBody = "Run2 X draft, now with more detail.";
    let edited = false;

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/edit`, async ({ request }) => {
        const { editedBody: sentBody } = (await request.json()) as { editedBody: string };
        edited = true;
        // The server runs the judge lane in the SAME request (judge-runner.ts) — a
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
          // The real read returns EVERY judge row for the draft, old body
          // hashes included (repos.judgeResults.listForDraft) — that history
          // is what the version strip attributes.
          judgeResults: [
            ...fixtureDraftDetails[FIXTURE_DRAFT_B_ID].judgeResults,
            { id: "g1", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g1", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3s", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_screen", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
            { id: "g3f", tenantId: "t", draftId: FIXTURE_DRAFT_B_ID, gate: "g3_final", verdict: "pass", bodyHash: "hash-b-edited", evidence: { claims: [] }, model: null, promptVersion: null, latencyMs: null, createdAt: "2026-07-04T11:00:00.000Z" },
          ],
        });
      }),
    );

    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 X draft"));
    // The composite block states its own rule — a tier DISAGREEMENT is not
    // visible in any single gate row.
    expect(within(detail()).getByText(/the gate blocks until they agree/)).toBeInTheDocument();

    await user.click(within(detail()).getByRole("button", { name: "Edit" }));
    const textarea = within(detail()).getByRole("textbox", { name: "Edit draft body" });
    await user.clear(textarea);
    await user.type(textarea, editedBody);
    await user.click(within(detail()).getByRole("button", { name: /save edit/i }));

    await waitFor(() => within(detail()).getByText(editedBody));
    expect(edited).toBe(true);
    // The receipt now reflects the NEW body's verdicts: nothing blocks, so
    // it closes itself and the failing reason is gone.
    expect(within(detail()).queryByText(/the gate blocks until they agree/)).not.toBeInTheDocument();
    expect(
      within(detail()).queryByText(/no provided source supports this claim/),
    ).not.toBeInTheDocument();
    expect(within(detail()).queryByRole("group", { name: "Judge verdicts" })).not.toBeInTheDocument();
    // …and the version strip attributes the edit as v2, re-judged.
    expect(within(detail()).getByText(/edited by you/)).toBeInTheDocument();
    expect(within(detail()).getByText("judge re-ran on v2")).toBeInTheDocument();
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

    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 X draft"));
    expect(within(detail()).getByText(/the gate blocks until they agree/)).toBeInTheDocument();

    const reJudgeButton = within(detail()).getByRole("button", { name: "Re-judge" });
    expect(reJudgeButton).toBeEnabled();
    await user.click(reJudgeButton);

    // Every gate passes on the unmodified body: the receipt closes and the
    // approve rail is back.
    await waitFor(() => within(detail()).getByRole("button", { name: "Approve" }));
    expect(within(detail()).queryByRole("group", { name: "Judge verdicts" })).not.toBeInTheDocument();
    expect(reJudged).toBe(true);
  });

  it("a judge failure (e.g. a budget halt) surfaces loudly in the card instead of vanishing silently", async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`/api/drafts/${FIXTURE_DRAFT_B_ID}/rejudge`, () =>
        HttpResponse.json({ error: "tenant tenant-fixture is over its daily token budget" }, { status: 400 }),
      ),
    );

    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 X draft"));

    await user.click(within(detail()).getByRole("button", { name: "Re-judge" }));

    expect(await waitFor(() => within(detail()).getByRole("alert"))).toHaveTextContent(/over its daily token budget/);
    // No unhandled GET override was registered for this test — the refresh
    // that follows a failed action re-fetches the draft's real current
    // state rather than papering over the failure with stale "success" data.
    expect(within(detail()).getByText(/the gate blocks until they agree/)).toBeInTheDocument();
  });
});
