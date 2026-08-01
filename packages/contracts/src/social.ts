import { z } from "zod";

/**
 * Sprint-8 window: shapes for the B-pub social publisher seam. The seam,
 * drivers, and queue consumer are LANE work against this frozen contract —
 * this file ships only the validated shapes and their ceilings (ADR 0002:
 * official platform APIs only; arming is per-platform env keys, mirroring
 * the outreach door's two-key pattern — never stored here).
 */

/**
 * Platform keys — the founder's test-account order (LinkedIn first, TikTok
 * last), then the D1 proof pair (s83): reddit + bluesky, chosen because both
 * have instant developer-app creation and no posting-scope review wall, so
 * the connector seam proves end to end without waiting on a partner filing.
 * youtube joined at s90 (founder ruling s89: "Youtube as a destination") —
 * the BUILD half only: key, capability rows, settings schema and driver ship
 * disarmed; the OAuth connect flow waits on the founder's Google portal app.
 */
export const SOCIAL_PLATFORMS = [
  "linkedin",
  "x",
  "facebook",
  "instagram",
  "tiktok",
  "reddit",
  "bluesky",
  "youtube",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS);

/**
 * Executable ceiling on per-platform daily posting — the outreach ≤50/day
 * convention applied to social: no tenant config can exceed it, whatever
 * the UI or an operator asks for. Conservative by design; raising it is a
 * deliberate contract change, never a config drift.
 */
export const SOCIAL_MAX_POSTS_PER_DAY_CEILING = 10;

const dailyCap = z
  .number()
  .int()
  .min(0)
  .max(SOCIAL_MAX_POSTS_PER_DAY_CEILING);

/** Per-platform cadence knobs (0 = platform configured but paused). */
export const socialCadenceSchema = z.object({
  maxPostsPerDay: dailyCap.default(1),
});
export type SocialCadence = z.infer<typeof socialCadenceSchema>;

/**
 * Reddit's cadence block carries the one platform-specific posting setting
 * the driver needs: WHERE to submit. Absent = the connected account's own
 * profile (`u_<username>` — every account has one, so a fresh connection
 * posts without configuration). A community subreddit is a deliberate
 * per-tenant choice; bare name, no "r/" prefix.
 */
export const socialRedditCadenceSchema = socialCadenceSchema.extend({
  subreddit: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_]+$/, "bare subreddit name — no r/ prefix, no slashes")
    .optional(),
});
export type SocialRedditCadence = z.infer<typeof socialRedditCadenceSchema>;

/**
 * The tenant's social publishing config block — explicit optional field per
 * platform (never a record-over-enum: zod 4's exhaustive-record semantics
 * would demand every platform configured at once). An absent platform =
 * not configured = the refusal ladder's "unarmed platform" rung.
 */
export const socialPublishConfigSchema = z.object({
  linkedin: socialCadenceSchema.optional(),
  x: socialCadenceSchema.optional(),
  facebook: socialCadenceSchema.optional(),
  instagram: socialCadenceSchema.optional(),
  tiktok: socialCadenceSchema.optional(),
  reddit: socialRedditCadenceSchema.optional(),
  bluesky: socialCadenceSchema.optional(),
  youtube: socialCadenceSchema.optional(),
});
export type SocialPublishConfig = z.infer<typeof socialPublishConfigSchema>;
