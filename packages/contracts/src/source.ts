import { z } from "zod";
import type { ImageRefEnvelope } from "./media";

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

/* ------------------------------------------------------------------ */
/* B-media.0 (s77): the source META-KEY MINI-CONTRACT for media.        */
/* ------------------------------------------------------------------ */

/**
 * The media keys on `sources.meta` (jsonb — no table change), named here so
 * the WRITER (`engine/ingest/video-title.ts`, at ingest) and the READER (the
 * web resolver) cannot drift apart.
 *
 * `thumbnailUrl` has shipped since the B6.6 rider. The two dimensions are
 * NEW in s77 and were free all along: YouTube's oEmbed reply carries
 * `thumbnail_width`/`thumbnail_height` in the very same response the fetcher
 * already parses for the title, and it was discarding them. They are what
 * makes `deriveOrientation` — and therefore the portrait crop-vs-contain
 * decision — possible without a second network call.
 *
 * Every field degrades to absent rather than throwing: pre-rider rows simply
 * lack the keys, and a malformed legacy value must never take down a read of
 * an otherwise good row (the serializer's long-standing rule).
 */
export const sourceMediaMetaSchema = z.object({
  /** Platform thumbnail URL, https-only. */
  thumbnailUrl: z
    .string()
    .regex(/^https:\/\//)
    .optional()
    .catch(undefined),
  /** Intrinsic width of that thumbnail, when the platform reported one. */
  thumbnailWidth: z.number().int().positive().optional().catch(undefined),
  /** Intrinsic height of that thumbnail, when the platform reported one. */
  thumbnailHeight: z.number().int().positive().optional().catch(undefined),
});
export type SourceMediaMeta = z.infer<typeof sourceMediaMetaSchema>;

/**
 * A source's thumbnail as a full envelope, or `null` when the row has none.
 *
 * `capturedAt` is the SOURCE ROW's creation time, and that is not a
 * convenience: the thumbnail is captured during `ingestVideoUrl`, in the same
 * call that creates the row, so row creation IS the capture moment. Passing
 * it in keeps this helper pure and keeps contracts free of a db import.
 */
export function sourceThumbnailEnvelope(
  meta: unknown,
  capturedAt?: Date | string,
): ImageRefEnvelope | null {
  const parsed = sourceMediaMetaSchema.safeParse(meta ?? {});
  if (!parsed.success) return null;
  const { thumbnailUrl, thumbnailWidth, thumbnailHeight } = parsed.data;
  if (!thumbnailUrl) return null;
  return {
    ref: {
      kind: "external",
      url: thumbnailUrl,
      // Dimensions ride together or not at all: one without the other yields
      // `unknown` from deriveOrientation anyway, and a half-measured ref
      // invites a consumer to guess the other half.
      ...(thumbnailWidth && thumbnailHeight
        ? { width: thumbnailWidth, height: thumbnailHeight }
        : {}),
    },
    provenance: "captured",
    ...(capturedAt === undefined
      ? {}
      : { capturedAt: typeof capturedAt === "string" ? capturedAt : capturedAt.toISOString() }),
  };
}
