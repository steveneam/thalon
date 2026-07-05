// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApproveQueue } from "@/components/approve/approve-queue";
import { FIXTURE_STAGED_RUN_ID } from "@/lib/staged-flow/fixtures";

/**
 * The advanced-mode walk, end to end against the MSW seam: feed → staged
 * surface → rail navigation → candidate pick → direction editing → advance
 * gate → polish → final stage. The operator reacts to visible artifacts at
 * every step, and every interaction lands in the capture log.
 */
async function openStagedSurface(user: ReturnType<typeof userEvent.setup>) {
  render(<ApproveQueue />);
  await user.click(await screen.findByRole("button", { name: `Select run ${FIXTURE_STAGED_RUN_ID}` }));
  return await screen.findByRole("region", { name: "Staged video flow" });
}

describe("StagedFlow — the B5.4 advanced-mode surface", () => {
  it("selecting the staged run swaps zones 2+3 for the staged surface, landing on the current stage's candidates", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    // The classic zones are gone; the plan's stages render as the rail.
    expect(screen.queryByRole("region", { name: "Per-platform fan-out grid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Approve panel" })).not.toBeInTheDocument();
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

  it("classic runs keep the 3-zone flow untouched", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const grid = await screen.findByRole("region", { name: "Per-platform fan-out grid" });
    await within(grid).findByText("Run2 LinkedIn draft");
    expect(screen.getByRole("region", { name: "Approve panel" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Staged video flow" })).not.toBeInTheDocument();
    // The staged run rides the feed as its own row.
    expect(screen.getByRole("button", { name: `Select run ${FIXTURE_STAGED_RUN_ID}` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Select run ${FIXTURE_STAGED_RUN_ID}` }));
    await screen.findByRole("region", { name: "Staged video flow" });
  });
});
