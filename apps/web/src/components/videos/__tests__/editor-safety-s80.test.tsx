// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Edl } from "@thalon/contracts";
import { VideoEditor } from "@/components/videos/editor";
import { server } from "@/lib/testing/server";
import type { CutDetail, ProjectDetail } from "@/lib/videos/types";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/videos/p1/edit",
  useRouter: () => ({ push, replace }),
}));

/**
 * THE SAFETY CORE (s80, slice a).
 *
 * `apply()` is the single funnel for every manual edit on this surface — drag
 * reorder, edge trim, per-character caption patch, take swap, music knobs — and
 * before this slice it only ever pushed FORWARD. Nothing retained the EDL the
 * operator started from, ⌘Z was unbound across the whole surface, and three
 * plain <Link>s plus the rail discarded a dirty working copy without a word.
 * Versioning protected the SAVED version; the working copy had nothing.
 *
 * These tests pin the three guarantees that fixed it. They are deliberately
 * behavioural — they make a real edit and then check the operator can get back
 * — because the defect was never that a function was missing, it was that a
 * JOURNEY could not be completed.
 */

const EDL: Edl = {
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
    { name: "beat-01", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, in: 0, duration: 6 },
    { name: "beat-02", source: { kind: "take", ref: "motion/keepers/beat-02.mp4" }, in: 0, duration: 6 },
  ],
  audio: [{ mode: "encode", source: { kind: "audio", ref: "music/bed.mp3" }, offset: 3, gainDb: -6 }],
  captions: {
    style: { font: "FreeSerif-Italic", pointsize: 42, kerning: 2, fill: "#eaaa40", glowFill: "#eaaa40" },
    lines: [{ text: "one prompt", x: 100, y: 600, fadeIn: 1, fadeOut: 3, ramp: 0.4 }],
  },
};

/** Rendered, so the player has a previous render to be honest about. */
const CUT: CutDetail = {
  id: "c1",
  name: "film-16x9",
  version: 6,
  status: "rendered",
  outputRef: "cuts/film-16x9-v6.mp4",
  lineage: null,
  attribution: null,
  edl: EDL,
  createdAt: "2026-07-20T00:00:00.000Z",
};

const DETAIL: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: true,
  takes: [
    {
      id: "t1",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-01.mp4",
      reason: null,
      provenance: {},
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  cuts: [
    {
      id: "c1",
      name: "film-16x9",
      version: 6,
      status: "rendered",
      outputRef: "cuts/film-16x9-v6.mp4",
      lineage: null,
      attribution: null,
      edl: { beats: 2, captionLines: 1, audio: "encode", width: 1280, height: 720, fps: 24, duration: 12 },
      createdAt: "2026-07-20T00:00:00.000Z",
    },
  ],
};

function serve() {
  server.use(
    http.get("/api/videos/p1", () => HttpResponse.json(DETAIL)),
    http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(CUT)),
    // s82 A4: the editor asks what is still rendering as part of every load.
    http.get("/api/videos/p1/render", () => HttpResponse.json({ jobs: [] })),
  );
}

/** Make one real, mistaken edit: trim beat-01 from 6s to 3s. */
async function mistrim(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
  const duration = await screen.findByLabelText("duration (s)");
  await user.clear(duration);
  await user.type(duration, "3");
  await user.tab();
  await waitFor(() => expect(screen.getByText(/^unsaved/)).toBeInTheDocument());
}

const widths = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk")).map((b) => b.style.width);

describe("the editor's safety core", () => {
  it("undoes a mistaken trim and puts the working copy back", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    const before = widths(container);

    await mistrim(user, container);
    expect(widths(container)).not.toEqual(before);

    // Undo appears only once there is something to undo — the resting surface
    // is unchanged, which is why it must be looked for AFTER the edit.
    await user.click(screen.getByRole("button", { name: /^Undo/ }));
    await waitFor(() => expect(widths(container)).toEqual(before));
  });

  it("binds Ctrl/Cmd+Z, which the shared list grammar deliberately cannot", async () => {
    // lib/workspace/keyboard.ts returns early on ctrlKey||metaKey so j/k never
    // eat browser shortcuts — which is exactly why undo needed its own binding.
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    const before = widths(container);

    await mistrim(user, container);
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(widths(container)).toEqual(before));
  });

  it("discards every unsaved edit back to the stored version in one step", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    const before = widths(container);

    await mistrim(user, container);
    await user.click(screen.getByRole("button", { name: /^Discard changes/ }));

    await waitFor(() => expect(widths(container)).toEqual(before));
    // Dirty is cleared: the pill returns to the cut's real status.
    expect(screen.getByText("rendered · 0:12.0")).toBeInTheDocument();
  });

  it("intercepts an exit while dirty and offers save, discard or stay", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    await mistrim(user, container);

    // The breadcrumb is one of the three plain <Link>s the audit named.
    await user.click(screen.getByRole("link", { name: /concept film/ }));

    const guard = await screen.findByRole("alertdialog", { name: "Unsaved changes" });
    expect(guard).toHaveTextContent(/unsaved edits to film-16x9 v6/i);
    expect(screen.getByRole("button", { name: "Save, then leave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard and leave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay here" })).toBeInTheDocument();
    // It BLOCKED the navigation rather than narrating one already taken.
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the operator stay, keeping the edit that was at risk", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    await mistrim(user, container);
    const edited = widths(container);

    await user.click(screen.getByRole("link", { name: /concept film/ }));
    await user.click(await screen.findByRole("button", { name: "Stay here" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(widths(container)).toEqual(edited);
    expect(screen.getByText(/^unsaved/)).toBeInTheDocument();
  });

  it("does not guard an exit when there is nothing to lose", async () => {
    serve();
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("link", { name: /concept film/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  /*
   * THE BLOCKER (slice b). The three timeline block types are real <button>s
   * with aria-pressed and focus rings, carrying ONLY onPointerDown. Enter/Space
   * on a focused button dispatches `click`, never `pointerdown`, so keyboard
   * activation was a silent no-op — and selecting a plate is the ONLY entry to
   * the caption and music inspectors (`setSelection({kind:"caption"})` appears
   * nowhere else in the tree, and j/k walk beats only). A keyboard-only
   * operator could never edit a caption or the music bed on this surface.
   *
   * The existing suite MASKED it: `user.click` synthesizes pointerdown before
   * click, so the pointer path was covered and the keyboard path was not. These
   * fire the key, which is the only thing that could have caught it.
   */
  it("opens the caption inspector from the keyboard, not just the pointer", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const plate = container.querySelector<HTMLElement>(".blk-cap");
    expect(plate).not.toBeNull();
    plate!.focus();
    expect(document.activeElement).toBe(plate);
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/^Caption 1/)).toBeInTheDocument();
    expect(plate).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the music inspector from the keyboard", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const music = container.querySelector<HTMLElement>(".blk-music");
    expect(music).not.toBeNull();
    music!.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Music cue")).toBeInTheDocument();
    expect(screen.getByLabelText("offset (s)")).toHaveValue(3);
  });

  it("selects a beat from the keyboard without starting a drag", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    const before = widths(container);

    const beat = container.querySelector<HTMLElement>(".lane-tr .blk");
    beat!.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Beat — beat-01")).toBeInTheDocument();
    // Selecting is not editing: a keyboard activation must not dirty the cut.
    expect(widths(container)).toEqual(before);
    expect(screen.queryByText(/^unsaved/)).toBeNull();
  });

  it("says which render the player is showing once the edit diverges from it", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    // At rest the plate makes no such claim — there is nothing to disclaim.
    expect(screen.queryByText(/unsaved edits are not in it/i)).toBeNull();

    await mistrim(user, container);
    expect(
      screen.getByText(/showing the render of v6 — your unsaved edits are not in it/i),
    ).toBeInTheDocument();
  });
});
