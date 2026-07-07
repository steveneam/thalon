import type { Source } from "@thalon/db";
import { registeredTranscriptProviders } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import type { LibrarySourceRow, TranscriptSeamStatus } from "./types";

/** Source row → library wire row. Provider + segment count ride sources.meta (written by ingestVideoUrl). */
export function toLibraryRow(source: Source): LibrarySourceRow {
  const meta = (source.meta ?? {}) as Record<string, unknown>;
  return {
    id: source.id,
    uri: source.uri,
    provider: typeof meta.transcriptProvider === "string" ? meta.transcriptProvider : null,
    segmentCount: typeof meta.segmentCount === "number" ? meta.segmentCount : null,
    createdAt: source.createdAt.toISOString(),
  };
}

/** Honest seam readout — provider NAMES and configured/unconfigured booleans only (the seam-status-card rule: never values, never secrets). */
export function transcriptSeamStatus(): TranscriptSeamStatus {
  const env = readEnv();
  return {
    selected: env.TRANSCRIPT_PROVIDER,
    registered: registeredTranscriptProviders(),
    vendorConfigured: Boolean(env.TRANSCRIPT_VENDOR_URL && env.TRANSCRIPT_VENDOR_API_KEY),
  };
}
