// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Edl } from "@thalon/contracts";
import { VideoEditor } from "@/components/videos/editor";
import { server } from "@/lib/testing/server";
import type { CutDetail, CutView, ProjectDetail, RenderJobView } from "@/lib/videos/types";

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
  retired: [],
  takes: [
    {
      id: "t1",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-01.mp4",
      reason: null,
      provenance: {},
      poster: null,
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
      poster: null,
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
      poster: null,
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

function serve(
  detail: ProjectDetail = DETAIL,
  cut: CutDetail = CUT,
  running: RenderJobView[] = [],
) {
  server.use(
    http.get("/api/videos/p1", () => HttpResponse.json(detail)),
    http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(cut)),
    /*
     * s82 A4: the editor asks what is still rendering as part of every load,
     * so every test serves that read — an unhandled one would leave each case
     * quietly exercising the failure path instead of the one it is about.
     */
    http.get("/api/videos/p1/render", ({ request }) =>
      new URL(request.url).searchParams.has("running")
        ? HttpResponse.json({ jobs: running })
        : new HttpResponse(null, { status: 404 }),
    ),
  );
}

/** A version of the same cut, one edit back — what A1 compares against. */
const V5: CutDetail = {
  ...CUT,
  id: "c0",
  version: 5,
  edl: {
    ...EDL,
    video: [{ ...EDL.video[0], duration: 4 }, EDL.video[1]],
    captions: {
      ...EDL.captions!,
      lines: [EDL.captions!.lines[0], { ...EDL.captions!.lines[1], text: "a whole cut" }],
    },
  },
};

const V5_SUMMARY: CutView = {
  id: "c0",
  name: "film-16x9",
  version: 5,
  status: "rendered",
  outputRef: "cuts/film-16x9-v5.mp4",
  lineage: null,
  attribution: null,
  edl: { beats: 2, captionLines: 2, audio: "encode", width: 1280, height: 720, fps: 24, duration: 12 },
  createdAt: "2026-07-19T00:00:00.000Z",
};

/** The project as it really is once a cut has history: two versions. */
const TWO_VERSIONS: ProjectDetail = { ...DETAIL, cuts: [DETAIL.cuts[0], V5_SUMMARY] };

function job(over: Partial<RenderJobView> = {}): RenderJobView {
  return {
    id: "j-resumed",
    projectId: "p1",
    cutId: "c1",
    kind: "render",
    status: "running",
    outputRef: null,
    error: null,
    startedAt: "2026-07-28T10:00:00.000Z",
    finishedAt: null,
    ...over,
  };
}

describe("VideoEditor (exact-mock rebuild — Videos.dc.html, step 2)", () => {
  it("renders the sheet's bands with the real cut behind them", async () => {
    serve();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);

    expect(await screen.findByRole("heading", { name: "film-16x9 v6" })).toBeInTheDocument();
    expect(container.querySelector(".content.editor-surface")).not.toBeNull();
    // A6: durations read in the sheet's own m:ss.t, the scrub's grammar.
    expect(screen.getByText("draft · 0:12.0")).toHaveClass("pill", "pill-idle");
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

    // The lane re-proportions from the EDL — s99: on the CUT's 12s axis (the
    // ruler/playhead's own), so the trimmed tail reads as honest empty lane
    // rather than the beats silently stretching onto a different clock.
    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk")).map((b) => b.style.width),
      ).toEqual([`${(3 / 12) * 100}%`, `${(6 / 12) * 100}%`]),
    );
    expect(screen.getByRole("button", { name: "Save as v7" })).toBeInTheDocument();
    expect(screen.getByText("unsaved · 0:12.0")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Propose ⚡1" }));
    expect(await screen.findByText(/clear the second caption off the falcon/)).toBeInTheDocument();
    expect(screen.getByText("proposal")).toHaveClass("pill", "pill-warn");
    // The proposal lands ON THE TIMELINE — the second plate carries the mark.
    await waitFor(() => expect(container.querySelectorAll(".blk-cap.prop")).toHaveLength(1));
    // Nothing has been applied: the cut is still clean.
    // The PRIMARY save (the versioned one) — "Save as a new variant…" is a
    // resting affordance and says nothing about the working copy being dirty.
    expect(screen.queryByRole("button", { name: /^Save as v\d/ })).toBeNull();

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

    await user.click(screen.getByRole("button", { name: "Propose ⚡1" }));
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

  it("names who authored the version being edited — an agent-authored cut is marked as such", async () => {
    serve(DETAIL, {
      ...CUT,
      attribution: {
        authoredBy: "agent",
        // The contract REQUIRES an agent-authored cut to carry its whole
        // replayable proposal — attribution without the record behind it is
        // exactly what the schema refuses.
        proposal: {
          baseCutId: "c0",
          model: "claude-x",
          promptName: "editor/propose",
          promptHash: "abc123",
          ask: "tighten the middle",
          diff: { version: 1 as const, summary: "trim beat 04", ops: [] },
          decidedBy: "operator" as const,
        },
      },
    });
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    // AI-authored content, marked, on the surface where it gets edited.
    expect(await screen.findByText(/agent · claude-x · “tighten the middle”/)).toBeInTheDocument();
  });

  it("says a cut has no recorded author rather than guessing one", async () => {
    serve(DETAIL, { ...CUT, attribution: null });
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(await screen.findByText(/no attribution recorded/)).toBeInTheDocument();
  });

  it("says a derived cut has fallen behind its parent — the fact it computes and never auto-syncs", async () => {
    serve(DETAIL, {
      ...CUT,
      lineage: {
        parentCutId: "master-1",
        aspect: "9:16",
        parentName: "film-16x9",
        parentVersion: 6,
        parentLatestVersion: 8,
      },
    });
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(await screen.findByText(/parent now v8 · no auto-sync/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /derived from film-16x9 v6/ })).toHaveAttribute(
      "href",
      "/app/videos/p1/edit?cut=master-1",
    );
  });

  it("a cut level with its parent says it is derived and does NOT cry stale", async () => {
    serve(DETAIL, {
      ...CUT,
      lineage: {
        parentCutId: "master-1",
        aspect: "9:16",
        parentName: "film-16x9",
        parentVersion: 8,
        parentLatestVersion: 8,
      },
    });
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(await screen.findByRole("link", { name: /derived from/ })).toBeInTheDocument();
    expect(screen.queryByText(/no auto-sync/)).toBeNull();
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

/**
 * s82 lane A — VERSION MANAGEMENT (A1–A4) and the takes strip's audition (A5).
 *
 * Four of the editor's five remaining no-affordance jobs were one theme: an
 * operator could make versions and could not compare them, name them, or throw
 * one away. Each case below drives the JOB, not the control — the jobs table's
 * own lesson is that a surface can pass every unit test and still offer nobody
 * a way to do the thing.
 */
describe("VideoEditor — version management (s82 A1–A3)", () => {
  it("compares this cut against another version and says what changed", async () => {
    serve(TWO_VERSIONS);
    server.use(http.get("/api/videos/p1/cuts/c0", () => HttpResponse.json(V5)));
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Compare with another version" }));

    // The diff is structural and deterministic: no model, no metered call. It
    // lands in the proposal panel's own grammar, which is why A1 needed no CSS.
    expect(await screen.findByText(/beat-01 4s → 6s/)).toBeInTheDocument();
    expect(screen.getByText(/“a whole cut” → “a full cut”/)).toBeInTheDocument();
    expect(container.querySelectorAll(".diff-panel .diff-op").length).toBeGreaterThanOrEqual(2);
    // It states WHICH two versions are being read, in both directions.
    expect(screen.getByText(/v5 → film-16x9 v6/)).toBeInTheDocument();
  });

  it("compares against the WORKING COPY, so an unsaved edit is what you see", async () => {
    serve(TWO_VERSIONS);
    server.use(http.get("/api/videos/p1/cuts/c0", () => HttpResponse.json(V5)));
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    const duration = await screen.findByLabelText("duration (s)");
    await user.clear(duration);
    await user.type(duration, "9");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Compare with another version" }));

    expect(await screen.findByText(/beat-01 4s → 9s/)).toBeInTheDocument();
    expect(screen.getByText(/with your unsaved edits/)).toBeInTheDocument();
  });

  it("says there is nothing to compare against rather than opening an empty panel", async () => {
    serve(); // one version on the project
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const compare = screen.getByRole("button", { name: "Compare with another version" });
    expect(compare).toHaveAttribute("aria-disabled", "true");
    await user.click(compare);
    expect(await screen.findByText(/is the only version on this project/)).toBeInTheDocument();
  });

  it("saves under a NEW NAME as a variant at v1, leaving this cut alone", async () => {
    serve();
    let saved: { name?: string } | null = null;
    server.use(
      http.post("/api/videos/p1/cuts", async ({ request }) => {
        saved = (await request.json()) as { name?: string };
        return HttpResponse.json({
          cut: { ...CUT, id: "c2", name: "film-tight", version: 1 },
          created: true,
        });
      }),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Save as a new variant…" }));
    const field = await screen.findByLabelText("variant name");
    await user.clear(field);
    await user.type(field, "film-tight");
    // The band says which of the two saves this is BEFORE the press.
    expect(screen.getByText(/“film-tight” is a new variant — it starts at v1/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save as film-tight v1" }));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ name: "film-tight" });
    expect(
      await screen.findByText(/Saved as a new variant: film-tight v1 — film-16x9 v6 is untouched/),
    ).toBeInTheDocument();
  });

  it("warns that an EXISTING name is that cut's next version, not a fork", async () => {
    serve(TWO_VERSIONS);
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Save as a new variant…" }));
    const field = await screen.findByLabelText("variant name");
    await user.clear(field);
    await user.type(field, "film-16x9");
    expect(screen.getByText(/is this cut — this saves as v7/)).toBeInTheDocument();
  });

  it("deletes a version behind a confirmation, and takes its render with it", async () => {
    serve(TWO_VERSIONS);
    let deleted = false;
    server.use(
      http.delete("/api/videos/p1/cuts/c1", () => {
        deleted = true;
        return HttpResponse.json({
          removed: { id: "c1", name: "film-16x9", version: 6, outputRef: "cuts/film-16x9-v6.mp4" },
          file: { removed: true, ref: "cuts/film-16x9-v6.mp4" },
        });
      }),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    // Reversible now (window 0026), but still a confirm: it names what goes
    // AND states the way back, which is the whole register change.
    await user.click(screen.getByRole("button", { name: "Retire this version" }));
    expect(
      await screen.findByText(/Retire film-16x9 v6\?[\s\S]*brings it back exactly/),
    ).toBeInTheDocument();
    expect(deleted).toBe(false);

    await user.click(screen.getByRole("button", { name: "Retire v6" }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(
      await screen.findByText(/Retired film-16x9 v6 — it kept its render/),
    ).toBeInTheDocument();
    // And it lands on what is left, rather than on a cut that no longer exists.
    expect(replace).toHaveBeenCalledWith("/app/videos/p1/edit?cut=c0", { scroll: false });
  });

  it("keeps the version when the confirmation is declined", async () => {
    serve(TWO_VERSIONS);
    let deleted = false;
    server.use(
      http.delete("/api/videos/p1/cuts/c1", () => {
        deleted = true;
        return HttpResponse.json({ retired: {}, changed: true });
      }),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Retire this version" }));
    await user.click(await screen.findByRole("button", { name: "Keep it" }));
    expect(deleted).toBe(false);
    expect(screen.queryByRole("button", { name: "Retire v6" })).toBeNull();
  });

  it("REFUSES to retire an approved cut, out loud, without disabling the control", async () => {
    /*
     * s81's standing lesson, applied to the newest verb on the surface: a
     * disabled button fires no tooltip and assistive tech skips it, so the
     * reason would be unreachable by every route. It stays focusable, says
     * aria-disabled, and answers when pressed.
     */
    serve(TWO_VERSIONS, { ...CUT, status: "approved" });
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const del = screen.getByRole("button", { name: "Retire this version" });
    expect(del).toBeEnabled();
    expect(del).toHaveAttribute("aria-disabled", "true");
    await user.click(del);
    expect(await screen.findByText(/approved — an approved cut carries its judge receipt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Retire v6$/ })).toBeNull();
  });

  it("refuses to retire the version you are holding unsaved edits to", async () => {
    serve(TWO_VERSIONS);
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    const duration = await screen.findByLabelText("duration (s)");
    await user.clear(duration);
    await user.type(duration, "3");
    await user.tab();

    await user.click(screen.getByRole("button", { name: "Retire this version" }));
    expect(await screen.findByText(/Save or discard your unsaved edits first/)).toBeInTheDocument();
  });

  it("carries the DOOR's refusal verbatim when the server is the one that says no", async () => {
    // The surface mirrors the repo's rules to answer early; the repo is still
    // the authority, and its sentence is what the operator reads.
    serve(TWO_VERSIONS);
    server.use(
      http.delete("/api/videos/p1/cuts/c1", () =>
        HttpResponse.json(
          {
            error:
              'video cut "film-16x9" v6 is the lineage parent of "film-9x16" v1 — retire the derived cut first, or its provenance would dangle',
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Retire this version" }));
    await user.click(await screen.findByRole("button", { name: "Retire v6" }));
    expect(await screen.findByText(/is the lineage parent of "film-9x16" v1/)).toBeInTheDocument();
  });
});

describe("VideoEditor — a render survives leaving the page (s82 A4)", () => {
  it("picks a running render back up on load and says so where the player is", async () => {
    serve(DETAIL, CUT, [job()]);
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    expect(
      await screen.findByText(/a render is in flight for v6 — this page picked the job back up/),
    ).toBeInTheDocument();
    // Adopting the job is what makes the primary button honest again — and
    // V7 puts the job's REAL elapsed (from its recorded startedAt) beside the
    // word, so the name is matched by prefix.
    expect(await screen.findByRole("button", { name: /^Rendering…/ })).toBeInTheDocument();
  });

  it("a finished render names its REAL duration in the notice band (V7)", async () => {
    serve(DETAIL, CUT, [job()]);
    // The poll's answer: the same job, done, its recorded clocks 2m 08s apart.
    // The notice derives from those clocks alone — deterministic, never wall time.
    server.use(
      http.get("/api/videos/p1/render", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("running")) return HttpResponse.json({ jobs: [job()] });
        if (url.searchParams.get("jobId") === "j-resumed") {
          return HttpResponse.json(
            job({
              status: "done",
              outputRef: "cuts/film-16x9-v6.mp4",
              finishedAt: "2026-07-28T10:02:08.000Z",
            }),
          );
        }
        return new HttpResponse(null, { status: 404 });
      }),
    );
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(
      await screen.findByText("Rendered in 2m 08s — local x264, 0 credits.", undefined, {
        timeout: 6000,
      }),
    ).toBeInTheDocument();
  }, 10_000);

  it("names another cut's render rather than implying it is this one's", async () => {
    serve(TWO_VERSIONS, CUT, [job({ id: "j2", cutId: "c0" })]);
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(await screen.findByText(/a render is in flight for film-16x9 v5/)).toBeInTheDocument();
    // And it is NOT adopted: this cut has no render running.
    expect(screen.queryByRole("button", { name: "Rendering…" })).toBeNull();
  });

  it("never adopts a PREVIEW — its unsaved EDL is gone, and it says that instead", async () => {
    serve(DETAIL, CUT, [job({ kind: "preview" })]);
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    expect(await screen.findByText(/belongs to an earlier working copy/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rendering…" })).toBeNull();
  });
});

describe("VideoEditor — the s78 tail (s82 A6)", () => {
  it("one verb's work no longer disables every other verb", async () => {
    // The old single `busy` flag: a render that takes minutes locked the
    // copilot, the aspect lens and the proposal panel behind it.
    serve();
    server.use(http.post("/api/videos/p1/render", () => new Promise<never>(() => {})));
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Render" }));
    expect(await screen.findByRole("button", { name: "Rendering…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Propose ⚡1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "9:16" })).toBeEnabled();
  });

  it("says so when the player cannot play the file, and hands back the way out", async () => {
    serve({ ...DETAIL, playable: true }, { ...CUT, status: "rendered", outputRef: "cuts/v6.mp4" });
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(screen.getByRole("button", { name: "Play film-16x9 v6" }));
    const video = container.querySelector("video.player-video");
    expect(video).not.toBeNull();
    fireEvent.error(video as HTMLVideoElement);

    // Back to the rest state — where every fact about this cut and every verb
    // that could fix it already live — with what happened stated on the way.
    expect(await screen.findByText(/would not play — the render is on record/)).toBeInTheDocument();
    expect(container.querySelector("video.player-video")).toBeNull();
    expect(screen.getByRole("button", { name: "Play film-16x9 v6" })).toBeEnabled();
  });
});

describe("VideoEditor — auditioning a candidate take (s82 A5)", () => {
  it("offers the frozen audition seam on every candidate, named by what it plays", async () => {
    serve({ ...DETAIL, playable: true });
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    expect(await screen.findByText("Takes — beat-01")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Audition take beat-01-t2.mp4" }),
    ).toBeInTheDocument();
    // What is IN the cut is auditionable too — a comparison needs both sides.
    expect(
      screen.getByRole("button", { name: /Audition what is in the cut — beat-01.mp4/ }),
    ).toBeInTheDocument();

    // The swap is still the tile's own verb, and still one press.
    await user.click(
      screen.getByRole("button", { name: /Swap this beat to take beat-01-t2.mp4/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save as v7" })).toBeInTheDocument(),
    );
  });

  it("offers no audition where nothing can be played — a project with no media root on this box", async () => {
    serve(); // DETAIL.playable is false
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    expect(await screen.findByText("Takes — beat-01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Audition/ })).toBeNull();
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

/**
 * s82 B3 — a judge refusal reaches the TIMELINE, not just the notice band.
 *
 * The receiving half shipped in editor-timeline.tsx (built, tested, defaulted
 * to an empty set) while this file never passed `refusedCaptions`, so the whole
 * feature rendered as nothing: a mark that existed in the code and never on
 * screen. Two lanes each owned one half and neither could see the seam. These
 * pin the seam itself.
 */
describe("VideoEditor — a judge refusal marks the plate it refused (s82 B3)", () => {
  /** The approve door's 409: the gate refused caption line 0 (0-based, its own index). */
  function refuseFirstCaption() {
    server.use(
      http.post("/api/videos/p1/cuts/c1/approve", () =>
        HttpResponse.json(
          {
            error: "judge gate g1-captions refused 1 of 2 caption line(s)",
            failures: [{ line: 0, text: "one prompt", matches: ["one prompt"] }],
          },
          { status: 409 },
        ),
      ),
    );
  }

  it("marks the refused plate on the caption lane, and only that one", async () => {
    // The approve verb exists only on a RENDERED cut — that is the door the
    // judge gate sits behind.
    serve(DETAIL, { ...CUT, status: "rendered", outputRef: "cuts/out.mp4" });
    refuseFirstCaption();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    // Nothing is refused until the gate says so.
    expect(container.querySelectorAll(".blk-cap.refused")).toHaveLength(0);

    await user.click((await screen.findAllByRole("button", { name: "Send cut to Approve" }))[0]);
    await screen.findByText(/refused 1 of 2 caption line/);

    // `refusal.line` is the 0-based index into captions.lines — the same basis
    // the plates are keyed on. An off-by-one here would mark the WRONG caption,
    // which is worse than marking none, so the count AND the position are both
    // pinned.
    const plates = container.querySelectorAll(".blk-cap");
    expect(plates).toHaveLength(2);
    expect(plates[0].className).toContain("refused");
    expect(plates[1].className).not.toContain("refused");
    // The lane says the word, not just a colour (the audit's own condition).
    expect(await screen.findByText("refused")).toBeInTheDocument();
  });

  it("names the refusal in the surface's own numbering, and is a door to the plate", async () => {
    serve(DETAIL, { ...CUT, status: "rendered", outputRef: "cuts/out.mp4" });
    refuseFirstCaption();
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    await user.click((await screen.findAllByRole("button", { name: "Send cut to Approve" }))[0]);

    // It printed the raw 0-based index — the judge refused "line 0" while the
    // inspector beside it called the same plate "Caption 1", so the operator
    // had to know the off-by-one to act on their own gate result.
    const row = await screen.findByRole("button", {
      name: /Select Caption 1, refused by the judge/,
    });
    expect(row).toHaveTextContent(/Caption 1 .one prompt./);
    expect(screen.queryByText(/line 0/)).not.toBeInTheDocument();

    // And it is a way TO the text, not merely a note about it: pressing the
    // refusal selects that plate, so the inspector opens on the very caption
    // the judge objected to.
    await user.click(row);
    const inspector = await screen.findByText("Caption 1", { selector: ".inspector-head .t-title" });
    expect(inspector).toBeInTheDocument();
  });
});

/** s99 — the fe-check fix round's own pins (the five HIGHs first). */
describe("s99 fixes: no silent destruction, no invisible failure, one gesture one undo", () => {
  async function openDirty(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
    await screen.findByRole("heading", { name: "film-16x9 v6" });
    await user.click(container.querySelectorAll(".lane-tr .blk")[0]);
    const duration = await screen.findByLabelText("duration (s)");
    await user.clear(duration);
    await user.type(duration, "3");
    await user.tab();
    await screen.findByRole("button", { name: "Save as v7" });
  }

  it("the Recut 9:16 chip REFUSES while dirty — it never leaves unsaved edits behind", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await openDirty(user, container);

    push.mockClear();
    await user.click(screen.getByRole("button", { name: /Recut 9:16/ }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/Save first — a derive reads the STORED EDL/)).toBeInTheDocument();
    // The working copy survives: still dirty, still on v7's save door.
    expect(screen.getByRole("button", { name: "Save as v7" })).toBeInTheDocument();
  });

  it("a failed render is visible with nothing else to say — broken never looks like idle", async () => {
    // The real path: a running render is adopted at load, then the poll
    // returns the failure. Nothing else writes a notice, so before s99 the
    // whole band stayed unmounted and the failure rendered nowhere.
    const failed = job({
      status: "error",
      error: "ffmpeg exited 1",
      finishedAt: "2026-07-28T10:02:00.000Z",
    });
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json(DETAIL)),
      http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(CUT)),
      http.get("/api/videos/p1/render", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("jobId")) return HttpResponse.json(failed);
        return HttpResponse.json({ jobs: [job()] });
      }),
    );
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await waitFor(() => expect(screen.getByText(/Render failed/)).toBeInTheDocument(), {
      timeout: 9000,
    });
    expect(screen.getByText(/ffmpeg exited 1/)).toBeInTheDocument();
    expect(container.querySelector(".notice-band.refused")).not.toBeNull();
  }, 15000);

  it("Discard is reversible — ⌘Z brings the discarded working copy back", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await openDirty(user, container);

    await user.click(screen.getByRole("button", { name: /Discard changes/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save as v7" })).toBeNull());
    await user.keyboard("{Control>}z{/Control}");
    expect(await screen.findByRole("button", { name: "Save as v7" })).toBeInTheDocument();
  });

  it("one typing burst in a caption is ONE undo step, not one per keystroke", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    await user.click(container.querySelectorAll(".blk-cap")[0]);
    const text = await screen.findByDisplayValue("one prompt");
    await user.type(text, "XYZ");
    expect(await screen.findByDisplayValue("one promptXYZ")).toBeInTheDocument();

    // The spine depth IS the pin: three keystrokes leave ONE step, not three
    // (before s99 each keystroke pushed, evicting real edits off the bound).
    const undoBtn = await screen.findByRole("button", { name: "Undo" });
    expect(undoBtn.getAttribute("title")).toContain("1 step back");

    // And that one step is the whole burst.
    await user.click(undoBtn);
    expect(await screen.findByDisplayValue("one prompt")).toBeInTheDocument();
  });

  it("the beat lane and the ruler share ONE time axis — the cut's own duration", async () => {
    // Beats summing under the declared duration must leave honest empty lane,
    // never stretch to fill (which put every edge on a different clock).
    serve(DETAIL, { ...CUT, edl: { ...EDL, video: [{ ...EDL.video[0], duration: 3 }, { ...EDL.video[1], duration: 3 }] } });
    const { container } = render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const widths = Array.from(container.querySelectorAll<HTMLElement>(".lane-tr .blk")).map(
      (b) => b.style.width,
    );
    expect(widths).toEqual([`${(3 / 12) * 100}%`, `${(3 / 12) * 100}%`]);
  });

  it("the approved primary ANSWERS instead of sitting dead", async () => {
    serve(DETAIL, { ...CUT, status: "approved", outputRef: "cuts/out.mp4" });
    const user = userEvent.setup();
    render(<VideoEditor projectId="p1" cutId="c1" />);
    await screen.findByRole("heading", { name: "film-16x9 v6" });

    const cta = screen.getByRole("button", { name: "Approved" });
    expect(cta).not.toBeDisabled();
    await user.click(cta);
    expect(screen.getByText(/the queue lives on Approve/)).toBeInTheDocument();
  });

  it("a stale ?cut= opens the project's current cut and says so — never the empty state", async () => {
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json(DETAIL)),
      http.get("/api/videos/p1/cuts/gone", () => new HttpResponse(null, { status: 404 })),
      http.get("/api/videos/p1/cuts/c1", () => HttpResponse.json(CUT)),
      http.get("/api/videos/p1/render", () => HttpResponse.json({ jobs: [] })),
    );
    render(<VideoEditor projectId="p1" cutId="gone" />);

    expect(await screen.findByRole("heading", { name: "film-16x9 v6" })).toBeInTheDocument();
    expect(screen.getByText(/That cut is no longer on record/)).toBeInTheDocument();
    expect(screen.queryByText(/No cut to edit yet/)).toBeNull();
  });
});
