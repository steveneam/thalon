// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { VideoDossier } from "@/components/videos/dossier";
import { server } from "@/lib/testing/server";
import type { CutView, ProjectDetail, TakeView } from "@/lib/videos/types";

/**
 * s96 — V1's five affordances, pinned against the AMENDED Video Dossier
 * sheet (s95: "THIS IS V1 DRAWN"; founder verdict "W3 is approved"): the
 * crumb's version flood, the ☆ Mark door (save-as-named-variant through the
 * one save door), the delete confirm in the Fibery/Resend register (with the
 * TRUE preservation sentence — no Restore claim, that column is the flagged
 * window ask), the compare radios, and the takes audition band with its
 * picked-tile Swap door.
 */

const SUMMARY = {
  beats: 2,
  captionLines: 0,
  audio: "silent" as const,
  width: 1280,
  height: 720,
  fps: 24,
  duration: 12,
};

const FULL_EDL = {
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
  audio: [],
};

const POSTER = {
  ref: { kind: "stored" as const, sha256: "b".repeat(64), ext: "webp" as const, width: 640, height: 360 },
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

function cut(over: Partial<CutView> & Pick<CutView, "id" | "version">): CutView {
  return {
    name: "film-16x9",
    status: "draft",
    outputRef: null,
    lineage: null,
    attribution: null,
    edl: SUMMARY,
    createdAt: `2026-07-2${over.version}T00:00:00.000Z`,
    ...over,
  };
}

const DETAIL: ProjectDetail = {
  id: "p1",
  name: "concept film",
  description: "a 40s film",
  createdAt: "2026-07-16T00:00:00.000Z",
  playable: true,
  takes: [
    take({ id: "t1", ref: "motion/keepers/beat-01.mp4", poster: POSTER }),
    take({ id: "t2", ref: "motion/rejects/beat-01-alt.mp4", disposition: "reject", reason: "flat motion" }),
    take({ id: "t3", slot: "beat-02", ref: "motion/keepers/beat-02.mp4" }),
  ],
  cuts: [
    cut({ id: "c1", version: 1 }),
    cut({ id: "c2", version: 2, status: "rendered", outputRef: "cuts/master.mp4" }),
  ],
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

async function open() {
  render(<VideoDossier projectId="p1" />);
  await screen.findByRole("heading", { name: "concept film" });
}

describe("the crumb (Synthesia) — the version flood behind it", () => {
  it("opens every version on record and switches the picked one", async () => {
    serve();
    const user = userEvent.setup();
    await open();
    // v1 is not in the strip (the flood stays behind Cut history)…
    expect(screen.queryByRole("option", { name: /v1/ })).toBeNull();
    await user.click(document.querySelector(".ver-crumb") as HTMLElement);
    // …but the crumb lists it, and picking it re-aims the whole surface.
    const v1 = await screen.findByRole("option", { name: /film-16x9 v1/ });
    await user.click(v1);
    expect((document.querySelector(".ver-crumb") as HTMLElement).textContent).toContain(
      "film-16x9 v1",
    );
  });
});

describe("☆ Mark — save-as-named-variant through the one save door", () => {
  it("saves the picked version's EDL under the typed name and says what stayed untouched", async () => {
    serve();
    let posted: { name?: string } = {};
    server.use(
      http.post("/api/videos/p1/cuts", async ({ request }) => {
        posted = (await request.json()) as { name: string };
        return HttpResponse.json({
          cut: { ...cut({ id: "c9", version: 1 }), name: posted.name ?? "?", edl: FULL_EDL },
          created: true,
        });
      }),
    );
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: /☆ Mark v2/ }));
    const field = await screen.findByRole("textbox", { name: "mark name" });
    await user.type(field, "Founder pick");
    await user.click(screen.getByRole("button", { name: /Mark as Founder pick/ }));
    expect(await screen.findByText(/Marked film-16x9 v2 as “Founder pick”/)).toBeInTheDocument();
    expect(posted.name).toBe("Founder pick");
  });
});

describe("the delete confirm (Fibery/Resend register)", () => {
  it("names the version, states the TRUE survivors, and never promises Restore", async () => {
    serve();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: /Delete v2/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete this version" });
    expect(confirm.textContent).toContain("Delete film-16x9 v2");
    expect(confirm.textContent).toContain("stay on this project’s record");
    // No restore door exists — the sheet's Restore sentence is the flagged
    // contract-window ask, never rendered as a promise the product can't keep.
    expect(confirm.textContent).not.toMatch(/[Rr]estore/);
    await user.click(within(confirm).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("an approved cut refuses out loud instead of opening the confirm", async () => {
    serve({
      ...DETAIL,
      cuts: [cut({ id: "c1", version: 1 }), cut({ id: "c2", version: 2, status: "approved" })],
    });
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: /Delete v2/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("carries its judge receipt");
  });
});

describe("the compare radios (AI Studio)", () => {
  it("answers out loud when pressed short of two picks", async () => {
    serve();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("checkbox", { name: /Pick film-16x9 v2/ }));
    await user.click(screen.getByRole("button", { name: "Compare two versions" }));
    expect(screen.getByRole("alert").textContent).toContain("Pick two versions");
  });

  it("arms on exactly two picks and renders the diff in the house grammar", async () => {
    // The strip carries one chip per NAME, so compare-two reads two names.
    serve({
      ...DETAIL,
      cuts: [
        cut({ id: "c2", version: 2, status: "rendered" }),
        cut({ id: "c9", version: 1, name: "Founder pick" }),
      ],
    });
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("checkbox", { name: /Pick film-16x9 v2/ }));
    await user.click(screen.getByRole("checkbox", { name: /Pick Founder pick v1/ }));
    await user.click(screen.getByRole("button", { name: /Compare .* ↔ .*/ }));
    // Both details serve the same fixture EDL, so the honest verdict is
    // "identical" — drawn as a row, never an empty panel.
    expect(await screen.findByText("identical")).toBeInTheDocument();
  });
});

describe("the takes audition band (V1's fifth job)", () => {
  it("lists in-cut takes and their slot-mates, wears posters, and swaps only from the picked tile", async () => {
    serve();
    let posted: { name?: string } = {};
    server.use(
      http.post("/api/videos/p1/cuts", async ({ request }) => {
        posted = (await request.json()) as { name?: string };
        return HttpResponse.json({
          cut: { ...cut({ id: "c10", version: 3 }), edl: FULL_EDL },
          created: true,
        });
      }),
    );
    const user = userEvent.setup();
    await open();
    const band = (await screen.findByText(/Takes — behind film-16x9 v2/)).closest(
      ".card",
    ) as HTMLElement;
    // BOTH beats' in-cut takes state it; the reject carries its reason; the poster rides.
    expect(await within(band).findAllByText("in the cut now")).toHaveLength(2);
    expect(within(band).getByText(/reject · flat motion/)).toBeInTheDocument();
    expect(band.querySelectorAll(".thumb-sm.framed")).toHaveLength(1);
    // No Swap door at rest — it rides the picked tile, and never an in-cut one.
    expect(within(band).queryByRole("button", { name: /Swap into cut/ })).toBeNull();
    // The TILE (its name leads with the beat) — not the audition play door,
    // which shares the file name by the seam's own labeling.
    await user.click(
      within(band).getByRole("button", { name: /^beat-01 · .*beat-01-alt\.mp4$/ }),
    );
    await user.click(await within(band).findByRole("button", { name: "Swap into cut" }));
    expect(await screen.findByText(/Swapped beat-01-alt\.mp4 in — saved as/)).toBeInTheDocument();
    expect(posted.name).toBe("film-16x9");
  });
});
