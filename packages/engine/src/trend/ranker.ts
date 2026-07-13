import {
  rankerWeightsSchema,
  type RankerWeightOverrides,
  type RankerWeights,
} from "@thalon/contracts";
import { z } from "zod";
import type { LongitudinalScore } from "./longitudinal";
import type { OutlierConfig, ScoredItem } from "./outliers";
import type { TrendItem } from "./trend-source";

/**
 * B6.4 config-weighted ranker — the ranking half of intel v2's two-stage
 * pipeline (ADR 0005 decision 3, EdgeRank-shaped). PURE tested math: the
 * caller supplies embedding vectors (item text + area description), the
 * single-sweep scores (./outliers.ts) and the stored-history Δ-velocity
 * (./longitudinal.ts); nothing here touches a clock, a db, a driver, or a
 * model. Deliberately rejected (SPINE §1): neural two-tower models,
 * federated learning, GenAI-synthesized feed items — deterministic math +
 * embeddings is the honest fit at this scale.
 *
 * Every candidate scores against EVERY area, so one polled item yields one
 * ranked row per area — the Trends tab filters by area; the operator sees
 * WHY each row is rising via one reason string per armed signal.
 *
 * Signal shape: each component lives in [0, 1]. Threshold-relative signals
 * (engagement ratios, velocity multiples) use the saturating form
 * x / (x + threshold): exactly 0.5 AT the configured threshold, rising
 * asymptotically toward 1 — a 10× outlier still outranks a 2× one, with no
 * cap cliff. The final score is the weight-normalized sum over ARMED
 * signals only (a platform that reports no share counter disarms
 * engagement rather than dragging the score down — the same "missing
 * metric disarms its rule" convention as ./outliers.ts).
 */

export const rankerConfigSchema = z.object({
  /** Tenant-default weights (contracts rankerWeightsSchema) — per-area overrides ride each area. Zod 4 `.default` short-circuits the inner parse, so the default is the full output shape (the outlierConfigSchema.metricNames pattern). */
  weights: rankerWeightsSchema.default({ relevance: 1, engagement: 1, velocity: 1, freshness: 1 }),
  /** Freshness half-life: an item this many hours old scores 0.5 on the freshness signal. */
  freshnessHalfLifeHours: z.number().positive().default(24),
});
export type RankerConfigInput = z.input<typeof rankerConfigSchema>;
export type RankerConfig = z.infer<typeof rankerConfigSchema>;

/**
 * Weight resolution is exactly two layers: tenant default ← area override.
 * An UNSET override field keeps the tenant default — never the schema's
 * all-1 default (the contract's rankerWeightOverridesSchema exists
 * precisely so unset signals can be told apart from explicit values).
 */
export function resolveRankerWeights(
  tenantDefaults: RankerWeights,
  overrides?: RankerWeightOverrides,
): RankerWeights {
  return {
    relevance: overrides?.relevance ?? tenantDefaults.relevance,
    engagement: overrides?.engagement ?? tenantDefaults.engagement,
    velocity: overrides?.velocity ?? tenantDefaults.velocity,
    freshness: overrides?.freshness ?? tenantDefaults.freshness,
  };
}

/** Plain cosine over equal-dimension vectors; a zero vector has no direction and scores 0. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    throw new Error(
      `cosine similarity needs two equal-dimension non-empty vectors (got ${a.length} and ${b.length})`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RankableArea {
  id: string;
  name: string;
  /** Per-area weight overrides — unset signals keep the tenant default. */
  weights?: RankerWeightOverrides;
  /** Embedding vector of the area DESCRIPTION — the relevance anchor. */
  vector: readonly number[];
}

export interface RankableCandidate {
  /** Single-sweep scores from ./outliers.ts — engagement ratios + sweep velocity ride in unchanged. */
  scored: ScoredItem;
  /**
   * Embedding vector of the item text; `null` when the item has no
   * embeddable text (e.g. an image-only post) — relevance disarms for it,
   * the same "missing metric disarms its rule" convention as the ratios.
   * (Found live on staging 2026-07-13: an empty string in the embed batch
   * is a provider-level rejection that killed the whole sweep.)
   */
  vector: readonly number[] | null;
  /** Stored-history Δ-velocity from ./longitudinal.ts, when the caller has history to read. */
  longitudinal?: LongitudinalScore;
}

export interface RankedComponents {
  /** Embedding cosine vs the area description, mapped to [0,1]; null when the item had no text to embed. */
  relevance: number | null;
  /** Mean of the armed engagement-ratio signals; null when no ratio is armed. */
  engagement: number | null;
  /** Mean of the armed velocity signals (single-sweep + stored Δ); null when neither is armed. */
  velocity: number | null;
  /** Recency half-life decay from publish time. Always armed. */
  freshness: number;
}

export interface RankedCandidate {
  item: TrendItem;
  areaId: string;
  areaName: string;
  /** Weight-normalized sum over ARMED signals, in [0,1] — disarmed signals never dilute. */
  score: number;
  components: RankedComponents;
  /** The weights actually applied (tenant default ← area override) — operator-visible config provenance. */
  weights: RankerWeights;
  /** One line per armed signal — the operator sees WHY this is rising (ADR 0005: reason strings preserved). */
  reasons: string[];
}

/** 0.5 exactly at the threshold, asymptotic to 1 — non-positive values carry no signal. */
function saturate(value: number, threshold: number): number {
  if (value <= 0 || threshold <= 0) return 0;
  return value / (value + threshold);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

interface SignalPart {
  signal: number;
  detail: string;
}

/**
 * Ranks every candidate against every area. Deterministic: same inputs,
 * same rows in the same order — sorted score-descending with total
 * tie-breaks (externalId, then areaId), so replays and tests are stable.
 */
export function rankCandidates(
  candidates: readonly RankableCandidate[],
  areas: readonly RankableArea[],
  configInput: RankerConfigInput = {},
  outlierConfig: OutlierConfig,
  nowMs: number,
): RankedCandidate[] {
  const config = rankerConfigSchema.parse(configInput);
  const names = outlierConfig.metricNames;
  const ranked: RankedCandidate[] = [];

  for (const candidate of candidates) {
    const { scored } = candidate;
    const { item } = scored;

    // Engagement + velocity + freshness are area-independent — computed once
    // per candidate; only relevance (and the weights) vary per area.
    const engagementParts: SignalPart[] = [];
    if (scored.shareToView !== null) {
      engagementParts.push({
        signal: saturate(scored.shareToView, outlierConfig.shareToViewThreshold),
        detail: `${names.shares}/${names.views} ${round4(scored.shareToView)} vs threshold ${outlierConfig.shareToViewThreshold}`,
      });
    }
    if (scored.bookmarkToView !== null) {
      engagementParts.push({
        signal: saturate(scored.bookmarkToView, outlierConfig.bookmarkToViewThreshold),
        detail: `${names.bookmarks}/${names.views} ${round4(scored.bookmarkToView)} vs threshold ${outlierConfig.bookmarkToViewThreshold}`,
      });
    }
    const engagement =
      engagementParts.length > 0 ? round4(mean(engagementParts.map((p) => p.signal))) : null;

    const velocityParts: SignalPart[] = [];
    if (
      scored.velocity !== null &&
      scored.baselineVelocity !== null &&
      scored.baselineVelocity > 0
    ) {
      velocityParts.push({
        signal: saturate(scored.velocity, outlierConfig.velocityMultiple * scored.baselineVelocity),
        detail: `sweep ${round2(scored.velocity)} ${names.views}/h vs ${outlierConfig.velocityMultiple}× account baseline ${round2(scored.baselineVelocity)} ${names.views}/h`,
      });
    }
    const delta = candidate.longitudinal;
    if (
      delta &&
      delta.deltaVelocity !== null &&
      delta.baselineDeltaVelocity !== null &&
      delta.baselineDeltaVelocity > 0
    ) {
      velocityParts.push({
        signal: saturate(
          delta.deltaVelocity,
          outlierConfig.velocityMultiple * delta.baselineDeltaVelocity,
        ),
        detail: `Δ ${round2(delta.deltaVelocity)} ${names.views}/h between sweeps vs ${outlierConfig.velocityMultiple}× stored baseline ${round2(delta.baselineDeltaVelocity)} ${names.views}/h`,
      });
    }
    const velocity =
      velocityParts.length > 0 ? round4(mean(velocityParts.map((p) => p.signal))) : null;

    const ageHours = Math.max(0, (nowMs - item.publishedAt) / 3_600_000);
    const freshness = round4(2 ** (-ageHours / config.freshnessHalfLifeHours));
    const freshnessDetail = `published ${round2(ageHours)}h ago, half-life ${config.freshnessHalfLifeHours}h`;

    for (const area of areas) {
      const cosine = candidate.vector === null ? null : cosineSimilarity(candidate.vector, area.vector);
      const relevance = cosine === null ? null : round4((cosine + 1) / 2);
      const weights = resolveRankerWeights(config.weights, area.weights);

      const reasons: string[] = [
        relevance === null || cosine === null
          ? `relevance disarmed (no item text to embed)`
          : `relevance ${round2(relevance)} to area "${area.name}" (embedding cosine ${round2(cosine)})`,
      ];
      if (engagement !== null) {
        reasons.push(
          `engagement ${round2(engagement)} (${engagementParts.map((p) => p.detail).join("; ")})`,
        );
      }
      if (velocity !== null) {
        reasons.push(
          `velocity ${round2(velocity)} (${velocityParts.map((p) => p.detail).join("; ")})`,
        );
      }
      reasons.push(`freshness ${round2(freshness)} (${freshnessDetail})`);

      const armed: Array<[weight: number, signal: number]> = [];
      if (relevance !== null) armed.push([weights.relevance, relevance]);
      if (engagement !== null) armed.push([weights.engagement, engagement]);
      if (velocity !== null) armed.push([weights.velocity, velocity]);
      armed.push([weights.freshness, freshness]);
      const totalWeight = armed.reduce((sum, [w]) => sum + w, 0);
      const score =
        totalWeight === 0
          ? 0
          : round4(armed.reduce((sum, [w, s]) => sum + w * s, 0) / totalWeight);

      ranked.push({
        item,
        areaId: area.id,
        areaName: area.name,
        score,
        components: { relevance, engagement, velocity, freshness },
        weights,
        reasons,
      });
    }
  }

  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      compareStrings(a.item.externalId, b.item.externalId) ||
      compareStrings(a.areaId, b.areaId),
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
