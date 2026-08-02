import { asJson } from "@/lib/approve-queue/client";

/**
 * Wire types for the Analytics read (`/api/analytics`) — the engine's
 * `AnalyticsReadModel` (packages/engine/src/social/metrics/read-model.ts)
 * with Dates as ISO strings (the lib/approve-queue/types.ts convention).
 * Name only what is actually there; the honesty semantics travel with the
 * shape: `value === null` and `value === 0` are DIFFERENT facts, an absence
 * always arrives with its reason and permanence, and `trend: null` means
 * draw NOTHING.
 */

export type MetricAbsenceWire =
  | "structural"
  | "retired"
  | "gated"
  | "permissioned"
  | "no_driver"
  | "deferred"
  | "not_collected";

export interface MetricCellWire {
  value: number | null;
  /** What went into `value`, each platform's own field name — the provenance the tooltips render verbatim. */
  parts: Array<{ label: string; value: number; platformField: string }>;
  reason?: string;
  absence?: MetricAbsenceWire;
  asOf: string | null;
}

export interface PostRowWire {
  publicationId: string;
  draftId: string;
  platform: string;
  externalPostId: string;
  publishedAt: string;
  audience: MetricCellWire;
  engagement: MetricCellWire;
  trend: { label: string; points: Array<{ at: string; value: number }> } | null;
  asOf: string | null;
}

export interface ChannelRowWire {
  platform: string;
  published: number;
  audience: MetricCellWire;
  engagement: MetricCellWire;
  reportsAudience: boolean;
  asOf: string | null;
}

export interface TileWire {
  value: number | null;
  previous: number | null;
  delta: number | null;
  /** Deliberately null when `previous` is 0 — a jump from nothing is not a percentage. */
  deltaPct: number | null;
  platformsReporting: string[];
  platformsNotReporting: Array<{ platform: string; reason: string; permanence: MetricAbsenceWire }>;
  asOf: string | null;
}

export interface AnalyticsModelWire {
  window: { from: string; to: string };
  previousWindow: { from: string; to: string };
  published: { count: number; previous: number; delta: number };
  audience: TileWire;
  engagement: TileWire;
  posts: PostRowWire[];
  channels: ChannelRowWire[];
  bound: { limit: number; windowDays: number; totalPublications: number; truncated: boolean };
}

/** `model: null` = the configured tenant is not seeded yet — the surface says so, never renders zeros. */
export async function fetchAnalytics(windowDays: number): Promise<AnalyticsModelWire | null> {
  const res = await fetch(`/api/analytics?windowDays=${windowDays}`);
  const body = await asJson<{ model: AnalyticsModelWire | null }>(res);
  return body.model ?? null;
}
