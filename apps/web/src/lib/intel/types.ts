import type {
  MonitoredAreaConfig,
  MonitoredAreaStatus,
  SearchTargetOrigin,
  SearchTargetStatus,
} from "@thalon/contracts";

/**
 * Wire types for the Intel surface (B6.2 over the frozen B6.4/B6.8
 * contract). Dates cross the wire as ISO strings. TrendCard mirrors the
 * engine ranker's RankedCandidate rows and HorizonCard the horizon math's
 * HorizonScore — defined here as wire shapes because apps/web is
 * engine-free (contracts + API routes only, the B5.4 doctrine).
 */

export interface AreaRow {
  id: string;
  name: string;
  description: string;
  status: MonitoredAreaStatus;
  config: MonitoredAreaConfig;
  createdAt: string;
  updatedAt: string;
}

/** One ranked (item × area) row — the Trends tab card. */
export interface TrendCard {
  /** Stable card id (fixture id today; the ranked row's source identity once B6.5 arms). */
  id: string;
  source: string;
  externalId: string;
  url?: string;
  text: string;
  account: string;
  publishedAt: string;
  areaName: string;
  /** Weight-normalized [0,1] rank score. */
  score: number;
  /** One line per armed signal — the operator sees WHY (ranker.ts format). */
  reasons: string[];
  isOutlier: boolean;
  /** Engagement ratios for the card's stat strip. */
  shareToView: number | null;
  bookmarkToView: number | null;
  metrics: Record<string, number>;
}

export interface TrendsPayload {
  areas: AreaRow[];
  cards: TrendCard[];
  /** true while cards come from the built-in demo dataset (live pollers arm at B6.5). */
  demo: boolean;
}

export interface TargetRow {
  id: string;
  keyword: string;
  origin: SearchTargetOrigin;
  status: SearchTargetStatus;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** One (query × page) horizon series — the Search tab card (horizon.ts HorizonScore shape). */
export interface HorizonCard {
  query: string;
  /** "" = the site-level aggregate (the storage convention). */
  page: string;
  snapshots: number;
  position: number | null;
  impressionsGrowth: number | null;
  latestImpressions: number | null;
  ctr: number | null;
  expectedCtr: number | null;
  /** One line per rule that fired, verbatim from the math — never model vibes. */
  reasons: string[];
  isOpportunity: boolean;
}

export interface HorizonPayload {
  cards: HorizonCard[];
  /** true while cards come from the built-in demo dataset (GSC arms after the B6.7 deploy). */
  demo: boolean;
}

/** Operator intel actions captured for the feedback loop (dismiss/promote → eval rows in pass 3). */
export interface IntelCapture {
  id: string;
  kind: "trend_dismiss" | "trend_promote" | "search_target_this";
  /** What was acted on: a TrendCard id or a search query. */
  ref: string;
  at: string;
  payload: Record<string, unknown>;
}
