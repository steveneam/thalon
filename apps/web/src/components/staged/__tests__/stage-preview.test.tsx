// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StagePreview, type PreviewScene } from "../stage-preview";

const scenes: PreviewScene[] = [
  { heading: "Hook", onScreenText: "Never sleeps", visual: "dark dashboard glow", motion: "snappy", durationMs: 4000 },
  { heading: "Solution", onScreenText: "One live view", visual: null, motion: "smooth", durationMs: 6000 },
];

describe("StagePreview — the composed frame behind the player seam", () => {
  it("renders the aspect, total duration, which scene is showing, and its on-screen text", () => {
    render(<StagePreview aspect="16:9" scenes={scenes} sceneIndex={0} onScene={vi.fn()} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });
    expect(within(preview).getByText("16:9 · 0:10")).toBeInTheDocument();
    expect(within(preview).getByText("scene 1 of 2 · Hook")).toBeInTheDocument();
    expect(within(preview).getByText("Never sleeps")).toBeInTheDocument();
    expect(within(preview).getByText("dark dashboard glow")).toBeInTheDocument();
  });

  /**
   * s101 — the founder's "the scenes look like placeholder" report. Nine real
   * grounded scenes were being introduced by a header that called the whole
   * thing a stub. The honesty stayed; it moved to the note under the frame,
   * which says what this IS rather than dismissing what it shows.
   */
  it("does not call itself a stub in its own title — the honesty is a note about what it is", () => {
    render(<StagePreview aspect="16:9" scenes={scenes} sceneIndex={0} onScene={vi.fn()} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });
    expect(preview.textContent).not.toMatch(/stub/i);
    expect(within(preview).getByText(/composed from the direction — not a render/)).toBeInTheDocument();
  });

  /**
   * The scrubber is CONTROLLED. It used to own private state, so the preview
   * and the scene list could point at different scenes with nothing on screen
   * admitting it.
   */
  it("scrubbing reports the scene upward rather than moving on its own", async () => {
    const onScene = vi.fn();
    const user = userEvent.setup();
    render(<StagePreview aspect="9:16" scenes={scenes} sceneIndex={0} onScene={onScene} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });

    await user.click(within(preview).getByRole("button", { name: "Preview scene 2: Solution" }));
    expect(onScene).toHaveBeenCalledWith(1);
    // Still showing scene 1: the parent owns the selection.
    expect(within(preview).getByText("scene 1 of 2 · Hook")).toBeInTheDocument();
  });

  it("an unfilled visual says so instead of leaving the caption bar blank", () => {
    render(<StagePreview aspect="16:9" scenes={scenes} sceneIndex={1} onScene={vi.fn()} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });
    expect(within(preview).getByText(/no visual direction yet/)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Preview scene 2: Solution" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
