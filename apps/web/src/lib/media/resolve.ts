import {
  deriveOrientation,
  imageRefEnvelopeSchema,
  sourceThumbnailEnvelope,
  videoTakePosterSchema,
  type ImageRefEnvelope,
  type MediaOrientation,
} from "@thalon/contracts";

/**
 * The media resolver (B-media.0, s77) — ONE pure function per entity kind,
 * over that entity's CURRENT row state.
 *
 * This is what "media changes dynamically with the source and the content"
 * actually reduces to. There is no refresh mechanism and no cache to
 * invalidate: because every resolution is computed from the row on read, the
 * moment a write lands (an ingest captures a thumbnail, a render derives a
 * poster, an operator uploads one) the very next read shows it. No pushed
 * invalidation, no cached lies.
 *
 * Plan of record: `docs/research/media-framework-plan.md` §3.
 */

export type MediaResolution =
  /** Bytes we can name and point at, with the orientation the fill mode needs. */
  | { state: "resolved"; src: string; envelope: ImageRefEnvelope; orientation: MediaOrientation }
  /** No media ever existed. Permanent and honest — NOT a degradation. */
  | { state: "empty" }
  /** We held a ref and the read failed. A different fact from `empty`, always. */
  | { state: "broken"; was: ImageRefEnvelope }
  /** A read is in flight and nothing is known yet. */
  | { state: "loading" };

export const EMPTY: MediaResolution = { state: "empty" };
export const LOADING: MediaResolution = { state: "loading" };

/**
 * INVARIANT 1, as reviewable data: the declared fallback chain for every
 * entity that resolves media, and the entity fields each link may read.
 *
 * No chain reaches into another entity. A draft never wears its run's or its
 * grounding source's image (the Approve ruling, s75) — on the one surface
 * where the operator is deciding whether to publish, a borrowed thumbnail
 * would invent a provenance. Every chain therefore stops at `empty` rather
 * than reaching sideways for something prettier.
 *
 * `media-chains.test.ts` walks this table and fails if any link names a field
 * outside its own entity, so widening a chain is a visible, argued diff.
 */
export const MEDIA_CHAINS = {
  /** A transcription source: the thumbnail captured from the platform at ingest. */
  source: { fields: ["meta.thumbnailUrl", "meta.thumbnailWidth", "meta.thumbnailHeight"] },
  /** A video take: the poster we derived from bytes we hold. One link, then honest empty. */
  take: { fields: ["meta.posterRef"] },
  /** A trend item: whatever the driver captured. Drivers never synthesize one. */
  trendItem: { fields: ["thumbnailUrl", "thumbnailWidth", "thumbnailHeight"] },
  /**
   * s96 (Schedule S1, founder-approved W3): a draft resolves its OWN attached
   * post image — `meta.mediaRefs`, the exact bytes the publish door sends.
   * This is the argued widening this table exists to make visible, and it
   * does NOT touch the Approve ruling: a draft still never wears its run's or
   * its grounding source's image; `mediaRefs` is the post's own media, not a
   * borrowed provenance. Runs still resolve nothing.
   */
  draft: { fields: ["meta.mediaRefs"] },
  run: { fields: [] },
} as const;

export type MediaChainEntity = keyof typeof MEDIA_CHAINS;

/**
 * A transcription source's thumbnail.
 *
 * `capturedAt` is the source row's own creation time: the thumbnail is
 * captured during `ingestVideoUrl`, in the same call that creates the row.
 */
export function resolveSourceMedia(source: {
  meta?: unknown;
  createdAt?: Date | string;
}): MediaResolution {
  const envelope = sourceThumbnailEnvelope(source.meta, source.createdAt);
  return envelope ? resolvedFrom(envelope) : EMPTY;
}

/**
 * A video take's poster. Absent until something derives one, and `empty` says
 * exactly that — "poster pending" is not a different state from "no poster",
 * it is the same honest box with a different story behind it.
 */
export function resolveTakeMedia(take: { meta?: unknown }): MediaResolution {
  const meta = (take.meta ?? {}) as Record<string, unknown>;
  if (meta.posterRef === undefined || meta.posterRef === null) return EMPTY;
  const parsed = videoTakePosterSchema.safeParse(meta.posterRef);
  // A malformed poster ref is not a broken image — nothing was ever fetched.
  // It is a row we cannot read, and the honest answer is the empty box.
  if (!parsed.success) return EMPTY;
  return resolvedFrom(parsed.data);
}

/**
 * s96 (Schedule S1) — a draft's attached post image, from the plan wire's
 * already-parsed `media` projection (the serializer read `meta.mediaRefs`
 * tolerantly; this stays a pure map). Provenance is `operator` — attached
 * media rides the operator's approval by the publish door's own doctrine
 * ("the image itself rides the operator's approval"), which is the one
 * provenance word that is true of it.
 */
export function resolveDraftCardMedia(
  media: { sha256: string; ext: string; alt: string | null } | null,
): MediaResolution {
  if (media === null) return EMPTY;
  const parsed = imageRefEnvelopeSchema.safeParse({
    ref: { kind: "stored", sha256: media.sha256, ext: media.ext },
    provenance: "operator",
    ...(media.alt === null ? {} : { alt: media.alt }),
  });
  // A ref outside the closed ext set is one the door would refuse anyway —
  // the honest answer is the empty box, never a broken-image claim.
  return parsed.success ? resolvedFrom(parsed.data) : EMPTY;
}

/**
 * A trend item's platform thumbnail. These arrive on the sweep wire rather
 * than from a row, already shaped by the driver, and are captured by
 * definition — a driver that synthesized one would be inventing provenance.
 */
export function resolveTrendItemMedia(item: {
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  /** Absent when the sweep stamp was not plumbed — honest, and never a reason to hide real media. */
  capturedAt?: Date | string;
}): MediaResolution {
  if (!item.thumbnailUrl || !/^https:\/\//.test(item.thumbnailUrl)) return EMPTY;
  const measured = isMeasured(item.thumbnailWidth) && isMeasured(item.thumbnailHeight);
  return resolvedFrom({
    ref: {
      kind: "external",
      url: item.thumbnailUrl,
      ...(measured ? { width: item.thumbnailWidth, height: item.thumbnailHeight } : {}),
    },
    provenance: "captured",
    ...(item.capturedAt === undefined
      ? {}
      : {
          capturedAt:
            typeof item.capturedAt === "string"
              ? item.capturedAt
              : item.capturedAt.toISOString(),
        }),
  });
}

/** The one place a resolved envelope becomes a src + orientation, so no caller re-derives either. */
function resolvedFrom(envelope: ImageRefEnvelope): MediaResolution {
  return {
    state: "resolved",
    src: srcOf(envelope),
    envelope,
    orientation: deriveOrientation(envelope.ref.width, envelope.ref.height),
  };
}

/**
 * Where the bytes are actually fetched from.
 *
 * External refs render DIRECT — never proxied. Proxying platform media would
 * spend our bandwidth to hide link rot, and link rot is precisely the truth
 * the `broken` state exists to surface. Stored refs go through the authed
 * workspace door, which is deliberately NOT the public `/assets/<sha>` route:
 * that one is allowlist-gated for the blog/IG unlock (s71), and a workspace
 * thumbnail must never require public allowlisting to render.
 */
export function srcOf(envelope: ImageRefEnvelope): string {
  const { ref } = envelope;
  return ref.kind === "external" ? ref.url : `/api/media/${ref.sha256}.${ref.ext}`;
}

function isMeasured(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
