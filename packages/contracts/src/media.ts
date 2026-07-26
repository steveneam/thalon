import { z } from "zod";

/**
 * The media reference model (B-media.0, s77) — ONE shape for every image,
 * poster and audio bed the product holds, so the four surfaces that already
 * resolve real media stop each carrying their own wiring.
 *
 * Plan of record: `docs/research/media-framework-plan.md`. The verdicted
 * sheet (`docs/research/source-media-plan.md`) owns APPEARANCE — five states,
 * three sizes, the 1.6 ratio, the portrait call. This file owns DATA. Where
 * they overlap the sheet wins on pixels and this file wins on shape.
 *
 * Three invariants, each executable rather than remembered:
 *
 *  1. **No invented provenance.** A resolver may never borrow media across
 *     entities — a draft never wears its run's or its grounding source's
 *     image (the Approve ruling, s75). Fallback chains are declared per
 *     entity and stop at `empty`, honestly. Pinned by the resolver's own
 *     chain test in lane A; the shape's contribution is that every ref
 *     carries WHO put it there, so a borrowed one is visible.
 *  2. **`empty` and `broken` are different facts.** No media ever existed vs.
 *     we held a URL and it died. They never look alike and never store alike
 *     — which is why `broken` is a RESOLUTION state (lane A) and never a
 *     stored field here.
 *  3. **`orientation` is derived, never stored.** One function of width and
 *     height. Storing it would create a second truth that drifts, so every
 *     schema below is `strictObject` and an envelope carrying `orientation`
 *     is REFUSED at the door — see `media.test.ts`.
 */

/* ------------------------------------------------------------------ */
/* Extensions — closed, and SPLIT by family on purpose.                */
/* ------------------------------------------------------------------ */

/**
 * The families are separate types, not one loose list, because a poster that
 * is accidentally an mp3 is a bug the type system can refuse for free. The
 * audio family exists so B-audio.1's bed rides this contract instead of
 * inventing a parallel one (plan §8).
 */
export const MEDIA_IMAGE_EXTS = ["webp", "jpg", "png"] as const;
export type MediaImageExt = (typeof MEDIA_IMAGE_EXTS)[number];

export const MEDIA_AUDIO_EXTS = ["mp3", "m4a", "wav"] as const;
export type MediaAudioExt = (typeof MEDIA_AUDIO_EXTS)[number];

export const MEDIA_EXTS = [...MEDIA_IMAGE_EXTS, ...MEDIA_AUDIO_EXTS] as const;
export type MediaExt = (typeof MEDIA_EXTS)[number];

/** Content-type per stored extension — the closed map the serving door reads (never sniffed from bytes, never svg). */
export const MEDIA_CONTENT_TYPES: Readonly<Record<MediaExt, string>> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

/** The house content-address format, matching `platform/object-keys.ts` and the public `/assets` door. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Pixels are positive integers or absent. A zero or fractional dimension is a lie about the bytes. */
const dimension = z.number().int().positive();

/* ------------------------------------------------------------------ */
/* MediaRef — a union on WHERE THE BYTES LIVE.                          */
/* ------------------------------------------------------------------ */

/**
 * Bytes on someone else's CDN. May die at any time, which is the whole
 * reason `broken` exists as a resolution state. https-only — the same rule
 * `lib/library/serialize.ts` already applies when reading `meta.thumbnailUrl`.
 */
export const externalMediaRefSchema = z.strictObject({
  kind: z.literal("external"),
  url: z
    .string()
    .regex(/^https:\/\//, "external media must be https (the serializer's own rule)"),
  width: dimension.optional(),
  height: dimension.optional(),
});
export type ExternalMediaRef = z.infer<typeof externalMediaRefSchema>;

const storedFields = {
  kind: z.literal("stored"),
  sha256: z.string().regex(SHA256_HEX, "sha256 must be 64 lowercase hex characters"),
  width: dimension.optional(),
  height: dimension.optional(),
  bytes: z.number().int().positive().optional(),
};

/** Bytes in OUR content-addressed store — verified reads, so they cannot silently rot. */
export const storedMediaRefSchema = z.strictObject({
  ...storedFields,
  ext: z.enum(MEDIA_EXTS),
});
export type StoredMediaRef = z.infer<typeof storedMediaRefSchema>;

/** A stored ref narrowed to the image family — what a poster or thumbnail may be. */
export const storedImageRefSchema = z.strictObject({
  ...storedFields,
  ext: z.enum(MEDIA_IMAGE_EXTS),
});
export type StoredImageRef = z.infer<typeof storedImageRefSchema>;

/** A stored ref narrowed to the audio family — what a bed may be. */
export const storedAudioRefSchema = z.strictObject({
  ...storedFields,
  ext: z.enum(MEDIA_AUDIO_EXTS),
});
export type StoredAudioRef = z.infer<typeof storedAudioRefSchema>;

export const mediaRefSchema = z.discriminatedUnion("kind", [
  externalMediaRefSchema,
  storedMediaRefSchema,
]);
export type MediaRef = z.infer<typeof mediaRefSchema>;

/**
 * An image may live either side of the wall: a platform thumbnail is
 * external (we cannot vouch for its bytes and never proxy them), a poster we
 * derived is stored. An external URL carries no extension we can trust
 * without fetching it, so none is required — that honesty is the point.
 */
export const imageRefSchema = z.discriminatedUnion("kind", [
  externalMediaRefSchema,
  storedImageRefSchema,
]);
export type ImageRef = z.infer<typeof imageRefSchema>;

/**
 * Audio is STORED-ONLY, deliberately. A music bed is a licensing artifact:
 * you cannot license bytes you do not hold, and hot-linking someone's audio
 * would make the render's legal footing depend on a stranger's uptime.
 * B-audio.1's licensing gate is recorded, never assumed (plan §8).
 */
export const audioRefSchema = storedAudioRefSchema;
export type AudioRef = z.infer<typeof audioRefSchema>;

/* ------------------------------------------------------------------ */
/* The envelope — the ref plus WHO PUT IT THERE.                        */
/* ------------------------------------------------------------------ */

/**
 * captured = taken from the platform at ingest (oEmbed, a trend driver)
 * derived  = we computed it from bytes we already hold (an ffprobe poster)
 * operator = a human brought it (the B-media import door, an audio bed)
 *
 * This is the fact every tooltip and every audit reads, and the reason
 * invariant 1 is checkable: media that appears without a provenance it could
 * plausibly have earned is media that was borrowed.
 */
export const MEDIA_PROVENANCES = ["captured", "derived", "operator"] as const;
export type MediaProvenance = (typeof MEDIA_PROVENANCES)[number];

/** Envelope fields shared by every family; the `ref` is supplied per family below. */
const envelopeFields = {
  provenance: z.enum(MEDIA_PROVENANCES),
  /** When the ref was WRITTEN — not when the underlying media was made. */
  capturedAt: z.iso.datetime({ offset: true }),
  /**
   * Alt text. ABSENT means decorative (the consumer renders `aria-hidden`),
   * which is a real editorial choice and not the same as an empty string —
   * so an empty string is refused rather than quietly meaning "decorative".
   */
  alt: z.string().min(1).optional(),
};

export const mediaRefEnvelopeSchema = z.strictObject({
  ref: mediaRefSchema,
  ...envelopeFields,
});
export type MediaRefEnvelope = z.infer<typeof mediaRefEnvelopeSchema>;

/** An envelope whose ref is an image — the shape thumbnails and posters use. */
export const imageRefEnvelopeSchema = z.strictObject({
  ref: imageRefSchema,
  ...envelopeFields,
});
export type ImageRefEnvelope = z.infer<typeof imageRefEnvelopeSchema>;

/** An envelope whose ref is stored audio — B-audio.1's bed. */
export const audioRefEnvelopeSchema = z.strictObject({
  ref: audioRefSchema,
  ...envelopeFields,
});
export type AudioRefEnvelope = z.infer<typeof audioRefEnvelopeSchema>;

/* ------------------------------------------------------------------ */
/* Derivations — helpers, never fields (invariant 3).                   */
/* ------------------------------------------------------------------ */

export const MEDIA_ORIENTATIONS = ["landscape", "portrait", "square", "unknown"] as const;
export type MediaOrientation = (typeof MEDIA_ORIENTATIONS)[number];

/**
 * The portrait decision in the verdicted sheet consumes exactly this: a 9:16
 * Short cover-cropped into a 1.6 box loses ~65% of its height and gets
 * decapitated, so `portrait` switches the component from crop to contain.
 *
 * `unknown` is a first-class answer, not a failure — most external thumbnails
 * arrive without dimensions, and the sheet's default treatment is correct for
 * them. Guessing an orientation from a URL would be inventing a fact.
 */
export function deriveOrientation(width?: number, height?: number): MediaOrientation {
  if (!isMeasured(width) || !isMeasured(height)) return "unknown";
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/** Orientation of a ref, from whatever dimensions it happens to carry. */
export function refOrientation(ref: MediaRef): MediaOrientation {
  return deriveOrientation(ref.width, ref.height);
}

function isMeasured(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Narrowing helpers so consumers never re-derive the discriminant by hand. */
export function isStoredRef(ref: MediaRef): ref is StoredMediaRef {
  return ref.kind === "stored";
}

export function isExternalRef(ref: MediaRef): ref is ExternalMediaRef {
  return ref.kind === "external";
}

/** True when a stored ref's extension is in the image family. */
export function isImageExt(ext: MediaExt): ext is MediaImageExt {
  return (MEDIA_IMAGE_EXTS as readonly string[]).includes(ext);
}

/** True when a stored ref's extension is in the audio family. */
export function isAudioExt(ext: MediaExt): ext is MediaAudioExt {
  return (MEDIA_AUDIO_EXTS as readonly string[]).includes(ext);
}
