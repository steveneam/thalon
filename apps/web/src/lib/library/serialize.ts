import type { Source } from "@thalon/db";
import { registeredTranscriptProviders } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import type { AreaRelevance, LibrarySourceRow, TranscriptSeamStatus } from "./types";

/** meta.tags per the mini-contract is string[]; anything else degrades to none — never invented. */
function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "");
}

/** meta.areaRelevance entries are kept only when structurally complete — a malformed entry is dropped, not patched. */
function readAreaRelevance(value: unknown): AreaRelevance[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AreaRelevance =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as AreaRelevance).areaId === "string" &&
      typeof (entry as AreaRelevance).areaName === "string" &&
      typeof (entry as AreaRelevance).score === "number" &&
      typeof (entry as AreaRelevance).reason === "string",
  );
}

/**
 * Source row → library wire row. Provider + segment count ride sources.meta
 * (written by ingestVideoUrl); title/tags/areaRelevance are the session-19
 * META-KEY MINI-CONTRACT keys — all optional on the wire IN, absent on
 * pre-rider rows, so every read here degrades honestly (URL identity, no
 * chips, no badge) rather than inventing values.
 */
export function toLibraryRow(source: Source): LibrarySourceRow {
  const meta = (source.meta ?? {}) as Record<string, unknown>;
  return {
    id: source.id,
    uri: source.uri,
    title: typeof meta.title === "string" && meta.title.trim() !== "" ? meta.title : null,
    tags: readTags(meta.tags),
    areaRelevance: readAreaRelevance(meta.areaRelevance),
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
