import type { HorizonCard, TrendCard } from "./types";

/**
 * The Intel demo dataset (B6.2): deterministic fixture cards so the surface
 * is never empty on a fresh checkout — the first-run stickiness rule
 * (docs/FRONTEND.md §3). Shapes and reason-string grammar mirror the
 * engine's OWN output byte-for-byte in style:
 *  - TrendCard reasons follow packages/engine/src/trend/ranker.ts;
 *  - HorizonCard rows extend packages/engine/src/search/fake-search-source.ts's
 *    demo queries through packages/engine/src/search/horizon.ts's rules.
 * The UI renders both with a visible "demo dataset" banner; B6.5 (live
 * pollers) / B6.7 (GSC) swap the route internals, not these components.
 */

/** Demo area names the fixture cards rank against (not db rows — the manager lists real areas). */
export const DEMO_AREA_NAMES = ["AI content automation", "Short-form video tooling"] as const;

const BASE_MS = Date.UTC(2026, 6, 5, 9, 0, 0);

function iso(offsetHours: number): string {
  return new Date(BASE_MS + offsetHours * 3_600_000).toISOString();
}

export const fixtureTrendCards: TrendCard[] = [
  {
    id: "demo-trend-1",
    source: "bluesky",
    externalId: "at://demo/post/3kx1",
    url: "https://example.com/demo/3kx1",
    text: "We let an agent draft every product update for a week — approval queue or chaos? Full breakdown with numbers.",
    account: "buildlog.example",
    publishedAt: iso(-6),
    areaName: "AI content automation",
    score: 0.87,
    reasons: [
      'relevance 0.81 to area "AI content automation" (embedding cosine 0.62)',
      "engagement 0.71 (shares/views 0.025 vs threshold 0.01; bookmarks/views 0.042 vs threshold 0.02)",
      "velocity 0.85 (sweep 4615.38 views/h vs 3× account baseline 202.5 views/h; Δ 15000 views/h between sweeps vs 3× stored baseline 125 views/h)",
      "freshness 0.84 (published 6h ago, half-life 24h)",
    ],
    isOutlier: true,
    shareToView: 0.025,
    bookmarkToView: 0.042,
    metrics: { views: 27_692, shares: 692, bookmarks: 1_163 },
  },
  {
    id: "demo-trend-2",
    source: "bluesky",
    externalId: "at://demo/post/3kx2",
    url: "https://example.com/demo/3kx2",
    text: "Hot take: 'grounded generation' is the only AI content feature that matters. Everything else is spam with extra steps.",
    account: "contentops.example",
    publishedAt: iso(-14),
    areaName: "AI content automation",
    score: 0.66,
    reasons: [
      'relevance 0.77 to area "AI content automation" (embedding cosine 0.54)',
      "engagement 0.62 (shares/views 0.018 vs threshold 0.01; bookmarks/views 0.028 vs threshold 0.02)",
      "freshness 0.67 (published 14h ago, half-life 24h)",
    ],
    isOutlier: false,
    shareToView: 0.018,
    bookmarkToView: 0.028,
    metrics: { views: 9_410, shares: 169, bookmarks: 263 },
  },
  {
    id: "demo-trend-3",
    source: "bluesky",
    externalId: "at://demo/post/3kx3",
    url: "https://example.com/demo/3kx3",
    text: "Rendered our whole launch video from HTML. No timeline editor, no export queue — a build step. Thread with the pipeline.",
    account: "framecraft.example",
    publishedAt: iso(-3),
    areaName: "Short-form video tooling",
    score: 0.9,
    reasons: [
      'relevance 0.84 to area "Short-form video tooling" (embedding cosine 0.68)',
      "engagement 0.74 (shares/views 0.031 vs threshold 0.01; bookmarks/views 0.05 vs threshold 0.02)",
      "velocity 0.92 (sweep 8210.5 views/h vs 3× account baseline 154.2 views/h)",
      "freshness 0.92 (published 3h ago, half-life 24h)",
    ],
    isOutlier: true,
    shareToView: 0.031,
    bookmarkToView: 0.05,
    metrics: { views: 24_631, shares: 764, bookmarks: 1_232 },
  },
  {
    id: "demo-trend-4",
    source: "bluesky",
    externalId: "at://demo/post/3kx4",
    text: "Captions with word-level timing are the cheapest retention win in short-form. Here's the ffmpeg + whisper recipe.",
    account: "clipsmith.example",
    publishedAt: iso(-30),
    areaName: "Short-form video tooling",
    score: 0.48,
    reasons: [
      'relevance 0.79 to area "Short-form video tooling" (embedding cosine 0.58)',
      "engagement 0.55 (shares/views 0.012 vs threshold 0.01; bookmarks/views 0.024 vs threshold 0.02)",
      "freshness 0.42 (published 30h ago, half-life 24h)",
    ],
    isOutlier: false,
    shareToView: 0.012,
    bookmarkToView: 0.024,
    metrics: { views: 5_113, shares: 61, bookmarks: 123 },
  },
];

/**
 * Extends the engine fake's three demo queries (fake-search-source.ts): the
 * horizon opportunity, the already-ranking brand query, the flat tail — plus
 * one near-miss so the tab shows why NOT-opportunities read differently.
 */
export const fixtureHorizonCards: HorizonCard[] = [
  {
    query: "what is content automation",
    page: "",
    snapshots: 2,
    position: 9,
    impressionsGrowth: 1.64,
    latestImpressions: 180,
    ctr: 0.005,
    expectedCtr: 0.03,
    reasons: [
      "position 9 is inside the horizon window 8–20 — page 1 is within reach",
      "impressions grew 1.64× to 180 across 2 snapshots (≥ 1.2×)",
      "ctr 0.005 is below 0.75× the expected 0.03 at position 9",
    ],
    isOpportunity: true,
  },
  {
    query: "ai video from prompt",
    page: "",
    snapshots: 2,
    position: 14,
    impressionsGrowth: 1.1,
    latestImpressions: 96,
    ctr: 0.008,
    expectedCtr: 0.015,
    reasons: ["position 14 is inside the horizon window 8–20 — page 1 is within reach"],
    isOpportunity: false,
  },
  {
    query: "acme motion studio",
    page: "",
    snapshots: 2,
    position: 1.4,
    impressionsGrowth: 1.05,
    latestImpressions: 220,
    ctr: 0.18,
    expectedCtr: 0.3,
    reasons: [],
    isOpportunity: false,
  },
  {
    query: "diy video editing",
    page: "",
    snapshots: 2,
    position: 46,
    impressionsGrowth: null,
    latestImpressions: 15,
    ctr: 0,
    expectedCtr: null,
    reasons: [],
    isOpportunity: false,
  },
];
