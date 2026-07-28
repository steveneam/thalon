// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
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
 * STEP 2 of the two-step rebuild: the sheet's bands (Videos.dc.html) with
 * the real cut behind them. Every assertion is either a band the sheet draws
 * or a fact the engine actually records.
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
    {
      name: "beat-01",
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
    { mode: "encode", source: { kind: "audio", ref: "music/bed.mp3" }, offset: 3, gainDb: -6 },
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
      { text: "a full cut", x: 100, y: 600, fadeIn: 5, fadeOut: 8, ramp: 0.4 },
    ],
  },
};

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
      disposition: "reject",
      ref: "motion/rejects/beat-01-t2.mp4",
      reason: "hand clips through the watch face",
      provenance: {},
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "t3",
      slot: "beat-02",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-02.mp4",
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
  );
}

describe("VideoEditor (exact-mock rebuild — Videos.dc.html, step 2)", () => {
  it("renders the sheet's bands with the real cut behind them", async () => {
    serve();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);

    expect(await screen.findByRole("heading", { name: "film-16x9 v6" })).toBeInTheDocument();
    expect(container.querySelector(".content.editor-surface")).not.toBeNull();
    expect(screen.getByText("draft · 12s")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("3 takes on record")).toHaveClass("pill", "pill-ok");

    // Three lanes drawn from the EDL: two beats, one music cue, two plates.
    expect(container.querySelectorAll(".tl-body .lane")).toHaveLength(3);
    expect(container.querySelectorAll(".lane-tr .blk")).toHaveLength(2);
    expect(container.querySelectorAll(".blk-music")).toHaveLength(1);
    expect(container.querySelectorAll(".blk-cap")).toHaveLength(2);

    // Beats rail from the same lane, with the keeper mark the takes justify.
    expect(container.querySelectorAll(".beat-row")).toHaveLength(2);
    expect(screen.getByText("01 · beat-01")).toBeInTheDocument();

    // The sheet's crescendo diamonds are NOT drawn: an AudioCue records
    // offset/gain/tail, and nothing measures crescendos.
    expect(container.querySelector(".cresc")).toBeNull();
  });

  it("sizes the lanes from the EDL's own durations", async () => {
    serve();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const blocks = Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk"));
    expect(blocks.map((b) => b.style.width)).toEqual(["50%", "50%"]);
    // A plate spans its own fade window, offset by the gap since the last one.
    const plates = Array.from(container.querySelectorAll<HTMLElement>(".blk-cap"));
    expect(plates[0].style.width).toBe(`${(2 / 12) * 100}%`);
    expect(plates[1].style.marginLeft).toBe(`${(2 / 12) * 100}%`);
  });

  it("opens the knobs as a state behind a picked block, with nothing picked at rest", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    expect(container.querySelector(".inspector")).toBeNull();
    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    expect(await screen.findByText("Beat — beat-01")).toBeInTheDocument();
    expect(screen.getByLabelText("duration (s)")).toHaveValue(6);

    // The music cue's own knobs, behind its own block.
    await user.click(container.querySelector(".blk-music") as HTMLElement);
    expect(await screen.findByText("Music cue")).toBeInTheDocument();
    expect(screen.getByLabelText("offset (s)")).toHaveValue(3);
    expect(screen.getByLabelText("gain (dB)")).toHaveValue(-6);
  });

  it("commits a trim through the pure transform and marks the cut dirty", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    const duration = await screen.findByLabelText("duration (s)");
    await user.clear(duration);
    await user.type(duration, "3");
    await user.tab();

    // The lane re-proportions from the EDL, and the primary button becomes Save.
    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk")).map((b) => b.style.width),
      ).toEqual([`${(3 / 9) * 100}%`, `${(6 / 9) * 100}%`]),
    );
    expect(screen.getByRole("button", { name: "Save as v7" })).toBeInTheDocument();
    expect(screen.getByText("unsaved · 12s")).toBeInTheDocument();
  });

  it("shows the take swap with every reject's reason, and swaps on click", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    expect(await screen.findByText("Takes — beat-01")).toBeInTheDocument();
    // The learning material is part of the picker.
    expect(screen.getByText("hand clips through the watch face")).toHaveClass("take-cap");

    await user.click(screen.getByTitle("swap this beat to motion/rejects/beat-01-t2.mp4"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save as v7" })).toBeInTheDocument(),
    );
    // The beat now rides a reject, and the rail says so rather than a green tick.
    expect(container.querySelectorAll(".beat-row")[0].textContent).toContain("!");
  });

  it("lands an agent proposal on the timeline and applies nothing until told", async () => {
    serve();
    server.use(
      http.post("/api/videos/p1/cuts/c1/propose", () =>
        HttpResponse.json({
          diff: {
            version: 1,
            summary: "clear the second caption off the falcon",
            ops: [{ op: "caption-move", line: 1, x: 100, y: 200, why: "the falcon owns that corner" }],
          },
          preview: { ...EDL, name: "previewed" },
          attribution: {
            authoredBy: "agent",
            proposal: {
              baseCutId: "c1",
              model: "test/proposer",
              promptName: "edl-propose",
              promptHash: "abc",
              decidedBy: "operator",
              diff: {
                version: 1,
                summary: "clear the second caption off the falcon",
                ops: [{ op: "caption-move", line: 1, x: 100, y: 200, why: "the falcon owns that corner" }],
              },
            },
          },
          tokens: { in: 900, out: 120 },
        }),
      ),
    );
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Propose" }));
    expect(await screen.findByText(/clear the second caption off the falcon/)).toBeInTheDocument();
    expect(screen.getByText("proposal")).toHaveClass("pill", "pill-warn");
    // The proposal lands ON THE TIMELINE — the second plate carries the mark.
    await waitFor(() => expect(container.querySelectorAll(".blk-cap.prop")).toHaveLength(1));
    // Nothing has been applied: the cut is still clean.
    expect(screen.queryByRole("button", { name: /^Save as/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Review diff →" }));
    expect(await screen.findByText("the falcon owns that corner")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("button", { name: "Save as v7" })).toBeInTheDocument();
    expect(screen.getByText("agent proposal applied")).toHaveClass("pill", "pill-warn");
  });

  it("takes the reason with a dismissed proposal — the correction is an eval row", async () => {
    serve();
    let rejected: unknown = null;
    server.use(
      http.post("/api/videos/p1/cuts/c1/propose", () =>
        HttpResponse.json({
          diff: { version: 1, summary: "trim", ops: [] },
          preview: EDL,
          attribution: {
            authoredBy: "agent",
            proposal: {
              baseCutId: "c1",
              model: "m",
              promptName: "p",
              promptHash: "h",
              decidedBy: "operator",
              diff: { version: 1, summary: "trim", ops: [] },
            },
          },
          tokens: { in: 1, out: 1 },
        }),
      ),
      http.post("/api/videos/p1/cuts/c1/propose/reject", async ({ request }) => {
        rejected = await request.json();
        return HttpResponse.json({ evalCaseId: "e1" });
      }),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Propose" }));
    await screen.findByText("proposal");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    const reason = await screen.findByLabelText(/why this proposal is wrong/);
    await user.type(reason, "the close needs the plate");
    await user.click(screen.getByRole("button", { name: "Record the correction" }));

    await waitFor(() => expect(rejected).not.toBeNull());
    expect(rejected).toMatchObject({ reason: "the close needs the plate" });
    expect(await screen.findByText(/the correction is now an eval row/)).toBeInTheDocument();
  });

  it("walks the cut through save → render → approve on the sheet's one primary button", async () => {
    serve();
    server.use(
      http.post("/api/videos/p1/render", () =>
        HttpResponse.json({
          job: {
            id: "j1",
            projectId: "p1",
            cutId: "c1",
            status: "running",
            outputRef: null,
            error: null,
            startedAt: "2026-07-26T00:00:00.000Z",
            finishedAt: null,
          },
          started: true,
        }),
      ),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    // A clean draft's next real step is a render, not a save.
    await user.click(screen.getByRole("button", { name: "Render" }));
    expect(await screen.findByText(/Rendering locally \(0 credits\)/)).toBeInTheDocument();

    // A rendered cut's next step is the judge-gated transition.
    serve(DETAIL, { ...CUT, status: "rendered", outputRef: "cuts/out.mp4" });
    render(<VideoEditor projectId="p1" cutId="c1" />);
    expect(
      await screen.findAllByRole("button", { name: "Send cut to Approve" }),
    ).not.toHaveLength(0);
  });

  it("refuses to derive over unsaved edits, and says why", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    expect(screen.getByRole("button", { name: "9:16" })).toBeEnabled();
    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    const duration = await screen.findByLabelText("duration (s)");
    await user.clear(duration);
    await user.type(duration, "3");
    await user.tab();

    /*
     * s81: the refusal is ANNOUNCED, not just dimmed. This used to assert
     * `disabled` + a `title`, which is precisely the dead door the audit found:
     * a disabled control fires no tooltip and assistive tech skips it, so the
     * reason was unreachable by every route. The control now stays focusable,
     * says aria-disabled, and ANSWERS when pressed.
     */
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "9:16" })).toHaveAttribute("aria-disabled", "true"),
    );
    await user.click(screen.getByRole("button", { name: "9:16" }));
    expect(
      await screen.findByText(/Save first — a derive reads the STORED EDL/),
    ).toBeInTheDocument();
  });

  it("the 16:9 option is a real door back to the master, not an aria-hidden span", async () => {
    // A derived cut pins its parent; 16:9 is the way back to it.
    serve(DETAIL, {
      ...CUT,
      edl: { ...CUT.edl, output: { ...CUT.edl.output, width: 1080, height: 1920 } },
      lineage: { parentCutId: "master-1", aspect: "9:16", parentName: "film-16x9", parentVersion: 6, parentLatestVersion: 6 },
    });
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const master = screen.getByRole("button", { name: "16:9" });
    expect(master).not.toHaveAttribute("aria-disabled");
    await user.click(master);
    expect(push).toHaveBeenCalledWith("/app/videos/p1/edit?cut=master-1");
  });

  it("a cut with no master says so instead of offering a door to nowhere", async () => {
    serve(DETAIL, {
      ...CUT,
      edl: { ...CUT.edl, output: { ...CUT.edl.output, width: 1080, height: 1920 } },
      lineage: null,
    });
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "16:9" }));
    expect(await screen.findByText(/has no 16:9 master on record/)).toBeInTheDocument();
  });

  it("says there is no cut to edit rather than drawing an empty timeline", async () => {
    server.use(http.get("/api/videos/p1", () => HttpResponse.json({ ...DETAIL, cuts: [] })));
    render(<VideoEditor projectId="p1" cutId={null} />);
    expect(await screen.findByText(/No cut to edit yet/)).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", async () => {
    serve();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});

describe("VideoEditor — the takes strip and the beats rail agree with the record", () => {
  it("marks a beat whose source has no take row as neither keeper nor reject", async () => {
    serve(DETAIL, {
      ...CUT,
      edl: {
        ...EDL,
        video: [
          { name: "layer", source: { kind: "take", ref: "cuts/layer.mp4" }, in: 0, duration: 12 },
        ],
      },
    });
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const row = container.querySelectorAll(".beat-row")[0];
    expect(within(row as HTMLElement).getByTitle(/no take row/)).toBeInTheDocument();
  });
});
