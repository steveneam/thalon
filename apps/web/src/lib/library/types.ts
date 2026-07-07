/**
 * Library wire types (B6.5): what the /api/library routes serialize. The
 * workspace keeps its own thin shapes (the B5.4 doctrine — contracts + API
 * routes only in client code); the server side maps engine/db rows onto
 * these, so the client bundle never imports engine types.
 */

/** One timed transcript segment on the wire — untimed (plain-text) ingests carry no startMs/endMs. */
export interface WireSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface LibrarySourceRow {
  id: string;
  uri: string | null;
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
