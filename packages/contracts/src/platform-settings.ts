import { z } from "zod";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "./social";

/**
 * s87 window — the D3 **per-platform settings** slice: the knobs the
 * Composer's right-hand rail renders per destination tab, declared once as
 * schema so the rail is GENERATED rather than hand-branched per platform.
 * Charters: `docs/create-engine/spec.md` §Design/Video+Postiz specifics
 * (which pulls this slice forward) and `docs/video-arc/spec.md` (whose video
 * settings are the same slice — it ships once, shared).
 *
 * Two boundaries worth stating, because both are easy to blur:
 *
 *  1. **This is not the capability matrix.** `platform-capability.ts` says
 *     what a platform's API will *accept* (a fact we may not exceed); this
 *     file says what the operator may *choose* within that. A char limit is
 *     a ceiling; a visibility is a knob.
 *  2. **This is not `alt` text.** The Composer sheet draws Alt text in the
 *     same rail, but alt already lives on the media envelope
 *     (`media.ts` `envelopeFields.alt`) and belongs to the media, not to the
 *     destination. Duplicating it here would create the second truth that
 *     contract windows exist to prevent.
 *
 * Every platform key is present, complete over `SOCIAL_PLATFORMS`, for the
 * reason `PLATFORM_CAPABILITIES` gives: a missing entry reads as "no
 * settings" to a naive caller, and silence is the one answer that is never
 * informative. A platform with genuinely no per-post knobs says so with an
 * empty shape.
 *
 * ⚠ **YouTube is deliberately absent, and that is a real gap, not an
 * oversight.** Both specs name YouTube's title / thumbnail / made-for-kids
 * settings. There is no `youtube` key in `SOCIAL_PLATFORMS`, no capability
 * row and no driver — so a YouTube settings schema here would be a contract
 * asserting a destination the product cannot reach. It waits on its own
 * window (platform key + verified capability row + driver), and is recorded
 * as such rather than invented. TikTok's video settings, which DO have a
 * platform key, ship below in full.
 */

/* ------------------------------------------------------------------ */
/* Cross-platform blocks.                                               */
/* ------------------------------------------------------------------ */

/**
 * Video settings that belong to the CUT rather than to a destination — one
 * per run, not one per tab. The Composer sheet draws the cover-frame picker
 * inside a platform tab's rail, but the frame chosen is a property of the
 * video itself: giving each tab its own would let five tabs drift to five
 * different posters for one file, which no operator ever means.
 */
export const videoPostSettingsSchema = z.strictObject({
  /**
   * Milliseconds into the cut for the poster frame. Absent = the platform's
   * own default first frame — a real choice ("I didn't pick"), never
   * silently stored as 0, which would mean "I picked the first frame".
   */
  coverFrameMs: z.number().int().min(0).optional(),
});
export type VideoPostSettings = z.infer<typeof videoPostSettingsSchema>;

/** Who may reply/comment. Kept as one vocabulary because three platforms express the same idea. */
export const AUDIENCE_SCOPES = ["anyone", "connections", "mentioned", "none"] as const;
export type AudienceScope = (typeof AUDIENCE_SCOPES)[number];

/* ------------------------------------------------------------------ */
/* Per-platform settings.                                               */
/* ------------------------------------------------------------------ */

/** LinkedIn — the rail the Composer sheet actually draws. */
export const linkedinPostSettingsSchema = z.strictObject({
  visibility: z.enum(["anyone", "connections"]).optional(),
  whoCanComment: z.enum(["anyone", "connections", "none"]).optional(),
  /**
   * The first-comment trick (links cost reach in the body). Absent = off;
   * an EMPTY string is refused rather than quietly meaning "off", the
   * `alt`-text convention.
   */
  firstComment: z.string().min(1).optional(),
});

/** X — HubSpot's per-network first-reply pattern, named in the Create spec. */
export const xPostSettingsSchema = z.strictObject({
  whoCanReply: z.enum(["anyone", "connections", "mentioned"]).optional(),
  firstReply: z.string().min(1).optional(),
});

export const facebookPostSettingsSchema = z.strictObject({
  firstComment: z.string().min(1).optional(),
});

export const instagramPostSettingsSchema = z.strictObject({
  firstComment: z.string().min(1).optional(),
  /** Reels also appearing in the main feed. Absent = the account's own default. */
  shareToFeed: z.boolean().optional(),
});

/**
 * TikTok — the video variant in full, from their Content Posting API's own
 * fields. These are the settings the video spec names, and unlike YouTube's
 * they have a platform key to hang on.
 */
export const tiktokPostSettingsSchema = z.strictObject({
  privacy: z.enum(["public", "friends", "private"]).optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  /** Their branded-content / paid-partnership disclosure. A compliance flag, never inferred. */
  brandedContent: z.boolean().optional(),
});

/**
 * Reddit. `title` is not a knob — the platform REQUIRES it and the body
 * ceiling in `platform-capability.ts` already notes it as a separate field
 * the driver derives. It sits here because it is per-post operator text,
 * and the 300-char cap is the platform's own.
 */
export const redditPostSettingsSchema = z.strictObject({
  title: z.string().min(1).max(300).optional(),
  flairId: z.string().min(1).optional(),
  /**
   * Per-POST override of the tenant's standing `social.reddit.subreddit`
   * cadence config. Absent = use the tenant's configured destination — the
   * config stays the default, this is the exception.
   */
  subreddit: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_]+$/, "bare subreddit name — no r/ prefix, no slashes")
    .optional(),
});

/**
 * Bluesky has no per-post settings: the post is its text and its media, and
 * the AppView exposes no visibility/reply knobs we could honestly offer.
 * The empty shape is the answer — present so a reader sees the platform was
 * considered, `strictObject` so inventing a knob here fails loudly.
 */
export const blueskyPostSettingsSchema = z.strictObject({});

/* ------------------------------------------------------------------ */
/* The envelope.                                                        */
/* ------------------------------------------------------------------ */

/**
 * One run/draft's settings across its destinations. Explicit optional field
 * per platform — never a record over the enum, for the reason
 * `socialPublishConfigSchema` states: zod 4's exhaustive-record semantics
 * would demand every platform be configured at once. An absent platform =
 * no settings chosen = every knob at the platform's own default.
 */
export const platformSettingsSchema = z.strictObject({
  video: videoPostSettingsSchema.optional(),
  linkedin: linkedinPostSettingsSchema.optional(),
  x: xPostSettingsSchema.optional(),
  facebook: facebookPostSettingsSchema.optional(),
  instagram: instagramPostSettingsSchema.optional(),
  tiktok: tiktokPostSettingsSchema.optional(),
  reddit: redditPostSettingsSchema.optional(),
  bluesky: blueskyPostSettingsSchema.optional(),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

/** Every platform this slice declares settings for — the completeness ratchet reads this. */
export const SETTINGS_PLATFORMS: readonly SocialPlatform[] = SOCIAL_PLATFORMS;

/**
 * Destinations named by the specs that have no settings schema here, with
 * the reason. Documentary ratchets rot, so this is a VALUE a test reads:
 * the day `youtube` joins `SOCIAL_PLATFORMS`, the completeness test fails
 * until this entry is resolved rather than quietly outliving its truth.
 */
export const SETTINGS_DEFERRED: Readonly<Record<string, string>> = {
  youtube:
    "no platform key, no capability row, no driver — title/thumbnail/made-for-kids wait on YouTube's own window (video-arc spec §Postiz has NO video editor / the pipeline seam)",
};
