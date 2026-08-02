import { describe, expect, it } from "vitest";
import {
  ageLabel,
  approveColumnCards,
  boardColumns,
  COLUMN_CARD_BOUND,
  footText,
  generatingCards,
  judgeCards,
  pickCards,
  publishedCards,
  publishedDayLabel,
  scheduledCards,
  slotTimeLabel,
  todayCount,
  type BoardViewInput,
} from "@/components/dashboard/board-view-model";
import type { RunRow } from "@/components/runs/runs-model";
import type { CreateRunWire } from "@/lib/create/client";
import type { IntelPickWire } from "@/lib/intel/types";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";

/**
 * The Dashboard's BOARD state derivations against the s91 pipeline-board
 * sheet (Board.dc.html, verdicted s91b): loop order, the per-column card
 * grammar, and the feet's the-day's-in/out math — with "–" wherever no read
 * records the crossing (a number nobody recorded is not a zero).
 */

const NOW = new Date("2026-08-02T15:00:00Z");
const TODAY_10 = "2026-08-02T10:00:00Z";
const YESTERDAY = "2026-08-01T10:00:00Z";

function asset(overrides: Partial<PipelineAsset>): PipelineAsset {
  return {
    draftId: "d1",
    runId: "r1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: null,
    capturedAt: null,
    generatedAt: YESTERDAY,
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "Deterministic-video explainer",
    ...overrides,
  };
}

function pick(overrides: Partial<IntelPickWire>): IntelPickWire {
  return {
    captureId: "c1",
    at: TODAY_10,
    title: "Rendered our whole launch video from HTML",
    family: "video",
    score: 0.9,
    source: "reddit",
    thumbnailUrl: null,
    ...overrides,
  };
}

function createRun(overrides: Partial<CreateRunWire>): CreateRunWire {
  return {
    id: "cr1",
    family: "video",
    mode: "one_prompt",
    brief: { prompt: "Launch film" },
    plan: null,
    children: [],
    status: "running",
    lastError: null,
    createdAt: "2026-08-02T14:59:36Z",
    ...overrides,
  };
}

function runRow(overrides: Partial<RunRow>): RunRow {
  return {
    id: "fr1",
    href: "/app/runs",
    lead: "LinkedIn · X",
    platforms: ["linkedin"],
    excerpt: "",
    excerptError: false,
    liveHref: null,
    pill: { tone: "idle", label: "running" },
    thumb: null,
    at: new Date("2026-08-02T14:58:00Z"),
    failed: false,
    published: false,
    retryable: false,
    live: true,
    waiting: 0,
    ...overrides,
  };
}

const EMPTY: BoardViewInput = {
  picks: [],
  runs: [],
  createRuns: [],
  assets: [],
  slots: [],
  now: NOW,
};

describe("boardColumns — the loop order and the sheet's labels", () => {
  it("draws six columns in loop order with the sheet's own heads", () => {
    const columns = boardColumns(EMPTY);
    expect(columns.map((c) => c.id)).toEqual([
      "picks",
      "generating",
      "judge",
      "approve",
      "scheduled",
      "published",
    ]);
    expect(columns.map((c) => c.label)).toEqual([
      "Intel picks",
      "Generating",
      "At the judge",
      "In Approve",
      "Scheduled",
      "Published",
    ]);
  });

  it("In Approve is the ONE warn column — the one human gate", () => {
    const columns = boardColumns(EMPTY);
    expect(columns.find((c) => c.id === "approve")?.warn).toBe(true);
    expect(columns.filter((c) => c.warn).length).toBe(1);
  });

  it("bounds cards at COLUMN_CARD_BOUND while count stays the total (Bounded-List Rule)", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      asset({ draftId: `d${i}`, status: "queued" }),
    );
    const approve = boardColumns({ ...EMPTY, assets: many }).find((c) => c.id === "approve");
    expect(approve?.cards.length).toBe(COLUMN_CARD_BOUND);
    expect(approve?.count).toBe(20);
  });
});

describe("pickCards — picks only, the operator's own order", () => {
  it("renders newest first with the picked family and the source-named thumb", () => {
    const cards = pickCards([
      pick({ captureId: "c1", at: "2026-08-02T09:00:00Z" }),
      pick({ captureId: "c2", at: "2026-08-02T11:00:00Z", family: "post", source: "youtube" }),
    ]);
    expect(cards[0].id).toBe("pick-c2");
    expect(cards[0].meta).toEqual([{ text: "picked · post" }]);
    expect(cards[0].thumb).toBe("youtube");
    expect(cards[1].meta).toEqual([{ text: "picked · video" }]);
  });

  it("a real thumbnail replaces the striped placeholder, never joins it", () => {
    const [card] = pickCards([pick({ thumbnailUrl: "https://cdn.example/t.jpg" })]);
    expect(card.thumbUrl).toBe("https://cdn.example/t.jpg");
    expect(card.thumb).toBeNull();
  });
});

describe("generatingCards — in-flight work from both reads plus drafting drafts", () => {
  it("carries live fanout runs, live create runs, and generated drafts with real elapsed", () => {
    const cards = generatingCards(
      [runRow({})],
      [createRun({})],
      [asset({ draftId: "dg", status: "generated", generatedAt: "2026-08-02T14:59:36Z" })],
      NOW,
    );
    expect(cards.map((c) => c.id)).toEqual(["run-fr1", "create-cr1", "dg"]);
    // Real seconds math — the sheet's "24s in" is arithmetic, never a fixture.
    expect(cards[1].meta[0].text).toBe("24s in");
    expect(cards[2].pill?.label).toBe("drafting");
  });

  it("a create run renders doorless — no detail surface exists, so no dead door", () => {
    const [card] = generatingCards([], [createRun({})], [], NOW);
    expect(card.href).toBeNull();
  });

  it("finished runs and non-generated drafts stay out of the column", () => {
    const cards = generatingCards(
      [runRow({ live: false })],
      [createRun({ status: "succeeded" })],
      [asset({ status: "queued" })],
      NOW,
    );
    expect(cards).toEqual([]);
  });
});

describe("judgeCards — the gates n/m chip", () => {
  it("says gates passed/total for the current body hash", () => {
    const [card] = judgeCards(
      [
        asset({
          status: "judging",
          gates: [
            { gate: "g1", verdict: "pass" },
            { gate: "g2", verdict: "pass" },
            { gate: "g3", verdict: "pending" },
            { gate: "g4", verdict: "pending" },
          ],
        }),
      ],
      NOW,
    );
    expect(card.pill?.label).toBe("gates 2/4");
    expect(card.meta[0].text).toBe("running");
  });

  it("a draft the judge has not gated yet says so instead of 0/0", () => {
    const [card] = judgeCards([asset({ status: "judging", gates: [] })], NOW);
    expect(card.pill?.label).toBe("at the judge");
  });
});

describe("approveColumnCards — the human gate, judge verdict on every card", () => {
  it("a queued card carries ✓ judge and the platform·age meta", () => {
    const [card] = approveColumnCards(
      [asset({ status: "queued", judgedAt: "2026-08-02T13:00:00Z" })],
      NOW,
    );
    expect(card.pill).toEqual({ tone: "ok", label: "✓ judge" });
    expect(card.meta[0].text).toMatch(/^LinkedIn · /);
    expect(card.reason).toBeUndefined();
  });

  it("a blocked card leads with its own title in the error channel and the judge's line VERBATIM", () => {
    const reason =
      "Grounding — final: Ships every platform — no provided source supports this claim.";
    const [card] = approveColumnCards(
      [asset({ status: "blocked", reasons: [reason], excerpt: "Works with every platform" })],
      NOW,
    );
    expect(card.titleError).toBe(true);
    expect(card.title).toBe("Works with every platform");
    expect(card.reason).toBe(reason);
    expect(card.pill).toEqual({ tone: "err", label: "✗ judge" });
    expect(card.meta[0].text).toMatch(/^your edit · /);
  });

  it("staged artifacts are not this column's work (founder ruling, s79 close)", () => {
    const cards = approveColumnCards(
      [asset({ status: "queued", format: "storyboard" })],
      NOW,
    );
    expect(cards).toEqual([]);
  });
});

describe("scheduledCards — plans forward in time, decided work never lost", () => {
  const slot: PlannedSlotWire = {
    draftId: "d1",
    platform: "facebook",
    scheduledFor: "2026-08-07T18:00:00",
    note: null,
  };

  it("a slot card wears the sheet's time grammar and the unarmed-door word", () => {
    const [card] = scheduledCards(
      [slot],
      [asset({ draftId: "d1", platform: "facebook", excerpt: "Launch film post" })],
    );
    expect(card.title).toBe("Launch film post · Facebook");
    expect(card.meta[0]).toEqual({ text: slotTimeLabel(new Date(slot.scheduledFor)), data: true });
    expect(card.meta[1].text).toBe("door unarmed — a plan");
  });

  it("an approved draft with no slot stays on the board as ready-to-plan", () => {
    const cards = scheduledCards(
      [],
      [asset({ draftId: "da", status: "approved", decidedAt: TODAY_10 })],
    );
    expect(cards.length).toBe(1);
    expect(cards[0].meta[0].text).toBe("ready to plan — no slot yet");
  });

  it("an approved draft WITH a slot renders once, as its slot", () => {
    const cards = scheduledCards(
      [slot],
      [asset({ draftId: "d1", status: "approved", decidedAt: TODAY_10 })],
    );
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe("slot-d1");
  });
});

describe("publishedCards — newest first, live doors only when recorded", () => {
  it("orders newest first and says view-live only with a deploy ref", () => {
    const cards = publishedCards(
      [
        asset({ draftId: "p1", publishedAt: "2026-07-19T10:00:00Z" }),
        asset({
          draftId: "p2",
          publishedAt: TODAY_10,
          deployRef: "https://site.example/blog/x",
        }),
      ],
      NOW,
    );
    expect(cards.map((c) => c.id)).toEqual(["p2", "p1"]);
    expect(cards[0].meta[0].text).toBe("view live ↗ · today");
    expect(cards[0].href).toBe("https://site.example/blog/x");
    // No deploy ref recorded: the day alone — never an invented live link.
    expect(cards[1].meta[0].text).toBe("19 Jul");
  });
});

describe("the feet — the day's recorded crossings, '–' where no read carries one", () => {
  it("counts today's instants only", () => {
    expect(todayCount([TODAY_10, YESTERDAY, null, undefined], NOW)).toBe(1);
  });

  it("picks: in = today's picks; out is not on the wire", () => {
    const foot = boardColumns({
      ...EMPTY,
      picks: [pick({ at: TODAY_10 }), pick({ captureId: "c2", at: YESTERDAY })],
    }).find((c) => c.id === "picks")?.foot;
    expect(foot).toEqual({ in: 1, out: null });
    expect(footText(foot!)).toBe("1 in · – out");
  });

  it("generating: in = runs started today (both reads); out = drafts generated today", () => {
    const foot = boardColumns({
      ...EMPTY,
      runs: [runRow({ at: new Date(TODAY_10) }), runRow({ id: "fr2", at: new Date(YESTERDAY) })],
      createRuns: [createRun({ createdAt: TODAY_10 })],
      assets: [asset({ generatedAt: TODAY_10 }), asset({ draftId: "d2", generatedAt: YESTERDAY })],
    }).find((c) => c.id === "generating")?.foot;
    expect(foot).toEqual({ in: 2, out: 1 });
  });

  it("generation's out IS the judge's in — the same recorded instant, two sides", () => {
    const columns = boardColumns({
      ...EMPTY,
      assets: [asset({ generatedAt: TODAY_10 })],
    });
    expect(columns.find((c) => c.id === "generating")?.foot.out).toBe(1);
    expect(columns.find((c) => c.id === "judge")?.foot.in).toBe(1);
  });

  it("approve: in = judged today, out = decisions today", () => {
    const foot = boardColumns({
      ...EMPTY,
      assets: [
        asset({ judgedAt: TODAY_10 }),
        asset({ draftId: "d2", status: "approved", decidedAt: TODAY_10 }),
      ],
    }).find((c) => c.id === "approve")?.foot;
    expect(foot).toEqual({ in: 1, out: 1 });
  });

  it("scheduled: no read records the planned-at instant — in stays '–'", () => {
    const foot = boardColumns(EMPTY).find((c) => c.id === "scheduled")?.foot;
    expect(foot?.in).toBeNull();
    expect(footText(foot!)).toBe("– in · 0 out");
  });

  it("published: the sheet's own right side — 'last Thu' when nothing landed today", () => {
    const thursday = "2026-07-30T09:00:00Z";
    const foot = boardColumns({
      ...EMPTY,
      assets: [asset({ publishedAt: thursday })],
    }).find((c) => c.id === "published")?.foot;
    expect(footText(foot!)).toBe(`0 in · last ${publishedDayLabel(new Date(thursday), NOW)}`);
  });

  it("an unresolved read renders every side it feeds as '–', never 0", () => {
    const columns = boardColumns({ ...EMPTY, picks: null, runs: null, createRuns: null });
    expect(footText(columns.find((c) => c.id === "picks")!.foot)).toBe("– in · – out");
    expect(columns.find((c) => c.id === "generating")?.foot.in).toBeNull();
  });
});

describe("the small grammars", () => {
  it("ageLabel keeps the sheet's hour honesty — 26h, never 1d", () => {
    expect(ageLabel(new Date(NOW.getTime() - 26 * 3_600_000), NOW)).toBe("26h");
    expect(ageLabel(new Date(NOW.getTime() - 45 * 60_000), NOW)).toBe("45m");
  });

  it("ageLabel rolls to days at 48h — 380h hides sixteen days behind arithmetic (s93 Mobbin re-check)", () => {
    expect(ageLabel(new Date(NOW.getTime() - 47 * 3_600_000), NOW)).toBe("47h");
    expect(ageLabel(new Date(NOW.getTime() - 48 * 3_600_000), NOW)).toBe("2d");
    expect(ageLabel(new Date(NOW.getTime() - 380 * 3_600_000), NOW)).toBe("15d");
  });

  it("publishedDayLabel: today · short weekday inside the week · date beyond it", () => {
    expect(publishedDayLabel(new Date("2026-08-02T09:00:00Z"), NOW)).toBe("today");
    expect(publishedDayLabel(new Date("2026-07-30T09:00:00Z"), NOW)).toBe("Thu");
    expect(publishedDayLabel(new Date("2026-07-19T09:00:00Z"), NOW)).toBe("19 Jul");
  });
});
