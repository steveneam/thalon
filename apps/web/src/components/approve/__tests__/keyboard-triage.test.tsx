// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  draftA,
  FIXTURE_DRAFT_A_ID,
  FIXTURE_DRAFT_B_ID,
  FIXTURE_DRAFT_C_ID,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveSurface } from "../approve-surface";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApproveQueue — keyboard triage (shared grammar, s40)", () => {
  it("j/k move the selection through the queue (newest-first view, s66) and clamp at the ends", async () => {
    const user = userEvent.setup();
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });

    // The first waiting draft in view order auto-selects (draft B — the view
    // is the reversed stable flatten: B → C → A → the staged demo row).
    const rowB = await within(queue).findByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` });
    expect(rowB).toHaveAttribute("aria-pressed", "true");

    // Clamped at the top of the list.
    await user.keyboard("k");
    expect(rowB).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("j");
    const rowC = within(queue).getByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}` });
    await waitFor(() => expect(rowC).toHaveAttribute("aria-pressed", "true"));

    await user.keyboard("j");
    const rowA = within(queue).getByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` });
    await waitFor(() => expect(rowA).toHaveAttribute("aria-pressed", "true"));

    await user.keyboard("k");
    await waitFor(() => expect(rowC).toHaveAttribute("aria-pressed", "true"));
  });

  it("'a' approves the selected queued draft; typing in a field never triggers shortcuts", async () => {
    const user = userEvent.setup();
    const approved: string[] = [];
    server.use(
      http.post("/api/drafts/:draftId/approve", ({ params }) => {
        approved.push(params.draftId as string);
        return HttpResponse.json({
          approval: { id: "appr", tenantId: "t", draftId: params.draftId, actor: "operator", action: "approve", editedBody: null, createdAt: "2026-07-04T11:00:00.000Z" },
          draft: { ...draftA, status: "approved" },
        });
      }),
    );

    render(<ApproveSurface />);
    const detail = screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Newest-first view (s66) auto-selects the blocked draft — select the queued one.
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await within(detail).findByText("Run2 LinkedIn draft");

    // 'e' opens the editor (queued draft is editable)…
    await user.keyboard("e");
    const textarea = await within(detail).findByRole("textbox", { name: "Edit draft body" });
    // …and single-letter keys typed INSIDE it are just text, not actions.
    await user.type(textarea, "ajr");
    expect(approved).toHaveLength(0);
    expect(textarea).toHaveValue(`${draftA.body}ajr`);

    // Escape cancels the edit, then 'a' approves the selected queued draft.
    await user.keyboard("{Escape}");
    await user.keyboard("a");
    await waitFor(() => expect(approved).toEqual([FIXTURE_DRAFT_A_ID]));
  });

  it("'r' goes through the NAMED confirm — confirms stay intact under keyboard triage", async () => {
    const user = userEvent.setup();
    const rejected: string[] = [];
    server.use(
      http.post("/api/drafts/:draftId/reject", ({ params }) => {
        rejected.push(params.draftId as string);
        return HttpResponse.json({
          approval: { id: "appr", tenantId: "t", draftId: params.draftId, actor: "operator", action: "reject", editedBody: null, createdAt: "2026-07-04T11:00:00.000Z" },
          draft: { ...draftA, status: "rejected" },
        });
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ApproveSurface />);
    const detail = screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await within(detail).findByText("Run2 LinkedIn draft");

    // Declined confirm: nothing happens.
    await user.keyboard("r");
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Reject this linkedin draft/));
    expect(rejected).toHaveLength(0);

    // Accepted confirm: the reject records.
    confirmSpy.mockReturnValue(true);
    await user.keyboard("r");
    await waitFor(() => expect(rejected).toEqual([FIXTURE_DRAFT_A_ID]));
  });
});
