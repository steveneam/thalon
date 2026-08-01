import { PLATFORM_CAPABILITIES, SOCIAL_PLATFORMS, type SocialPlatform } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  platformFitStamp,
  readDraftFitMedia,
  segmentBody,
  validateForPlatform,
} from "../capability";

/**
 * C1 (s82): the capability validator, per platform. These are the executable
 * form of "the matrix is the platform's CEILING" — the one distinction the
 * lane could get wrong (contracts platform-capability.ts states it at
 * length), plus the `text.urlWeight` rule that is data in the matrix rather
 * than a branch in the code.
 */

const LINK = "https://thalon.example/some/quite/long/path/for/testing";

describe("validateForPlatform — the text ceiling", () => {
  it("passes a body inside the ceiling and reports what it billed", () => {
    const fit = validateForPlatform({ platform: "linkedin", body: "A short post." });
    expect(fit.fits).toBe(true);
    expect(fit.problems).toEqual([]);
    expect(fit.text.billedChars).toBe("A short post.".length);
    expect(fit.text.maxChars).toBe(3000);
    expect(fit.text.overBy).toBe(0);
    // Nothing is cut when nothing is over.
    expect(fit.text.cutIndex).toBe("A short post.".length);
  });

  it("refuses a body over the ceiling, naming both numbers and the gap", () => {
    const body = "x".repeat(300);
    const fit = validateForPlatform({ platform: "x", body });
    expect(fit.fits).toBe(false);
    expect(fit.problems.map((p) => p.code)).toEqual(["text_over_ceiling"]);
    expect(fit.text.overBy).toBe(20);
    expect(fit.problems[0].message).toContain("280");
    expect(fit.problems[0].message).toContain("300");
    expect(fit.problems[0].message).toContain("20 over");
  });

  it("reports EVERY problem at once — an operator sees the whole bill", () => {
    const fit = validateForPlatform({
      platform: "instagram",
      body: `${"y".repeat(2300)} ${Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ")}`,
    });
    expect(fit.problems.map((p) => p.code).sort()).toEqual([
      "media_required",
      "text_over_ceiling",
      "too_many_hashtags",
    ]);
  });

  it("an empty body is its own refusal — there is nothing to publish", () => {
    const fit = validateForPlatform({ platform: "linkedin", body: "   \n  " });
    expect(fit.problems.map((p) => p.code)).toEqual(["text_empty"]);
  });

  it("an unparseable platform fails at the enum — there is no unknown-platform branch", () => {
    expect(() => validateForPlatform({ platform: "myspace", body: "hi" })).toThrow();
  });
});

describe("validateForPlatform — text.urlWeight is DATA, not a branch", () => {
  it("X bills every URL at 23 characters however long it is", () => {
    const body = `Read this: ${LINK}`;
    const fit = validateForPlatform({ platform: "x", body });
    expect(fit.text.rawChars).toBe(body.length);
    expect(fit.text.billedChars).toBe("Read this: ".length + 23);
    expect(fit.text.billedChars).toBeLessThan(fit.text.rawChars);
    expect(fit.text.links).toEqual([LINK]);
  });

  it("a SHORT url still costs X the full 23 — the weight is a floor as well as a ceiling", () => {
    const fit = validateForPlatform({ platform: "x", body: "see http://a.co" });
    expect(fit.text.billedChars).toBe("see ".length + 23);
    expect(fit.text.rawChars).toBe("see http://a.co".length);
  });

  it("every other platform counts links verbatim — the same body, a different bill", () => {
    const body = `Read this: ${LINK}`;
    for (const platform of ["linkedin", "facebook", "instagram", "tiktok"] as SocialPlatform[]) {
      const fit = validateForPlatform({ platform, body });
      expect(fit.text.billedChars).toBe(body.length);
      expect(fit.text.urlWeight).toBeNull();
    }
  });

  it("three links can push an otherwise-legal X body over — and a naive length would have passed it", () => {
    const body = `${"z".repeat(220)} ${LINK} ${LINK} ${LINK}`;
    const fit = validateForPlatform({ platform: "x", body });
    // Raw length is far larger; the billed length is what decides.
    expect(fit.text.billedChars).toBe(220 + 3 + 3 * 23);
    expect(fit.fits).toBe(false);
    expect(fit.text.overBy).toBe(fit.text.billedChars - 280);
  });

  it("trailing sentence punctuation is not part of the link", () => {
    const fit = validateForPlatform({ platform: "x", body: `see ${LINK}.` });
    expect(fit.text.links).toEqual([LINK]);
    expect(fit.text.billedChars).toBe("see ".length + 23 + 1);
  });
});

describe("segmentBody — what the platform-true preview renders", () => {
  it("splits text, links and hashtags, each billed as the platform bills it", () => {
    const segments = segmentBody(`hi ${LINK} #thalon`, 23);
    expect(segments.map((s) => s.kind)).toEqual(["text", "link", "text", "hashtag"]);
    expect(segments[1].billed).toBe(23);
    expect(segments[3]).toEqual({ kind: "hashtag", text: "#thalon", billed: 7 });
    // The segments reassemble the body exactly — the preview shows the post,
    // never a lossy reconstruction of it.
    expect(segments.map((s) => s.text).join("")).toBe(`hi ${LINK} #thalon`);
  });

  it("a #fragment inside a URL is part of the link, never a hashtag", () => {
    const fit = validateForPlatform({ platform: "linkedin", body: "see https://a.example/x#section" });
    expect(fit.text.hashtags).toEqual([]);
    expect(fit.text.links).toEqual(["https://a.example/x#section"]);
  });

  it("the cut index lands where the ceiling falls, and never mid-link", () => {
    // 270 chars of text, then a space, then a link: on X the link would push
    // the bill to 294, so the cut belongs BEFORE the link — half a URL is not
    // a shorter URL.
    const head = "q".repeat(270);
    const fit = validateForPlatform({ platform: "x", body: `${head} ${LINK}` });
    expect(fit.fits).toBe(false);
    expect(fit.text.cutIndex).toBe(head.length + 1);
  });

  it("the cut index falls mid-word in plain text, which is where the platform cuts", () => {
    const fit = validateForPlatform({ platform: "x", body: "w".repeat(400) });
    expect(fit.text.cutIndex).toBe(280);
  });
});

describe("validateForPlatform — media and hashtags", () => {
  it("Instagram refuses a text-only post — the driver's typed refusal, stated as data", () => {
    const fit = validateForPlatform({ platform: "instagram", body: "A caption." });
    expect(fit.problems.map((p) => p.code)).toEqual(["media_required"]);
    const withImage = validateForPlatform({
      platform: "instagram",
      body: "A caption.",
      media: [{ contentType: "image/jpeg" }],
    });
    expect(withImage.fits).toBe(true);
  });

  it("LinkedIn and X accept a text-only post — media.required is per platform", () => {
    for (const platform of ["linkedin", "x", "facebook"] as SocialPlatform[]) {
      expect(validateForPlatform({ platform, body: "Text only." }).fits).toBe(true);
    }
  });

  it("an unaccepted image type refuses, naming what the platform takes", () => {
    const fit = validateForPlatform({
      platform: "instagram",
      body: "A caption.",
      media: [{ contentType: "image/webp" }],
    });
    expect(fit.problems.map((p) => p.code)).toEqual(["unsupported_image_type"]);
    expect(fit.problems[0].message).toContain("image/jpeg");
  });

  it("a content type with parameters still matches its base type", () => {
    const fit = validateForPlatform({
      platform: "instagram",
      body: "A caption.",
      media: [{ contentType: "IMAGE/JPEG; charset=binary" }],
    });
    expect(fit.fits).toBe(true);
  });

  it("more images than the platform's ceiling refuses", () => {
    const fit = validateForPlatform({
      platform: "x",
      body: "Five pictures.",
      media: Array.from({ length: 5 }, () => ({ contentType: "image/png" })),
    });
    expect(fit.problems.map((p) => p.code)).toEqual(["too_many_images"]);
  });

  it("YouTube refuses a TEXT-ONLY draft with the typed video problem, not the image sentence (s90)", () => {
    const fit = validateForPlatform({ platform: "youtube", body: "A description." });
    expect(fit.problems.map((p) => p.code)).toEqual(["video_required"]);
    expect(fit.problems[0].message).toContain("video");
    expect(fit.problems[0].message).not.toContain("attach an image");
  });

  it("YouTube refuses an IMAGE-ONLY draft too — an image cannot satisfy a video-demanding platform", () => {
    const fit = validateForPlatform({
      platform: "youtube",
      body: "A description.",
      media: [{ contentType: "image/jpeg" }],
    });
    expect(fit.problems.map((p) => p.code)).toEqual(["video_required"]);
    expect(fit.problems[0].message).toContain("no video");
  });

  it("YouTube passes with a video, and judges an image BESIDE it by the thumbnail rules", () => {
    const withVideo = validateForPlatform({
      platform: "youtube",
      body: "A description.",
      media: [{ contentType: "video/mp4" }],
    });
    expect(withVideo.fits).toBe(true);
    // One JPEG beside the video = the platform's one custom thumbnail: fits.
    const withThumb = validateForPlatform({
      platform: "youtube",
      body: "A description.",
      media: [{ contentType: "video/mp4" }, { contentType: "image/jpeg" }],
    });
    expect(withThumb.fits).toBe(true);
    // A second image is over the thumbnail ceiling; a webp is the wrong type.
    const overThumb = validateForPlatform({
      platform: "youtube",
      body: "A description.",
      media: [
        { contentType: "video/mp4" },
        { contentType: "image/jpeg" },
        { contentType: "image/png" },
      ],
    });
    expect(overThumb.problems.map((p) => p.code)).toEqual(["too_many_images"]);
    const badThumb = validateForPlatform({
      platform: "youtube",
      body: "A description.",
      media: [{ contentType: "video/mp4" }, { contentType: "image/webp" }],
    });
    expect(badThumb.problems.map((p) => p.code)).toEqual(["unsupported_image_type"]);
  });

  it("YouTube's description ceiling refuses at 5000, naming both numbers", () => {
    const fit = validateForPlatform({
      platform: "youtube",
      body: "d".repeat(5100),
      media: [{ contentType: "video/mp4" }],
    });
    expect(fit.fits).toBe(false);
    expect(fit.problems.map((p) => p.code)).toEqual(["text_over_ceiling"]);
    expect(fit.text.maxChars).toBe(5000);
    expect(fit.problems[0].message).toContain("5000");
  });

  it("a video attachment on an IMAGE platform still refuses as an unsupported type — the pre-s90 behavior, pinned", () => {
    const fit = validateForPlatform({
      platform: "instagram",
      body: "A caption.",
      media: [{ contentType: "video/mp4" }],
    });
    expect(fit.problems.map((p) => p.code)).toEqual(["unsupported_image_type"]);
  });

  it("Instagram (30) and YouTube (60) cap hashtags — elsewhere the cap is the authoring profile's opinion, not a refusal", () => {
    const body = Array.from({ length: 40 }, (_, i) => `#tag${i}`).join(" ");
    expect(validateForPlatform({ platform: "linkedin", body }).fits).toBe(true);
    const ig = validateForPlatform({
      platform: "instagram",
      body,
      media: [{ contentType: "image/jpeg" }],
    });
    expect(ig.problems.map((p) => p.code)).toEqual(["too_many_hashtags"]);
    expect(ig.text.hashtags).toHaveLength(40);
    // 40 hashtags sit under YouTube's 60; 61 crosses the documented
    // ignore-all cliff and refuses.
    expect(
      validateForPlatform({
        platform: "youtube",
        body,
        media: [{ contentType: "video/mp4" }],
      }).fits,
    ).toBe(true);
    const overCliff = validateForPlatform({
      platform: "youtube",
      body: Array.from({ length: 61 }, (_, i) => `#tag${i}`).join(" "),
      media: [{ contentType: "video/mp4" }],
    });
    expect(overCliff.problems.map((p) => p.code)).toEqual(["too_many_hashtags"]);
  });
});

describe("the ceiling is not the authoring budget", () => {
  it("Facebook's 5000-character shipped budget sits far inside its 63,206 ceiling", () => {
    // The gap is the whole point: a 6000-character post is over the tenant's
    // STYLE preference and nowhere near the platform's refusal. This
    // validator reads the ceiling only.
    const fit = validateForPlatform({ platform: "facebook", body: "f".repeat(6000) });
    expect(fit.fits).toBe(true);
    expect(fit.text.maxChars).toBe(63_206);
  });

  it("every platform in the enum has a row the validator can measure against", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      // Attach the medium the row DEMANDS: a video where requiredKind says
      // so (YouTube), the first accepted image type everywhere else.
      const { media } = PLATFORM_CAPABILITIES[platform];
      const contentType =
        media.requiredKind === "video" ? "video/mp4" : media.imageContentTypes[0];
      const fit = validateForPlatform({
        platform,
        body: "A post.",
        media: [{ contentType }],
      });
      expect(fit.fits).toBe(true);
      expect(fit.capability.platform).toBe(platform);
      expect(fit.capability.verifiedOn).toBe(PLATFORM_CAPABILITIES[platform].verifiedOn);
    }
  });
});

describe("readDraftFitMedia — tolerant where the publish door is strict", () => {
  it("reads the content types off meta.mediaRefs", () => {
    expect(
      readDraftFitMedia({ mediaRefs: [{ ref: "social-media/abc.jpg", contentType: "image/jpeg" }] }),
    ).toEqual([{ contentType: "image/jpeg" }]);
  });

  it("no media refs reads as a text-only post, never a throw", () => {
    expect(readDraftFitMedia({})).toEqual([]);
    expect(readDraftFitMedia(null)).toEqual([]);
    expect(readDraftFitMedia({ mediaRefs: "not-an-array" })).toEqual([]);
  });

  it("SEES more images than the door would carry, so the ceiling refusal can fire", () => {
    const media = readDraftFitMedia({
      mediaRefs: [
        { ref: "a", contentType: "image/png" },
        { ref: "b", contentType: "image/png" },
        { ref: "c", contentType: "image/png" },
        { ref: "d", contentType: "image/png" },
        { ref: "e", contentType: "image/png" },
      ],
    });
    expect(media).toHaveLength(5);
    expect(validateForPlatform({ platform: "x", body: "Pictures.", media }).fits).toBe(false);
  });

  it("skips entries it cannot read rather than crashing on them", () => {
    expect(
      readDraftFitMedia({ mediaRefs: [null, 3, { ref: "a" }, { contentType: "" }, { contentType: "image/png" }] }),
    ).toEqual([{ contentType: "image/png" }]);
  });
});

describe("platformFitStamp — provenance that cannot go stale silently", () => {
  it("carries the body hash it was measured on", () => {
    const fit = validateForPlatform({ platform: "x", body: "x".repeat(300) });
    const stamp = platformFitStamp(fit, "hash-of-v1");
    expect(stamp).toEqual({
      fits: false,
      problems: ["text_over_ceiling"],
      billedChars: 300,
      maxChars: 280,
      bodyHash: "hash-of-v1",
    });
  });
});
