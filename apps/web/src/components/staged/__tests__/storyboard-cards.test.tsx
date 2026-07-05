// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fixtureStoryboardMeta } from "@/lib/staged-flow/fixtures";
import type { StoryboardContent } from "@/lib/staged-flow/types";
import { StoryboardCards } from "../storyboard-cards";

const content: StoryboardContent = {
  title: fixtureStoryboardMeta.title,
  scenes: fixtureStoryboardMeta.scenes,
  cta: fixtureStoryboardMeta.cta,
};

function setup(accepted: ReadonlySet<number> = new Set()) {
  const onEdit = vi.fn();
  const onAccept = vi.fn();
  render(<StoryboardCards content={content} busy={false} accepted={accepted} onEdit={onEdit} onAccept={onAccept} />);
  return { onEdit, onAccept };
}

describe("StoryboardCards — reorder / accept / tweak chips", () => {
  it("reorder emits the verbatim move op plus the contract's sceneIndex repairs", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Move scene 2 up" }));
    expect(onEdit).toHaveBeenCalledWith(
      "reorder",
      [
        { op: "move", from: "/scenes/1", path: "/scenes/0" },
        { op: "replace", path: "/scenes/0/sceneIndex", value: 0 },
        { op: "replace", path: "/scenes/1/sceneIndex", value: 1 },
      ],
      "scene 2 → 1",
    );
  });

  it("edge scenes cannot move past the ends", () => {
    setup();
    expect(screen.getByRole("button", { name: "Move scene 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Move scene ${content.scenes.length} down` })).toBeDisabled();
  });

  it("a tweak commits add/remove/replace ops for exactly the changed fields", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Tweak scene 1" }));
    const narration = screen.getByRole("textbox", { name: "Scene 1 narration" });
    await user.clear(narration);
    await user.type(narration, "Metrics never sleep.");
    // Clearing an optional field is a remove, not a replace-with-empty.
    await user.clear(screen.getByRole("spinbutton", { name: "Scene 1 duration hint" }));
    await user.click(screen.getByRole("button", { name: "Save tweak" }));

    expect(onEdit).toHaveBeenCalledWith(
      "tweak",
      [
        { op: "replace", path: "/scenes/0/narration", value: "Metrics never sleep." },
        { op: "remove", path: "/scenes/0/durationHintMs" },
      ],
      "scene 1",
    );
  });

  it("a tweak with no changes emits nothing", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Tweak scene 2" }));
    await user.click(screen.getByRole("button", { name: "Save tweak" }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("accept reports the beat index; an accepted beat shows pressed and stays put", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup(new Set([2]));

    await user.click(screen.getByRole("button", { name: "Accept scene 1" }));
    expect(onAccept).toHaveBeenCalledWith(0);
    const acceptedChip = screen.getByRole("button", { name: "Accept scene 3" });
    expect(acceptedChip).toHaveAttribute("aria-pressed", "true");
    expect(acceptedChip).toBeDisabled();
  });
});
