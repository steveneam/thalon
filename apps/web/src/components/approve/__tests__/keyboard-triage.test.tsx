// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  draftA,
  FIXTURE_DRAFT_A_ID,
  FIXTURE_DRAFT_B_ID,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — keyboard triage (B6.2 [+])", () => {
  it("j/k move the selection through the grid", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });

    // Run 2 auto-selects draft A first.
    const buttonA = await within(grid).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` });
    expect(buttonA).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("j");
    const buttonB = within(grid).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` });
    await waitFor(() => expect(buttonB).toHaveAttribute("aria-pressed", "true"));
    // Clamped at the end of the list.
    await user.keyboard("j");
    expect(buttonB).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("k");
    await waitFor(() => expect(buttonA).toHaveAttribute("aria-pressed", "true"));
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

    render(<ApproveQueue />);
    const grid = screen.getByRole("region", { name: "Per-platform fan-out grid" });
    const panel = screen.getByRole("region", { name: "Approve panel" });
    await within(grid).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` });
    await within(panel).findByText("Run2 LinkedIn draft");

    // 'e' opens the editor (queued draft is editable)…
    await user.keyboard("e");
    const textarea = await within(panel).findByRole("textbox", { name: "Edit draft body" });
    // …and single-letter keys typed INSIDE it are just text, not actions.
    await user.type(textarea, "ajr");
    expect(approved).toHaveLength(0);
    expect(textarea).toHaveValue(`${draftA.body}ajr`);

    // Escape cancels the edit, then 'a' approves the selected queued draft.
    await user.keyboard("{Escape}");
    await user.keyboard("a");
    await waitFor(() => expect(approved).toEqual([FIXTURE_DRAFT_A_ID]));
  });
});
