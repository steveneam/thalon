import { describe, expect, it } from "vitest";
import type { PipelineAsset } from "@/lib/workspace/types";
import {
  applyFilters,
  chipState,
  clockLabel,
  cycleFilter,
  deriveItems,
  groupItemsByDay,
  hourPct,
  monthCells,
  monthItems,
  observedValues,
  overlapGroups,
  placedAt,
  quietSplit,
  statusWord,
  DAY_WINDOW,
  EMPTY_FILTER,
  FULL_WINDOW,
} from "../model";

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: new Date(2026, 6, 21, 9, 0).toISOString(),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    ...overrides,
  };
}

describe("month cells", () => {
  it("covers July 2026 in full Monday-start weeks (the design's grid: starts Mon 29 June)", () => {
    const now = new Date(2026, 6, 18);
    const cells = monthCells(new Date(2026, 6, 1), now);
    expect(cells).toHaveLength(35);
    expect(cells[0].date.getDate()).toBe(29);
    expect(cells[0].date.getMonth()).toBe(5);
    expect(cells[0].inMonth).toBe(false);
    expect(cells[2].date.getDate()).toBe(1);
    expect(cells[2].inMonth).toBe(true);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.find((c) => c.isToday)?.date.getDate()).toBe(18);
  });

  it("grows to six weeks only when the month spans them — the grid is bounded by the month, not the data", () => {
    // August 2026: Sat the 1st, Mon the 31st — Mon Jul 27 through Sun Sep 6.
    const cells = monthCells(new Date(2026, 7, 1), new Date(2026, 6, 18));
    expect(cells).toHaveLength(42);
    expect(cells[0].date.getDate()).toBe(27);
    expect(cells[41].date.getDate()).toBe(6);
  });
});

describe("status words (chip anatomy: ONE word; gated is the only bronze dress)", () => {
  it("maps the draft lifecycle honestly", () => {
    expect(statusWord("blocked")).toEqual({ word: "gated", dress: "gated" });
    expect(statusWord("queued")).toEqual({ word: "queued", dress: "draft" });
    expect(statusWord("generated").word).toBe("draft");
    expect(statusWord("judging").word).toBe("draft");
    expect(statusWord("approved")).toEqual({ word: "approved", dress: "approved" });
    expect(statusWord("published")).toEqual({ word: "published", dress: "approved" });
    expect(statusWord("rejected").dress).toBe("draft");
  });

  it("never lies about an unknown status — the raw word carries through, dressed neutral", () => {
    expect(statusWord("something-new")).toEqual({ word: "something-new", dress: "draft" });
  });
});

describe("item derivation", () => {
  it("places every draft at its LATEST reached pipeline instant — a record, never a fake schedule", () => {
    const generated = new Date(2026, 6, 1, 8, 0).toISOString();
    const judged = new Date(2026, 6, 2, 9, 0).toISOString();
    const decided = new Date(2026, 6, 3, 10, 0).toISOString();
    const published = new Date(2026, 6, 4, 11, 0).toISOString();
    expect(placedAt(asset({ draftId: "a", generatedAt: generated })).getDate()).toBe(1);
    expect(placedAt(asset({ draftId: "b", generatedAt: generated, judgedAt: judged })).getDate()).toBe(2);
    expect(
      placedAt(asset({ draftId: "c", generatedAt: generated, judgedAt: judged, decidedAt: decided })).getDate(),
    ).toBe(3);
    expect(
      placedAt(
        asset({ draftId: "d", generatedAt: generated, judgedAt: judged, decidedAt: decided, publishedAt: published }),
      ).getDate(),
    ).toBe(4);
  });

  it("derives sorted items with the approve deep link and the gated reason on the meta line", () => {
    const items = deriveItems([
      asset({ draftId: "late", generatedAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
      asset({
        draftId: "early",
        status: "blocked",
        generatedAt: new Date(2026, 6, 20, 9, 0).toISOString(),
        reasons: ["Grounding — one claim has no provided source."],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["early", "late"]);
    expect(items[0].href).toBe("/app/approve?run=run-1&draft=early");
    expect(items[0].detail).toBe("Grounding — one claim has no provided source.");
    expect(items[0].title).toBe("post");
    expect(items[0].recurring).toBe(false);
  });

  it("groups by local day and scopes to the anchor month", () => {
    const items = deriveItems([
      asset({ draftId: "a", generatedAt: new Date(2026, 6, 21, 9, 0).toISOString() }),
      asset({ draftId: "b", generatedAt: new Date(2026, 6, 21, 15, 0).toISOString() }),
      asset({ draftId: "c", generatedAt: new Date(2026, 7, 2, 9, 0).toISOString() }),
    ]);
    expect(groupItemsByDay(items).get("2026-07-21")).toHaveLength(2);
    expect(monthItems(items, new Date(2026, 6, 1))).toHaveLength(2);
  });
});

describe("week time mapping — ONE shared time→position function", () => {
  it("maps the bounded window edges and midpoint (a label may never drift from the slot it names)", () => {
    expect(hourPct(6, DAY_WINDOW)).toBe(0);
    expect(hourPct(13, DAY_WINDOW)).toBe(50);
    expect(hourPct(20, DAY_WINDOW)).toBe(100);
    expect(hourPct(0, FULL_WINDOW)).toBe(0);
    expect(hourPct(12, FULL_WINDOW)).toBe(50);
  });

  it("splits quiet hours honestly (20:00–06:00 collapsed with a count)", () => {
    const items = deriveItems([
      asset({ draftId: "day", generatedAt: new Date(2026, 6, 21, 9, 0).toISOString() }),
      asset({ draftId: "night", generatedAt: new Date(2026, 6, 21, 21, 30).toISOString() }),
      asset({ draftId: "dawn", generatedAt: new Date(2026, 6, 21, 5, 59).toISOString() }),
    ]);
    const { inWindow, quiet } = quietSplit(items, DAY_WINDOW);
    expect(inWindow.map((i) => i.id)).toEqual(["day"]);
    expect(quiet.map((i) => i.id)).toEqual(["dawn", "night"]);
  });

  it("splits two slots in one hour side-by-side; a third becomes +N (the month's overflow grammar)", () => {
    const items = deriveItems([
      asset({ draftId: "a", generatedAt: new Date(2026, 6, 21, 9, 0).toISOString() }),
      asset({ draftId: "b", generatedAt: new Date(2026, 6, 21, 9, 15).toISOString() }),
      asset({ draftId: "c", generatedAt: new Date(2026, 6, 21, 9, 45).toISOString() }),
    ]);
    const groups = overlapGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].shown).toHaveLength(2);
    expect(groups[0].more).toBe(1);
  });
});

describe("filters — exclusion is first-class", () => {
  it("cycles off → only → not → off", () => {
    let f = EMPTY_FILTER;
    expect(chipState(f, "gated")).toBe("off");
    f = cycleFilter(f, "gated");
    expect(chipState(f, "gated")).toBe("only");
    f = cycleFilter(f, "gated");
    expect(chipState(f, "gated")).toBe("not");
    f = cycleFilter(f, "gated");
    expect(chipState(f, "gated")).toBe("off");
  });

  it("applies channel + status together, exclusion winning", () => {
    const items = deriveItems([
      asset({ draftId: "a", platform: "linkedin", status: "blocked" }),
      asset({ draftId: "b", platform: "x", status: "queued" }),
      asset({ draftId: "c", platform: "linkedin", status: "queued" }),
    ]);
    const onlyLinkedin = cycleFilter(EMPTY_FILTER, "linkedin");
    expect(applyFilters(items, onlyLinkedin, EMPTY_FILTER).map((i) => i.id)).toEqual(["a", "c"]);
    const notGated = cycleFilter(cycleFilter(EMPTY_FILTER, "gated"), "gated");
    expect(applyFilters(items, EMPTY_FILTER, notGated).map((i) => i.id)).toEqual(["b", "c"]);
    expect(applyFilters(items, onlyLinkedin, notGated).map((i) => i.id)).toEqual(["c"]);
  });

  it("derives chip rows from observed data, never a hard-coded brand list", () => {
    const items = deriveItems([
      asset({ draftId: "a", platform: "linkedin" }),
      asset({ draftId: "b", platform: "x" }),
      asset({ draftId: "c", platform: "linkedin" }),
    ]);
    expect(observedValues(items, (i) => i.platform)).toEqual(["linkedin", "x"]);
  });
});

describe("display helpers", () => {
  it("renders the compact clock with padded minutes", () => {
    expect(clockLabel(new Date(2026, 6, 21, 9, 5))).toBe("9:05");
    expect(clockLabel(new Date(2026, 6, 21, 15, 30))).toBe("15:30");
  });
});
