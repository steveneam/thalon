// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { directionDocSchema, renderDirectionMd, type DirectionDoc } from "@thalon/contracts";
import { describe, expect, it, vi } from "vitest";
import { fixtureStylePresets } from "@/lib/staged-flow/fixtures";
import { DirectionEditor } from "../direction-editor";

const doc: DirectionDoc = directionDocSchema.parse({
  docVersion: "direction.v1",
  title: "Fernwood in 60 seconds",
  aspect: "16:9",
  fps: 30,
  pacing: "medium",
  scenes: [
    {
      sceneIndex: 0,
      heading: "Hook",
      narration: "Your metrics don't sleep.",
      onScreenText: "Never sleeps",
      visual: "dark dashboard glow",
      motion: "snappy",
      durationMs: 4000,
    },
    {
      sceneIndex: 1,
      heading: "Solution",
      narration: "One live view for the whole team.",
      onScreenText: null,
      visual: "single pane assembling",
      motion: "smooth",
      durationMs: 7000,
    },
  ],
  cta: "Start free",
});

function setup() {
  const onEdit = vi.fn();
  const onAccept = vi.fn();
  render(
    <DirectionEditor
      doc={doc}
      docKey="hash-1"
      presets={fixtureStylePresets}
      busy={false}
      accepted={new Set()}
      onEdit={onEdit}
      onAccept={onAccept}
    />,
  );
  return { onEdit, onAccept };
}

describe("DirectionEditor — form view", () => {
  it("a doc-level field commits one replace op", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "Pacing" }), "fast");
    expect(onEdit).toHaveBeenCalledWith("tweak", [{ op: "replace", path: "/pacing", value: "fast" }], "document");
  });

  it("a scene tweak commits replaces on exactly the changed fields; blank nullable fields become null", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Tweak scene 1" }));
    await user.clear(screen.getByRole("textbox", { name: "Scene 1 on-screen text" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Scene 1 motion" }), "dramatic");
    await user.click(screen.getByRole("button", { name: "Save tweak" }));

    expect(onEdit).toHaveBeenCalledWith(
      "tweak",
      [
        { op: "replace", path: "/scenes/0/onScreenText", value: null },
        { op: "replace", path: "/scenes/0/motion", value: "dramatic" },
      ],
      "scene 1",
    );
  });

  it("a profile style preset replaces the style fields, including every scene's motion", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Apply preset Short-form vertical" }));
    expect(onEdit).toHaveBeenCalledWith(
      "preset",
      [
        { op: "replace", path: "/aspect", value: "9:16" },
        { op: "replace", path: "/pacing", value: "fast" },
        // scene 0 is already snappy — only scene 1 needs the motion replace.
        { op: "replace", path: "/scenes/1/motion", value: "snappy" },
      ],
      "short-vertical",
    );
  });

  it("per-beat accept chips report the scene index", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    await user.click(screen.getByRole("button", { name: "Accept scene 2" }));
    expect(onAccept).toHaveBeenCalledWith(1);
  });
});

describe("DirectionEditor — raw strict-md view (same schema as the form)", () => {
  it("shows the byte-exact rendered document and applies a valid edit as a structured diff patch", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Raw direction.md" }));
    const textarea = screen.getByRole("textbox", { name: "Raw direction.md" }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(renderDirectionMd(doc));

    fireEvent.change(textarea, {
      target: { value: textarea.value.replace("title: Fernwood in 60 seconds", "title: Fernwood, in one minute") },
    });
    await user.click(screen.getByRole("button", { name: "Apply raw edit" }));

    expect(onEdit).toHaveBeenCalledWith(
      "raw_md",
      [{ op: "replace", path: "/title", value: "Fernwood, in one minute" }],
      "raw direction.md edit",
    );
  });

  it("surfaces parse errors loudly with their line numbers and applies nothing", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Raw direction.md" }));
    const textarea = screen.getByRole("textbox", { name: "Raw direction.md" }) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: textarea.value.replace("- motion: snappy", "- motion: wobbly") },
    });
    await user.click(screen.getByRole("button", { name: "Apply raw edit" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/direction\.md line \d+/);
    expect(alert).toHaveTextContent(/"wobbly" is not one of smooth \| snappy \| bouncy \| dramatic/);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("an unchanged document reports 'no changes' instead of an empty capture", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Raw direction.md" }));
    await user.click(screen.getByRole("button", { name: "Apply raw edit" }));

    expect(screen.getByRole("status")).toHaveTextContent("No changes to apply.");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
