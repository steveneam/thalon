import type { Watchlist } from "./watchlist";

/**
 * One item surfaced by a polling sweep. Extraction tiers are honestly
 * bounded (CHARTER B3.12 / amendment A7): `text` is whatever the platform's
 * OFFICIAL API hands over — full text on text platforms, title/description/
 * tags on video platforms. Spoken-hook transcripts arrive only via the
 * permitted B3.13 paths, never here.
 */
export interface TrendItem {
  /** Stable platform-native id (video id, post URI) — the idempotency/provenance anchor. */
  externalId: string;
  /** Canonical URL of the item, when the platform provides one. */
  url?: string;
  /** The extractable text for this platform tier. */
  text: string;
  /** Account/author handle the item belongs to — the velocity baseline group. */
  account: string;
  /** Publish time, ms epoch — the velocity denominator. */
  publishedAt: number;
  /** Engagement counters, platform-generic name/value (SPINE §4.1: metric names are data, never hard-coded). */
  metrics: Record<string, number>;
}

/**
 * B3.12 intake seam (CHARTER B3.12; skeleton in pass 1 per amendment A9). A
 * trend source runs ONE polling sweep for one watchlist against an OFFICIAL
 * platform API and never persists anything — only ./intake.ts, the core
 * caller, writes (SPINE §1, same read-only driver contract as every other
 * seam). Real drivers land behind this interface in pass 2 (YouTube Data
 * API first — free quota; AT Protocol/Bluesky next; X API v2 when funded);
 * ./fake-source.ts is the deterministic keyless test double. Audio ripping
 * and proxy-cluster scraping are rejected architectures (ADR 0002) — a
 * driver that isn't an official API does not belong behind this seam.
 */
export interface TrendSource {
  readonly name: string;
  poll(watchlist: Watchlist): Promise<TrendItem[]>;
}
