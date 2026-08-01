import { describe, expect, it } from "vitest";
import {
  PLATFORM_CAPABILITIES,
  platformCapability,
  platformCapabilitySchema,
  type PlatformCapability,
} from "../platform-capability";
import { SOCIAL_PLATFORMS } from "../social";

/**
 * s82 window (W1) ratchets for the capability matrix. The matrix is DATA, so
 * these pin the properties that make it safe to build a deterministic
 * validator on: it is complete, it parses its own schema, and it is
 * internally coherent. The relationship between the matrix and the shipped
 * AUTHORING budgets is pinned separately, where the profile files live —
 * `packages/engine/src/fanout/__tests__/profiles.test.ts`.
 */

describe("platform capability matrix (s82 W1)", () => {
  it("covers every social platform — a missing entry would read as 'no limits'", () => {
    expect(Object.keys(PLATFORM_CAPABILITIES).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("every entry parses its own schema, and its key matches its platform field", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const entry = PLATFORM_CAPABILITIES[platform];
      expect(() => platformCapabilitySchema.parse(entry)).not.toThrow();
      expect(entry.platform, `matrix key "${platform}" disagrees with its platform field`).toBe(
        platform,
      );
    }
  });

  it("is internally coherent: a platform that requires media can accept at least one image", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const { media } = PLATFORM_CAPABILITIES[platform];
      if (!media.required) continue;
      expect(
        media.maxImages,
        `${platform} demands media but accepts no images — an unpublishable platform`,
      ).toBeGreaterThan(0);
    }
  });

  it("the publish door's one-image cap fits inside every platform's ceiling", () => {
    // `mediaRefsSchema` in engine/src/social/publish.ts caps attached media at
    // ONE image. This pins the relationship rather than leaving it to be
    // rediscovered: if a platform ever accepted fewer than the door can send,
    // the door would offer the operator something the API refuses.
    const DOOR_MAX_IMAGES = 1;
    for (const platform of SOCIAL_PLATFORMS) {
      expect(
        PLATFORM_CAPABILITIES[platform].media.maxImages,
        `${platform} accepts fewer images than the publish door can attach`,
      ).toBeGreaterThanOrEqual(DOOR_MAX_IMAGES);
    }
  });

  it("pins Instagram's text-only refusal as data — the same fact its driver throws", () => {
    // The Instagram driver refuses a text-only post with a typed error. That
    // is a platform fact, and it must read identically from the matrix or a
    // validator would clear a post the driver then rejects.
    expect(PLATFORM_CAPABILITIES.instagram.media.required).toBe(true);
    expect(PLATFORM_CAPABILITIES.instagram.hashtags.max).toBe(30);
  });

  it("pins YouTube's s90 row: video-required, the 5000-byte description ceiling, the hashtag cliff", () => {
    // The doc-verified facts (developers.google.com/youtube/v3/docs/videos,
    // checked 2026-08-01): description max 5000 (bytes — the row's comment
    // carries the nuance), a VIDEO demanded rather than an image, one custom
    // thumbnail in JPEG/PNG beside it, and the 60-hashtag ignore-all cliff.
    const youtube = PLATFORM_CAPABILITIES.youtube;
    expect(youtube.text.maxChars).toBe(5000);
    expect(youtube.text.urlWeight).toBeNull();
    expect(youtube.media.required).toBe(true);
    expect(youtube.media.requiredKind).toBe("video");
    expect(youtube.media.maxImages).toBe(1);
    expect(youtube.media.imageContentTypes).toEqual(["image/jpeg", "image/png"]);
    expect(youtube.hashtags.max).toBe(60);
  });

  it("requiredKind stays ABSENT on every image-required row — absence means image, the pre-s90 shape", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      if (platform === "youtube") continue;
      expect(
        PLATFORM_CAPABILITIES[platform].media.requiredKind,
        `${platform} declares a requiredKind — only a video-demanding platform needs one`,
      ).toBeUndefined();
    }
  });

  it("keeps X's standard-tier ceiling and its fixed URL weight", () => {
    // Encoding the premium long-post ceiling would make every standard
    // account's post fail at the API instead of at our door.
    expect(PLATFORM_CAPABILITIES.x.text.maxChars).toBe(280);
    expect(PLATFORM_CAPABILITIES.x.text.urlWeight).toBe(23);
  });

  it("the lookup is total over the enum", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const entry: PlatformCapability = platformCapability(platform);
      expect(entry.platform).toBe(platform);
    }
  });

  it("stays additive: an entry carrying a field a future window adds still parses today", () => {
    // The additivity proof the window discipline asks for — a matrix row from
    // a LATER contract version must not fail an older parse.
    const withFutureField = {
      ...PLATFORM_CAPABILITIES.linkedin,
      video: { maxSeconds: 600 },
    };
    expect(() => platformCapabilitySchema.parse(withFutureField)).not.toThrow();
  });
});
