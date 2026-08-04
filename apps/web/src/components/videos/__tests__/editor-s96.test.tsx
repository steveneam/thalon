// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Edl } from "@thalon/contracts";
import { VideoEditor } from "@/components/videos/editor";
import { server } from "@/lib/testing/server";
import type { CutDetail, ProjectDetail, TakeView } from "@/lib/videos/types";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/videos/p1/edit",
  useRouter: () => ({ push, replace }),
}));

/**
 * s96 — the editor p1 + s95b deltas, pinned (sheet: Videos.dc.html, AMENDED
 * s95/s95b; founder verdict "W3 is approved"). Each case is one delta the
 * amendment drew: the tools row's verbs and refusals, the kind dots, the
 * frame thumbnails riding B-media.0 posters, the ⓘ frames tip, and the ⚡
 * cost markers at the metered verbs.
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
  audio: [
    { mode: "encode", source: { kind: "audio", ref: "music/bed.mp3" }, offset: 0, gainDb: -6 },
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
      { text: "a full cut", x: 100, y: 600, fadeIn: 7, fadeOut: 9, ramp: 0.4 },
    ],
  },
};

const POSTER = {
  ref: { kind: "stored" as const, sha256: "a".repeat(64), ext: "webp" as const, width: 640, height: 360 },
  provenance: "derived" as const,
};

function take(over: Partial<TakeView>): TakeView {
  return {
    id: "t?",
    slot: "beat-01",
    kind: "motion",
    disposition: "keeper",
    ref: "motion/keepers/beat-01.mp4",
    reason: null,
    provenance: {},
    poster: null,
    createdAt: "2026-07-16T00:00:00.000Z",
    ...over,
  };
}

const CUT: CutDetail = {
  id: "c1",
  name: "film-16x9",
  version: 6,
  status: "draft",
  outputRef: null,
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
  playable: false,
  onePrompt: false,
  retired: [],
  takes: [
    // beat-01's keeper carries a derived poster; beat-02's does not — the
    // same project shows both truths side by side.
    take({ id: "t1", ref: "motion/keepers/beat-01.mp4", poster: POSTER, provenance: { credits: 12 } }),
    take({ id: "t2", slot: "beat-02", ref: "motion/keepers/beat-02.mp4" }),
  ],
  cuts: [
    {
      id: "c1",
      name: "film-16x9",
      version: 6,
      status: "draft",
      outputRef: null,
      lineage: null,
      attribution: null,
      edl: { beats: 2, captionLines: 2, audio: "encode", width: 1280, height: 720, fps: 24, duration: 12 },
      createdAt: "2026-07-20T00:00:00.000Z",
    },
  ],
};

function serve(detail: ProjectDetail = DETAIL, cut: CutDetail = CUT) {
  server.use(
    http.get("/api/videos/p1", () => HttpResponse.json(detail)),
    http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(cut)),
    http.get("/api/videos/p1/render", ({ request }) =>
      new URL(request.url).searchParams.has("running")
        ? HttpResponse.json({ jobs: [] })
        : new HttpResponse(null, { status: 404 }),
    ),
  );
}

async function open() {
  render(<VideoEditor projectId="p1" cutId="c1" />);
  return await screen.findByRole("heading", { name: "film-16x9 v6" });
}

/** The beat block for a name, from its never-clipping accessible label. */
function block(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("the s95b tools row (Split · Crop · Text · Delete, on the selected block)", () => {
  it("draws all four chips, delete in the danger register, and the sheet's resting label", async () => {
    serve();
    await open();
    for (const label of ["Split", "Crop", "Text", "Delete"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain("chip-danger");
    expect(screen.getByText("on the selected block · drag reorders · edges trim")).toBeInTheDocument();
  });

  it("refuses OUT LOUD with nothing selected — a sentence in the notice band, never a dead chip", async () => {
    serve();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Select a beat block first — Split cuts the selected beat at the playhead.",
    );
  });

  it("Split cuts the selected beat at the playhead into two halves of the same take", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 01 · beat-01/));
    const ruler = screen.getByRole("slider", { name: "Playhead" });
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(ruler, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(block(/beat-01 · 3s/)).toBeInTheDocument();
    expect(block(/beat-01-split · 3s/)).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toContain("Split beat-01 at 3s");
  });

  it("Split refuses while the playhead sits outside the selected beat", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 01 · beat-01/));
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Place the playhead inside beat-01 first",
    );
  });

  it("Crop trims the selected beat to end at the playhead", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 01 · beat-01/));
    const ruler = screen.getByRole("slider", { name: "Playhead" });
    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(ruler, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    expect(block(/Beat 01 · beat-01 · 4s/)).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toContain("Cropped beat-01 to 4s");
  });

  it("Text lands a caption plate over the selected beat and selects it for typing", async () => {
    serve();
    await open();
    expect(screen.getAllByRole("button", { name: /^Caption \d/ })).toHaveLength(2);
    fireEvent.click(block(/Beat 02 · beat-02/));
    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    const plates = screen.getAllByRole("button", { name: /^Caption \d/ });
    expect(plates).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain("Added a caption over beat-02");
    // The new plate spans beat-02's own window (6s → 12s) and is selected —
    // the inspector opens on its text.
    expect(screen.getByRole("button", { name: /New caption/ })).toBeInTheDocument();
  });

  it("Delete removes the selected beat, and refuses to empty the lane", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 02 · beat-02/));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: /Beat 02 · beat-02/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Removed beat-02");
    // Now only beat-01 remains: the last beat stays, said in words.
    fireEvent.click(block(/Beat 01 · beat-01/));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("status").textContent).toContain("The last beat stays");
    expect(block(/Beat 01 · beat-01/)).toBeInTheDocument();
  });

  it("Delete on the music block silences the cut — and the silent lane is the door back", async () => {
    serve();
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Music bed music\/bed\.mp3/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: /Silent cut — choose a music bed/ })).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toContain("Removed the music bed");
  });
});

describe("the s95 kind grammar and frame thumbnails", () => {
  it("each lane header carries its kind dot (VEED) — kind tokens, not status colours", async () => {
    serve();
    const heading = await open();
    const surface = heading.closest(".editor-surface")!;
    const dots = surface.querySelectorAll(".kdot");
    expect(dots).toHaveLength(3);
    expect(Array.from(dots).map((d) => (d as HTMLElement).style.background)).toEqual([
      "var(--tk-video)",
      "var(--tk-music)",
      "var(--tk-cap)",
    ]);
  });

  it("a beat with a derived poster wears its frame; one without keeps the stripes", async () => {
    serve();
    await open();
    const framed = block(/Beat 01 · beat-01/);
    expect(framed.className).toContain("framed");
    expect(framed.style.backgroundImage).toContain(`/api/media/${"a".repeat(64)}.webp`);
    const bare = block(/Beat 02 · beat-02/);
    expect(bare.className).not.toContain("framed");
    expect(bare.style.backgroundImage).toBe("");
  });

  it("the beats rail rows wear the same frames", async () => {
    serve();
    const heading = await open();
    const surface = heading.closest(".editor-surface")!;
    expect(surface.querySelectorAll(".beat-thumb.framed")).toHaveLength(1);
  });
});

describe("the s95b ⓘ — the frames named", () => {
  it("names each ratio as shape + format + platforms, in the shared tip vocabulary", async () => {
    serve();
    await open();
    expect(screen.getByRole("button", { name: "What the aspect frames mean" })).toBeInTheDocument();
    expect(screen.getByText("WHAT THE FRAMES MEAN")).toBeInTheDocument();
    expect(screen.getByText(/wide — the full video: YouTube, the blog, site embeds/)).toBeInTheDocument();
    expect(screen.getByText(/tall — short-form clips: TikTok, Reels, Shorts/)).toBeInTheDocument();
    expect(screen.getByText(/square — feed posts: LinkedIn, X, Instagram feed/)).toBeInTheDocument();
  });
});

describe("the s95 ⚡ cost markers (V4 — cost learnt before the click)", () => {
  it("Propose carries its one-call cost; Recut stays unbadged because THIS recut is free", async () => {
    serve();
    await open();
    expect(screen.getByRole("button", { name: /Propose ⚡1/ })).toBeInTheDocument();
    // The aspect lens's derive is local and 0 credits — absence says free.
    expect(screen.getByRole("button", { name: "Recut 9:16" }).textContent).not.toContain("⚡");
    expect(screen.getByRole("button", { name: /Retake a beat/ }).textContent).toContain("⚡");
  });

  it("the retake door states the beat's LAST recorded mint cost and pre-fills the re-brief", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 01 · beat-01/));
    const door = screen.getByRole("button", { name: /Re-brief beat-01 for a retake/ });
    expect(door.textContent).toContain("⚡12 cr");
    fireEvent.click(door);
    expect(screen.getByRole("textbox", { name: "Direct the edit" })).toHaveValue("Retake beat-01: ");
  });

  it("a beat with no recorded mint cost gets the bare ⚡ — metered, never an invented number", async () => {
    serve();
    await open();
    fireEvent.click(block(/Beat 02 · beat-02/));
    const door = screen.getByRole("button", { name: /Re-brief beat-02 for a retake/ });
    expect(door.textContent).toContain("⚡");
    expect(door.textContent).not.toContain("cr");
  });
});
