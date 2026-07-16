// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/lib/testing/server";
import type { ProjectDetail, ProjectSummary } from "@/lib/videos/types";
import { ProjectBrowser } from "../project-browser";
import { VideoProjects } from "../video-projects";

const SUMMARIES: ProjectSummary[] = [
  {
    id: "p1",
    name: "concept film",
    description: "the reference project",
    keepers: 12,
    rejects: 9,
    cuts: 2,
    createdAt: "2026-07-16T00:00:00.000Z",
  },
];

const DETAIL: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: "the reference project",
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: true,
  takes: [
    {
      id: "t1",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/clip-01-the-watch.mp4",
      reason: null,
      provenance: { pinned: "4c4274dc", model: "test/mint" },
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "t2",
      slot: "beat-01",
      kind: "motion",
      disposition: "reject",
      ref: "motion/rejects/clip-01-t1-reject.mp4",
      reason: "hand clips through the watch face",
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
      outputRef: "cuts/film-16x9-master.mp4",
      edl: { beats: 10, captionLines: 12, audio: "encode", width: 1280, height: 720, fps: 24, duration: 50.78 },
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
};

describe("VideoProjects (list)", () => {
  it("renders projects with their keeper/reject/cut counts", async () => {
    server.use(http.get("/api/videos", () => HttpResponse.json({ projects: SUMMARIES })));
    render(<VideoProjects />);
    expect(await screen.findByText("concept film")).toBeInTheDocument();
    expect(screen.getByText("12 keepers")).toBeInTheDocument();
    expect(screen.getByText("9 rejects")).toBeInTheDocument();
    expect(screen.getByText("2 cuts")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is registered", async () => {
    server.use(http.get("/api/videos", () => HttpResponse.json({ projects: [] })));
    render(<VideoProjects />);
    expect(await screen.findByText(/No video projects yet/)).toBeInTheDocument();
  });
});

describe("ProjectBrowser (detail)", () => {
  function serveDetail(detail: ProjectDetail) {
    server.use(http.get("/api/videos/p1", () => HttpResponse.json(detail)));
  }

  it("lists takes with the reject reason inline and pinned provenance in the panel", async () => {
    serveDetail(DETAIL);
    render(<ProjectBrowser projectId="p1" />);
    // Inline on the reject row — the learning material is never hidden behind a click.
    expect(await screen.findByText("hand clips through the watch face")).toBeInTheDocument();
    // First take auto-selected → its provenance is in the panel.
    expect(screen.getByText("4c4274dc")).toBeInTheDocument();
    expect(screen.getByText("test/mint")).toBeInTheDocument();
  });

  it("moves the selected take with j/k (detail follows selection)", async () => {
    serveDetail(DETAIL);
    const user = userEvent.setup();
    render(<ProjectBrowser projectId="p1" />);
    await screen.findByText("hand clips through the watch face");
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
      "clip-01-the-watch.mp4",
    );
    await user.keyboard("j");
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
      "clip-01-t1-reject.mp4",
    );
    // "why rejected" block follows the selection into the panel.
    expect(screen.getByText("why rejected")).toBeInTheDocument();
  });

  it("summarizes each cut's EDL and reveals the player on play", async () => {
    serveDetail(DETAIL);
    const user = userEvent.setup();
    render(<ProjectBrowser projectId="p1" />);
    const cutRow = (await screen.findByText("film-16x9")).closest("li")!;
    expect(
      within(cutRow).getByText(/10 beats · 12 captions · music encode · 1280×720 @ 24fps · 50.78s/),
    ).toBeInTheDocument();
    expect(cutRow.querySelector("video")).toBeNull();
    await user.click(within(cutRow).getByRole("button", { name: "play" }));
    await waitFor(() => expect(cutRow.querySelector("video")).not.toBeNull());
  });

  it("turns playback off (no media elements, notice shown) when no media root is configured", async () => {
    serveDetail({ ...DETAIL, playable: false });
    render(<ProjectBrowser projectId="p1" />);
    await screen.findByText("hand clips through the watch face");
    expect(screen.getByText(/No media root configured/)).toBeInTheDocument();
    expect(document.querySelector("video, audio, img[alt^='Still']")).toBeNull();
    expect(screen.queryByRole("button", { name: "play" })).toBeNull();
  });
});
