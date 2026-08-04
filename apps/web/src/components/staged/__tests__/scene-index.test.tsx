// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SceneIndex, type IndexScene } from "../scene-index";

const scenes: IndexScene[] = [
  {
    heading: "Hook",
    narration: "Your metrics don't sleep.",
    onScreenText: "Never sleeps",
    visual: "dark dashboard glow",
    motion: "snappy",
    durationMs: 4000,
  },
  {
    heading: "Solution",
    narration: "One live view for the whole team.",
    onScreenText: null,
    visual: null,
    motion: "smooth",
    durationMs: 7000,
  },
];

function setup(over: Partial<Parameters<typeof SceneIndex>[0]> = {}) {
  const onOpen = vi.fn();
  const onAccept = vi.fn();
  const onTweak = vi.fn();
  const onMove = vi.fn();
  const props = {
    scenes,
    openIndex: 0,
    onOpen,
    editable: true,
    busy: false,
    accepted: new Set<number>(),
    motions: ["smooth", "snappy", "bouncy", "dramatic"] as const,
    onAccept,
    onTweak,
    onMove,
    ...over,
  };
  render(<SceneIndex {...props} />);
  return { onOpen, onAccept, onTweak, onMove };
}

/**
 * s101 — nine open scene cards stacked in the pane's one column measured
 * 3219px inside a 764px viewport, and the preview scrolled off the top. ONE
 * row open at a time is what bounds it.
 */
describe("SceneIndex — an index, one scene open at a time", () => {
  it("lists every scene but only expands the open one", () => {
    setup();
    expect(screen.getByRole("button", { name: "Scene 1: Hook" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Scene 2: Solution" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Your metrics don't sleep.")).toBeInTheDocument();
    expect(screen.queryByText("One live view for the whole team.")).not.toBeInTheDocument();
  });

  it("opening a row reports upward — the parent keeps index and preview on the same scene", async () => {
    const user = userEvent.setup();
    const { onOpen } = setup();
    await user.click(screen.getByRole("button", { name: "Scene 2: Solution" }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  /**
   * The founder read the visual line as filler because it WAS dressed as
   * filler — body-copy grey italic with no tag saying what kind of thing it
   * is. Every direction line now carries its own label.
   */
  it("labels each direction line, and says so when a visual is not filled yet", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText("On-screen")).toBeInTheDocument();
    expect(screen.getByText("dark dashboard glow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Scene 2: Solution" }));
    setup({ openIndex: 1 });
    expect(screen.getAllByText(/not filled yet — the scenes stage writes it/).length).toBeGreaterThan(0);
  });

  it("per-beat accept reports the scene index", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    await user.click(screen.getByRole("button", { name: "Accept scene 1" }));
    expect(onAccept).toHaveBeenCalledWith(0);
  });

  it("a scene tweak hands the parent the edited fields", async () => {
    const user = userEvent.setup();
    const { onTweak } = setup();

    await user.click(screen.getByRole("button", { name: "Tweak scene 1" }));
    await user.clear(screen.getByRole("textbox", { name: "Scene 1 on-screen text" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Scene 1 motion" }), "dramatic");
    await user.click(screen.getByRole("button", { name: "Save tweak" }));

    expect(onTweak).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ onScreenText: "", motion: "dramatic", heading: "Hook" }),
    );
  });

  /**
   * A read-only chain shows the artifact and NOT a set of greyed verbs. The
   * old surface hard-disabled 18 accept/tweak buttons on a live run.
   */
  it("a read-only chain draws no verbs at all", () => {
    setup({ editable: false });
    expect(screen.queryByRole("button", { name: "Accept scene 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tweak scene 1" })).not.toBeInTheDocument();
    // The artifact itself is still fully readable.
    expect(screen.getByText("Your metrics don't sleep.")).toBeInTheDocument();
  });

  /** Inert controls answer the press with a reason (s81 grammar), never hard-disabled. */
  it("the first scene's move-up is aria-disabled rather than disabled, and does nothing", async () => {
    const user = userEvent.setup();
    const { onMove } = setup();
    const up = screen.getByRole("button", { name: "Move scene 1 up" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    expect(up).not.toBeDisabled();
    await user.click(up);
    expect(onMove).not.toHaveBeenCalled();
  });
});
