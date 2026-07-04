export const SOURCE_KINDS = [
  "url",
  "prompt",
  "doc",
  "feature",
  // B2.2 (amendment A5): time-coded and library source kinds.
  "video_transcript",
  "exemplar",
  "voice_sample",
  "site_crawl",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * Known source modalities (B2.2). The `sources.modality` column is
 * deliberately open-ended text — like `judge_results.gate` — so future tiers
 * (e.g. the B3.7 visual-ingest sidecar) extend this list with zero
 * migrations; these are the values the engine recognizes today.
 */
export const SOURCE_MODALITIES = ["text", "visual"] as const;
export type SourceModality = (typeof SOURCE_MODALITIES)[number];
