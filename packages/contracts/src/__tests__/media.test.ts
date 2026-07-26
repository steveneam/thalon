import { describe, expect, it } from "vitest";
import {
  MEDIA_AUDIO_EXTS,
  MEDIA_CONTENT_TYPES,
  MEDIA_EXTS,
  MEDIA_IMAGE_EXTS,
  audioRefEnvelopeSchema,
  deriveOrientation,
  externalMediaRefSchema,
  imageRefEnvelopeSchema,
  mediaRefEnvelopeSchema,
  refOrientation,
  sourceMediaMetaSchema,
  sourceThumbnailEnvelope,
  storedImageRefSchema,
  videoTakePosterSchema,
} from "../index";

const SHA = "a".repeat(64);
const AT = "2026-07-26T04:00:00.000Z";

describe("MediaRef — where the bytes live", () => {
  it("refuses non-https external media (the serializer's own long-standing rule)", () => {
    expect(externalMediaRefSchema.safeParse({ kind: "external", url: "https://cdn.test/a.jpg" }).success).toBe(true);
    expect(externalMediaRefSchema.safeParse({ kind: "external", url: "http://cdn.test/a.jpg" }).success).toBe(false);
    expect(externalMediaRefSchema.safeParse({ kind: "external", url: "//cdn.test/a.jpg" }).success).toBe(false);
  });

  it("refuses a sha256 that is not 64 lowercase hex — one content-address format, matching the /assets door", () => {
    const ok = storedImageRefSchema.safeParse({ kind: "stored", sha256: SHA, ext: "webp" });
    expect(ok.success).toBe(true);
    for (const bad of [SHA.toUpperCase(), SHA.slice(0, 63), `${SHA}f`, "not-a-hash"]) {
      expect(storedImageRefSchema.safeParse({ kind: "stored", sha256: bad, ext: "webp" }).success).toBe(false);
    }
  });

  it("refuses a dimension that lies about the bytes — zero, negative or fractional", () => {
    for (const width of [0, -1, 12.5]) {
      expect(
        externalMediaRefSchema.safeParse({ kind: "external", url: "https://c.test/a.jpg", width }).success,
      ).toBe(false);
    }
  });

  /** The family split is the point: a poster that is quietly an mp3 is a bug the schema can refuse for free. */
  it("keeps the image and audio families disjoint, and covers every ext with a content type", () => {
    for (const ext of MEDIA_AUDIO_EXTS) {
      expect(storedImageRefSchema.safeParse({ kind: "stored", sha256: SHA, ext }).success).toBe(false);
    }
    expect(MEDIA_IMAGE_EXTS.some((e) => (MEDIA_AUDIO_EXTS as readonly string[]).includes(e))).toBe(false);
    for (const ext of MEDIA_EXTS) expect(MEDIA_CONTENT_TYPES[ext]).toBeTruthy();
    // The public-door rule this mirrors: svg is never a served media type.
    expect(Object.values(MEDIA_CONTENT_TYPES)).not.toContain("image/svg+xml");
  });

  it("keeps audio STORED-only — a bed you do not hold is a bed you cannot license", () => {
    const external = { kind: "external" as const, url: "https://cdn.test/bed.mp3" };
    expect(
      audioRefEnvelopeSchema.safeParse({ ref: external, provenance: "operator", capturedAt: AT }).success,
    ).toBe(false);
    expect(
      audioRefEnvelopeSchema.safeParse({
        ref: { kind: "stored", sha256: SHA, ext: "mp3" },
        provenance: "operator",
        capturedAt: AT,
      }).success,
    ).toBe(true);
  });
});

describe("the envelope — who put it there", () => {
  it("requires a provenance and a capture time", () => {
    const ref = { kind: "external" as const, url: "https://cdn.test/a.jpg" };
    expect(mediaRefEnvelopeSchema.safeParse({ ref, capturedAt: AT }).success).toBe(false);
    expect(mediaRefEnvelopeSchema.safeParse({ ref, provenance: "captured" }).success).toBe(false);
    expect(mediaRefEnvelopeSchema.safeParse({ ref, provenance: "invented", capturedAt: AT }).success).toBe(false);
    expect(mediaRefEnvelopeSchema.safeParse({ ref, provenance: "captured", capturedAt: "yesterday" }).success).toBe(
      false,
    );
  });

  /**
   * INVARIANT 3, made executable: orientation is derived, never stored.
   * `strictObject` is what enforces it — an envelope carrying an orientation
   * would be a second truth, free to drift from the dimensions beside it.
   */
  it("REFUSES a stored orientation, on the envelope and on the ref alike", () => {
    const ref = { kind: "external" as const, url: "https://cdn.test/a.jpg", width: 1280, height: 720 };
    expect(
      mediaRefEnvelopeSchema.safeParse({ ref, provenance: "captured", capturedAt: AT, orientation: "landscape" })
        .success,
    ).toBe(false);
    expect(
      externalMediaRefSchema.safeParse({ ...ref, orientation: "landscape" }).success,
    ).toBe(false);
  });

  it("treats absent alt as decorative but refuses an empty string — those are different editorial facts", () => {
    const ref = { kind: "external" as const, url: "https://cdn.test/a.jpg" };
    expect(imageRefEnvelopeSchema.safeParse({ ref, provenance: "captured", capturedAt: AT }).success).toBe(true);
    expect(imageRefEnvelopeSchema.safeParse({ ref, provenance: "captured", capturedAt: AT, alt: "" }).success).toBe(
      false,
    );
  });
});

describe("deriveOrientation — the portrait crop-vs-contain input", () => {
  it("answers unknown when it is not measured, rather than guessing", () => {
    expect(deriveOrientation(undefined, undefined)).toBe("unknown");
    expect(deriveOrientation(1280, undefined)).toBe("unknown");
    expect(deriveOrientation(0, 100)).toBe("unknown");
    expect(deriveOrientation(Number.NaN, 100)).toBe("unknown");
    expect(deriveOrientation(Number.POSITIVE_INFINITY, 100)).toBe("unknown");
  });

  it("names the three measured cases, including the 9:16 Short that must not be cover-cropped", () => {
    expect(deriveOrientation(1280, 720)).toBe("landscape");
    expect(deriveOrientation(1080, 1920)).toBe("portrait");
    expect(deriveOrientation(800, 800)).toBe("square");
  });

  it("reads a ref's own dimensions", () => {
    expect(refOrientation({ kind: "stored", sha256: SHA, ext: "webp", width: 640, height: 360 })).toBe("landscape");
    expect(refOrientation({ kind: "external", url: "https://cdn.test/a.jpg" })).toBe("unknown");
  });
});

describe("source media meta — the ingest/read mini-contract", () => {
  it("degrades a malformed legacy value to absent instead of taking down the row", () => {
    const parsed = sourceMediaMetaSchema.parse({
      thumbnailUrl: "http://insecure.test/a.jpg",
      thumbnailWidth: -4,
      thumbnailHeight: "tall",
      title: "an unrelated key that must survive untouched elsewhere",
    });
    expect(parsed.thumbnailUrl).toBeUndefined();
    expect(parsed.thumbnailWidth).toBeUndefined();
    expect(parsed.thumbnailHeight).toBeUndefined();
  });

  it("builds a captured envelope, stamping the row's own creation time as the capture moment", () => {
    const envelope = sourceThumbnailEnvelope(
      { thumbnailUrl: "https://i.ytimg.test/vi/x/hq.jpg", thumbnailWidth: 480, thumbnailHeight: 360 },
      new Date(AT),
    );
    expect(envelope).toEqual({
      ref: { kind: "external", url: "https://i.ytimg.test/vi/x/hq.jpg", width: 480, height: 360 },
      provenance: "captured",
      capturedAt: AT,
    });
    expect(refOrientation(envelope!.ref)).toBe("landscape");
    expect(imageRefEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("returns null when the row has no thumbnail — empty is a fact, not a failure", () => {
    expect(sourceThumbnailEnvelope({}, new Date(AT))).toBeNull();
    expect(sourceThumbnailEnvelope(undefined, new Date(AT))).toBeNull();
    expect(sourceThumbnailEnvelope({ thumbnailWidth: 480 }, new Date(AT))).toBeNull();
  });

  /** Half a measurement is no measurement: it would only invite a consumer to guess the other half. */
  it("carries dimensions only when BOTH arrived", () => {
    const half = sourceThumbnailEnvelope(
      { thumbnailUrl: "https://i.ytimg.test/vi/x/hq.jpg", thumbnailWidth: 480 },
      AT,
    );
    expect(half?.ref).toEqual({ kind: "external", url: "https://i.ytimg.test/vi/x/hq.jpg" });
    expect(refOrientation(half!.ref)).toBe("unknown");
  });

  /** Pre-rider rows simply lack the keys — every one of them must still read. */
  it("parses a pre-window source meta unchanged (additivity)", () => {
    const legacy = { title: "A talk", tags: ["ai"], transcriptProvider: "hosted", segmentCount: 12 };
    expect(sourceMediaMetaSchema.safeParse(legacy).success).toBe(true);
    expect(sourceThumbnailEnvelope(legacy, new Date(AT))).toBeNull();
  });
});

describe("the take poster — stored bytes only", () => {
  it("accepts a derived stored poster and refuses an external one", () => {
    expect(
      videoTakePosterSchema.safeParse({
        ref: { kind: "stored", sha256: SHA, ext: "webp", width: 640, height: 360 },
        provenance: "derived",
        capturedAt: AT,
      }).success,
    ).toBe(true);
    expect(
      videoTakePosterSchema.safeParse({
        ref: { kind: "external", url: "https://cdn.test/poster.jpg" },
        provenance: "derived",
        capturedAt: AT,
      }).success,
    ).toBe(false);
  });

  it("refuses an audio ext on a poster", () => {
    expect(
      videoTakePosterSchema.safeParse({
        ref: { kind: "stored", sha256: SHA, ext: "mp3" },
        provenance: "derived",
        capturedAt: AT,
      }).success,
    ).toBe(false);
  });

  it("leaves provenance open across all three — narrowing it now would cost a window to widen", () => {
    for (const provenance of ["derived", "captured", "operator"]) {
      expect(
        videoTakePosterSchema.safeParse({
          ref: { kind: "stored", sha256: SHA, ext: "webp" },
          provenance,
          capturedAt: AT,
        }).success,
      ).toBe(true);
    }
  });
});
