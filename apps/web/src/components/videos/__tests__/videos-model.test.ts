import { describe, expect, it } from "vitest";
import {
  attributionLine,
  cardDate,
  derivedElsewhere,
  derivedFrom,
  family,
  headlineCut,
  mintModels,
  passesFilter,
  projectKind,
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
    poster: null,
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
    onePrompt: false,
    retired: [],
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

describe("family — AMENDED s95: the project's own history rows (Riverside)", () => {
  it("counts takes then cuts — raw row counts, one answer everywhere", () => {
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
    expect(family(detail)).toEqual([
      { text: "2 takes", door: true, target: "takes" },
      { text: "3 cuts", door: true, target: "cuts" },
    ]);
  });

  it("leaves a zero-cut project's dimension out instead of restating the pill", () => {
    expect(family(project([]))).toEqual([{ text: "no takes yet", door: false }]);
    expect(family(project([], [take()]))).toEqual([{ text: "1 take", door: true, target: "takes" }]);
  });

  /*
   * The s79 disagreement ("4 aspect cuts" on the card, "none yet" in the
   * dossier's per-version band) came from counting a DERIVED dimension two
   * ways. A raw row count cannot disagree with anything: the crumb's flood
   * in the dossier lists exactly these rows. The ratchet survives by
   * construction — this pin keeps derived cuts COUNTED (they are rows), not
   * re-classified.
   */
  it("counts derived cuts as rows — they are cuts, and the dossier's flood shows them", () => {
    const base = cut({ id: "base", name: "film-16x9", version: 6 });
    const derived = cut({
      id: "d1",
      name: "film-1x1",
      version: 1,
      lineage: {
        parentCutId: "base",
        aspect: "1:1",
        parentName: "film-16x9",
        parentVersion: 6,
        parentLatestVersion: 6,
      },
    });
    expect(family(project([base, derived], [take()])).map((p) => p.text)).toEqual([
      "1 take",
      "2 cuts",
    ]);
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

describe("provenance — visible, never guessed (AMENDED s95: the kind token leads)", () => {
  it("names the mint model when every take agrees on one", () => {
    const detail = project(
      [cut({ name: "film-16x9", version: 6 })],
      [take({ provenance: { model: "kling3-turbo" } }), take({ id: "t2", provenance: { model: "kling3-turbo" } })],
    );
    expect(provenance(detail)).toBe("kling3-turbo");
  });

  // AMENDED s99 (fe-check, live case thalon-concept-film): an imported
  // project whose takes record SEVERAL mints must never read "by you" — the
  // authorship slot counts the machine mints instead of crediting the operator.
  it("counts the mints when the takes disagree — never 'by you' over machine mints", () => {
    const takes = [
      take({ provenance: { model: "kling3-turbo" } }),
      take({ id: "t2", provenance: { model: "kling3-turbo" } }),
      take({ id: "t3", provenance: { model: "seedance" } }),
    ];
    expect(mintModels(takes)).toEqual(["kling3-turbo", "seedance"]);
    expect(provenance(project([cut()], takes))).toBe("2 mint models");
  });

  it("keeps 'by you' for the hand-imported project no mint touched", () => {
    expect(provenance(project([cut()], [take()]))).toBe("by you");
  });

  // AMENDED s99: an engine-made project with all-empty manifests says the
  // unknown out loud — never a cut identity standing in the authorship slot.
  it("says 'model unrecorded' for a one-prompt project with no recorded mint", () => {
    const oneprompt = { ...project([cut()], [take()]), onePrompt: true };
    expect(provenance(oneprompt)).toBe("model unrecorded");
    expect(provenance({ ...oneprompt, cuts: [] })).toBe("model unrecorded");
  });

  it("classifies the project KIND from the RECORDED origin, never from prose", () => {
    // s100: the kind comes off `meta.onePrompt` — the stamp the one-prompt
    // runner writes on the project row — surfaced as `detail.onePrompt`.
    expect(projectKind({ ...project([]), onePrompt: true })).toBe("one-prompt");
    // The old sniff read `description.startsWith("One-prompt")`, so BOTH of
    // these were wrong: a one-prompt project whose description the operator
    // edited read as imported, and an imported project whose blurb happened to
    // open with those words read as one-prompt. The stamp answers both.
    expect(
      projectKind({ ...project([], [take()]), description: "One-prompt auto-run — x" }),
    ).toBe("imported");
    expect(
      projectKind({ ...project([]), onePrompt: true, description: "renamed by hand" }),
    ).toBe("one-prompt");
    expect(projectKind(project([], [take({ kind: "still" })]))).toBe("image");
    // Stills + a music candidate is still an image project — audio is not visual.
    expect(
      projectKind(project([], [take({ kind: "still" }), take({ id: "t2", kind: "audio", slot: null })])),
    ).toBe("image");
    expect(projectKind(project([], [take()]))).toBe("imported");
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
