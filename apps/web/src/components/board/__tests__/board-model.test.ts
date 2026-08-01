import { describe, expect, it } from "vitest";
import {
  ageLabel,
  boardColumns,
  boardPlatformOptions,
  plannedCards,
  COLUMN_CARD_BOUND,
} from "@/components/board/board-model";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";

const NOW = new Date(2026, 6, 24, 12, 0, 0);

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: minutesAgo(180),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "a draft",
    ...overrides,
  };
}

describe("the board's age grammar", () => {
  it("counts minutes, then hours — never a day that hides how long someone waited", () => {
    expect(ageLabel(new Date(NOW.getTime() - 45 * 60_000), NOW)).toBe("45m");
    expect(ageLabel(new Date(NOW.getTime() - 60 * 60_000), NOW)).toBe("1h");
    expect(ageLabel(new Date(NOW.getTime() - 26 * 3_600_000), NOW)).toBe("26h");
    // A future stamp reads as brand new rather than as a negative age.
    expect(ageLabel(new Date(NOW.getTime() + 60_000), NOW)).toBe("0m");
  });
});

describe("columns are the recorded lifecycle, not a hand-kept status", () => {
  const assets = [
    asset({ draftId: "a", status: "generated" }),
    asset({ draftId: "b", status: "judging" }),
    asset({ draftId: "c", status: "queued", judgedAt: minutesAgo(120) }),
    asset({ draftId: "d", status: "blocked", judgedAt: minutesAgo(60), reasons: ["Grounding: no source"] }),
    asset({ draftId: "e", status: "approved" }),
    asset({ draftId: "f", status: "published", publishedAt: minutesAgo(30) }),
    // Rejected work has left the pipeline: the sheet draws no column for it.
    asset({ draftId: "g", status: "rejected", decidedAt: minutesAgo(10) }),
  ];

  it("routes every draft to exactly one column, and rejects to none", () => {
    const columns = boardColumns({ assets, slots: [], trends: [], now: NOW });
    expect(columns.map((c) => [c.id, c.count])).toEqual([
      ["intel", 0],
      ["composing", 1],
      ["judge", 1],
      ["waiting", 2],
      ["approved", 2],
      ["planned", 0],
    ]);
    const placed = columns.flatMap((c) => c.cards.map((card) => card.id));
    expect(placed).not.toContain("g");
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("orders the waiting column oldest first — the queue's own order", () => {
    const waiting = boardColumns({ assets, slots: [], trends: [], now: NOW }).find(
      (c) => c.id === "waiting",
    );
    expect(waiting?.cards.map((card) => card.id)).toEqual(["c", "d"]);
    expect(waiting?.signal).toBe(true);
  });

  it("keeps the header count at the TOTAL when a long column scrolls", () => {
    const many = Array.from({ length: COLUMN_CARD_BOUND + 5 }, (_, i) =>
      asset({ draftId: `q${i}`, status: "queued", judgedAt: minutesAgo(i + 1) }),
    );
    const waiting = boardColumns({ assets: many, slots: [], trends: [], now: NOW }).find(
      (c) => c.id === "waiting",
    );
    expect(waiting?.count).toBe(COLUMN_CARD_BOUND + 5);
    expect(waiting?.cards).toHaveLength(COLUMN_CARD_BOUND);
  });

  it("says published only when a deploy recorded it", () => {
    const approved = boardColumns({ assets, slots: [], trends: [], now: NOW }).find(
      (c) => c.id === "approved",
    );
    expect(approved?.cards.map((c) => c.meta)).toEqual(["ready to plan", "published ↗"]);
  });
});

describe("planned slots", () => {
  const slots: PlannedSlotWire[] = [
    { draftId: "late", platform: "x", scheduledFor: new Date(2026, 6, 26, 11, 0).toISOString(), note: null },
    { draftId: "early", platform: "facebook", scheduledFor: new Date(2026, 6, 24, 18, 0).toISOString(), note: null },
  ];

  it("reads soonest first, in the sheet's own grammar", () => {
    const cards = plannedCards(slots, []);
    expect(cards.map((c) => c.title)).toEqual([
      "Friday 18:00 · Facebook",
      "Sunday 11:00 · X",
    ]);
    expect(cards.every((c) => c.meta === "door unarmed — a plan")).toBe(true);
  });

  it("a plan whose draft aged out of the read still opens somewhere real", () => {
    expect(plannedCards(slots, [])[0].href).toBe("/app/schedule");
    expect(plannedCards(slots, [asset({ draftId: "early" })])[0].href).toBe(
      "/app/approve?run=run-1&draft=early",
    );
  });
});

/*
 * s77 finding (board-model.ts:138): Composing / At-the-judge / Approved cards
 * carried no platform, and `.k-title` is a two-line clamp — so a fan-out's
 * siblings, whose excerpts diverge only after ~70 characters, rendered as
 * byte-identical cards. The sheet leads those titles with the platform
 * ("Blog · inside the build-step pipeline"); this pins that.
 */
describe("a card names its platform where the sheet does (s77 · board-model:138)", () => {
  const shared =
    "Three Claude releases in eight weeks and the pricing changed twice along the way";
  const siblings = [
    asset({ draftId: "s-li", platform: "linkedin", status: "approved", excerpt: shared }),
    asset({ draftId: "s-fb", platform: "facebook", status: "approved", excerpt: shared }),
  ];

  it("two approved siblings of ONE fan-out no longer render as the same card", () => {
    const approved = boardColumns({ assets: siblings, slots: [], trends: [], now: NOW }).find(
      (c) => c.id === "approved",
    );
    const titles = approved?.cards.map((card) => card.title) ?? [];
    expect(new Set(titles).size).toBe(2);
    expect(titles).toEqual([`LinkedIn · ${shared}`, `Facebook · ${shared}`]);
    // The distinguishing token leads, so a two-line clamp can never cut it off.
    for (const title of titles) expect(title.indexOf("·")).toBeLessThan(12);
  });

  it("Composing and At-the-judge lead with the platform too", () => {
    const columns = boardColumns({
      assets: [
        asset({ draftId: "c1", platform: "x", status: "generated", excerpt: "a draft" }),
        asset({ draftId: "j1", platform: "web", status: "judging", excerpt: "a page" }),
      ],
      slots: [],
      trends: [],
      now: NOW,
    });
    expect(columns.find((c) => c.id === "composing")?.cards[0].title).toBe("X · a draft");
    expect(columns.find((c) => c.id === "judge")?.cards[0].title).toBe("Blog · a page");
  });

  it("Waiting keeps the sheet's OWN grammar — platform in the meta, reason in the title", () => {
    const columns = boardColumns({
      assets: [
        asset({ draftId: "w1", status: "queued", judgedAt: minutesAgo(120), excerpt: "waiting draft" }),
        asset({ draftId: "b1", status: "blocked", judgedAt: minutesAgo(60), reasons: ["grounding: unsupported claim"] }),
      ],
      slots: [],
      trends: [],
      now: NOW,
    });
    const waiting = columns.find((c) => c.id === "waiting");
    expect(waiting?.cards.map((c) => c.title)).toEqual([
      "waiting draft",
      "grounding: unsupported claim",
    ]);
    expect(waiting?.cards[0].meta).toBe("LinkedIn · 2h");
  });
});

/* The view knobs the founder asked to re-introduce (s77). */
describe("the view knobs — platform filter and sort", () => {
  const mixed = [
    asset({ draftId: "m-li", platform: "linkedin", status: "queued", judgedAt: minutesAgo(30) }),
    asset({ draftId: "m-x", platform: "x", status: "queued", judgedAt: minutesAgo(90) }),
  ];

  it("offers only platforms the pipeline actually holds", () => {
    expect(boardPlatformOptions(mixed, [])).toEqual(["linkedin", "x"]);
  });

  it("narrows every column that HAS a platform", () => {
    const waiting = boardColumns({
      assets: mixed,
      slots: [],
      trends: [],
      now: NOW,
      platform: "x",
    }).find((c) => c.id === "waiting");
    expect(waiting?.cards.map((c) => c.id)).toEqual(["m-x"]);
    expect(waiting?.count).toBe(1);
  });

  it("marks Intel picks UNFILTERED rather than letting it pass for narrowed", () => {
    const columns = boardColumns({ assets: mixed, slots: [], trends: [], now: NOW, platform: "x" });
    expect(columns.find((c) => c.id === "intel")?.unfiltered).toBe(true);
    expect(columns.find((c) => c.id === "waiting")?.unfiltered).toBeUndefined();
    // With no filter applied nothing claims to be unfiltered.
    expect(
      boardColumns({ assets: mixed, slots: [], trends: [], now: NOW }).find((c) => c.id === "intel")
        ?.unfiltered,
    ).toBe(false);
  });

  it("defaults to the queue's own oldest-first order, and 'newest' reverses it", () => {
    const oldestFirst = boardColumns({ assets: mixed, slots: [], trends: [], now: NOW }).find(
      (c) => c.id === "waiting",
    );
    expect(oldestFirst?.cards.map((c) => c.id)).toEqual(["m-x", "m-li"]);
    const newestFirst = boardColumns({
      assets: mixed,
      slots: [],
      trends: [],
      now: NOW,
      sort: "newest",
    }).find((c) => c.id === "waiting");
    expect(newestFirst?.cards.map((c) => c.id)).toEqual(["m-li", "m-x"]);
  });
});
