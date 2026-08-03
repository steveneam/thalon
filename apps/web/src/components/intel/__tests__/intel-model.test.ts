import { describe, expect, it } from "vitest";
import {
  bandOf,
  HEADLINE_MAX,
  headlineOf,
  parseReason,
  reasonViews,
  sourceLabel,
  sweepStamp,
  toDossierView,
  toRisingView,
} from "@/components/intel/intel-model";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import type { TrendsPayload } from "@/lib/intel/types";

// The fixture dataset's own clock (lib/intel/fixtures BASE_MS) — card ages
// then read exactly as the sheet writes them.
const NOW = Date.UTC(2026, 6, 5, 9, 0, 0);

function payload(over: Partial<TrendsPayload>): TrendsPayload {
  return {
    areas: [],
    cards: [],
    demo: true,
    sweep: { lastSweptAt: new Date(NOW - 2 * 3_600_000).toISOString(), intervalHours: 4, nextSweepAt: null },
    sources: [],
    ...over,
  };
}

describe("intel view model (the sheet's own rows, built from the wire)", () => {
  it("parses the ranker's reason grammar without inventing prose", () => {
    // The four shapes packages/engine/src/trend/ranker.ts emits.
    expect(parseReason('relevance 0.81 to area "AI content automation" (embedding cosine 0.62)')).toEqual({
      name: "Relevance 0.81",
      score: 0.81,
      text: 'to area "AI content automation"',
      title: 'relevance 0.81 to area "AI content automation" (embedding cosine 0.62)',
    });
    expect(
      parseReason("engagement 0.71 (shares/views 0.025 vs threshold 0.01; bookmarks/views 0.042 vs threshold 0.02)"),
    ).toMatchObject({ name: "Engagement 0.71", text: "shares/views 0.025 vs threshold 0.01" });
    expect(
      parseReason("velocity 0.85 (sweep 4615.38 views/h vs 3× account baseline 202.5 views/h; Δ 15000 views/h between sweeps vs 3× stored baseline 125 views/h)"),
    ).toMatchObject({ text: "sweep 4615.38 views/h vs 3× account baseline 202.5 views/h" });
    expect(parseReason("freshness 0.84 (published 6h ago, half-life 24h)")).toMatchObject({
      name: "Freshness 0.84",
      text: "published 6h ago, half-life 24h",
    });
  });

  it("keeps the scoreless 'disarmed' reason honest instead of scoring it", () => {
    const disarmed = parseReason("relevance disarmed (no item text to embed)");
    expect(disarmed).toMatchObject({ name: "Relevance", score: 0 });
    expect(disarmed.title).toBe("relevance disarmed (no item text to embed)");
  });

  it("orders reason rows by score and ramps their colour by rank, like the sheet", () => {
    const rows = reasonViews([
      "freshness 0.92 (published 3h ago, half-life 24h)",
      'relevance 0.84 to area "Short-form video tooling" (embedding cosine 0.68)',
      "velocity 0.92 (sweep 8210.5 views/h vs 3× account baseline 154.2 views/h)",
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Freshness 0.92", "Velocity 0.92", "Relevance 0.84"]);
    expect(rows.map((r) => r.heat)).toEqual([
      "var(--heat-hot)",
      "var(--heat-rising)",
      "var(--heat-warm)",
    ]);
    expect(rows.map((r) => r.percent)).toEqual([92, 92, 84]);
  });

  it("wears the thermal word-in-pill — the word is the text channel", () => {
    expect(bandOf(0.9).word).toBe("Hot");
    expect(bandOf(0.65)).toMatchObject({ word: "Rising", pill: "pill-heat-rising" });
    expect(bandOf(0.45).word).toBe("Warm");
    expect(bandOf(0.1)).toMatchObject({ word: "Cool", fill: "var(--heat-cool)" });
  });

  it("names platforms the way the sheet writes them", () => {
    expect(sourceLabel("youtube")).toBe("YouTube");
    expect(sourceLabel("bluesky")).toBe("Bluesky");
    expect(sourceLabel("mastodon")).toBe("Mastodon");
  });

  it("maps a trend card onto the dossier the sheet draws", () => {
    const card = fixtureTrendCards.find((c) => c.id === "demo-trend-3")!;
    const view = toDossierView(card, NOW);
    expect(view.band.word).toBe("Hot");
    expect(view.percent).toBe(90);
    expect(view.scoreTitle).toBe("rank score 0.90 of 1 — Short-form video tooling");
    expect(view.isOutlier).toBe(true);
    expect(view.freshness).toBe("rising 3h · catchable");
    expect(view.prov).toMatchObject({
      account: "framecraft.example",
      views: "24.6k views",
      age: "3h ago",
      sourceLabel: "Bluesky",
      areaName: "Short-form video tooling",
    });
    // No driver thumbnail on demo cards — the sheet's placeholder legend
    // stands in, and the resolution says `empty` rather than inventing one.
    expect(view.media).toEqual({ state: "empty" });
    expect(view.thumbLabel).toBe("post media");
    // A bluesky item is not video-native, so the suggested exit is the post door.
    expect(view.suggested.family).toBe("post");
  });

  // Founder report s99: a live YouTube card wore its whole title+description+
  // transcript blob as the h2. The headline is the first line — the TrendItem
  // contract's title position — and the verbatim text demotes to hover truth.
  it("never wears the whole transcript as the headline — first line only, verbatim in the hover", () => {
    const card = fixtureTrendCards.find((c) => c.id === "demo-trend-3")!;
    const blob = "Why the US Is Restricting AI\nDiscover how the landscape is shifting.\n" + "spoken hook ".repeat(150);
    const view = toDossierView({ ...card, text: blob }, NOW);
    expect(view.headline).toBe("Why the US Is Restricting AI");
    expect(view.fullText).toBe(blob);
    const rising = toRisingView({ ...card, text: blob }, NOW);
    expect(rising.text).toBe("Why the US Is Restricting AI");
    expect(rising.fullText).toBe(blob);
  });

  it("cuts a single-line post at a word boundary and keeps a short one whole", () => {
    const long = "word ".repeat(60).trim();
    const cut = headlineOf(long);
    expect(cut.length).toBeLessThanOrEqual(HEADLINE_MAX + 1);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toContain("wor…"); // word boundary, never mid-word
    const card = fixtureTrendCards.find((c) => c.id === "demo-trend-3")!;
    const short = toDossierView(card, NOW);
    expect(short.headline).toBe(card.text);
    expect(short.fullText).toBeUndefined();
  });

  it("builds the rising row's mono data stamp, and drops what the source didn't report", () => {
    const card = fixtureTrendCards.find((c) => c.id === "demo-trend-2")!;
    expect(toRisingView(card, NOW).data).toBe("Bluesky · 9.4k · 14h ago");
    expect(toRisingView({ ...card, metrics: {} }, NOW).data).toBe("Bluesky · 14h ago");
    expect(toRisingView({ ...card, source: "youtube" }, NOW).thumbLabel).toBe("yt thumb");
  });
});

describe("the sweep stamp (honest in both eras)", () => {
  it("names the demo era instead of implying a live sweep", () => {
    const { text, title } = sweepStamp(payload({ demo: true }), NOW);
    expect(text).toBe("Swept 2h ago · no next sweep scheduled · demo dataset — no live sweep yet");
    expect(title).toBeUndefined();
  });

  it("names every swept platform, with its own stamp in the hover title", () => {
    const { text, title } = sweepStamp(
      payload({
        demo: false,
        sweep: {
          lastSweptAt: new Date(NOW - 2 * 3_600_000).toISOString(),
          intervalHours: 4,
          nextSweepAt: new Date(NOW + 4 * 3_600_000).toISOString(),
        },
        sources: [
          { source: "youtube", lastSweptAt: new Date(NOW - 2 * 3_600_000).toISOString(), cards: 12 },
          { source: "bluesky", lastSweptAt: new Date(NOW - 9 * 3_600_000).toISOString(), cards: 4 },
        ],
      }),
      NOW,
    );
    expect(text).toBe("Swept 2h ago · next in 4h · YouTube + Bluesky");
    // The merged read's per-source truth: bluesky is SEVEN HOURS staler than
    // the headline stamp, and says so rather than riding YouTube's freshness.
    expect(title).toBe("YouTube: 12 cards, swept 2h ago\nBluesky: 4 cards, swept 9h ago");
  });

  it("says a due sweep is due, and never invents a next one", () => {
    const due = sweepStamp(
      payload({ demo: false, sweep: { lastSweptAt: new Date(NOW - 5 * 3_600_000).toISOString(), intervalHours: 4, nextSweepAt: new Date(NOW - 3_600_000).toISOString(), dueNow: true }, sources: [{ source: "bluesky", lastSweptAt: new Date(NOW - 5 * 3_600_000).toISOString(), cards: 2 }] }),
      NOW,
    );
    expect(due.text).toBe("Swept 5h ago · sweep due now · Bluesky");
    const none = sweepStamp(payload({ demo: false, sources: [] }), NOW);
    expect(none.text).toBe("Swept 2h ago · no next sweep scheduled");
  });
});
