import { describe, expect, it } from "vitest";
import {
  assetEvents,
  cadenceBreaches,
  cadenceLine,
  eventsInScope,
  gutterHours,
  monthCells,
  outsideWindow,
  placeColumn,
  planEvents,
  sweepEvents,
  waitingEvents,
  weekRangeLabel,
  windowHeight,
  yOf,
  DAY_WINDOW,
  FULL_WINDOW,
  HOUR_PX,
  type CalEvent,
} from "@/components/calendar/calendar-model";
import type { PipelineAsset, PlanCadenceRule, PlannedSlotWire } from "@/lib/workspace/types";
import { weekDays } from "@/lib/workspace/week";

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 6, day, hour, minute, 0, 0);
}

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: at(22, 9).toISOString(),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "the pipeline thread",
    ...overrides,
  };
}

function slot(overrides: Partial<PlannedSlotWire> & { draftId: string }): PlannedSlotWire {
  return {
    platform: "linkedin",
    scheduledFor: at(26, 9, 30).toISOString(),
    note: null,
    ...overrides,
  };
}

describe("the calendar's ONE time mapping", () => {
  it("puts 06:00 at the top and every hour 44px below the last", () => {
    expect(yOf(6)).toBe(0);
    expect(yOf(6.5)).toBe(HOUR_PX / 2);
    expect(yOf(14.5)).toBe(374); // the sheet's own 14:30 event
    expect(yOf(18)).toBe(528); // the sheet's own 18:00 plan
    expect(windowHeight(DAY_WINDOW)).toBe(660); // the sheet's column height
    expect(windowHeight(FULL_WINDOW)).toBe(1056);
  });

  it("labels the gutter on even hours inside the window", () => {
    expect(gutterHours(DAY_WINDOW)).toEqual([6, 8, 10, 12, 14, 16, 18, 20]);
    expect(gutterHours(FULL_WINDOW)[0]).toBe(0);
  });
});

describe("events are placed only where the backend recorded something", () => {
  it("plans carry the slot's note, its draft's excerpt and a door", () => {
    const [event] = planEvents(
      [slot({ draftId: "d1", note: "launch film post" })],
      [asset({ draftId: "d1" })],
      new Map(),
    );
    expect(event.kind).toBe("plan");
    expect(event.lead).toBe("Planned · LinkedIn");
    expect(event.meta).toBe("09:30 · launch film post");
    expect(event.href).toContain("/app/approve?run=run-1&draft=d1");
    expect(event.flagged).toBe(false);
  });

  it("a plan whose draft aged out of the feed window still renders, without a fake excerpt", () => {
    const [event] = planEvents([slot({ draftId: "gone" })], [], new Map());
    expect(event.meta).toBe("09:30 · no note");
    expect(event.excerpt).toBe("");
    expect(event.href).toBeNull();
  });

  it("published work is a success, approved/rejected are not dressed as one", () => {
    const events = assetEvents([
      asset({
        draftId: "p1",
        status: "published",
        publishedAt: at(24, 16, 20).toISOString(),
        decidedAt: at(24, 16, 20).toISOString(),
        deployRef: "https://example.test/post",
      }),
      asset({ draftId: "a1", status: "approved", decidedAt: at(23, 11).toISOString() }),
      asset({ draftId: "r1", status: "rejected", decidedAt: at(23, 12).toISOString() }),
    ]);
    expect(events.map((e) => [e.kind, e.lead])).toEqual([
      ["done", "LinkedIn · published ✓"],
      ["closed", "LinkedIn · approved"],
      ["closed", "LinkedIn · rejected"],
    ]);
    expect(events[0].meta).toContain("https://example.test/post");
  });

  it("waiting and composing drafts never appear in the time grid", () => {
    expect(
      assetEvents([
        asset({ draftId: "q1", status: "queued" }),
        asset({ draftId: "b1", status: "blocked" }),
        asset({ draftId: "g1", status: "generated" }),
      ]),
    ).toEqual([]);
  });
});

describe("sweeps: what ran, and what the engine will run", () => {
  const now = at(24, 12);
  const days = weekDays(now);

  it("projects the pointer forward and marks the sweep that ran", () => {
    const events = sweepEvents(
      {
        lastSweptAt: at(24, 6, 30).toISOString(),
        nextSweepAt: at(24, 14, 30).toISOString(),
        intervalMs: 8 * 3_600_000,
        source: "youtube + bluesky",
      },
      now,
      days,
    );
    expect(events[0].lead).toBe("Sweep · ran ✓");
    expect(events[0].kind).toBe("done");
    expect(events.filter((e) => e.kind === "engine").length).toBeGreaterThan(0);
    expect(events[1].lead).toBe("Sweep · engine");
  });

  it("projects NOTHING from an overdue pointer — a stalled poller is not a plan", () => {
    const events = sweepEvents(
      {
        lastSweptAt: at(18, 6).toISOString(),
        nextSweepAt: at(19, 6).toISOString(),
        intervalMs: 8 * 3_600_000,
        source: "youtube",
      },
      now,
      days,
    );
    expect(events.filter((e) => e.kind === "engine")).toEqual([]);
  });

  it("renders no sweep band at all when no pointer exists", () => {
    expect(sweepEvents(null, now, days)).toEqual([]);
  });
});

describe("the waiting lane is a present state, not a past event", () => {
  const now = at(24, 12);
  const days = weekDays(now);

  it("places waiting work on the day it started waiting, with the hours it has waited", () => {
    const [event] = waitingEvents(
      [asset({ draftId: "w1", status: "queued", judgedAt: at(23, 10).toISOString() })],
      days,
      now,
    );
    expect(event.kind).toBe("you");
    expect(event.lead).toBe("LinkedIn · your review");
    expect(event.hours).toBe(26);
    expect(event.carried).toBe(false);
  });

  it("carries older waiting work into today instead of dropping it out of view", () => {
    const [event] = waitingEvents(
      [asset({ draftId: "w2", status: "blocked", judgedAt: at(10, 9).toISOString() })],
      days,
      now,
    );
    expect(event.lead).toBe("LinkedIn · needs edit");
    expect(event.carried).toBe(true);
    expect(event.day).toBe(days.find((d) => d.isToday)?.key);
  });
});

describe("the ⚑ flag: the sheet's cadence claim, made checkable", () => {
  const cadence: PlanCadenceRule[] = [
    { platform: "linkedin", maxPerDay: 2, minGapMinutes: 90 },
    { platform: "x", maxPerDay: 4 },
  ];

  it("flags the plans beyond a platform's daily allowance, naming the rule", () => {
    const slots = [
      slot({ draftId: "a", scheduledFor: at(26, 9).toISOString() }),
      slot({ draftId: "b", scheduledFor: at(26, 13).toISOString() }),
      slot({ draftId: "c", scheduledFor: at(26, 17).toISOString() }),
    ];
    const breaches = cadenceBreaches(slots, cadence);
    expect(breaches.has("a")).toBe(false);
    expect(breaches.has("b")).toBe(false);
    expect(breaches.get("c")).toBe("LinkedIn is planned 3× that day — your cadence allows 2");
  });

  it("flags a plan that lands inside the minimum gap", () => {
    const breaches = cadenceBreaches(
      [
        slot({ draftId: "a", scheduledFor: at(26, 9).toISOString() }),
        slot({ draftId: "b", scheduledFor: at(26, 10).toISOString() }),
      ],
      cadence,
    );
    expect(breaches.get("b")).toBe("60m after the previous LinkedIn plan — your cadence asks for 90m");
  });

  it("flags nothing when the tenant has no rule for that platform", () => {
    expect(
      cadenceBreaches(
        [
          slot({ draftId: "a", platform: "facebook", scheduledFor: at(26, 9).toISOString() }),
          slot({ draftId: "b", platform: "facebook", scheduledFor: at(26, 9, 5).toISOString() }),
        ],
        cadence,
      ).size,
    ).toBe(0);
  });

  it("states the truth in the footer when no cadence is configured", () => {
    expect(cadenceLine([])).toBe(
      "No cadence rules configured — every platform plans unconstrained.",
    );
    expect(cadenceLine(cadence)).toBe("Cadence — LinkedIn ≤ 2/day 90m gap · X ≤ 4/day");
  });
});

describe("scope, layout and labels", () => {
  const events: CalEvent[] = [
    { id: "1", kind: "plan", at: at(26, 9), day: "2026-07-26", lead: "Planned · X", meta: "", href: null, excerpt: "", flagged: true, flagReason: "over cadence" },
    { id: "2", kind: "done", at: at(26, 11), day: "2026-07-26", lead: "Blog · published ✓", meta: "", href: null, excerpt: "", flagged: false, flagReason: "" },
    { id: "3", kind: "you", at: at(26, 8), day: "2026-07-26", lead: "X · your review", meta: "", href: null, excerpt: "", flagged: false, flagReason: "" },
  ];

  it("each scope shows exactly its own slice", () => {
    expect(eventsInScope(events, "all")).toHaveLength(3);
    expect(eventsInScope(events, "plans").map((e) => e.id)).toEqual(["1"]);
    expect(eventsInScope(events, "flagged").map((e) => e.id)).toEqual(["1"]);
    expect(eventsInScope(events, "needs").map((e) => e.id)).toEqual(["3"]);
  });

  it("a lone event keeps the sheet's full-width box", () => {
    const [placed] = placeColumn([events[0]]);
    expect(placed.leftPct).toBe(0);
    expect(placed.widthPct).toBe(100);
    expect(placed.top).toBe(yOf(9));
    expect(placed.height).toBe(42);
  });

  it("concurrent events split the column instead of stacking on top of each other", () => {
    const overlapping = [
      { ...events[0], id: "a", at: at(26, 9) },
      { ...events[0], id: "b", at: at(26, 9, 15) },
    ];
    const placed = placeColumn(overlapping);
    expect(placed.map((p) => p.widthPct)).toEqual([50, 50]);
    expect(placed.map((p) => p.leftPct)).toEqual([0, 50]);
  });

  it("counts what the collapsed quiet hours hide", () => {
    const early = { ...events[0], id: "early", at: at(26, 3) };
    const late = { ...events[0], id: "late", at: at(26, 22) };
    expect(outsideWindow([...events, early, late], DAY_WINDOW).map((e) => e.id)).toEqual([
      "early",
      "late",
    ]);
    expect(outsideWindow([early, late], FULL_WINDOW)).toEqual([]);
  });

  it("labels the week the way the sheet does, and names both months when it must", () => {
    expect(weekRangeLabel(weekDays(at(24, 12)))).toBe("20 – 26 July");
    expect(weekRangeLabel(weekDays(new Date(2026, 6, 30)))).toBe("27 July – 2 August");
  });

  it("covers a month in whole Monday-start weeks", () => {
    const cells = monthCells(new Date(2026, 6, 15), at(24, 12));
    expect(cells.length % 7).toBe(0);
    expect(cells[0].date.getDay()).toBe(1);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
  });
});
