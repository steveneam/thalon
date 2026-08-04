// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { VideoDossier } from "@/components/videos/dossier";
import { server } from "@/lib/testing/server";
import type { CutView, ProjectDetail } from "@/lib/videos/types";

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (Video Dossier.dc.html)
 * with the real project record behind them. Every assertion is either a band
 * the sheet draws or a fact the engine actually records.
 */

const EDL = {
  beats: 8,
  captionLines: 4,
  audio: "encode" as const,
  width: 1280,
  height: 720,
  fps: 24,
  duration: 42.3,
};

function cut(over: Partial<CutView> & Pick<CutView, "id" | "version">): CutView {
  return {
    name: "film-16x9",
    status: "draft",
    outputRef: null,
    lineage: null,
    attribution: null,
    edl: EDL,
    createdAt: "2026-07-20T00:00:00.000Z",
    ...over,
  };
}

const DETAIL: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: "a 40s film of the one-prompt flow",
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: true,
  onePrompt: false,
  retired: [],
  takes: [
    {
      id: "t1",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-01-the-watch.mp4",
      reason: null,
      provenance: { pinned: "4c4274dc", model: "test/mint" },
      poster: null,
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "t2",
      slot: "beat-01",
      kind: "motion",
      disposition: "reject",
      ref: "motion/rejects/beat-01-t1.mp4",
      reason: "hand clips through the watch face",
      provenance: {},
      poster: null,
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  cuts: [
    cut({ id: "c1", version: 1, attribution: { authoredBy: "operator" } }),
    cut({
      id: "c2",
      version: 2,
      status: "rendered",
      outputRef: "cuts/master.mp4",
      createdAt: "2026-07-24T00:00:00.000Z",
      attribution: {
        authoredBy: "agent",
        proposal: {
          baseCutId: "c1",
          model: "test/proposer",
          promptName: "edl-propose",
          promptHash: "abc",
          ask: "tighten the middle",
          decidedBy: "operator",
          diff: { version: 1, summary: "trim beat 04", ops: [] },
        },
      },
    }),
    cut({
      id: "c3",
      version: 1,
      name: "film-9x16",
      status: "rendered",
      outputRef: "cuts/vertical.mp4",
      lineage: {
        parentCutId: "c2",
        aspect: "9:16",
        parentName: "film-16x9",
        parentVersion: 2,
        parentLatestVersion: 4,
      },
      edl: { ...EDL, width: 1080, height: 1920 },
    }),
  ],
};

/** The picked cut's FULL EDL — the s96 on-demand read behind Mark/Swap/the takes band. */
const FULL_EDL = {
  version: 1,
  name: "film-16x9",
  output: {
    width: 1280,
    height: 720,
    fps: 24,
    duration: 42.3,
    video: { mode: "encode", codec: "libx264", crf: 18, preset: "medium", pixFmt: "yuv420p" },
  },
  video: [
    {
      name: "beat-01",
      source: { kind: "take", ref: "motion/keepers/beat-01-the-watch.mp4" },
      in: 0,
      duration: 42.3,
    },
  ],
  audio: [],
};

function serve(detail: ProjectDetail = DETAIL) {
  server.use(
    http.get("/api/videos/p1", () => HttpResponse.json(detail)),
    http.get("/api/videos/p1/cuts/:cutId", ({ params }) =>
      HttpResponse.json({
        ...(detail.cuts.find((c) => c.id === params.cutId) ?? detail.cuts[0]),
        edl: FULL_EDL,
      }),
    ),
    http.get("/api/videos/p1/render", ({ request }) =>
      new URL(request.url).searchParams.has("running")
        ? HttpResponse.json({ jobs: [] })
        : new HttpResponse(null, { status: 404 }),
    ),
  );
}

describe("VideoDossier (exact-mock rebuild — Video Dossier.dc.html, step 2)", () => {
  it("renders the sheet's bands with the real record behind them", async () => {
    serve();
    const { container } = render(<VideoDossier projectId="p1" />);

    expect(await screen.findByRole("heading", { name: "concept film" })).toBeInTheDocument();
    expect(container.querySelector(".content.dossier-surface")).not.toBeNull();
    expect(screen.getByRole("link", { name: "← Videos" })).toHaveAttribute("href", "/app/videos");
    // s96 — the crumb (Synthesia) sits between the h1 and the state pill,
    // naming the version you are on; the headline cut is v2, rendered.
    const crumb = screen.getByRole("heading", { name: "concept film" }).nextElementSibling;
    expect(crumb).toHaveClass("ver-crumb");
    expect(crumb?.textContent).toContain("film-16x9 v2");
    expect(crumb?.nextElementSibling).toHaveClass("pill", "pill-idle");
    expect(screen.getByRole("link", { name: "Open in editor" })).toHaveAttribute(
      "href",
      "/app/videos/p1/edit?cut=c2",
    );

    /*
     * s96 — the strip is the MARKED set (the amended sheet's own words:
     * "marked cuts ride this strip — the timestamp flood stays behind Cut
     * history"): the Brief chip, one chip per non-derived NAME at its picked/
     * latest version (the 9:16 derive belongs to the aspect band), then the
     * ☆ Mark and + New version doors. v1 lives behind the crumb, not here.
     */
    const vers = container.querySelectorAll(".ver-strip .ver");
    expect(vers).toHaveLength(4); // Brief + film-16x9 + ☆ Mark + New version
    expect(container.querySelectorAll(".ver-strip .ver-arrow")).toHaveLength(1);
    expect(screen.getByText("✓ film-16x9").closest(".ver")).toHaveClass("on");
    expect(screen.queryByText(/v1\b.*film-16x9/)).toBeNull();
  });

  it("names what changed every version, and never credits an unattributed one", async () => {
    serve();
    const user = userEvent.setup();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    // The picked chip carries its attribution; the flood behind the crumb
    // (s96) carries every OTHER version's, so v1's line lives there.
    expect(screen.getByText(/agent · test\/proposer · “tighten the middle”/)).toHaveClass("ver-a");
    await user.click(document.querySelector(".ver-crumb") as HTMLElement);
    expect(screen.getByText(/your edit ·/)).toHaveClass("ver-a");

    // A cut written before the attributed save door says so.
    serve({ ...DETAIL, cuts: [cut({ id: "c1", version: 1 })] });
    render(<VideoDossier projectId="p1" />);
    expect(await screen.findByText(/no attribution recorded/)).toBeInTheDocument();
  });

  it("keeps the sheet's player at rest and reveals the real render on play", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(container.querySelector(".player video")).toBeNull();
    expect(within(container.querySelector(".player") as HTMLElement).getByText("0:42.3")).toHaveClass(
      "t-data",
    );
    await user.click(screen.getByRole("button", { name: /^Play / }));
    await waitFor(() =>
      expect(container.querySelector<HTMLVideoElement>(".player video")?.getAttribute("src")).toBe(
        "/api/videos/p1/media?ref=cuts%2Fmaster.mp4",
      ),
    );
  });

  it("says why there is nothing to play instead of a dead play button", async () => {
    serve({ ...DETAIL, cuts: [cut({ id: "c1", version: 1 })] });
    render(<VideoDossier projectId="p1" />);

    expect(await screen.findByText(/no render yet for v1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Play / })).toBeDisabled();
  });

  it("shows the aspect cut's real lineage and its honest staleness", async () => {
    serve();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(screen.getByText("film-9x16 v1 · 0:42.3")).toHaveClass("clip-cap");
    expect(screen.getByText("1080×1920 · 8 beats")).toHaveClass("clip-kind");
    // The parent moved on since the pin and there is no auto-sync by design.
    expect(screen.getByText("parent now v4")).toHaveClass("pchip", "pill-warn");
    // No platform chips: nothing carries a video to a platform.
    expect(screen.queryByText(/LinkedIn/)).toBeNull();
  });

  /**
   * s79 V1, the other half. The overview card's aspect count is now scoped
   * to the cut it speaks for, which is right — but the band here is scoped
   * to the picked VERSION, so a project whose recuts hang off a different
   * version must still say they exist, or narrowing the card would simply
   * hide them. (Live: four recuts, all off `concept-film-16x9 v6`, with the
   * dossier's own band reading a bare "none yet".)
   */
  it("an empty aspect band still names the recuts hanging off another version", async () => {
    serve({
      ...DETAIL,
      cuts: [
        cut({ id: "base", version: 6, name: "film-16x9" }),
        // The picked cut is ITSELF a recut, exactly as the live project's is.
        cut({
          id: "head",
          version: 2,
          name: "film-1x1",
          status: "approved",
          createdAt: "2026-07-25T00:00:00.000Z",
          lineage: {
            parentCutId: "base",
            aspect: "1:1",
            parentName: "film-16x9",
            parentVersion: 6,
            parentLatestVersion: 6,
          },
        }),
        // …and a sibling recut off the same parent — the one that is genuinely
        // elsewhere, and that the card's narrowed count no longer mentions.
        cut({
          id: "sibling",
          version: 1,
          name: "film-9x16",
          status: "rendered",
          lineage: {
            parentCutId: "base",
            aspect: "9:16",
            parentName: "film-16x9",
            parentVersion: 6,
            parentLatestVersion: 6,
          },
        }),
      ],
    });
    const user = userEvent.setup();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    // s96: the default pick prefers the MASTER chain, so the recut-as-picked
    // shape is reached the way an operator reaches it — through the crumb.
    await user.click(document.querySelector(".ver-crumb") as HTMLElement);
    await user.click(screen.getByRole("option", { name: /film-1x1 v2/ }));

    expect(
      screen.getByText(/none from this version · 1 elsewhere in this project, from film-16x9 v6/),
    ).toBeInTheDocument();
    // The bare "none yet" is reserved for a project that genuinely has none.
    expect(screen.queryByText(/^none yet ·/)).toBeNull();
  });

  it("says a plain 'none yet' when the project really has no recuts at all", async () => {
    serve({ ...DETAIL, cuts: [cut({ id: "c1", version: 1 })] });
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(screen.getByText(/none yet · a recut is measured from this timeline/)).toBeInTheDocument();
    expect(screen.queryByText(/elsewhere in this project/)).toBeNull();
  });

  it("keeps the record's keys and marks only real doors as doors", async () => {
    serve();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(screen.getByText("a 40s film of the one-prompt flow")).toHaveClass("fact-v");
    expect(screen.getByText(/grounding rides text drafts today/)).toHaveClass("fact-v");
    expect(screen.getByText(/it gates, never rewrites/)).toHaveClass("fact-v");
    expect(screen.getByText(/no publish path carries a video/)).toHaveClass("fact-v");
    // Runs is the one row that opens something, so it is the one with an arrow.
    expect(document.querySelectorAll(".fact-row .tile-arrow")).toHaveLength(1);
  });

  it("re-enters the takes keeper as a state behind the record's Runs row", async () => {
    serve();
    const user = userEvent.setup();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(screen.queryByText("hand clips through the watch face")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Runs/ }));

    // The reject's reason is on the row, never behind a click.
    expect(await screen.findByText("hand clips through the watch face")).toBeInTheDocument();
    expect(screen.getByText("beat-01")).toBeInTheDocument();

    // The pinned manifest follows the picked take — the PANEL's row, not the
    // s96 audition band's tile, which shares the file name by design.
    const panel = document.querySelector(".takes-panel") as HTMLElement;
    await user.click(within(panel).getByRole("button", { name: /beat-01-the-watch\.mp4/ }));
    expect(await screen.findByText("4c4274dc")).toBeInTheDocument();
    expect(screen.getByText("test/mint")).toBeInTheDocument();
  });

  it("shows a judge refusal verbatim, per line", async () => {
    serve();
    server.use(
      http.post("/api/videos/p1/cuts/c2/approve", () =>
        HttpResponse.json(
          {
            error: "captions failed the denylist gate",
            failures: [{ line: 3, text: "guaranteed results", matches: ["guaranteed"] }],
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    await user.click(screen.getByRole("button", { name: "Send cut to Approve" }));
    expect(await screen.findByText(/captions failed the denylist gate/)).toBeInTheDocument();
    expect(screen.getByText(/line 3 “guaranteed results” — guaranteed/)).toBeInTheDocument();
  });

  it("treats a failed read as a read failure, and a 404 as a missing project", async () => {
    server.use(
      http.get("/api/videos/p1", () => HttpResponse.json({ error: "boom" }, { status: 500 })),
    );
    render(<VideoDossier projectId="p1" />);
    expect(await screen.findByText(/a read failure, not an empty project/)).toBeInTheDocument();

    server.use(http.get("/api/videos/p1", () => new HttpResponse(null, { status: 404 })));
    render(<VideoDossier projectId="p1" />);
    expect(await screen.findByText(/doesn’t exist, or belongs to another tenant/)).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", async () => {
    serve();
    const { container } = render(<VideoDossier projectId="p1" />);
    await screen.findByRole("heading", { name: "concept film" });

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
