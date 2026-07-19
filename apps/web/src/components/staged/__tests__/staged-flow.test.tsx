// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApproveQueue } from "@/components/approve/approve-queue";
import { FIXTURE_STORYBOARD_DRAFT_ID } from "@/lib/staged-flow/fixtures";

/**
 * The advanced-mode walk, end to end against the MSW seam: queue → staged
 * surface → rail navigation → candidate pick → direction editing → advance
 * gate → polish → final stage. The operator reacts to visible artifacts at
 * every step, and every interaction lands in the capture log.
 */
async function openStagedSurface(user: ReturnType<typeof userEvent.setup>) {
  render(<ApproveQueue />);
  await user.click(
    await screen.findByRole("button", { name: `Select video draft ${FIXTURE_STORYBOARD_DRAFT_ID}` }),
  );
  return await screen.findByRole("region", { name: "Staged video flow" });
}

describe("StagedFlow — the B5.4 advanced-mode surface", () => {
  it("selecting a stage-artifact draft swaps the detail pane for the staged surface, landing on the current stage's candidates", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    // The plain detail pane is gone; the plan's stages render as the rail.
    expect(screen.queryByRole("region", { name: "Draft detail" })).not.toBeInTheDocument();
    expect(within(surface).getByRole("button", { name: "View stage 1: Structure" })).toBeInTheDocument();
    expect(within(surface).getByRole("button", { name: "View stage 2: Scenes & effects" })).toBeInTheDocument();
    // Polish is locked until the flow reaches it.
    expect(within(surface).getByRole("button", { name: "View stage 3: Polish" })).toBeDisabled();

    // Current stage = scenes/effects, offering its 2–3 takes — never a blank prompt box.
    expect(within(surface).getByText("Kinetic typography")).toBeInTheDocument();
    expect(within(surface).getByText("Product walkthrough")).toBeInTheDocument();
    expect(within(surface).getByText("Illustrated gradients")).toBeInTheDocument();

    // The structural gate, mirrored in the UI: nothing to advance until a pick.
    expect(within(surface).getByRole("button", { name: "Generate Polish" })).toBeDisabled();
    expect(within(surface).getByText("Pick a candidate to continue.")).toBeInTheDocument();
  });

  it("the rail navigates back to the judged storyboard, whose cards and preview are visible artifacts", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    await user.click(within(surface).getByRole("button", { name: "View stage 1: Structure" }));
    const cards = within(surface).getByRole("group", { name: "Storyboard cards" });
    expect(within(cards).getByText("Hook — the 3am dashboard")).toBeInTheDocument();
    expect(within(cards).getByText("Teams stitch together five tools to answer one question.")).toBeInTheDocument();
    // The per-stage preview seam renders the low-res stub with the scene timeline.
    const preview = within(surface).getByRole("region", { name: "Stage preview" });
    expect(within(preview).getByRole("button", { name: "Preview scene 2: Problem" })).toBeInTheDocument();
  });

  it("pick → direction editor → judged queued → advance → polish candidates → final stage, captures counted throughout", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    // Pick a take: the stage resolves to a judged direction_doc draft.
    await user.click(within(surface).getByRole("button", { name: "Pick candidate Kinetic typography" }));
    await within(surface).findByRole("group", { name: "Direction editor" });
    expect(within(surface).getByText(/1 interaction/)).toBeInTheDocument();

    // A form tweak round-trips as a captured patch (pacing is a doc-level style field).
    await user.selectOptions(within(surface).getByRole("combobox", { name: "Pacing" }), "fast");
    await within(surface).findByText(/2 interactions/);

    // The gate is open now (fake judge passed the pick + tweak) — advance to polish.
    await user.click(within(surface).getByRole("button", { name: "Generate Polish" }));
    await within(surface).findByText("Punchier on-screen copy");
    expect(within(surface).getByText("Tighter narration")).toBeInTheDocument();

    // Pick the polish take: final stage, export is core — no further advance.
    await user.click(within(surface).getByRole("button", { name: "Pick candidate Tighter narration" }));
    await within(surface).findByText(/Final stage — export to timeline\/SRT\/render manifest is deterministic core/);
    expect(within(surface).queryByRole("button", { name: /Generate/ })).not.toBeInTheDocument();
    expect(within(surface).getByText(/3 interactions/)).toBeInTheDocument();
  });

  it("per-beat accept chips capture the explicit no-change signal and mark the beat", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    await user.click(within(surface).getByRole("button", { name: "View stage 1: Structure" }));
    await user.click(within(surface).getByRole("button", { name: "Accept scene 1" }));
    await within(surface).findByRole("button", { name: "Accept scene 1", pressed: true });
    expect(within(surface).getByText(/1 interaction/)).toBeInTheDocument();
  });

  it("classic drafts keep the plain list + detail flow untouched", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = screen.getByRole("region", { name: "Draft detail" });
    // Newest-first view (s66) auto-selects the blocked draft — walk to the classic queued one.
    await user.click(await within(queue).findByRole("button", { name: /Select linkedin draft aaaaaaaa/ }));
    await within(detail).findByText("Run2 LinkedIn draft");
    expect(screen.queryByRole("region", { name: "Staged video flow" })).not.toBeInTheDocument();
    // The staged chain rides the queue as its own row.
    const stagedRow = within(queue).getByRole("button", {
      name: `Select video draft ${FIXTURE_STORYBOARD_DRAFT_ID}`,
    });
    await user.click(stagedRow);
    await screen.findByRole("region", { name: "Staged video flow" });
  });
});
