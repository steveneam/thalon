// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { VideosOverview } from "@/components/videos/videos";
import { server } from "@/lib/testing/server";
import type { ProjectDetail, ProjectSummary } from "@/lib/videos/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/videos",
  useRouter: () => ({ push }),
}));

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (Videos Overview.dc.html)
 * with the real project read behind them. Every assertion is either a band
 * the sheet draws or a fact the engine actually records — the two things a
 * card is allowed to be made of.
 */

const SUMMARIES: ProjectSummary[] = [
  {
    id: "p1",
    name: "concept film",
    description: "the reference project",
    keepers: 12,
    rejects: 9,
    cuts: 3,
    createdAt: "2026-07-16T00:00:00.000Z",
  },
  {
    id: "p2",
    name: "ship-notes explainer",
    description: null,
    keepers: 0,
    rejects: 0,
    cuts: 0,
    createdAt: "2026-07-16T00:00:00.000Z",
  },
];

const EDL = {
  beats: 8,
  captionLines: 4,
  audio: "encode" as const,
  width: 1280,
  height: 720,
  fps: 24,
  duration: 42.3,
};

const P1: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: "the reference project",
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: true,
  retired: [],
  takes: [
    {
      id: "t1",
      slot: "beat-01",
      kind: "motion",
      disposition: "keeper",
      ref: "motion/keepers/beat-01.mp4",
      reason: null,
      provenance: { model: "kling3-turbo" },
      poster: null,
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  cuts: [
    { id: "c1", name: "film-16x9", version: 1, status: "draft", outputRef: null, lineage: null, attribution: null, edl: EDL, createdAt: "2026-07-16T00:00:00.000Z" },
    { id: "c2", name: "film-16x9", version: 2, status: "approved", outputRef: "cuts/master.mp4", lineage: null, attribution: null, edl: EDL, createdAt: "2026-07-18T00:00:00.000Z" },
    {
      id: "c3",
      name: "film-9x16",
      version: 1,
      status: "rendered",
      outputRef: "cuts/vertical.mp4",
      lineage: {
        parentCutId: "c2",
        aspect: "9:16",
        parentName: "film-16x9",
        parentVersion: 2,
        parentLatestVersion: 2,
      },
      attribution: null,
      edl: EDL,
      createdAt: "2026-07-19T00:00:00.000Z",
    },
  ],
};

const P2: ProjectDetail = {
  id: "p2",
  name: "ship-notes explainer",
  description: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: false,
  retired: [],
  takes: [],
  cuts: [],
};

function serveAll() {
  server.use(
    http.get("/api/videos", () => HttpResponse.json({ projects: SUMMARIES })),
    http.get("/api/videos/p1", () => HttpResponse.json(P1)),
    http.get("/api/videos/p2", () => HttpResponse.json(P2)),
  );
}

describe("VideosOverview (exact-mock rebuild — Videos Overview.dc.html, step 2)", () => {
  it("renders the sheet's bands with the real project list behind them", async () => {
    serveAll();
    const { container } = render(<VideosOverview />);

    // s99: the visible count sits inside the pill beside its invisible sizer
    // (the box that keeps the seg from lurching on filter clicks).
    expect((await screen.findByText("2 projects")).closest(".pill")).toHaveClass(
      "pill",
      "pill-idle",
      "count-pill",
    );

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.videos-surface")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Videos" })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll(".seg .seg-opt")).map((el) => el.textContent),
    ).toEqual(["All", "Approved", "Rendered", "Drafts"]);
    expect(container.querySelector(".imp .imp-box")?.textContent).toContain("Bring your own.");
    expect(screen.getByRole("link", { name: "+ New video" })).toHaveAttribute(
      "href",
      "/app/create?family=video",
    );

    // Two project cards + the new-project tile.
    expect(container.querySelectorAll(".vgrid > .vcard")).toHaveLength(2);
    expect(container.querySelectorAll(".vgrid > .newcard")).toHaveLength(1);

    const card = screen.getByText("concept film").closest(".vcard") as HTMLElement;
    expect(card).toHaveAttribute("href", "/app/videos/p1");
    // The HEADLINE cut is the furthest-along one — approved, 42.3s.
    expect(within(card).getByText("approved")).toHaveClass("pill", "pill-ok");
    expect(within(card).getByText("0:42")).toHaveClass("dur");
    // AMENDED s95 (Riverside): the family line is the project's own history
    // rows — takes first, then cuts (raw counts; derived cuts are rows too).
    expect(within(card).getByText("1 take")).toHaveClass("fam-link");
    expect(within(card).getByText("3 cuts")).toHaveClass("fam-link");
    // AMENDED s95 (ClickUp): the stamp's first token is the KIND.
    const prov = card.querySelector(".prov") as HTMLElement;
    expect(within(prov).getByText("imported")).toHaveClass("kind");
    expect(prov.textContent).toBe("imported · kling3-turbo");
    // The state pill rides the THUMB now (VEED), opaquely composited.
    expect(within(card).getByText("approved").closest(".thumb-lg")).not.toBeNull();
  });

  it("s96: a take's B-media.0 poster frames the card, keepers first", async () => {
    const poster = {
      ref: { kind: "stored" as const, sha256: "c".repeat(64), ext: "webp" as const, width: 640, height: 360 },
      provenance: "derived" as const,
    };
    server.use(
      http.get("/api/videos", () => HttpResponse.json({ projects: [SUMMARIES[0]] })),
      http.get("/api/videos/p1", () =>
        HttpResponse.json({ ...P1, takes: [{ ...P1.takes[0], poster }] }),
      ),
    );
    render(<VideosOverview />);
    await screen.findByText("1 project");
    const thumb = document.querySelector(".thumb-lg.framed") as HTMLElement;
    expect(thumb).not.toBeNull();
    // s99: the poster rides --poster so the striped placeholder stays layered
    // beneath it — a pruned media ref degrades to the stripes, never a blank.
    expect(thumb.style.getPropertyValue("--poster")).toContain(`/api/media/${"c".repeat(64)}.webp`);
    // The frame IS the preview — no placeholder words over it.
    expect(screen.queryByText("no preview yet")).toBeNull();
  });

  it("says no-preview in words and never invents a state or a badge", async () => {
    serveAll();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    // AMENDED s95 (VEED): a thumb with no frame says so in WORDS — a
    // deliberate tile, never a blank; no take here carries a poster yet.
    expect(screen.getAllByText("no preview yet")).toHaveLength(2);
    expect(document.querySelector(".vgrid img, .vgrid video")).toBeNull();
    expect(document.querySelector(".thumb-lg.framed")).toBeNull();

    const empty = screen.getByText("ship-notes explainer").closest(".vcard") as HTMLElement;
    expect(within(empty).getByText("no cuts yet")).toHaveClass("pill", "pill-idle");
    expect(within(empty).getByText("no takes yet")).toHaveClass("subtle");
    // Nothing assembled → no runtime badge at all, rather than a 0:00.
    expect(empty.querySelector(".dur")).toBeNull();
    expect((empty.querySelector(".prov") as HTMLElement).textContent).toBe("imported · by you");
  });

  it("filters on the same cut the pill names", async () => {
    serveAll();
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    await user.click(screen.getByRole("button", { name: "Approved" }));
    await waitFor(() => expect(screen.getByText("1 of 2 projects")).toBeInTheDocument());
    expect(screen.getByText("concept film")).toBeInTheDocument();
    expect(screen.queryByText("ship-notes explainer")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Rendered" }));
    await screen.findByText(/No projects in this state/);
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(await screen.findByText("2 projects")).toBeInTheDocument();
  });

  it("opens the import path instead of offering an upload that does not exist", async () => {
    serveAll();
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    expect(screen.queryByText(/npm run videos:import/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Browse files" }));
    expect(await screen.findByText(/npm run videos:import/)).toBeInTheDocument();
    expect(screen.getByText(/There is no browser upload door yet/)).toBeInTheDocument();
  });

  // s99 fe-check: the pick had no way back to "nothing selected", and the
  // invited drop gesture hit the browser default (navigating AWAY from the
  // workspace). Both now land where they should.
  it("Escape returns the j/k pick to the rest state", async () => {
    serveAll();
    const user = userEvent.setup();
    const { container } = render(<VideosOverview />);
    await screen.findByText("2 projects");

    await user.keyboard("j");
    expect(container.querySelector(".vcard.sel")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(container.querySelector(".vcard.sel")).toBeNull();
  });

  it("a dropped file opens the honest import disclosure instead of ejecting the workspace", async () => {
    serveAll();
    const { container } = render(<VideosOverview />);
    await screen.findByText("2 projects");

    expect(screen.queryByText(/npm run videos:import/)).toBeNull();
    fireEvent.drop(container.querySelector(".videos-surface") as HTMLElement);
    expect(await screen.findByText(/npm run videos:import/)).toBeInTheDocument();
  });

  it("the takes/cuts facts are DISTINCT doors — they deep-link to their evidence", async () => {
    serveAll();
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    await user.click(screen.getByRole("link", { name: "1 take" }));
    expect(push).toHaveBeenCalledWith("/app/videos/p1?open=takes");
    await user.click(screen.getByRole("link", { name: "3 cuts" }));
    expect(push).toHaveBeenCalledWith("/app/videos/p1?open=cuts");
  });

  it("says a project record is unreadable rather than drawing it empty", async () => {
    server.use(
      http.get("/api/videos", () => HttpResponse.json({ projects: [SUMMARIES[0]] })),
      http.get("/api/videos/p1", () => HttpResponse.json({ error: "boom" }, { status: 500 })),
    );
    render(<VideosOverview />);

    expect(await screen.findByText("record unreadable")).toHaveClass("pill", "pill-err");
    expect(screen.getByText(/takes on the list read/)).toBeInTheDocument();
  });

  it("treats a failed list read as a read failure, not an empty grid", async () => {
    server.use(http.get("/api/videos", () => HttpResponse.json({ error: "boom" }, { status: 500 })));
    render(<VideosOverview />);

    expect(await screen.findByText(/Couldn’t read your video projects/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", async () => {
    serveAll();
    const { container } = render(<VideosOverview />);
    await screen.findByText("2 projects");

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});

/**
 * Window 0026 — the project doors on the grid. The refusals and the
 * reversibility are pinned in packages/db and at the routes; what is pinned
 * HERE is the operator's side of it: that Retire says what survives and names
 * the way back, that the way back EXISTS on this surface (a promise whose
 * destination has no door is the dead door this programme refuses), and that
 * a rename collision is READ rather than swallowed.
 */
describe("VideosOverview — retire / restore / rename (window 0026)", () => {
  it("retires a project, states what survives, and names where Restore lives", async () => {
    let retired = false;
    server.use(
      http.get("/api/videos", () =>
        HttpResponse.json(
          retired
            ? {
                projects: [SUMMARIES[1]],
                retired: [
                  { id: "p1", name: "concept film", retiredAt: "2026-08-04T00:00:00.000Z" },
                ],
              }
            : { projects: SUMMARIES, retired: [] },
        ),
      ),
      http.get("/api/videos/p1", () => HttpResponse.json(P1)),
      http.get("/api/videos/p2", () => HttpResponse.json(P2)),
      http.delete("/api/videos/p1", () => {
        retired = true;
        return HttpResponse.json({ retired: { id: "p1", name: "concept film" }, changed: true });
      }),
    );
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    await user.click(screen.getAllByRole("button", { name: "Retire" })[0]);

    // The notice states the survivors and points at the door, in one sentence.
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/takes, cuts and renders are untouched/);
    expect(notice.textContent).toMatch(/Retired projects/);

    // And that door is really there — with the project inside it.
    const disclosure = await screen.findByRole("button", { name: /Retired projects \(1\)/ });
    await user.click(disclosure);
    expect(await screen.findByText("concept film")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("restores a retired project back onto the grid, whole", async () => {
    let restored = false;
    server.use(
      http.get("/api/videos", () =>
        HttpResponse.json(
          restored
            ? { projects: SUMMARIES, retired: [] }
            : {
                projects: [SUMMARIES[1]],
                retired: [
                  { id: "p1", name: "concept film", retiredAt: "2026-08-04T00:00:00.000Z" },
                ],
              },
        ),
      ),
      http.get("/api/videos/p1", () => HttpResponse.json(P1)),
      http.get("/api/videos/p2", () => HttpResponse.json(P2)),
      http.post("/api/videos/p1/restore", () => {
        restored = true;
        return HttpResponse.json({ restored: { id: "p1", name: "concept film" }, changed: true });
      }),
    );
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("1 project");

    await user.click(await screen.findByRole("button", { name: /Retired projects \(1\)/ }));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect((await screen.findByRole("status")).textContent).toMatch(/back on the grid, whole/);
    await waitFor(() => expect(screen.getByText("2 projects")).toBeInTheDocument());
  });

  it("carries a rename COLLISION verbatim and keeps the field open to edit", async () => {
    server.use(
      http.get("/api/videos", () => HttpResponse.json({ projects: SUMMARIES, retired: [] })),
      http.get("/api/videos/p1", () => HttpResponse.json(P1)),
      http.get("/api/videos/p2", () => HttpResponse.json(P2)),
      http.patch("/api/videos/p1", () =>
        HttpResponse.json(
          {
            error:
              'another project is already called "ship-notes explainer" — names are unique, and renaming onto one would merge two projects into it',
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<VideosOverview />);
    await screen.findByText("2 projects");

    await user.click(screen.getAllByRole("button", { name: "Rename…" })[0]);
    const field = await screen.findByLabelText("rename to");
    await user.clear(field);
    await user.type(field, "ship-notes explainer");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    // The door's own sentence, not "that refused".
    expect((await screen.findByRole("alert")).textContent).toMatch(/would merge two projects/);
    // And the operator edits rather than retypes: the field is still open,
    // still holding what they wrote.
    expect(screen.getByLabelText("rename to")).toHaveValue("ship-notes explainer");
  });
});
