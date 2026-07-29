/**
 * Library wire types (B6.5): what the /api/library routes serialize. The
 * workspace keeps its own thin shapes (the B5.4 doctrine — contracts + API
 * routes only in client code); the server side maps engine/db rows onto
 * these, so the client bundle never imports engine types.
 */

import type { MediaResolution } from "@/lib/media/resolve";

/** One timed transcript segment on the wire — untimed (plain-text) ingests carry no startMs/endMs. */
export interface WireSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

/**
 * One entry of `sources.meta.areaRelevance` — the META-KEY MINI-CONTRACT
 * (session 19): written at ingest by the origination lane's rider (scored
 * against monitored-area descriptions via the B6.4 ranker's embedding
 * path), read here. Absent on pre-rider rows — surfaces degrade honestly.
 */
export interface AreaRelevance {
  areaId: string;
  areaName: string;
  /** 0–1 rank score — rendered in the thermal-heat grammar. */
  score: number;
  reason: string;
}

export interface LibrarySourceRow {
  id: string;
  uri: string | null;
  /** oEmbed title (sources.meta.title, mini-contract) — null on pre-rider rows: the URL stays the row's identity. */
  title: string | null;
  /**
   * The row's media, already RESOLVED (B-media.0): the Source-Link Rule's
   * visual identity as one state the surface renders rather than a URL it has
   * to interpret. `empty` on pre-rider rows and on non-visual sources — which
   * is the truth about them, not a degradation.
   */
  media: MediaResolution;
  /** Operator-set tags (sources.meta.tags) — empty on pre-rider rows. */
  tags: string[];
  /** Relevance to monitored areas (sources.meta.areaRelevance) — empty until the engine scores it. */
  areaRelevance: AreaRelevance[];
  /**
   * Whether the operator asked to AI-enhance THIS ingest (sources.meta
   * .aiEnhanced, written on both paths since s86 — free + deterministic by
   * default, founder ruling s79).
   *
   * Three states, and the third is the point: `true` = embedded, scored, and
   * semantically retrievable; `false` = ingested free, so an empty
   * `areaRelevance` above is a CHOICE and the surface can say so in words;
   * `undefined` = the row predates the key, and nothing is claimed about it.
   * Without this, `areaRelevance: []` is ambiguous between "chose free", "no
   * monitored areas" and "pre-rider row" — an absence with three causes that a
   * surface can only report honestly by staying silent.
   */
  aiEnhanced?: boolean;
  /** Which TranscriptProvider fetched it (sources.meta.transcriptProvider). */
  provider: string | null;
  segmentCount: number | null;
  createdAt: string;
}

export interface TranscriptPayload {
  sourceId: string;
  uri: string | null;
  provider: string | null;
  segments: WireSegment[];
}

/**
 * The transcript seam's honest status readout (names/booleans only — the
 * seam-status-card precedent, never secrets): which provider the env
 * selects, what's registered, and whether the hosted vendor is configured.
 */
export interface TranscriptSeamStatus {
  selected: string;
  registered: string[];
  /** TRANSCRIPT_VENDOR_URL + TRANSCRIPT_VENDOR_API_KEY both present. */
  vendorConfigured: boolean;
}

export interface LibraryPayload {
  sources: LibrarySourceRow[];
  seam: TranscriptSeamStatus;
}

export interface IngestResponse {
  sourceId: string;
  created: boolean;
  chunkCount: number;
  provider: string;
}
