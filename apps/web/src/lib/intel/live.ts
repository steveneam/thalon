import { readSweepBundle, type SweepBundle, type SweepCard } from "@thalon/engine";
import type { SweepStamp, TrendCard } from "./types";

/**
 * The live half of the Trends read (B6.5): the poller (`runTrendSweep`)
 * persists a wire-ready bundle at `sweeps/<tenantId>.json`; this module
 * reads it back (schema-validated in the engine) and maps its cards onto
 * the SAME TrendCard wire shape the fixture dataset uses — the components
 * don't know which era they're rendering. Null before the first sweep, and
 * the route falls back to the demo dataset with its visible banner.
 */

export async function readLiveSweep(tenantId: string): Promise<SweepBundle | null> {
  return readSweepBundle(tenantId);
}

export function toTrendCard(card: SweepCard): TrendCard {
  return {
    id: card.id,
    source: card.source,
    externalId: card.externalId,
    url: card.url,
    text: card.text,
    account: card.account,
    publishedAt: new Date(card.publishedAtMs).toISOString(),
    areaName: card.areaName,
    score: card.score,
    reasons: card.reasons,
    isOutlier: card.isOutlier,
    shareToView: card.shareToView,
    bookmarkToView: card.bookmarkToView,
    metrics: card.metrics,
    dossier: card.dossier,
  };
}

/** Card lookup for the action routes (dismiss/promote): live bundle first; null falls back to the fixture path. */
export async function findLiveTrendCard(tenantId: string, cardId: string): Promise<TrendCard | null> {
  const bundle = await readSweepBundle(tenantId);
  const card = bundle?.cards.find((c) => c.id === cardId);
  return card ? toTrendCard(card) : null;
}

export function liveSweepStamp(bundle: SweepBundle): SweepStamp {
  return {
    lastSweptAt: new Date(bundle.sweptAtMs).toISOString(),
    intervalHours: Math.round(bundle.intervalMs / 3_600_000),
    nextSweepAt: new Date(bundle.nextSweepAtMs).toISOString(),
  };
}
