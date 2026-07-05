// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StagePreview, type PreviewScene } from "../stage-preview";

const scenes: PreviewScene[] = [
  { heading: "Hook", onScreenText: "Never sleeps", visual: "dark dashboard glow", motion: "snappy", durationMs: 4000 },
  { heading: "Solution", onScreenText: "One live view", visual: null, motion: "smooth", durationMs: 6000 },
];

describe("StagePreview — the low-res preview stub behind the player seam", () => {
  it("renders the aspect, total duration, and the selected scene's on-screen text", () => {
    render(<StagePreview aspect="16:9" scenes={scenes} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });
    expect(within(preview).getByText("16:9 · 0:10")).toBeInTheDocument();
    expect(within(preview).getByText("Never sleeps")).toBeInTheDocument();
    expect(within(preview).getByText("dark dashboard glow")).toBeInTheDocument();
  });

  it("scrubbing the timeline switches scenes; unfilled visuals say so", async () => {
    const user = userEvent.setup();
    render(<StagePreview aspect="9:16" scenes={scenes} />);
    const preview = screen.getByRole("region", { name: "Stage preview" });

    await user.click(within(preview).getByRole("button", { name: "Preview scene 2: Solution" }));
    expect(within(preview).getByText("One live view")).toBeInTheDocument();
    expect(within(preview).getByText(/visual direction pending/)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Preview scene 2: Solution" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
