import { z } from "zod";

/**
 * B6.4 (amendment A12 / ADR 0005): operator-described monitored AREAS — the
 * un-built "niches" third of the chartered B3.12 watchlist, per-tenant
 * RUNTIME CONFIG, never code. An area is a name plus a free-text
 * description; the description is load-bearing data — it seeds the
 * deterministic area→query expansion (candidate generation) and is the
 * embedding anchor the ranker scores relevance against. Durable storage is
 * `monitored_areas` (packages/db schema/intel.ts); these schemas are the
 * validated shape at every boundary (UI forms, repos, engine intake).
 */

/** Zero is legal ("turn this signal off" is config); negative amplification is not. */
const weight = z.number().min(0);

/**
 * The EdgeRank-shaped ranker weights (ADR 0005 decision 3): score =
 * config-weighted combination of relevance-to-area (embedding cosine) ×
 * engagement ratios × velocity/freshness — deterministic math + embeddings,
 * never neural machinery. All weights are per-tenant/per-area config;
 * defaults weight every signal equally.
 */
export const rankerWeightsSchema = z.object({
  /** Embedding-cosine relevance of the item against the area description. */
  relevance: weight.default(1),
  /** The existing engagement-ratio signals (share-to-view, bookmark efficiency). */
  engagement: weight.default(1),
  /** Single-sweep velocity + longitudinal Δ-velocity vs account baseline. */
  velocity: weight.default(1),
  /** Recency decay from the item's publish time. */
  freshness: weight.default(1),
});
export type RankerWeights = z.infer<typeof rankerWeightsSchema>;

/**
 * The per-area OVERRIDE shape — deliberately not `rankerWeightsSchema.
 * partial()`: a defaulted field still fills on parse, which would silently
 * pin unset signals to 1 instead of deferring to the tenant default.
 */
export const rankerWeightOverridesSchema = z.object({
  relevance: weight.optional(),
  engagement: weight.optional(),
  velocity: weight.optional(),
  freshness: weight.optional(),
});
export type RankerWeightOverrides = z.infer<typeof rankerWeightOverridesSchema>;

/** Per-area tuning knobs; everything optional — tenant defaults apply when omitted. */
export const monitoredAreaConfigSchema = z.object({
  /** Ranker weight overrides for this area — unset signals keep the tenant default. */
  weights: rankerWeightOverridesSchema.optional(),
  /**
   * Per-sweep cap on discovery queries expanded from this area — the quota
   * ration (ADR 0005: YouTube `search.list` ≈100/day is its own scarce
   * bucket since June 2026; per-driver budgets are config, not code).
   */
  maxQueriesPerSweep: z.number().int().positive().optional(),
});
export type MonitoredAreaConfig = z.infer<typeof monitoredAreaConfigSchema>;

/** Lifecycle: paused areas stop expanding into queries but keep their history. */
export const MONITORED_AREA_STATUSES = ["active", "paused"] as const;
export type MonitoredAreaStatus = (typeof MONITORED_AREA_STATUSES)[number];

/** One monitored area as config-as-data — the validated create/update boundary shape. */
export const monitoredAreaSchema = z.object({
  name: z.string().min(1),
  /** Free-text: what the operator watches and why — the query-expansion seed AND the relevance-embedding anchor. */
  description: z.string().min(1),
  config: monitoredAreaConfigSchema.default({}),
});
export type MonitoredAreaInput = z.input<typeof monitoredAreaSchema>;
export type MonitoredArea = z.infer<typeof monitoredAreaSchema>;

// ---------------------------------------------------------------------------
// Intel captures (Phase-I window, s61): the operator-action spine the
// workspace already runs in memory (promote / dismiss / target-this /
// lead-promote all record a capture; Create resolves context FROM one)
// gains a durable shape. The payload stays an open record — capture
// context is per-family vocabulary (data), the KINDS list is the closed
// set the check constraint enforces.

export const CAPTURE_KINDS = [
  "trend_dismiss",
  "trend_promote",
  "search_target_this",
  "lead_promote",
] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

export function isCaptureKind(value: string): value is CaptureKind {
  return (CAPTURE_KINDS as readonly string[]).includes(value);
}

export const intelCaptureSchema = z.object({
  kind: z.enum(CAPTURE_KINDS),
  /** The structured context the capture carries (titles/angles/hook for a promote, the dismissed card for a dismiss) — open shape, per-family vocabulary. */
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type IntelCaptureInput = z.input<typeof intelCaptureSchema>;
export type IntelCaptureShape = z.infer<typeof intelCaptureSchema>;
