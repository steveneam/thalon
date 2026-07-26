import { describe, expect, it } from "vitest";
import {
  applyQueueView,
  batchScopeNote,
  checkGlyph,
  checkMarks,
  flattenQueue,
  formatStamp,
  formatWord,
  headWindow,
  platformLabel,
  rowQuote,
  rowTitle,
  statusPill,
  targetTerms,
  thumbLabel,
  versionStrip,
} from "@/components/approve/approve-model";
import { draft, run, verdict } from "@/lib/approve-queue/fixtures";

const RUN = run("11111111-1111-1111-1111-111111111111", "2026-07-04T09:00:00.000Z");

const CLIP_META = {
  windowIndex: 0,
  chunkSeqs: [1, 2],
  startMs: 12_000,
  endMs: 47_000,
  durationMs: 35_000,
  hook: "Hook",
  captions: "Captions",
  platformCopy: "Copy",
  promptVersion: "highlight-select.v1",
  brandProfileVersion: 1,
  platformProfileVersion: "brand-profile.v1",
};

describe("the sheet's copy grammar (Approve.dc.html)", () => {
  it("platforms read as their brand names, never the wire token", () => {
    expect(platformLabel("linkedin")).toBe("LinkedIn");
    expect(platformLabel("x")).toBe("X");
    expect(platformLabel("tiktok")).toBe("TikTok");
    // An unknown platform is capitalized, never renamed or dropped.
    expect(platformLabel("mastodon")).toBe("Mastodon");
  });

  it("format words follow the sheet: post · article · a clip's own window", () => {
    expect(formatWord(draft("d1", RUN.id, "linkedin", "body", "queued", "h"))).toBe("post");
    expect(
      formatWord(draft("d2", RUN.id, "blog", "body", "queued", "h", { format: "web_page" })),
    ).toBe("article");
    expect(
      formatWord(draft("d3", RUN.id, "linkedin", "body", "queued", "h", { format: "clip_plan", meta: CLIP_META })),
    ).toBe("clip 0:12–0:47");
    // Unknown formats read as their own token, never a fabricated word.
    expect(formatWord(draft("d4", RUN.id, "x", "body", "queued", "h", { format: "odd_thing" }))).toBe(
      "odd thing",
    );
  });

  it("the detail head's window is a clip's alone — no other format invents a stat", () => {
    expect(
      headWindow(draft("d3", RUN.id, "linkedin", "b", "queued", "h", { format: "clip_plan", meta: CLIP_META })),
    ).toBe("0:12–0:47 · 35s");
    expect(headWindow(draft("d1", RUN.id, "linkedin", "b", "queued", "h"))).toBeNull();
    // A clip_plan whose meta doesn't parse gets no invented window either.
    expect(
      headWindow(draft("d5", RUN.id, "linkedin", "b", "queued", "h", { format: "clip_plan", meta: {} })),
    ).toBeNull();
  });

  it("status pills: the sheet's three words on their channels; every other state keeps its own on neutral", () => {
    expect(statusPill("queued")).toEqual({ word: "Waiting", cls: "pill-warn" });
    expect(statusPill("blocked")).toEqual({ word: "Blocked", cls: "pill-err" });
    expect(statusPill("approved")).toEqual({ word: "Approved", cls: "pill-ok" });
    expect(statusPill("rejected")).toEqual({ word: "Rejected", cls: "pill-idle" });
    expect(statusPill("judging")).toEqual({ word: "Judging", cls: "pill-idle" });
  });

  it("media slots exist only where the draft references media (media-first, doctrine 1)", () => {
    expect(thumbLabel(draft("d3", RUN.id, "linkedin", "b", "queued", "h", { format: "clip_plan" }))).toBe(
      "clip frame",
    );
    expect(thumbLabel(draft("d2", RUN.id, "blog", "b", "queued", "h", { format: "web_page" }))).toBe(
      "page hero",
    );
    expect(thumbLabel(draft("d1", RUN.id, "linkedin", "b", "queued", "h"))).toBeNull();
  });

  it("the row quotes the body's next line after the hook; a one-line draft has nothing more to quote", () => {
    expect(rowTitle("Hook line\n\nSecond line")).toBe("Hook line");
    expect(rowQuote("Hook line\n\nSecond line")).toBe("Second line");
    expect(rowQuote("Hook line")).toBeNull();
    expect(rowTitle("   \nreal line")).toBe("(empty draft)");
  });

  it("stamps are the EXACT local date and time, and carry the year only when it isn't this one", () => {
    const now = new Date("2026-07-25T00:00:00.000Z");
    expect(formatStamp("2026-07-04T10:00:00.000Z", now)).toMatch(/^\d{1,2} Jul, \d{2}:\d{2}$/);
    expect(formatStamp("2025-07-04T10:00:00.000Z", now)).toMatch(/^\d{1,2} Jul 2025, \d{2}:\d{2}$/);
    // Deterministic, and an unparseable instant never renders as a fake date.
    expect(formatStamp("2026-07-04T10:00:00.000Z", now)).toBe(formatStamp("2026-07-04T10:00:00.000Z", now));
    expect(formatStamp("not-a-date", now)).toBe("—");
  });
});

describe("the queue view", () => {
  const older = draft("a", RUN.id, "linkedin", "A", "queued", "ha");
  const newer = { ...draft("b", RUN.id, "x", "B", "blocked", "hb"), createdAt: "2026-07-05T09:00:00.000Z" };

  it("flattens ascending by age with a stable tiebreak, and the view decides direction", () => {
    const flat = flattenQueue([[{ draft: newer, run: RUN }], [{ draft: older, run: RUN }]]);
    expect(flat.map((i) => i.draft.id)).toEqual(["a", "b"]);
    expect(applyQueueView(flat, "newest", "all").map((i) => i.draft.id)).toEqual(["b", "a"]);
    expect(applyQueueView(flat, "oldest", "all").map((i) => i.draft.id)).toEqual(["a", "b"]);
  });

  it("filters on the two triage states only", () => {
    const flat = flattenQueue([[{ draft: older, run: RUN }, { draft: newer, run: RUN }]]);
    expect(applyQueueView(flat, "oldest", "waiting").map((i) => i.draft.id)).toEqual(["a"]);
    expect(applyQueueView(flat, "oldest", "blocked").map((i) => i.draft.id)).toEqual(["b"]);
  });
});

/**
 * s79 A1 — measured live: the header read "13 waiting" beside "Approve all
 * waiting (2)" with nothing on screen naming the other 11. Both numbers are
 * true; the sentence between them was missing.
 */
describe("batchScopeNote — the gap between the two waiting counts", () => {
  it("says nothing when the two counts agree", () => {
    expect(batchScopeNote({ waiting: 4, batchable: 4, stagedWaiting: 0 })).toBeNull();
  });

  it("names the staged drafts batch approve leaves behind — the live 13-vs-2 case", () => {
    const note = batchScopeNote({ waiting: 13, batchable: 2, stagedWaiting: 11 });
    expect(note).toContain("2 of 13");
    expect(note).toContain("11 staged drafts");
  });

  it("names a narrowing filter separately, so staged work never explains a gap it did not cause", () => {
    const note = batchScopeNote({ waiting: 10, batchable: 3, stagedWaiting: 4 });
    expect(note).toContain("4 staged drafts");
    expect(note).toContain("3 sit outside this view");
  });

  it("singularises one staged draft", () => {
    expect(batchScopeNote({ waiting: 3, batchable: 2, stagedWaiting: 1 })).toContain(
      "1 staged draft advance",
    );
  });
});

describe("the version strip (VISIBLE PROVENANCE, plan §5 doctrine 4b)", () => {
  it("an unedited draft is v1, the engine's own", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "queued", "h1");
    expect(versionStrip(d, [verdict("g1", "pass", "h1")])).toEqual({
      total: 1,
      current: 1,
      edited: false,
      reJudged: true,
    });
  });

  it("an edit that the judge re-ran on is v2, attributed and stamped as re-judged", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "queued", "h2");
    const results = [
      { ...verdict("g1", "pass", "h1"), createdAt: "2026-07-04T09:00:00.000Z" },
      { ...verdict("g1", "pass", "h2"), createdAt: "2026-07-04T10:00:00.000Z" },
    ];
    expect(versionStrip(d, results)).toEqual({ total: 2, current: 2, edited: true, reJudged: true });
  });

  it("a current body with no verdicts is honestly its own, UN-judged version", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "judging", "h3");
    const results = [{ ...verdict("g1", "pass", "h1"), createdAt: "2026-07-04T09:00:00.000Z" }];
    expect(versionStrip(d, results)).toEqual({ total: 2, current: 2, edited: true, reJudged: false });
  });
});

describe("the checks band", () => {
  it("names the blocking gates, marks a failure ✗, and carries the reasons verbatim", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "blocked", "h");
    const marks = checkMarks(d, [
      verdict("g1", "pass", "h"),
      verdict("g3_screen", "pass", "h"),
      verdict("g3_final", "fail", "h", {
        claims: [
          { claim: "Works with every platform", verdict: "fail", evidence: "no provided source supports this claim" },
        ],
      }),
    ]);
    const byGate = Object.fromEntries(marks.map((m) => [m.gate, m]));
    expect(byGate.g1.label).toBe("Denylist");
    expect(checkGlyph(byGate.g1)).toBe("✓");
    expect(byGate.g3_final.label).toBe("Grounding — final — no provided source supports this claim");
    expect(checkGlyph(byGate.g3_final)).toBe("✗");
    expect(byGate.g3_final.advisory).toBe(false);
    expect(byGate.g3_final.lines).toEqual([
      "Works with every platform — no provided source supports this claim",
    ]);
  });

  it("the discoverability lens shows as an ADVISORY warning (◐), never a block, and names its targets", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "queued", "h", {
      meta: { targetTerms: ["AI", "content automation"] },
    });
    const marks = checkMarks(d, [
      verdict("g1", "pass", "h"),
      verdict("g3_screen", "pass", "h"),
      verdict("g3_final", "pass", "h"),
      verdict("discoverability", "fail", "h", {
        claims: [
          { claim: "term_coverage", verdict: "fail", evidence: '1/2 target terms present — missing: "content automation"' },
        ],
        notes: "advisory discoverability lens (Phase 2c) — never blocks",
      }),
    ]);
    const disco = marks.find((m) => m.gate === "discoverability");
    expect(disco?.advisory).toBe(true);
    expect(checkGlyph(disco!)).toBe("◐");
    expect(disco?.label).toBe('Discoverability — 1/2 target terms present — missing: "content automation"');
    expect(disco?.title).toContain("advisory — warns, never blocks");
    expect(disco?.title).toContain("targets: AI · content automation");
    expect(targetTerms(d)).toEqual(["AI", "content automation"]);
  });

  it("cadence BLOCKS — it wears the blocking ✗, never the advisory ◐", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "blocked", "h");
    const marks = checkMarks(d, [
      verdict("g1", "pass", "h"),
      verdict("g3_screen", "pass", "h"),
      verdict("g3_final", "pass", "h"),
      verdict("cadence", "fail", "h", {
        claims: [{ claim: "max_per_day", verdict: "fail", evidence: "2 of 2 posts already admitted today" }],
      }),
    ]);
    const cadence = marks.find((m) => m.gate === "cadence");
    expect(cadence?.advisory).toBe(false);
    expect(checkGlyph(cadence!)).toBe("✗");
    expect(cadence?.label).toBe("Cadence — 2 of 2 posts already admitted today");
  });

  it("only the CURRENT body's verdicts are live evidence (SPINE invariant I1)", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "queued", "h-new");
    const marks = checkMarks(d, [verdict("g1", "fail", "h-old")]);
    const g1 = marks.find((m) => m.gate === "g1");
    expect(g1?.status).toBe("pending");
    expect(g1?.lines).toEqual(["no verdict yet for the current body"]);
    expect(checkGlyph(g1!)).toBe("·");
  });

  it("a malformed evidence blob yields an honest fallback line, never a crash", () => {
    const d = draft("d", RUN.id, "linkedin", "body", "queued", "h");
    const marks = checkMarks(d, [verdict("g1", "pass", "h", { claims: "not-an-array" })]);
    expect(marks.find((m) => m.gate === "g1")?.lines).toEqual([
      "passed — no claims recorded for this check",
    ]);
  });
});
