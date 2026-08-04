// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { directionDocSchema, renderDirectionMd, type DirectionDoc } from "@thalon/contracts";
import { describe, expect, it, vi } from "vitest";
import { fixtureStylePresets } from "@/lib/staged-flow/fixtures";
import { DirectionFacts } from "../direction-editor";

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

function setup(editable = true) {
  const onEdit = vi.fn();
  render(
    <DirectionFacts
      doc={doc}
      docKey="hash-1"
      presets={fixtureStylePresets}
      editable={editable}
      busy={false}
      onEdit={onEdit}
    />,
  );
  return { onEdit };
}

/**
 * s101 — the founder's report ("Aspect (compile-time frame)" wrapping three
 * lines, the title truncated). The style fields were five labelled inputs in a
 * grid whose VIEWPORT breakpoints resolved to three 46.7px columns inside the
 * 560px pane. They are chips now: value first, label as the small print.
 */
describe("DirectionFacts — the direction as chips", () => {
  it("states aspect, fps, pacing and the CTA at rest, with no form in the way", () => {
    setup();
    const facts = screen.getByRole("group", { name: "Direction" });
    expect(facts.textContent).toContain("16:9");
    expect(facts.textContent).toContain("30");
    expect(facts.textContent).toContain("medium");
    expect(facts.textContent).toContain("Start free");
    // The editor is behind a door, not lying open in a 46px column.
    expect(screen.queryByRole("combobox", { name: "Pacing" })).not.toBeInTheDocument();
  });

  /**
   * A LIVE one-prompt chain used to render this whole editor and hard-disable
   * it — 26 of 41 controls dead on arrival. Absent beats greyed: the facts are
   * still readable, the doors that cannot work are simply not drawn.
   */
  it("a read-only chain gets the facts and NO edit doors at all", () => {
    setup(false);
    expect(screen.getByRole("group", { name: "Direction" }).textContent).toContain("16:9");
    expect(screen.queryByRole("button", { name: "Edit direction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raw .md" })).not.toBeInTheDocument();
  });

  it("a doc-level field commits one replace op", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Edit direction" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Pacing" }), "fast");
    expect(onEdit).toHaveBeenCalledWith("tweak", [{ op: "replace", path: "/pacing", value: "fast" }], "document");
  });

  it("a profile style preset replaces the style fields, including every scene's motion", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole("button", { name: "Edit direction" }));
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
});

describe("DirectionFacts — raw strict-md view (same schema as the chips)", () => {
  async function openRaw(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Raw .md" }));
    return screen.getByRole("textbox", { name: "Raw direction.md" }) as HTMLTextAreaElement;
  }

  it("shows the byte-exact rendered document and applies a valid edit as a structured diff patch", async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    const textarea = await openRaw(user);
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

    const textarea = await openRaw(user);
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

    await openRaw(user);
    await user.click(screen.getByRole("button", { name: "Apply raw edit" }));

    expect(screen.getByRole("status")).toHaveTextContent("No changes to apply.");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
