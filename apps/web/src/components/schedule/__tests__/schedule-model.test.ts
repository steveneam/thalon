import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assetEvents,
  byMarkPriority,
  cadenceBreaches,
  cadenceLine,
  eventsInScope,
  gutterHours,
  hourFromOffset,
  instantOn,
  monthCells,
  outsideWindow,
  placeColumn,
  planEmptyReason,
  plannableAssets,
  SNAP_MINUTES,
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
} from "@/components/schedule/schedule-model";
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
    media: null,
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
    const {
      placed: [placed],
      overflow,
    } = placeColumn([events[0]]);
    expect(placed.leftPct).toBe(0);
    expect(placed.widthPct).toBe(100);
    expect(placed.top).toBe(yOf(9));
    expect(placed.height).toBe(42);
    expect(overflow).toEqual([]);
  });

  it("two concurrent events split the column instead of stacking on top of each other", () => {
    const overlapping = [
      { ...events[0], id: "a", at: at(26, 9) },
      { ...events[0], id: "b", at: at(26, 9, 15) },
    ];
    const { placed, overflow } = placeColumn(overlapping);
    expect(placed.map((p) => p.widthPct)).toEqual([50, 50]);
    expect(placed.map((p) => p.leftPct)).toEqual([0, 50]);
    expect(overflow).toEqual([]);
  });

  /*
   * s96 (S3, the amended sheet — SUPERSEDES the even split): a four-platform
   * fan-out at one instant draws TWO chips; the remainder is a count that
   * names exactly what it holds. Priority decides who stays visible (a
   * commitment outranks an intention outranks a record), and the visible
   * pair still renders in time order.
   */
  it("caps a run at two chips and puts the remainder behind the +N door", () => {
    const cluster = [
      { ...events[1], id: "d1", at: at(26, 11) },
      { ...events[1], id: "d2", at: at(26, 11) },
      { ...events[0], id: "p1", at: at(26, 11, 10) },
      { ...events[0], id: "q1", kind: "queued" as const, at: at(26, 11, 5) },
    ];
    const { placed, overflow } = placeColumn(cluster);
    expect(placed).toHaveLength(2);
    // The queued commitment and the plan outrank the two published records…
    expect(placed.map((p) => p.event.id).sort()).toEqual(["p1", "q1"]);
    // …and the visible pair reads chronologically left to right.
    expect(placed[0].event.id).toBe("q1");
    expect(placed.map((p) => p.widthPct)).toEqual([50, 50]);
    // The count holds EXACTLY the hidden events — nothing vanishes silently.
    expect(overflow).toHaveLength(1);
    expect(overflow[0].hidden.map((e) => e.id).sort()).toEqual(["d1", "d2"]);
    expect(overflow[0].at.getTime()).toBe(at(26, 11).getTime());
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

  it("ranks a bounded month cell's marks: you, then plans, then done, engine last", () => {
    const engine = { ...events[1], id: "sweep", kind: "engine" as const };
    const ranked = [engine, events[1], events[0], events[2]].sort(byMarkPriority);
    expect(ranked.map((e) => e.kind)).toEqual(["you", "plan", "done", "engine"]);
  });

  it("covers a month in whole Monday-start weeks", () => {
    const cells = monthCells(new Date(2026, 6, 15), at(24, 12));
    expect(cells.length % 7).toBe(0);
    expect(cells[0].date.getDay()).toBe(1);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
  });
});

/**
 * s78 — two CSS facts that cost the surface its honesty, pinned as tests
 * because neither is reachable from jsdom (layout and cursor are not
 * computed there) and both were REGRESSIONS OF A PORTED SHEET RULE. A
 * documentary note would have rotted; this runs.
 */
describe("schedule.css — the two rules a real day breaks", () => {
  // Comments in this file DISCUSS the rules they replaced, so the pins read
  // declarations only — a note about `cursor: grab` must not read as one.
  const css = readFileSync(new URL("../schedule.css", import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  it("the week card takes its natural height, so the grid can never clip without a scrollbar", () => {
    const rule = /\.calendar-surface \.cal \{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    // `flex: 1` inside `.content` (flex:1; overflow:hidden auto) sizes the
    // card to the free space and clips it — the evening and the whole 21–24
    // band, including the band that would have said anything was hidden.
    expect(rule?.[1]).toContain("flex: 0 0 auto");
    expect(rule?.[1]).not.toMatch(/flex:\s*1\s*;/);
  });

  /**
   * INVERTED s78b, and the invariant is the same one either way: **a drag
   * cursor only where drag actually works.**
   *
   * Lane 2 asserted the absence of `grab` because nothing could be dragged —
   * correct then. The founder then found the deeper gap (nothing could CREATE
   * a plan, so there was never anything to drag OR reschedule), drag was
   * wired, and the sheet's own affordance came back. What must never return is
   * the lie: a grab cursor on a box that cannot move.
   */
  it("offers a drag cursor ONLY on plans — the one kind that can be moved", () => {
    const grabbing = [...css.matchAll(/([^{}]+)\{([^{}]*cursor:\s*grab[^{}]*)\}/g)];
    expect(grabbing.length).toBeGreaterThan(0);
    for (const [, selector] of grabbing) {
      expect(selector).toContain(".ev-plan");
    }
  });

  it("never puts a drag cursor on the record kinds — history does not move", () => {
    for (const kind of [".ev-ok", ".ev.done", ".mark"]) {
      const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
        ([, sel, body]) => sel.includes(kind) && /cursor:\s*grab/.test(body),
      );
      expect(rule).toBeUndefined();
    }
  });
});

/* ── PLANNING (s78b, founder-found) ──────────────────────────────────────── */

describe("plannableAssets — what can actually be planned", () => {
  it("offers approved, unpublished drafts that hold no slot", () => {
    const rows = plannableAssets([asset({ draftId: "d1", status: "approved" })], []);
    expect(rows.map((r) => r.draftId)).toEqual(["d1"]);
  });

  it("never offers a draft that is not approved — planning is post-approval", () => {
    expect(plannableAssets([asset({ draftId: "d1", status: "queued" })], [])).toEqual([]);
    expect(plannableAssets([asset({ draftId: "d1", status: "blocked" })], [])).toEqual([]);
  });

  it("never offers one already published, or one that already holds a slot", () => {
    expect(
      plannableAssets(
        [asset({ draftId: "d1", status: "approved", publishedAt: at(23, 9).toISOString() })],
        [],
      ),
    ).toEqual([]);
    expect(
      plannableAssets(
        [asset({ draftId: "d1", status: "approved" })],
        [slot({ draftId: "d1" })],
      ),
    ).toEqual([]);
  });
});

/**
 * THE EMPTY PICKER STATED THE WRONG FACT (s79, found by DRIVING the surface).
 *
 * `PlanPicker`'s own docstring promised this distinction — *"'nothing approved
 * yet' and 'everything is already planned' are different facts and the
 * operator's next move differs"* — and the code rendered ONE hardcoded line for
 * both. On live dev that line was false: five drafts were approved and every
 * plannable one already held a slot, so the picker told the operator to go and
 * approve something they had already approved.
 *
 * No reading audit catches this, because the docstring describes the correct
 * behaviour and the code reads as consistent with its own stated intent. Only
 * opening the picker against real data shows the message is wrong for the case.
 */
describe("planEmptyReason — an empty picker must state the TRUE reason", () => {
  it("says nothing is approved when nothing is approved", () => {
    expect(planEmptyReason([asset({ draftId: "d1", status: "queued" })], [])).toBe("none-approved");
    expect(planEmptyReason([], [])).toBe("none-approved");
  });

  it("says everything is already planned when that is what happened", () => {
    // The live-dev shape: approved, unpublished, and already holding a slot.
    expect(
      planEmptyReason([asset({ draftId: "d1", status: "approved" })], [slot({ draftId: "d1" })]),
    ).toBe("all-planned");
  });

  it("counts a PUBLISHED approved draft as no longer plannable, not as planned", () => {
    // Published work is done, not pending a slot — telling the operator
    // "everything is already planned" would be a second wrong fact.
    expect(
      planEmptyReason(
        [asset({ draftId: "d1", status: "approved", publishedAt: at(23, 9).toISOString() })],
        [],
      ),
    ).toBe("none-approved");
  });

  it("never claims 'already planned' while something is still plannable", () => {
    // The pair derives from the same inputs on purpose. If this drifted, the
    // picker could tell the operator everything is planned on a surface that is
    // simultaneously offering them something to plan.
    const mixed = [
      asset({ draftId: "planned", status: "approved" }),
      asset({ draftId: "free", status: "approved" }),
    ];
    expect(plannableAssets(mixed, [slot({ draftId: "planned" })]).map((r) => r.draftId)).toEqual([
      "free",
    ]);
    expect(planEmptyReason(mixed, [slot({ draftId: "planned" })])).not.toBe("all-planned");
  });
});

describe("hourFromOffset — the exact inverse of yOf, snapped and clamped", () => {
  it("round-trips a drawn hour back to itself", () => {
    for (const hour of [6, 9.5, 12.25, 18]) {
      expect(hourFromOffset(yOf(hour, DAY_WINDOW), DAY_WINDOW)).toBeCloseTo(hour, 5);
    }
  });

  it("snaps to the quarter hour, so a drop never lands on 10:07", () => {
    const hour = hourFromOffset(yOf(10.1, DAY_WINDOW), DAY_WINDOW);
    expect(Math.round((hour % 1) * 60) % SNAP_MINUTES).toBe(0);
  });

  it("clamps INTO the window — an overshooting drag lands on the edge, never off-grid", () => {
    expect(hourFromOffset(-500, DAY_WINDOW)).toBe(DAY_WINDOW.start);
    expect(hourFromOffset(99999, DAY_WINDOW)).toBeLessThan(DAY_WINDOW.end);
    expect(hourFromOffset(99999, DAY_WINDOW)).toBeGreaterThanOrEqual(DAY_WINDOW.end - 1);
  });
});

describe("instantOn — a day plus a fractional hour is a real local instant", () => {
  it("places 14.25 as 14:15 on that day", () => {
    const day = { date: new Date(2026, 6, 22), key: "2026-07-22", isToday: false };
    const at = instantOn(day, 14.25);
    expect(at.getHours()).toBe(14);
    expect(at.getMinutes()).toBe(15);
    expect(at.getDate()).toBe(22);
  });
});

/**
 * THE POPOVER MUST BE MEASURED, NOT GUESSED (founder s78b: "the popover goes
 * off screen, i cant click to remove").
 *
 * It was clamped with a hard-coded `DETAIL_HEIGHT = 190`, against the GRID's
 * height rather than the visible scroll viewport. Both were wrong: with quiet
 * hours expanded the grid is 1056px, and opening Reschedule grows the popover
 * past 190 — which is precisely when its verbs ran off the bottom.
 *
 * jsdom computes no layout (`offsetHeight` is 0), so the fit itself cannot be
 * asserted here; it was verified in a real browser with `elementFromPoint`,
 * confirming Remove is hittable and not merely on screen. What IS pinnable is
 * that the guessed constant never comes back.
 */
describe("calendar popovers fit themselves to what is visible", () => {
  const source = readFileSync(
    new URL("../schedule-surface.tsx", import.meta.url),
    "utf8",
  );

  it("no hard-coded popover height — the height is measured after layout", () => {
    expect(source).not.toMatch(/DETAIL_HEIGHT\s*=\s*\d/);
  });

  it("neither popover uses a class with no rule behind it", () => {
    // `.detail-hd` was invented for the plan picker and never given a rule, so
    // its ✕ sat wherever the title text ended while the detail popover's sat at
    // the right edge — two popovers, two close buttons, two places (founder
    // s78b). Both now share the detail popover's own header markup.
    // The className, not a mention of it in the note explaining why it went.
    expect(source).not.toMatch(/className="detail-hd"/);
    expect([...source.matchAll(/className="bare detail-close"/g)]).toHaveLength(2);
    // Same GLYPH too: × (U+00D7), never ✕ (U+2715) — different characters
    // render at different sizes, and that is what the founder saw. Comments
    // are stripped first: the note explaining the fix names the old glyph.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\u2715/);
    expect([...source.matchAll(/className="t-title detail-title"/g)]).toHaveLength(2);
  });

  it("an outside press dismisses, and does not also plan underneath it", () => {
    expect(source).toMatch(/function useDismissOnOutside/);
    expect([...source.matchAll(/useDismissOnOutside\(ref, onClose\)/g)]).toHaveLength(2);
    // The same press must not close a popover AND open the planner.
    expect(source).toMatch(/dismissedRef/);
  });

  it("both popovers route their top through the fit-in-view measurement", () => {
    expect(source).toMatch(/function useFitInView/);
    // Two callers: the detail card and the plan picker.
    expect([...source.matchAll(/useFitInView<HTMLDivElement>/g)]).toHaveLength(2);
    // Optional call — jsdom has no scrollIntoView (the runs.tsx precedent).
    expect(source).toMatch(/scrollIntoView\?\.\(\{\s*block:\s*"nearest"/);
  });
});
