// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import type { CutDetail, ProjectDetail } from "@/lib/videos/types";
import { CutEditor } from "../cut-editor";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: routerPush }),
  usePathname: () => "/app/videos/p1/edit",
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
      attribution: null,
      edl: { beats: 2, captionLines: 1, audio: "encode", width: 1280, height: 720, fps: 24, duration: 9.5 },
      lineage: null,
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
  lineage: null,
  attribution: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  edl: {
    version: 1,
    name: "film",
    output: {
      width: 1280,
      height: 720,
      fps: 24,
      duration: 9.5,
      video: { mode: "encode", codec: "libx264", crf: 18, preset: "slow", pixFmt: "yuv420p" },
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

  it("reorder keeps the lane magnetic (B-ve.6 track view: chunk order flips, starts re-derive)", async () => {
    arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    await user.click(screen.getByRole("button", { name: "Move clip later" }));
    // The track view now reads b2 then b1 — magnetic slots, no gaps possible.
    const track = screen.getByTestId("track-view");
    const names = within(track)
      .getAllByRole("button", { name: /^b[12] \(/ })
      .map((el) => el.getAttribute("aria-label"));
    expect(names).toEqual(["b2 (5s)", "b1 (5s)"]);
    // The fade rhythm stayed position-bound: the transform is pinned in
    // editor.test.ts; here the derived starts prove it (b1 starts at 4.5s).
    expect(within(track).getByRole("button", { name: "b1 (5s)" })).toHaveStyle({
      left: "108px", // 4.5s × 24px/s — the compiler's own offset math
    });
  });

  it("with no cuts on the project, the editor says so instead of exploding", async () => {
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json({ ...DETAIL, cuts: [] })),
    );
    render(<CutEditor projectId="p1" cutId={null} />);
    expect(await screen.findByText(/No cuts to edit yet/)).toBeInTheDocument();
  });
});

describe("CutEditor track view (B-ve.6)", () => {
  it("renders lanes against the time axis: proportional chunks, caption chips, music block, ruler", async () => {
    arm();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByTestId("track-view");
    const track = screen.getByTestId("track-view");
    // Beat chunks at derived starts, width ∝ duration (24px/s default).
    expect(within(track).getByRole("button", { name: "b1 (5s)" })).toHaveStyle({
      left: "0px",
      width: "120px",
    });
    expect(within(track).getByRole("button", { name: "b2 (5s)" })).toHaveStyle({
      left: "108px", // 5s − 0.5s xfade = 4.5s × 24
    });
    // Caption chip spans its fade window at absolute time (the contract's truth).
    expect(
      within(track).getByRole("button", { name: "Caption: measured, not vibed" }),
    ).toHaveStyle({ left: `${1 * 24}px`, width: `${(4 - 1) * 24}px` });
    // Music block shows the source + offset knob value; encode mode drags.
    expect(within(track).getByRole("button", { name: "Music (offset 3s)" })).toBeInTheDocument();
    // Ruler + playhead slider exist.
    expect(within(track).getByRole("slider", { name: "Playhead" })).toBeInTheDocument();
  });

  it("zoom rescales the axis and snap toggles", async () => {
    arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByTestId("track-view");
    const track = screen.getByTestId("track-view");
    await user.click(within(track).getByRole("button", { name: "Zoom in" }));
    expect(within(track).getByRole("button", { name: "b1 (5s)" })).toHaveStyle({
      width: "180px", // 24 × 1.5 px/s × 5s
    });
    const snap = within(track).getByRole("button", { name: /snap/ });
    expect(snap).toHaveAttribute("aria-pressed", "true");
    await user.click(snap);
    expect(snap).toHaveAttribute("aria-pressed", "false");
  });
});

describe("CutEditor aspect lens (B-ve.5)", () => {
  const DERIVED: CutDetail = {
    ...CUT,
    id: "c9",
    name: "film-9x16",
    lineage: {
      parentCutId: "c1",
      aspect: "9:16",
      parentName: "film",
      parentVersion: 6,
      parentLatestVersion: 8,
    },
    edl: {
      ...CUT.edl,
      name: "film-9x16",
      output: { ...CUT.edl.output, width: 1080, height: 1920 },
      video: CUT.edl.video.map((clip) => ({
        ...clip,
        crop: { width: 404, height: 720, x: 438, y: 0 },
        scale: { width: 1080, height: 1920, flags: "lanczos" as const },
      })),
    },
  };

  function armDerived() {
    const posts: unknown[] = [];
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json(DETAIL)),
      http.get("/api/videos/p1/cuts/c9", () => HttpResponse.json(DERIVED)),
      http.post("/api/videos/p1/cuts", async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          { cut: { ...DERIVED, id: "c10", version: 2 }, created: true },
          { status: 201 },
        );
      }),
      http.post("/api/videos/p1/cuts/c1/derive", async ({ request }) => {
        posts.push({ derive: await request.json() });
        return HttpResponse.json({ cut: DERIVED, created: true }, { status: 201 });
      }),
    );
    return posts;
  }

  it("a derived cut shows its parent pin and HONEST staleness; saves carry the lineage forward", async () => {
    const posts = armDerived();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c9" />);
    await screen.findByText("b1");
    expect(screen.getByText(/9:16 · from film v6/)).toBeInTheDocument();
    expect(screen.getByText("parent now v8")).toBeInTheDocument();

    const caption = screen.getByDisplayValue("measured, not vibed");
    await user.clear(caption);
    await user.type(caption, "re-placed for the vertical frame");
    await user.click(screen.getByRole("button", { name: /^Save as v/ }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      name: "film-9x16",
      meta: { lineage: { parentCutId: "c1", aspect: "9:16" } },
    });
  });

  it("the frame section measures in source pixels: fields + mode toggle drive the crop and mark the cut dirty", async () => {
    armDerived();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c9" />);
    await screen.findByText("b1");
    const frame = screen.getByTestId("frame-composer");
    expect(within(frame).getByText(/window 404×720/)).toBeInTheDocument();
    // Playback off: numbers-only editing is stated, not hidden.
    expect(within(frame).getByText(/editable by numbers only/)).toBeInTheDocument();

    await user.click(within(frame).getByRole("button", { name: "x: static → pan" }));
    expect(within(frame).getByLabelText("x from")).toHaveValue(438);
    expect(within(frame).getByLabelText("x to")).toHaveValue(438);
    expect(screen.getByText("unsaved edits")).toBeInTheDocument();
  });

  it("Derive posts the aspect to the derive door and navigates to the new cut", async () => {
    const posts = arm();
    server.use(
      http.post("/api/videos/p1/cuts/c1/derive", async ({ request }) => {
        posts.push({ derive: await request.json() });
        return HttpResponse.json({ cut: DERIVED, created: true }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    await user.click(screen.getByRole("button", { name: "Derive 9:16" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ derive: { aspect: "9:16" } });
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith("/app/videos/p1/edit?cut=c9"),
    );
  });

  it("Derive is gated while dirty — it reads the STORED EDL", async () => {
    arm();
    const user = userEvent.setup();
    render(<CutEditor projectId="p1" cutId="c1" />);
    await screen.findByText("b1");
    const caption = screen.getByDisplayValue("measured, not vibed");
    await user.clear(caption);
    await user.type(caption, "edited");
    expect(screen.getByRole("button", { name: "Derive 9:16" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Derive 1:1" })).toBeDisabled();
  });
});
