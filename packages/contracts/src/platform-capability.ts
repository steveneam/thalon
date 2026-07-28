import { z } from "zod";
import { SOCIAL_PLATFORMS, socialPlatformSchema, type SocialPlatform } from "./social";

/**
 * s82 window (W1): **what a platform's API will accept** — the physics, as
 * DATA. The deterministic pre-publish validator (lane C's
 * `validateForPlatform`) is built against this; the window ships only the
 * shape, the values, and their ratchets.
 *
 * ⚠ THIS IS NOT `platformProfiles[platform].charLimit`, and conflating the
 * two would be a real defect. There are two different numbers:
 *
 *   - **The authoring budget** — `proprietary/profiles/<platform>.vN.json`
 *     (tenant-overridable via `brand_profiles.platformProfiles`). A STYLE
 *     preference fed to generation, sitting beside prose policies for tone,
 *     hashtags and CTAs. Facebook's shipped budget is 5000 characters while
 *     the platform itself accepts 63,206 — that gap is the whole point: it
 *     is an opinion about good posts, freely tuned per tenant.
 *   - **The capability ceiling** — this file. A fact about the platform that
 *     no tenant config may exceed, in the same spirit as
 *     `SOCIAL_MAX_POSTS_PER_DAY_CEILING`. Changing one is a contract change,
 *     never config drift.
 *
 * The invariant tying them together — *the authoring budget must never
 * exceed the capability ceiling* — is executable, not remembered: see the
 * ratchet in `packages/engine/src/fanout/__tests__/profiles.test.ts`. Without
 * it, bumping a shipped profile's charLimit would silently start generating
 * posts the platform bounces at the door.
 *
 * **Conservative by construction.** Where a platform has a higher paid tier
 * or a recently-raised limit, the STANDARD, long-documented value is encoded
 * (X = 280, not the premium long-post ceiling). The asymmetry is deliberate:
 * refusing to queue a post the API would in fact have accepted is a visible,
 * recoverable annoyance; accepting one the API bounces spends a live call to
 * fail. `verifiedOn` stamps when the row was last checked against the
 * platform's published docs — these facts drift, and a stale number should
 * be visible rather than assumed current.
 */

/**
 * One platform's hard limits. Every field is load-bearing for a refusal the
 * validator can make deterministically — nothing speculative is encoded.
 */
export const platformCapabilitySchema = z.object({
  platform: socialPlatformSchema,
  text: z.object({
    /** Hard ceiling on the post body the API accepts. */
    maxChars: z.number().int().positive(),
    /**
     * Some platforms bill every URL at a fixed length however long it is (X
     * wraps in t.co), so a 300-char body carrying two links may still fit.
     * `null` = links are counted verbatim, like any other characters.
     */
    urlWeight: z.number().int().positive().nullable(),
  }),
  media: z.object({
    /**
     * The platform refuses a text-only post (Instagram, TikTok). This is the
     * same fact the Instagram driver already carries as a typed refusal —
     * pinned in the contracts test so the two can never drift apart.
     */
    required: z.boolean(),
    /**
     * The platform's own image ceiling. NOTE our publish door caps attached
     * media at ONE image regardless (`mediaRefsSchema`), so today every value
     * here is non-binding; the relationship is pinned by a ratchet rather
     * than left to be rediscovered.
     */
    maxImages: z.number().int().min(0),
    /** Accepted image MIME types — a draft's `meta.mediaRefs` carry theirs. */
    imageContentTypes: z.array(z.string().regex(/^image\//)).min(1),
  }),
  hashtags: z.object({
    /** A hard platform cap (Instagram's 30). `null` = no platform limit — style policy lives in the authoring profile's prose. */
    max: z.number().int().min(0).nullable(),
  }),
  /** ISO date these values were last checked against the platform's published docs. */
  verifiedOn: z.iso.date(),
});
export type PlatformCapability = z.infer<typeof platformCapabilitySchema>;

/** Checked 2026-07-28 against each platform's published developer docs. */
const VERIFIED_ON = "2026-07-28";

/**
 * The matrix. Complete over `SOCIAL_PLATFORMS` on purpose — a missing entry
 * would read as "no limits" to a naive caller, which is the one answer that
 * is never true. TikTok carries real values despite having no driver: the
 * matrix describes the PLATFORM, while whether we can reach it at all is the
 * registry's arming question. Keeping those two refusals separate is what
 * lets an operator be told *which* wall they hit.
 */
export const PLATFORM_CAPABILITIES: Readonly<Record<SocialPlatform, PlatformCapability>> = {
  linkedin: {
    platform: "linkedin",
    text: { maxChars: 3000, urlWeight: null },
    media: {
      required: false,
      maxImages: 9,
      imageContentTypes: ["image/jpeg", "image/png", "image/gif"],
    },
    hashtags: { max: null },
    verifiedOn: VERIFIED_ON,
  },
  x: {
    platform: "x",
    // The standard tier. Premium long posts raise this; encoding the raised
    // number would make every non-premium account's post fail at the API.
    text: { maxChars: 280, urlWeight: 23 },
    media: {
      required: false,
      maxImages: 4,
      imageContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    },
    hashtags: { max: null },
    verifiedOn: VERIFIED_ON,
  },
  facebook: {
    platform: "facebook",
    text: { maxChars: 63206, urlWeight: null },
    media: {
      required: false,
      maxImages: 10,
      imageContentTypes: ["image/jpeg", "image/png", "image/gif"],
    },
    hashtags: { max: null },
    verifiedOn: VERIFIED_ON,
  },
  instagram: {
    platform: "instagram",
    text: { maxChars: 2200, urlWeight: null },
    media: {
      // The driver's typed text-only refusal, stated as data.
      required: true,
      maxImages: 10,
      imageContentTypes: ["image/jpeg"],
    },
    hashtags: { max: 30 },
    verifiedOn: VERIFIED_ON,
  },
  tiktok: {
    platform: "tiktok",
    text: { maxChars: 2200, urlWeight: null },
    media: {
      required: true,
      maxImages: 35,
      imageContentTypes: ["image/jpeg", "image/png", "image/webp"],
    },
    hashtags: { max: null },
    verifiedOn: VERIFIED_ON,
  },
};

/**
 * The matrix lookup. Total over the platform enum by construction — there is
 * no "unknown platform" branch to forget, because an unparseable platform
 * fails at the enum instead.
 */
export function platformCapability(platform: SocialPlatform): PlatformCapability {
  return PLATFORM_CAPABILITIES[platform];
}

/** Every platform the matrix covers — the completeness ratchet reads this. */
export const CAPABILITY_PLATFORMS = SOCIAL_PLATFORMS;
