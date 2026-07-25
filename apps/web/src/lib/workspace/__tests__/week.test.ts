import { describe, expect, it } from "vitest";
import type { PipelineAsset, PlanSweep } from "../types";
import {
  dayKey,
  decidedEntries,
  groupByDay,
  projectSweepTicks,
  sweepOverdue,
  waitingEntries,
  weekDays,
} from "../week";

// Wednesday 2026-07-15 10:00 local — mid-week, so the grid has past and future days.
const NOW = new Date(2026, 6, 15, 10, 0, 0);

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: "2026-07-14T08:00:00.000Z",
    generatedAt: new Date(2026, 6, 14, 9, 0).toISOString(),
    judgedAt: new Date(2026, 6, 14, 9, 5).toISOString(),
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "fixture excerpt",
    ...overrides,
  };
}

describe("weekDays", () => {
  it("builds a Monday-start local week with today marked", () => {
    const days = weekDays(NOW);
    expect(days).toHaveLength(7);
    expect(days[0].date.getDay()).toBe(1); // Monday
    expect(days[0].date.getDate()).toBe(13);
    expect(days.map((d) => d.isToday)).toEqual([false, false, true, false, false, false, false]);
  });

  it("stays Monday-start when today IS Sunday (the wrap-around day)", () => {
    const days = weekDays(new Date(2026, 6, 19, 23, 0));
    expect(days[0].date.getDate()).toBe(13);
    expect(days[6].isToday).toBe(true);
  });
});

describe("projectSweepTicks", () => {
  const windowStart = new Date(2026, 6, 13);
  const windowEnd = new Date(2026, 6, 20);

  it("projects next-sweep plus every interval, clipped to the window and never in the past", () => {
    const sweep: PlanSweep = {
      lastSweptAt: new Date(2026, 6, 15, 8, 0).toISOString(),
      nextSweepAt: new Date(2026, 6, 15, 12, 0).toISOString(),
      intervalMs: 24 * 3_600_000,
      source: "bluesky",
    };
    const ticks = projectSweepTicks(sweep, NOW, windowStart, windowEnd);
    expect(ticks.map((t) => t.getDate())).toEqual([15, 16, 17, 18, 19]);
  });

  it("drops a stale pointer whose next sweep already passed, keeping later projections", () => {
    const sweep: PlanSweep = {
      lastSweptAt: new Date(2026, 6, 14, 6, 0).toISOString(),
      nextSweepAt: new Date(2026, 6, 14, 12, 0).toISOString(),
      intervalMs: 48 * 3_600_000,
      source: "bluesky",
    };
    const ticks = projectSweepTicks(sweep, NOW, windowStart, windowEnd);
    // The 14th is in the past; only the 16th and 18th remain.
    expect(ticks.map((t) => t.getDate())).toEqual([16, 18]);
  });

  it("an OVERDUE pointer (more than one interval late) projects nothing — a dead poller paints no future", () => {
    const sweep: PlanSweep = {
      lastSweptAt: new Date(2026, 6, 7, 8, 0).toISOString(),
      nextSweepAt: new Date(2026, 6, 7, 12, 0).toISOString(),
      intervalMs: 4 * 3_600_000,
      source: "bluesky",
    };
    expect(sweepOverdue(sweep, NOW)).toBe(true);
    expect(projectSweepTicks(sweep, NOW, windowStart, windowEnd)).toEqual([]);
    // A merely-due pointer (within one interval) is still trusted.
    expect(
      sweepOverdue(
        { ...sweep, nextSweepAt: new Date(NOW.getTime() - 3_600_000).toISOString() },
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses to project a degenerate sub-hour interval (flood guard)", () => {
    const sweep: PlanSweep = {
      lastSweptAt: NOW.toISOString(),
      nextSweepAt: new Date(NOW.getTime() + 60_000).toISOString(),
      intervalMs: 60_000,
      source: "bluesky",
    };
    expect(projectSweepTicks(sweep, NOW, windowStart, windowEnd)).toEqual([]);
  });
});

describe("waiting / decided entries", () => {
  it("waiting drafts sit on the day the judge put them there; decided on the decision day", () => {
    const assets = [
      asset({ draftId: "q1", status: "queued" }),
      asset({ draftId: "b1", status: "blocked", judgedAt: new Date(2026, 6, 15, 7, 0).toISOString() }),
      asset({
        draftId: "a1",
        status: "approved",
        decidedAt: new Date(2026, 6, 13, 16, 0).toISOString(),
      }),
      asset({ draftId: "g1", status: "judging" }),
    ];
    const days = weekDays(NOW);
    const waiting = groupByDay(waitingEntries(assets), days);
    const decided = groupByDay(decidedEntries(assets), days);

    expect(waiting.get(dayKey(new Date(2026, 6, 14)))?.map((e) => e.asset.draftId)).toEqual(["q1"]);
    expect(waiting.get(dayKey(new Date(2026, 6, 15)))?.map((e) => e.asset.draftId)).toEqual(["b1"]);
    expect(decided.get(dayKey(new Date(2026, 6, 13)))?.map((e) => e.asset.draftId)).toEqual(["a1"]);
    // judging is the engine's to finish — it never renders as operator work.
    const all = [...waiting.values()].flat().map((e) => e.asset.draftId);
    expect(all).not.toContain("g1");
  });

  it("drops entries outside the visible week instead of mis-bucketing them", () => {
    const assets = [
      asset({ draftId: "old", status: "queued", judgedAt: new Date(2026, 6, 1).toISOString() }),
    ];
    const grouped = groupByDay(waitingEntries(assets), weekDays(NOW));
    expect([...grouped.values()].flat()).toHaveLength(0);
  });

  it("carries PRE-WEEK waiting into the named day, flagged — waiting is a present state (critique P1, s39)", () => {
    const days = weekDays(NOW);
    const today = days.find((d) => d.isToday)?.key as string;
    const assets = [
      asset({ draftId: "old", status: "queued", judgedAt: new Date(2026, 6, 1).toISOString() }),
      // A FUTURE out-of-window entry must still be dropped, never carried.
      asset({ draftId: "future", status: "queued", judgedAt: new Date(2026, 6, 25).toISOString() }),
    ];
    const grouped = groupByDay(waitingEntries(assets), days, { carryEarlierInto: today });
    const carried = grouped.get(today) ?? [];
    expect(carried.map((e) => [e.asset.draftId, e.carried])).toEqual([["old", true]]);
    expect([...grouped.values()].flat()).toHaveLength(1);
  });
});
