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

  it("'r' goes through the reason ASK (W1) — the prompt stays intact under keyboard triage", async () => {
    const user = userEvent.setup();
    const rejected: Array<{ id: string; reason: string | undefined }> = [];
    server.use(
      http.post("/api/drafts/:draftId/reject", async ({ params, request }) => {
        const body = (await request.json().catch(() => ({}))) as { reason?: string };
        rejected.push({ id: params.draftId as string, reason: body?.reason });
        return HttpResponse.json({
          approval: { id: "appr", tenantId: "t", draftId: params.draftId, actor: "operator", action: "reject", editedBody: null, createdAt: "2026-07-04T11:00:00.000Z" },
          draft: { ...draftA, status: "rejected" },
        });
      }),
    );
    // The reject control is the learn loop's front door: it ASKS for a
    // reason (Cancel = null keeps the draft; a stated reason rides the wire
    // and becomes the eval row server-side — s90 window).
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    render(<ApproveSurface />);
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));

    // Cancelled ask: nothing happens.
    await user.keyboard("r");
    expect(promptSpy).toHaveBeenCalledWith(expect.stringMatching(/Reject this linkedin draft/), "");
    expect(rejected).toHaveLength(0);

    // A stated reason: the reject records WITH the reason on the wire.
    promptSpy.mockReturnValue("cites a benchmark we never ran");
    await user.keyboard("r");
    await waitFor(() =>
      expect(rejected).toEqual([
        { id: FIXTURE_DRAFT_A_ID, reason: "cites a benchmark we never ran" },
      ]),
    );
  });

  it("a BLANK reason is a bare decision — the reject records with no reason field on the wire", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/drafts/:draftId/reject", async ({ request }) => {
        bodies.push(await request.json().catch(() => null));
        return HttpResponse.json({
          approval: { id: "appr", tenantId: "t", draftId: FIXTURE_DRAFT_A_ID, actor: "operator", action: "reject", editedBody: null, createdAt: "2026-07-04T11:00:00.000Z" },
          draft: { ...draftA, status: "rejected" },
        });
      }),
    );
    vi.spyOn(window, "prompt").mockReturnValue("   ");

    render(<ApproveSurface />);
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await user.click(await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }));
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));

    await user.keyboard("r");
    // Whitespace trims to blank ⇒ no JSON body at all — the seat treats the
    // rejection as a decision, not a correction, and no eval row lands.
    await waitFor(() => expect(bodies).toEqual([null]));
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
