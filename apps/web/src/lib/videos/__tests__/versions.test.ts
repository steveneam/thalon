import { describe, expect, it } from "vitest";
import type { CutView, RenderJobView } from "../types";
import { adoptableRender, deleteRefusalFor, elapsedWords, inFlightLine, variantSaveNote } from "../versions";

/**
 * The version verbs' pure reads. The delete refusals are the interesting half:
 * they mirror what `videoCuts.remove` enforces inside a transaction, and the
 * mirror going stale would produce the worst version of this surface — a
 * control that looks live, is pressed, and comes back with a refusal the
 * operator could have been told about a second earlier.
 */

function cut(over: Partial<CutView> & { id: string }): CutView {
  return {
    name: "film-16x9",
    version: 1,
    status: "draft",
    outputRef: null,
    lineage: null,
    attribution: null,
    edl: { beats: 2, captionLines: 1, audio: "encode", width: 1280, height: 720, fps: 24, duration: 12 },
    createdAt: "2026-07-20T00:00:00.000Z",
    ...over,
  };
}

const V6 = cut({ id: "c6", version: 6 });
const V7 = cut({ id: "c7", version: 7 });

describe("deleteRefusalFor — the founder's three ratified refusals, mirrored", () => {
  it("lets an ordinary version go", () => {
    expect(deleteRefusalFor(V6, [V6, V7])).toBeNull();
  });

  it("refuses an APPROVED cut, because approval is a judge receipt", () => {
    const approved = cut({ id: "c6", version: 6, status: "approved" });
    expect(deleteRefusalFor(approved, [approved, V7])).toMatch(/approved/);
    expect(deleteRefusalFor(approved, [approved, V7])).toMatch(/judge receipt/);
  });

  it("refuses a LINEAGE PARENT, and names the derived cut standing in the way", () => {
    const child = cut({
      id: "c9",
      name: "film-9x16",
      version: 2,
      lineage: {
        parentCutId: "c6",
        aspect: "9:16",
        parentName: "film-16x9",
        parentVersion: 6,
        parentLatestVersion: 6,
      },
    });
    expect(deleteRefusalFor(V6, [V6, child])).toBe(
      "film-16x9 v6 is the lineage parent of film-9x16 v2 — delete the derived cut first, or its provenance would point at nothing.",
    );
    // The child itself is deletable — that IS the abandoned-recut case.
    expect(deleteRefusalFor(child, [V6, child])).toBeNull();
  });

  it("refuses the project's LAST cut, whatever its name or state", () => {
    expect(deleteRefusalFor(V6, [V6])).toMatch(/only cut/);
  });

  it("applies the refusals in the repo's own order — approved outranks everything", () => {
    // Both true at once: the surface must say the same thing the door will.
    const approvedOnly = cut({ id: "c6", version: 6, status: "approved" });
    expect(deleteRefusalFor(approvedOnly, [approvedOnly])).toMatch(/approved/);
  });
});

describe("variantSaveNote — which of the two saves this is, before the press", () => {
  const cuts = [
    { name: "film-16x9", version: 6 },
    { name: "film-16x9", version: 7 },
  ];

  it("a new name is a variant at v1, and says the current cut is left alone", () => {
    expect(variantSaveNote("film-tight", cuts, "film-16x9")).toBe(
      "“film-tight” is a new variant — it starts at v1, and film-16x9 is left exactly as it is.",
    );
  });

  it("the cut's OWN name is the primary button's act, said plainly", () => {
    expect(variantSaveNote("film-16x9", cuts, "film-16x9")).toBe(
      "“film-16x9” is this cut — this saves as v8, the same as the primary button.",
    );
  });

  it("another EXISTING name is that cut's next version, not a fork", () => {
    const withOther = [...cuts, { name: "film-9x16", version: 2 }];
    expect(variantSaveNote("film-9x16", withOther, "film-16x9")).toBe(
      "“film-9x16” already exists — this saves as v3 of it, not a new variant.",
    );
  });

  it("asks for a name rather than saving under an empty one", () => {
    expect(variantSaveNote("   ", cuts, "film-16x9")).toMatch(/needs a name/);
  });
});

function job(over: Partial<RenderJobView> & { id: string }): RenderJobView {
  return {
    projectId: "p1",
    cutId: "c6",
    kind: "render",
    status: "running",
    outputRef: null,
    error: null,
    startedAt: "2026-07-28T10:00:00.000Z",
    finishedAt: null,
    ...over,
  };
}

const CUTS = [
  { id: "c6", name: "film-16x9", version: 6 },
  { id: "c9", name: "film-9x16", version: 2 },
];

describe("inFlightLine + adoptableRender — a render survives leaving the page", () => {
  it("says nothing when nothing is running", () => {
    expect(inFlightLine([], CUTS, "c6")).toBeNull();
    expect(inFlightLine([job({ id: "j1", status: "done" })], CUTS, "c6")).toBeNull();
  });

  it("names THIS cut's render in versions, and says the poll was picked back up", () => {
    expect(inFlightLine([job({ id: "j1" })], CUTS, "c6")).toBe(
      "a render is in flight for v6 — this page picked the job back up and is polling it",
    );
  });

  it("names another cut's render by cut and version", () => {
    expect(inFlightLine([job({ id: "j1", cutId: "c9" })], CUTS, "c6")).toBe(
      "a render is in flight for film-9x16 v2",
    );
  });

  it("says a PREVIEW belongs to a working copy this sitting no longer has", () => {
    const line = inFlightLine([job({ id: "j1", kind: "preview" })], CUTS, "c6");
    expect(line).toMatch(/preview render for v6/);
    expect(line).toMatch(/earlier working copy/);
  });

  it("adopts a running render for this cut, and NEVER a preview", () => {
    const render = job({ id: "j1" });
    const preview = job({ id: "j2", kind: "preview" });
    expect(adoptableRender([preview, render], "c6")?.id).toBe("j1");
    // Adopting a preview would land an unsaved EDL's output on the cut as its
    // rendered version — an EDL nobody can reproduce, claiming to be v6.
    expect(adoptableRender([preview], "c6")).toBeNull();
    expect(adoptableRender([render], "c9")).toBeNull();
  });
});

describe("elapsedWords — a real duration in words, never an estimate (V7)", () => {
  it("renders seconds alone under a minute, and m + zero-padded s above it", () => {
    expect(elapsedWords("2026-08-03T10:00:00.000Z", "2026-08-03T10:00:34.000Z")).toBe("34s");
    expect(elapsedWords("2026-08-03T10:00:00.000Z", "2026-08-03T10:02:08.400Z")).toBe("2m 08s");
    expect(elapsedWords("2026-08-03T10:00:00.000Z", Date.parse("2026-08-03T10:01:00.000Z"))).toBe(
      "1m 00s",
    );
    // An hours-old job (a stale adopted registry entry) rolls to h + m — it
    // never prints a four-digit minute count.
    expect(elapsedWords("2026-08-03T10:00:00.000Z", "2026-08-03T16:05:30.000Z")).toBe("6h 05m");
  });

  it("answers null for a reversed or unreadable pair — no fabricated number", () => {
    expect(elapsedWords("2026-08-03T10:05:00.000Z", "2026-08-03T10:00:00.000Z")).toBeNull();
    expect(elapsedWords("not a timestamp", "2026-08-03T10:00:00.000Z")).toBeNull();
    expect(elapsedWords("2026-08-03T10:00:00.000Z", Number.NaN)).toBeNull();
  });
});
