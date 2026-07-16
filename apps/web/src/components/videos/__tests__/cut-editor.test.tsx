// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import type { CutDetail, ProjectDetail } from "@/lib/videos/types";
import { CutEditor } from "../cut-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// The waveform seat — never exercised in jsdom (no WebAudio); the lane's knobs are.
vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(() => ({ on: vi.fn(), destroy: vi.fn(), playPause: vi.fn(), getDuration: () => 0, setTime: vi.fn() })),
  },
}));

const DETAIL: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: "the reference project",
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: false,
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
    {
      id: "t2",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-01-alt.mp4",
      reason: null,
      provenance: {},
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "t3",
      slot: "beat-01",
      kind: "motion",
      disposition: "reject",
      ref: "motion/rejects/beat-01-bad.mp4",
      reason: "hand clips through the watch face",
      provenance: {},
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  cuts: [
    {
      id: "c1",
      name: "film",
      version: 6,
      status: "draft",
      outputRef: null,
      edl: { beats: 2, captionLines: 1, audio: "encode", width: 1280, height: 720, fps: 24, duration: 9.5 },
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
};

const CUT: CutDetail = {
  id: "c1",
  name: "film",
  version: 6,
  status: "draft",
  outputRef: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  edl: {
    version: 1,
    name: "film",
    output: {
      width: 1280,
      height: 720,
      fps: 24,
      duration: 9.5,
      video: { codec: "libx264", crf: 18, preset: "slow", pixFmt: "yuv420p" },
    },
    video: [
      { name: "b1", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, in: 0, duration: 5 },
      {
        name: "b2",
        source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
        in: 0,
        duration: 5,
        transitionIn: { type: "xfade", duration: 0.5 },
      },
    ],
    audio: [{ source: { kind: "audio", ref: "music/track.mp3" }, offset: 3, gainDb: -2, mode: "encode" }],
    captions: {
      style: { font: "FreeSerif-Italic", pointsize: 44, kerning: 2, fill: "#eaaa40", glowFill: "#e09b30" },
      lines: [{ text: "measured, not vibed", x: 640, y: 600, fadeIn: 1, fadeOut: 4, ramp: 0.4 }],
    },
  },
};

function arm(saved?: Partial<CutDetail>) {
  const posts: unknown[] = [];
  server.use(
    http.get("/api/videos/p1", () => HttpResponse.json(DETAIL)),
    http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(CUT)),
    http.post("/api/videos/p1/cuts", async ({ request }) => {
      const body = await request.json();
      posts.push(body);
      return HttpResponse.json(
        { cut: { ...CUT, ...saved, id: "c2", version: 7 }, created: true },
        { status: 201 },
      );
    }),
  );
  return posts;
}

describe("CutEditor (B-ve.3 timeline editor MVP)", () => {
  it("renders the timeline, inspector, captions, and music knobs from the full EDL", async () => {
    arm();
    render(<CutEditor projectId="p1" cutId="c1" />);
    expect(await screen.findByText("b1")).toBeInTheDocument();
    expect(screen.getByText("b2")).toBeInTheDocument();
    expect(screen.getByText(/2 beats · assembled 9.5s/)).toBeInTheDocument();
    // Inspector opens on the first clip; its trim fields are live.
    expect(screen.getByLabelText("in (s)")).toBeInTheDocument();
    expect(screen.getByLabelText("duration (s)")).toBeInTheDocument();
    // Caption line + music knobs.
    expect(screen.getByDisplayValue("measured, not vibed")).toBeInTheDocument();
    expect(screen.getByLabelText("offset (s)")).toHaveValue(3);
    // Playback off (no media root): no waveform region.
    expect(screen.queryByLabelText(/Music waveform/)).not.toBeInTheDocument();
  });

  it("take-swap is slot-scoped, keepers first, rejects visible WITH reasons — and swapping marks the cut dirty", async () => {
    arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    const picker = screen.getByText("swap take").parentElement as HTMLElement;
    const rows = within(picker).getAllByRole("button");
    // beat-01 candidates minus the current ref: the alt keeper first, then the reject.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("beat-01-alt.mp4");
    expect(rows[1]).toHaveTextContent("hand clips through the watch face");
    await user.click(rows[0]);
    expect(screen.getByText("motion/keepers/beat-01-alt.mp4")).toBeInTheDocument();
    expect(screen.getByText("unsaved edits")).toBeInTheDocument();
    // Render is gated while dirty — the render replays the STORED EDL.
    expect(screen.getByRole("button", { name: "Render" })).toBeDisabled();
  });

  it("save POSTs the working EDL under the cut's name and lands on the new version", async () => {
    const posts = arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    const save = screen.getByRole("button", { name: "Save as v7" });
    expect(save).toBeDisabled(); // nothing edited yet
    const caption = screen.getByDisplayValue("measured, not vibed");
    await user.clear(caption);
    await user.type(caption, "graded and measured");
    await user.click(screen.getByRole("button", { name: "Save as v7" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { name: string; edl: { captions: { lines: { text: string }[] } } };
    expect(body.name).toBe("film");
    expect(body.edl.captions.lines[0].text).toBe("graded and measured");
    await waitFor(() => expect(screen.getByText("v7")).toBeInTheDocument());
    expect(screen.queryByText("unsaved edits")).not.toBeInTheDocument();
  });

  it("reorder keeps the fade rhythm position-bound (row order changes, xfade badge stays on position 2)", async () => {
    arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    await user.click(screen.getByRole("button", { name: "Move clip later" }));
    // The timeline list now reads b2 then b1…
    const list = screen.getByText("Timeline").closest("[data-slot=card]") as HTMLElement;
    const names = within(list)
      .getAllByText(/^b[12]$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["b2", "b1"]);
    // …and exactly one xfade badge remains (position-bound, never doubled or lost).
    expect(within(list).getAllByText(/xfade/)).toHaveLength(1);
  });

  it("with no cuts on the project, the editor says so instead of exploding", async () => {
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json({ ...DETAIL, cuts: [] })),
    );
    render(<CutEditor projectId="p1" cutId={null} />);
    expect(await screen.findByText(/No cuts to edit yet/)).toBeInTheDocument();
  });
});
