// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Edl } from "@thalon/contracts";
import { resetAuditions } from "@/components/media/take-audition";
import { EditorInspector } from "@/components/videos/editor-inspector";
import { EditorTimeline, type Selection } from "@/components/videos/editor-timeline";
import type { TakeView } from "@/lib/videos/types";

/**
 * THE POLISH TAIL (s82, lane `editor-polish`) — the s78 medium/low findings
 * that live in the inspector, the timeline and the two videos stylesheets,
 * plus the `high` remnant the s80 build-out left behind.
 *
 * These render the two COMPONENTS directly rather than the whole editor. That
 * is not a shortcut: every guarantee below is a property of a lane, a plate or
 * a knob, and driving it through `editor.tsx` would couple this file to a
 * surface another lane is editing in parallel this session. The findings whose
 * whole defect was a CSS declaration are pinned next door in
 * `editor-polish-s82-css.test.ts` — jsdom computes no layout and cannot read a
 * stylesheet, and a vitest file has one environment.
 *
 * Every case makes the mistake first and then checks the operator can get back,
 * because the R-lens findings were never "a function is missing" — they were
 * "an act cannot be undone".
 */

/** A cut with two beats, a caption pair, and an encoded music cue with a measured tail. */
function edl(): Edl {
  return {
    version: 1,
    name: "film-16x9",
    output: {
      width: 1280,
      height: 720,
      fps: 24,
      duration: 12,
      video: { mode: "encode", codec: "libx264", crf: 18, preset: "medium", pixFmt: "yuv420p" },
    },
    video: [
      {
        name: "beat-01-the-long-descriptive-one",
        source: { kind: "take", ref: "motion/keepers/beat-01.mp4" },
        in: 0,
        duration: 6,
      },
      {
        name: "beat-02",
        source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
        in: 0,
        duration: 6,
      },
    ],
    audio: [
      {
        mode: "encode",
        source: { kind: "audio", ref: "music-candidates/cello-03.mp3" },
        offset: 3,
        gainDb: -6,
        fadeOut: { start: 9.4, duration: 2.6 },
      },
    ],
    captions: {
      style: {
        font: "FreeSerif-Italic",
        pointsize: 42,
        kerning: 2,
        fill: "#eaaa40",
        glowFill: "#eaaa40",
      },
      lines: [
        { text: "one prompt", x: 100, y: 600, fadeIn: 1, fadeOut: 3, ramp: 0.4 },
        { text: "one film", x: 100, y: 600, fadeIn: 5, fadeOut: 7, ramp: 0.4 },
      ],
    },
  };
}

const TAKES: TakeView[] = [
  {
    id: "b1",
    slot: null,
    kind: "audio",
    disposition: "keeper",
    ref: "music-candidates/cello-03.mp3",
    reason: null,
    provenance: {},
    poster: null,
    createdAt: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "b2",
    slot: null,
    kind: "audio",
    disposition: "reject",
    ref: "music-candidates/piano-01.mp3",
    reason: "too bright under the second caption",
    provenance: {},
    poster: null,
    createdAt: "2026-07-20T00:00:00.000Z",
  },
];

/** The timeline under test, with an EDL the caller can watch change. */
function Timeline({
  propBeats = new Set<number>(),
  propCaptions = new Set<number>(),
  propMusic = false,
  refusedCaptions,
  source = edl(),
}: {
  propBeats?: ReadonlySet<number>;
  propCaptions?: ReadonlySet<number>;
  propMusic?: boolean;
  refusedCaptions?: ReadonlySet<number>;
  source?: Edl;
}) {
  return (
    <div className="content editor-surface">
      <EditorTimeline
        edl={source}
        selection={null}
        onSelect={vi.fn()}
        onEdl={vi.fn()}
        playhead={null}
        onPlayhead={vi.fn()}
        propBeats={propBeats}
        propCaptions={propCaptions}
        propMusic={propMusic}
        refusedCaptions={refusedCaptions}
        onNotice={vi.fn()}
      />
    </div>
  );
}

/**
 * The inspector under test, holding the EDL the way the editor's `apply()`
 * funnel does — so a knob's effect on the cut is a real round trip and not a
 * spy assertion.
 */
function Inspector({
  selection,
  start = edl(),
  takes = TAKES,
  onChange,
}: {
  selection: Exclude<Selection, null>;
  start?: Edl;
  takes?: TakeView[];
  onChange?: (next: Edl) => void;
}) {
  const [held, setHeld] = useState<Edl>(start);
  return (
    <div className="content editor-surface">
      <EditorInspector
        projectId="p1"
        edl={held}
        takes={takes}
        selection={selection}
        playable={false}
        onEdl={(fn) => {
          const next = fn(held);
          setHeld(next);
          onChange?.(next);
        }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    </div>
  );
}

describe("B10 — the beat block's label and its proposal mark (a `high` remnant)", () => {
  it("labels the block with the sheet's ordinal and keeps the name where it cannot clip", () => {
    const { container } = render(<Timeline />);

    const blocks = Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk"));
    expect(blocks).toHaveLength(2);
    // The sheet's own label ("01"), in a span that never shrinks.
    expect(blocks[0].querySelector(".blk-ord")?.textContent).toBe("01");
    expect(blocks[1].querySelector(".blk-ord")?.textContent).toBe("02");
    // The name is present but ellipsisable — the fact that used to clip
    // mid-token is now in a box that can show it went short.
    expect(blocks[0].querySelector(".blk-lbl")?.textContent).toBe(
      "· beat-01-the-long-descriptive-one",
    );
    // And it is on the accessible name, which no width can truncate.
    expect(blocks[0].getAttribute("aria-label")).toBe(
      "Beat 01 · beat-01-the-long-descriptive-one · 6s",
    );
    expect(blocks[0].getAttribute("title")).toContain("beat-01-the-long-descriptive-one");
  });

  it("draws the proposal word out of the text flow, and says it in the accessible name", () => {
    const { container } = render(<Timeline propBeats={new Set([0])} />);

    const block = container.querySelector<HTMLElement>(".lane-tr .blk");
    expect(block?.querySelector(".prop-tag")?.textContent).toBe("proposed");
    expect(block?.getAttribute("aria-label")).toContain("proposed change");
  });
});

describe("B2/B3 — proposal and judge-refusal marks on the caption and music lanes", () => {
  it("gives a proposed caption plate the word, an accessible state and a mark", () => {
    const { container } = render(<Timeline propCaptions={new Set([1])} />);

    const plates = Array.from(container.querySelectorAll<HTMLElement>(".blk-cap"));
    expect(plates[0].className).not.toContain("prop");
    expect(plates[1].className).toContain("prop");
    expect(plates[1].getAttribute("aria-label")).toBe("Caption 2: one film · proposed change");
    expect(plates[1].querySelector(".cap-mark")).not.toBeNull();
    // The WORD, once per lane — a 22px plate cannot hold it, and border colour
    // alone was the whole defect.
    expect(screen.getByText("proposed")).toHaveClass("prop-tag");
  });

  it("marks a judge-refused caption in the error channel, distinctly from a proposal", () => {
    const { container } = render(
      <Timeline propCaptions={new Set([0])} refusedCaptions={new Set([1])} />,
    );

    const plates = Array.from(container.querySelectorAll<HTMLElement>(".blk-cap"));
    expect(plates[1].className).toContain("refused");
    expect(plates[1].getAttribute("aria-label")).toBe("Caption 2: one film · refused by the judge");
    expect(plates[1].querySelector(".cap-mark.refused")).not.toBeNull();
    expect(screen.getByText("refused")).toHaveClass("refused-tag");
  });

  it("carries both marks when one plate is proposed AND refused", () => {
    const { container } = render(
      <Timeline propCaptions={new Set([0])} refusedCaptions={new Set([0])} />,
    );

    const plate = container.querySelector<HTMLElement>(".blk-cap");
    expect(plate?.getAttribute("aria-label")).toBe(
      "Caption 1: one prompt · proposed change · refused by the judge",
    );
  });

  it("defaults the refusal set, so an unwired caller cannot half-render a mark", () => {
    const { container } = render(<Timeline propCaptions={new Set([0])} />);
    expect(container.querySelector(".blk-cap.refused")).toBeNull();
    expect(screen.queryByText("refused")).toBeNull();
  });

  it("names a proposal on the music block, which has no text of its own", () => {
    const { container } = render(<Timeline propMusic />);

    const music = container.querySelector<HTMLElement>(".blk-music");
    expect(music?.getAttribute("aria-label")).toBe(
      "Music bed music-candidates/cello-03.mp3 · offset 3s · gain -6dB · proposed change",
    );
    expect(music?.querySelector(".prop-tag")?.textContent).toBe("proposed");
  });
});

describe("B6 — the stream-copied cue reads selectable-not-draggable", () => {
  const copied = (): Edl => {
    const base = edl();
    return {
      ...base,
      audio: [{ ...base.audio[0], mode: "copy" }],
    };
  };

  it("classes the mode onto the block and draws the constraint", () => {
    const { container } = render(<Timeline source={copied()} />);

    const music = container.querySelector<HTMLElement>(".blk-music");
    expect(music?.className).toContain("copy");
    expect(music?.querySelector(".mode-tag")?.textContent).toBe("no knobs");
    expect(music?.getAttribute("aria-label")).toContain("no knobs by contract");
  });

  it("leaves an encoded cue draggable, with no constraint tag", () => {
    const { container } = render(<Timeline />);

    const music = container.querySelector<HTMLElement>(".blk-music");
    expect(music?.className).not.toContain("copy");
    expect(music?.querySelector(".mode-tag")).toBeNull();
  });
});

describe("B7 — the endcard overlay's freeze fact is drawn, not tooltipped", () => {
  const withEndcard = (): Edl => {
    const base = edl();
    return {
      ...base,
      video: [
        ...base.video,
        {
          name: "endcard.mp4",
          source: { kind: "take", ref: "stills/endcard.png" },
          in: 0,
          duration: 2,
          // `at` is the trim/freeze boundary, and `overlay-fade` is what makes
          // splitLane treat this clip as the tail rather than a beat.
          at: 10,
          transitionIn: { type: "overlay-fade", duration: 0.5 },
        },
      ],
    };
  };

  it("renders the freeze second first, and drops the title that could never show", () => {
    const { container } = render(<Timeline source={withEndcard()} />);

    const marker = container.querySelector<HTMLElement>(".blk-overlay");
    expect(marker).not.toBeNull();
    expect(marker?.querySelector(".blk-overlay-fact")?.textContent).toBe("endcard · freeze 10s");
    expect(marker?.textContent).toContain("endcard.mp4");
    // The dead channel is gone. `pointer-events: none` STAYS — the marker spans
    // the beats underneath it, so making it hoverable would swallow their
    // drags — which is exactly why the fact had to move into the text.
    expect(marker?.hasAttribute("title")).toBe(false);
  });
});

describe("B1 — remove-easing restores the values it held", () => {
  it("brings the measured tail back verbatim instead of fabricating defaults", async () => {
    const user = userEvent.setup();
    const seen: Edl[] = [];
    render(<Inspector selection={{ kind: "music" }} onChange={(next) => seen.push(next)} />);

    expect(screen.getByLabelText("tail at (s)")).toHaveValue(9.4);
    await user.click(screen.getByRole("button", { name: "Remove easing" }));
    expect(seen.at(-1)?.audio[0].fadeOut).toBeUndefined();

    // The apparent inverse is now the real one, and it says so.
    const restore = screen.getByRole("button", { name: "Restore tail easing" });
    expect(restore.getAttribute("title")).toContain("2.6s at 9.4s");
    await user.click(restore);
    expect(seen.at(-1)?.audio[0].fadeOut).toEqual({ start: 9.4, duration: 2.6 });
  });

  it("still offers the fabricated default when there is nothing held — and states it", async () => {
    const base = edl();
    const noTail: Edl = { ...base, audio: [{ ...base.audio[0], fadeOut: undefined }] };
    const user = userEvent.setup();
    const seen: Edl[] = [];
    render(
      <Inspector
        selection={{ kind: "music" }}
        start={noTail}
        onChange={(next) => seen.push(next)}
      />,
    );

    const add = screen.getByRole("button", { name: "Add tail easing" });
    expect(add.getAttribute("title")).toBe("Add tail easing — 1.5s, starting 2s before the end");
    await user.click(add);
    expect(seen.at(-1)?.audio[0].fadeOut).toEqual({ start: 10, duration: 1.5 });
  });
});

describe("B5 — flattening a pan axis keeps its destination for the return trip", () => {
  const panning = (): Edl => {
    const base = edl();
    return {
      ...base,
      video: base.video.map((clip, i) =>
        i === 0 ? { ...clip, crop: { width: 608, height: 1080, x: { from: 100, to: 400 }, y: 0 } } : clip,
      ),
    };
  };

  it("restores the discarded end endpoint, not a collapsed pan", async () => {
    const user = userEvent.setup();
    const seen: Edl[] = [];
    render(
      <Inspector
        selection={{ kind: "beat", index: 0 }}
        start={panning()}
        onChange={(next) => seen.push(next)}
      />,
    );

    const flatten = screen.getByRole("button", { name: "x: pan → static" });
    // The loss is stated before the click, not after it.
    expect(flatten.getAttribute("title")).toContain("x to 400");
    await user.click(flatten);
    expect(seen.at(-1)?.video[0].crop?.x).toBe(100);

    const back = screen.getByRole("button", { name: "x: static → pan" });
    expect(back.getAttribute("title")).toContain("restores the destination");
    await user.click(back);
    // Before this, the return trip produced { from: 100, to: 100 } — a dead pan.
    expect(seen.at(-1)?.video[0].crop?.x).toEqual({ from: 100, to: 400 });
  });

  it("seeds both endpoints when nothing was ever flattened", async () => {
    const base = edl();
    const staticCrop: Edl = {
      ...base,
      video: base.video.map((clip, i) =>
        i === 0 ? { ...clip, crop: { width: 608, height: 1080, x: 120, y: 0 } } : clip,
      ),
    };
    const user = userEvent.setup();
    const seen: Edl[] = [];
    render(
      <Inspector
        selection={{ kind: "beat", index: 0 }}
        start={staticCrop}
        onChange={(next) => seen.push(next)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "x: static → pan" }));
    expect(seen.at(-1)?.video[0].crop?.x).toEqual({ from: 120, to: 120 });
  });
});

describe("B9 — the bed picker auditions, through the frozen W2 seam", () => {
  it("offers an audition beside every candidate, and one plays at a time", async () => {
    resetAuditions();
    const user = userEvent.setup();
    const { container } = render(<Inspector selection={{ kind: "music" }} />);

    // Two candidates, each in its own slot: the swap verb and the audition are
    // separate controls, because a button cannot nest inside a button.
    expect(container.querySelectorAll(".bed-slot")).toHaveLength(2);
    const auditions = screen.getAllByRole("button", { name: /^Audition / });
    expect(auditions.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Audition cello-03.mp3",
      "Audition piano-01.mp3",
    ]);

    await user.click(auditions[0]);
    expect(screen.getByRole("button", { name: "Stop auditioning cello-03.mp3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The seam's one-at-a-time guarantee, exercised from this consumer: the
    // second audition takes the slot and the first lands back at rest.
    await user.click(screen.getByRole("button", { name: "Audition piano-01.mp3" }));
    expect(screen.getByRole("button", { name: "Audition cello-03.mp3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    resetAuditions();
  });

  it("offers no audition for a still — there is nothing in it to hear", () => {
    resetAuditions();
    const stills: TakeView[] = [{ ...TAKES[1], kind: "still", ref: "music-candidates/cover.png" }];
    render(<Inspector selection={{ kind: "music" }} takes={stills} />);

    expect(screen.queryByRole("button", { name: /^Audition / })).toBeNull();
    expect(screen.getByRole("button", { name: /^Swap the music bed to/ })).toBeInTheDocument();
  });
});

describe("B4 — the free-text fields the numfield width used to flatten", () => {
  it("keeps the caption text field typeless, which is what the CSS scope keys on", () => {
    render(<Inspector selection={{ kind: "caption", index: 0 }} />);
    // The width fix is `input:not([type="number"])`, so a `type` added here
    // later would silently re-pin this field to 100px. The rule and the markup
    // are therefore pinned together, not separately (the rule itself is pinned
    // in editor-polish-s82-css.test.ts).
    expect(screen.getByLabelText("text")).not.toHaveAttribute("type");
  });
});
