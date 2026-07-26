import { describe, expect, it } from "vitest";
import {
  cardDate,
  family,
  headlineCut,
  mintModel,
  passesFilter,
  provenance,
  runtime,
  statePill,
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

describe("passesFilter — the pill and the grid agree", () => {
  it("matches on the same cut the pill names", () => {
    expect(passesFilter(cut({ status: "rendered" }), "rendered")).toBe(true);
    expect(passesFilter(cut({ status: "rendered" }), "approved")).toBe(false);
    expect(passesFilter(null, "all")).toBe(true);
    expect(passesFilter(null, "draft")).toBe(false);
  });
});
