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

/**
 * Control-arc part A (s102): the ARM STATE — an authorization fact, held per
 * DESTINATION rather than for the whole queue.
 *
 * `SOCIAL_QUEUE_ARMED` is one boolean over every platform and every draft, so
 * letting a single Bluesky post out arms everything that is due. Klaviyo arms
 * per MESSAGE, and its middle rung routes the recipient to a review tab
 * instead of sending — which is Approve, arrived at independently. We take the
 * granularity, not the vocabulary:
 *
 *   off     this destination is not authorized; due rows are not touched
 *   review  due rows are HELD and surfaced as needing the operator
 *   live    the consumer may publish this destination's due rows
 *
 * `off` is first because it is the default and the safe end of the ladder.
 *
 * ⛔ This NARROWS the blast radius of a GO, it does not widen it: the master
 * env key and the per-destination state are AND, so a master-armed tick with
 * no per-destination config publishes nothing at all.
 *
 * It lives HERE, not beside the queue vocabulary in `./publish-queue.ts` as
 * the spec first drew it: that module already imports this one for
 * `socialPlatformSchema`, so declaring the arm state there and reading it here
 * is a circular import that leaves one of the two schemas in TDZ at barrel
 * eval. Grounded and corrected s102.
 */
export const ARM_STATES = ["off", "review", "live"] as const;
export type ArmState = (typeof ARM_STATES)[number];
export const armStateSchema = z.enum(ARM_STATES);

/**
 * Control-arc part A2 (s103, founder directive): the tenant-level POSTING
 * SCOPE above the per-destination arm states.
 *
 * ```
 * selective  each destination's own armState governs — part A's behaviour, exactly
 * all        every CONFIGURED destination's `off` is READ as `live`
 * ```
 *
 * It is an OVERLAY, never a mutation: `all` changes how the stored states are
 * READ, never what is stored. Flipping back to `selective` therefore restores
 * precisely the arrangement the operator left, with no "which ones were on
 * before?" to reconstruct — that property is what makes the mode safe to try.
 *
 * Three bindings, all load-bearing:
 * 1. It sits UNDER the master key, never beside it. Three gates, all AND:
 *    `SOCIAL_QUEUE_ARMED` → scope → (in `selective`) the destination's state.
 *    `all` cannot arm anything the master key has not already armed.
 * 2. **`all` never overrides an explicit `review`.** A hold the operator
 *    deliberately asked for is not cancelled by a scope switch. `all` raises
 *    `off` → `live` and leaves `review` alone — the one place `all`
 *    deliberately does not mean *all*.
 * 3. It is LIVE, not a snapshot: a platform configured next month is raised
 *    by `all` without the operator touching this field again. A snapshot
 *    calling itself "all" would be a lie with a delay on it.
 *
 * ⛔ CONFIGURED, not merely connected — corrected by grounding at build time,
 * and the spec's prose said otherwise. A connected credential does NOT create
 * an entry in this block (nothing in the connect path writes one; the only
 * writer is a profile config write), and the publish door's rung (c) refuses a
 * platform with no entry. Since a queue row that is CLAIMED and then refused
 * is marked `failed` — TERMINAL by contract, no retry ladder — reading an
 * absent entry as `live` would burn drafts that `off` merely holds. So an
 * absent entry stays `off` under `all`, and the surface owes the true
 * sentence ("channels you have configured for posting") rather than the
 * spec's original "new channels you connect will post automatically".
 */
export const POSTING_SCOPES = ["selective", "all"] as const;
export type PostingScope = (typeof POSTING_SCOPES)[number];
export const postingScopeSchema = z.enum(POSTING_SCOPES);

/**
 * The Integrations arm control's write body (s103): ONE flip per request.
 *
 * A union rather than one bag with every field optional, because the two
 * flips are different facts — a destination's own state, or the tenant-wide
 * mode — and a bag would accept `{}` (a write that changes nothing) and
 * `{platform}` without a state. The door should not have to re-check what the
 * shape can simply refuse.
 */
export const socialArmingWriteSchema = z.union([
  z.object({ platform: socialPlatformSchema, armState: armStateSchema }),
  z.object({ postingScope: postingScopeSchema }),
]);
export type SocialArmingWrite = z.infer<typeof socialArmingWriteSchema>;

/**
 * Per-platform cadence knobs.
 *
 * `maxPostsPerDay: 0` and `armState: "off"` are NOT the same fact and must
 * never be collapsed: paused is a CADENCE answer ("no more today"), armed is
 * an AUTHORIZATION answer ("may this destination publish at all"). A tenant
 * can legitimately be `live` with a cap of 0 for the rest of the day.
 *
 * `armState` defaults to `off`, so every config written before s102 reads
 * back unauthorized — absence disarms, which is this block's standing rule.
 */
export const socialCadenceSchema = z.object({
  maxPostsPerDay: dailyCap.default(1),
  armState: armStateSchema.default("off"),
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
 *
 * `postingScope` (part A2) is the one NON-platform field here, and it is safe
 * to sit beside them because every reader of this block is a KEYED lookup —
 * `publish.ts` `config[platform]`, `social-arming.ts` and `cards.ts`
 * `config?.[destination]` — and nothing anywhere iterates the block's own
 * keys, so a scalar field can never be mistaken for a platform. Verified
 * before it was specced, re-verified at build time; no migration (the column
 * is jsonb, and the default makes a pre-A2 block read back as today's
 * behaviour).
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
  postingScope: postingScopeSchema.default("selective"),
});
export type SocialPublishConfig = z.infer<typeof socialPublishConfigSchema>;
