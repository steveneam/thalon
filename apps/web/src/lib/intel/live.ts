import {
  mergeSweepCards,
  readSweepBundle,
  readSweepBundles,
  type SweepBundle,
  type SweepCard,
} from "@thalon/engine";
import type { SweepStamp, TrendCard } from "./types";

/**
 * The live half of the Trends read (B6.5; honest multi-source since
 * B-learn L2 slice 1): the poller (`runTrendSweep`) persists one
 * wire-ready bundle PER SOURCE (`sweeps/<tenantId>.<source>.json`); this
 * module reads them ALL back (schema-validated in the engine, legacy
 * single-pointer fallback for pre-slice stores) and maps the merged
 * score-ordered union onto the SAME TrendCard wire shape the fixture
 * dataset uses — the components don't know which era they're rendering.
 * Empty before the first sweep, and the route falls back to the demo
 * dataset with its visible banner.
 */

export async function readLiveSweeps(tenantId: string): Promise<SweepBundle[]> {
  return readSweepBundles(tenantId);
}

/** The single freshest bundle (legacy last-swept pointer) — the workspace plan's cadence stamp; the trends read uses the merged plural above. */
export async function readLiveSweep(tenantId: string): Promise<SweepBundle | null> {
  return readSweepBundle(tenantId);
}

export function toTrendCard(card: SweepCard, sweptAtMs?: number): TrendCard {
  return {
    id: card.id,
    source: card.source,
    externalId: card.externalId,
    url: card.url,
    thumbnailUrl: card.thumbnailUrl,
    // When WE saw this ref, which is what a captured thumbnail's provenance
    // means — not when the platform published the item. Absent on fixture
    // cards, which is honest: nothing swept them.
    ...(sweptAtMs === undefined ? {} : { capturedAt: new Date(sweptAtMs).toISOString() }),
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

/** The merged live cards, wire-shaped — score-ordered union across every swept source. */
export function mergedTrendCards(bundles: readonly SweepBundle[]): TrendCard[] {
  // The merge flattens bundles and keeps the highest-scoring instance of an
  // id, so the owning bundle's sweep stamp is lost by the time we map. Carry
  // it here: for an id seen in several sweeps the LATEST stamp is the honest
  // answer, since that is when we most recently saw the ref alive.
  const sweptAtMs = new Map<string, number>();
  for (const bundle of bundles) {
    for (const card of bundle.cards) {
      sweptAtMs.set(card.id, Math.max(sweptAtMs.get(card.id) ?? 0, bundle.sweptAtMs));
    }
  }
  return mergeSweepCards(bundles).map((card) => toTrendCard(card, sweptAtMs.get(card.id)));
}

/** Card lookup for the action routes (dismiss/promote): EVERY source's live bundle; null falls back to the fixture path. */
export async function findLiveTrendCard(tenantId: string, cardId: string): Promise<TrendCard | null> {
  const card = mergeSweepCards(await readSweepBundles(tenantId)).find((c) => c.id === cardId);
  return card ? toTrendCard(card) : null;
}

export function liveSweepStamp(bundle: SweepBundle): SweepStamp {
  return {
    lastSweptAt: new Date(bundle.sweptAtMs).toISOString(),
    intervalHours: Math.round(bundle.intervalMs / 3_600_000),
    nextSweepAt: new Date(bundle.nextSweepAtMs).toISOString(),
  };
}

/** Per-source sweep stamps for the trends read — each swept platform's own honesty line (additive wire field). */
export function sourceSweepStamps(
  bundles: readonly SweepBundle[],
): Array<{ source: string; lastSweptAt: string; cards: number }> {
  return bundles.map((bundle) => ({
    source: bundle.source,
    lastSweptAt: new Date(bundle.sweptAtMs).toISOString(),
    cards: bundle.cards.length,
  }));
}
