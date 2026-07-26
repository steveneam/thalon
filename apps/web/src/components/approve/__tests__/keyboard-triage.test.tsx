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
import {
  FIXTURE_STAGED_PLATFORM,
  FIXTURE_STORYBOARD_DRAFT_ID,
} from "@/lib/staged-flow/fixtures";
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
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Newest-first view (s66) auto-selects the blocked draft — select the queued one.
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));

    // 'e' opens the editor (queued draft is editable)…
    await user.keyboard("e");
    const textarea = await waitFor(() => within(detail()).getByRole("textbox", { name: "Edit draft body" }));
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
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));

    // Declined confirm: nothing happens.
    await user.keyboard("r");
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Reject this linkedin draft/));
    expect(rejected).toHaveLength(0);

    // Accepted confirm: the reject records.
    confirmSpy.mockReturnValue(true);
    await user.keyboard("r");
    await waitFor(() => expect(rejected).toEqual([FIXTURE_DRAFT_A_ID]));
  });

  /**
   * s77/s79 A2 — measured live before the fix: with a staged row selected,
   * `j` did nothing (control: it moved 1→2 on a plain row) while the footer
   * still advertised j · k · a · r · e. The whole grammar rode one master
   * gate, so the operator was stranded on that row with no keyboard way off
   * it. Navigation is never owned by the detail pane.
   */
  describe("a staged row does not trap the keyboard", () => {
    async function selectStagedRow(user: ReturnType<typeof userEvent.setup>) {
      const queue = await screen.findByRole("region", { name: "Approve queue" });
      const staged = await within(queue).findByRole("button", {
        name: `Select ${FIXTURE_STAGED_PLATFORM} draft ${FIXTURE_STORYBOARD_DRAFT_ID}`,
      });
      await user.click(staged);
      await waitFor(() => expect(staged).toHaveAttribute("aria-pressed", "true"));
      return { queue, staged };
    }

    it("j still moves the selection off a staged row", async () => {
      const user = userEvent.setup();
      render(<ApproveSurface />);
      const { staged } = await selectStagedRow(user);

      await user.keyboard("k");
      await waitFor(() => expect(staged).toHaveAttribute("aria-pressed", "false"));
    });

    it("states that a/r/e are not wired for it, instead of advertising five live keys", async () => {
      const user = userEvent.setup();
      render(<ApproveSurface />);
      const { queue } = await selectStagedRow(user);

      expect(
        within(queue).getByText(/a · r · e aren’t wired for a staged draft/),
      ).toBeInTheDocument();
      for (const key of ["a", "r", "e"]) {
        expect(within(queue).getByText(key)).toHaveClass("kbd-off");
      }
      // Navigation keys are never dimmed — they always work.
      for (const key of ["j", "k"]) {
        expect(within(queue).getByText(key)).not.toHaveClass("kbd-off");
      }
    });

    it("says nothing and dims nothing on a plain row", async () => {
      render(<ApproveSurface />);
      const queue = await screen.findByRole("region", { name: "Approve queue" });
      await waitFor(() =>
        expect(within(queue).queryByText(/aren’t wired for a staged draft/)).not.toBeInTheDocument(),
      );
      for (const key of ["j", "k", "a", "r", "e"]) {
        expect(within(queue).getByText(key)).not.toHaveClass("kbd-off");
      }
    });

    it("'a' does not act while a staged row is selected — no silent no-op verb", async () => {
      const user = userEvent.setup();
      const approved: string[] = [];
      server.use(
        http.post("/api/drafts/:draftId/approve", ({ params }) => {
          approved.push(String(params.draftId));
          return HttpResponse.json({ ok: true });
        }),
      );
      render(<ApproveSurface />);
      await selectStagedRow(user);

      await user.keyboard("a");
      expect(approved).toEqual([]);
    });
  });
});
