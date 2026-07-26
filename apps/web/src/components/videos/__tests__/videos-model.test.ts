import { describe, expect, it } from "vitest";
import {
  attributionLine,
  cardDate,
  derivedElsewhere,
  derivedFrom,
  family,
  headlineCut,
  mintModel,
  passesFilter,
  provenance,
  runtime,
  soleParentOf,
  staleAgainstParent,
  statePill,
  timecode,
  versionsOf,
} from "@/components/videos/videos-model";
import type { CutView, ProjectDetail, TakeView } from "@/lib/videos/types";

function cut(over: Partial<CutView> = {}): CutView {
  return {
    id: over.id ?? "c1",
    name: over.name ?? "film-16x9",
    version: over.version ?? 1,
    status: over.status ?? "draft",
    outputRef: over.outputRef ?? null,
    lineage: over.lineage ?? null,
    attribution: over.attribution ?? null,
    edl: over.edl ?? {
      beats: 8,
      captionLines: 4,
      audio: "encode",
      width: 1280,
      height: 720,
      fps: 24,
      duration: 42.3,
    },
    createdAt: over.createdAt ?? "2026-07-20T00:00:00.000Z",
  };
}

function take(over: Partial<TakeView> = {}): TakeView {
  return {
    id: over.id ?? "t1",
    slot: over.slot ?? "beat-01",
    kind: over.kind ?? "motion",
    disposition: over.disposition ?? "keeper",
    ref: over.ref ?? "motion/keepers/beat-01.mp4",
    reason: over.reason ?? null,
    provenance: over.provenance ?? {},
    createdAt: over.createdAt ?? "2026-07-20T00:00:00.000Z",
  };
}

function project(cuts: CutView[], takes: TakeView[] = []): ProjectDetail {
  return {
    id: "p1",
    name: "concept film",
    description: null,
    createdAt: "2026-07-16T00:00:00.000Z",
    playable: true,
    takes,
    cuts,
  };
}

describe("headlineCut — one cut speaks for the card", () => {
  it("picks the furthest-along cut, not the newest", () => {
    const picked = headlineCut([
      cut({ id: "draft", status: "draft", createdAt: "2026-07-24T00:00:00.000Z" }),
      cut({ id: "approved", status: "approved", createdAt: "2026-07-20T00:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("approved");
  });

  it("breaks a tie on recency", () => {
    const picked = headlineCut([
      cut({ id: "old", status: "rendered", createdAt: "2026-07-20T00:00:00.000Z" }),
      cut({ id: "new", status: "rendered", createdAt: "2026-07-24T00:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("new");
  });

  it("is null for a project with no cuts", () => {
    expect(headlineCut([])).toBeNull();
  });
});

describe("statePill — the engine's vocabulary, never an invented publish state", () => {
  it("names the three states the contract actually has", () => {
    expect(statePill(cut({ status: "draft" }))).toEqual({
      text: "draft",
      className: "pill pill-idle",
    });
    expect(statePill(cut({ status: "rendered" }))).toEqual({
      text: "rendered",
      className: "pill pill-idle",
    });
    expect(statePill(cut({ status: "approved" }))).toEqual({
      text: "approved",
      className: "pill pill-ok",
    });
  });

  it("says so when nothing has been cut yet", () => {
    expect(statePill(null).text).toBe("no cuts yet");
  });
});

describe("runtime — the poster's badge", () => {
  it("renders m:ss from the cut's own output duration", () => {
    expect(runtime(cut())).toBe("0:42");
    expect(runtime(cut({ edl: { ...cut().edl, duration: 185 } }))).toBe("3:05");
  });

  it("draws no badge when there is no cut to time", () => {
    expect(runtime(null)).toBeNull();
  });
});

describe("family — the derivative dimensions this engine records", () => {
  it("counts versions of the headline cut's name, aspect cuts, and takes", () => {
    const head = cut({ id: "c2", name: "film-16x9", version: 2 });
    const detail = project(
      [
        cut({ id: "c1", name: "film-16x9", version: 1 }),
        head,
        cut({
          id: "c3",
          name: "film-9x16",
          version: 1,
          lineage: {
            parentCutId: "c2",
            aspect: "9:16",
            parentName: "film-16x9",
            parentVersion: 2,
            parentLatestVersion: 2,
          },
        }),
      ],
      [take({ id: "t1" }), take({ id: "t2" })],
    );
    expect(family(detail, head)).toEqual([
      { text: "2 versions", door: true },
      { text: "1 aspect cut", door: true },
      { text: "2 takes", door: true },
    ]);
  });

  it("leaves out a dimension with nothing in it instead of restating the pill", () => {
    expect(family(project([]), null)).toEqual([{ text: "no takes yet", door: false }]);
    const head = cut();
    expect(family(project([head], [take()]), head)).toEqual([
      { text: "1 version", door: true },
      { text: "1 take", door: true },
    ]);
  });

  /**
   * s79 V1, measured live on `thalon-concept-film`: the card read "4 aspect
   * cuts" and the dossier it opened said "none yet", because the card counted
   * every derived cut in the PROJECT while the dossier's band is per-version.
   * Two of those four hung off a different cut — and one of them was the
   * headline cut itself, counted among its own derivatives.
   */
  describe("the aspect count is scoped to the cut the card speaks for", () => {
    const head = cut({ id: "head", name: "film-1x1", version: 2 });
    const lineage = (parentCutId: string) => ({
      parentCutId,
      aspect: "1:1",
      parentName: "film-16x9",
      parentVersion: 6,
      parentLatestVersion: 8,
    });

    it("does not count recuts that hang off another version", () => {
      const detail = project([
        cut({ id: "base", name: "film-16x9", version: 6 }),
        cut({ id: "d1", name: "film-1x1", version: 1, lineage: lineage("base") }),
        head,
        cut({ id: "d2", name: "film-9x16", version: 1, lineage: lineage("base") }),
      ]);
      expect(family(detail, head).map((p) => p.text)).not.toContain("3 aspect cuts");
      expect(family(detail, head).some((p) => p.text.includes("aspect cut"))).toBe(false);
    });

    it("never counts the headline cut as one of its own aspect cuts", () => {
      // The live shape: the cut the card speaks for is ITSELF a recut, so a
      // project-wide "has lineage" count included it in its own family line.
      const derivedHead = cut({ id: "head", name: "film-1x1", version: 2, lineage: lineage("base") });
      const detail = project([cut({ id: "base", name: "film-16x9", version: 6 }), derivedHead]);
      expect(family(detail, derivedHead).map((p) => p.text)).toEqual(["1 version", "no takes yet"]);
    });

    it("still counts the recuts that DO hang off it", () => {
      const detail = project([
        head,
        cut({ id: "d1", name: "film-9x16", version: 1, lineage: lineage("head") }),
      ]);
      expect(family(detail, head).map((p) => p.text)).toContain("1 aspect cut");
    });
  });
});

/** The other half of V1: narrowing the card's count must not hide the project's recuts. */
describe("derivedElsewhere / soleParentOf — what the dossier's empty band still owes", () => {
  const base = cut({ id: "base", name: "film-16x9", version: 6 });
  const head = cut({ id: "head", name: "film-1x1", version: 2 });
  const lineage = {
    parentCutId: "base",
    aspect: "1:1" as const,
    parentName: "film-16x9",
    parentVersion: 6,
    parentLatestVersion: 8,
  };
  const cuts = [
    base,
    head,
    cut({ id: "d1", name: "film-1x1", version: 1, lineage }),
    cut({ id: "d2", name: "film-9x16", version: 1, lineage }),
  ];

  it("finds the recuts hanging off a different version", () => {
    expect(derivedElsewhere(cuts, head).map((c) => c.id)).toEqual(["d1", "d2"]);
  });

  it("names their parent when they share one, and refuses to guess when they do not", () => {
    expect(soleParentOf(cuts, derivedElsewhere(cuts, head))?.id).toBe("base");
    const split = [...derivedElsewhere(cuts, head), cut({ id: "d3", lineage: { ...lineage, parentCutId: "head" } })];
    expect(soleParentOf(cuts, split)).toBeNull();
  });

  it("never counts the picked cut itself, even when it is a recut — the live shape", () => {
    const derivedHead = cut({ id: "head", name: "film-1x1", version: 2, lineage });
    const all = [base, derivedHead, cut({ id: "d1", name: "film-9x16", version: 1, lineage })];
    expect(derivedElsewhere(all, derivedHead).map((c) => c.id)).toEqual(["d1"]);
  });

  it("is empty when every recut hangs off the picked version", () => {
    expect(derivedElsewhere([head, cut({ id: "d", lineage: { ...lineage, parentCutId: "head" } })], head)).toEqual([]);
  });
});

describe("provenance — visible, never guessed", () => {
  it("names the cut, and the mint model when every take agrees on one", () => {
    const head = cut({ name: "film-16x9", version: 6 });
    const detail = project(
      [head],
      [take({ provenance: { model: "kling3-turbo" } }), take({ id: "t2", provenance: { model: "kling3-turbo" } })],
    );
    expect(provenance(detail, head)).toBe("film-16x9 v6 · kling3-turbo");
  });

  it("drops the model when the takes disagree — a majority is not a fact", () => {
    const takes = [
      take({ provenance: { model: "kling3-turbo" } }),
      take({ id: "t2", provenance: { model: "kling3-turbo" } }),
      take({ id: "t3", provenance: { model: "seedance" } }),
    ];
    expect(mintModel(takes)).toBeNull();
    expect(provenance(project([cut()], takes), cut())).toBe("film-16x9 v1");
  });

  it("says what a project with takes but no cut is", () => {
    expect(provenance(project([], [take()]), null)).toBe("takes only · no cut yet");
  });
});

describe("cardDate — the sheet's own date grammar", () => {
  const now = Date.parse("2026-07-26T10:00:00.000Z");

  it("reads today, a weekday inside the week, then a short date", () => {
    expect(cardDate("2026-07-26T01:00:00.000Z", now)).toBe("today");
    expect(cardDate("2026-07-24T01:00:00.000Z", now)).toBe("Fri");
    expect(cardDate("2026-07-18T01:00:00.000Z", now)).toBe("18 Jul");
  });

  it("passes an unparseable stamp through rather than inventing a date", () => {
    expect(cardDate("not a date", now)).toBe("not a date");
  });
});

describe("timecode — the scrub's own format", () => {
  it("counts in whole tenths, so a float duration never rounds into :60", () => {
    expect(timecode(0)).toBe("0:00.0");
    expect(timecode(42.3)).toBe("0:42.3");
    expect(timecode(59.99)).toBe("1:00.0");
    expect(timecode(185.04)).toBe("3:05.0");
    expect(timecode(-1)).toBe("0:00.0");
  });
});

describe("attributionLine — every version names what changed it", () => {
  const now = Date.parse("2026-07-26T10:00:00.000Z");

  it("names the operator, the agent with its model and ask, and the unattributed", () => {
    expect(attributionLine(cut({ attribution: { authoredBy: "operator" } }), now)).toBe(
      "your edit · Mon",
    );
    expect(
      attributionLine(
        cut({
          attribution: {
            authoredBy: "agent",
            proposal: {
              baseCutId: "c1",
              model: "test/proposer",
              promptName: "edl-propose",
              promptHash: "abc",
              ask: "tighten the middle",
              decidedBy: "operator",
              diff: { version: 1, summary: "trim", ops: [] },
            },
          },
        }),
        now,
      ),
    ).toBe("agent · test/proposer · “tighten the middle” · Mon");
    // A cut written before the attributed save door existed is never credited.
    expect(attributionLine(cut(), now)).toBe("no attribution recorded · Mon");
  });
});

describe("staleAgainstParent — honest, because there is no auto-sync", () => {
  const lineage = {
    parentCutId: "c2",
    aspect: "9:16",
    parentName: "film-16x9",
    parentVersion: 2,
    parentLatestVersion: 2,
  };

  it("is true only when the parent has moved past the pin", () => {
    expect(staleAgainstParent(cut({ lineage }))).toBe(false);
    expect(staleAgainstParent(cut({ lineage: { ...lineage, parentLatestVersion: 4 } }))).toBe(true);
    expect(staleAgainstParent(cut())).toBe(false);
  });
});

describe("versionsOf / derivedFrom — the two bands the dossier splits", () => {
  it("keeps versions to one name, and derives by the exact pinned parent row", () => {
    const parent = cut({ id: "c2", version: 2 });
    const cuts = [
      cut({ id: "c1", version: 1 }),
      parent,
      cut({
        id: "c3",
        version: 1,
        name: "film-9x16",
        lineage: {
          parentCutId: "c2",
          aspect: "9:16",
          parentName: "film-16x9",
          parentVersion: 2,
          parentLatestVersion: 2,
        },
      }),
    ];
    expect(versionsOf(cuts, "film-16x9").map((c) => c.version)).toEqual([1, 2]);
    expect(derivedFrom(cuts, parent).map((c) => c.id)).toEqual(["c3"]);
    // A derive is pinned to ONE version — v1 has none of its own.
    expect(derivedFrom(cuts, cuts[0])).toEqual([]);
    expect(derivedFrom(cuts, null)).toEqual([]);
  });
});

describe("passesFilter — the pill and the grid agree", () => {
  it("matches on the same cut the pill names", () => {
    expect(passesFilter(cut({ status: "rendered" }), "rendered")).toBe(true);
    expect(passesFilter(cut({ status: "rendered" }), "approved")).toBe(false);
    expect(passesFilter(null, "all")).toBe(true);
    expect(passesFilter(null, "draft")).toBe(false);
  });
});
