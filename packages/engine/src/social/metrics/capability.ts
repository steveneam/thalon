import { SOCIAL_PLATFORMS, type SocialPlatform } from "@thalon/contracts";

/**
 * D2 (s87): **what a platform will tell us about a post WE published** — the
 * measurement half of `../capability.ts`. That one encodes what a platform
 * ACCEPTS; this one encodes what it REPORTS, and both are data with a
 * `verifiedOn` stamp rather than knowledge living in a driver's head.
 *
 * ⚠ THE HONESTY RULE THIS FILE EXISTS TO SERVE. `publication_metrics` has no
 * nullable value and no "unavailable" flag: **a platform that cannot report a
 * metric yields NO ROW for it**, and absence is the entire way the Analytics
 * surface says "not measured". That makes absence ambiguous on its own — a
 * missing `reach` row could mean "the platform will never tell us", "the
 * token lacks the permission", or "the tick has not run yet". THIS TABLE is
 * what disambiguates it: every refusal carries the platform's own reason and
 * a `permanence`, so the surface can write *"no impressions in the API"*
 * under Bluesky and *"partner-gated"* under LinkedIn instead of the same
 * blank cell twice.
 *
 * **Conservative by construction, same as the fit matrix.** A metric is
 * listed under `reports` only when the platform's published docs say the
 * endpoint returns it for a post the authenticated account owns. Anything
 * doubtful is a refusal with its reason — an over-claimed capability makes
 * the surface promise a number that never arrives, which is worse than an
 * honest "not measured".
 */

/** Checked against each platform's published developer docs on this date. */
const VERIFIED_ON = "2026-07-29";

/**
 * The canonical metric vocabulary. `publication_metrics.metric_label` is
 * deliberately generic TEXT (platform words are data), but a roll-up across
 * platforms is impossible without one spelling per concept — so drivers
 * normalise to these labels and record the platform's own field name beside
 * the number as provenance. Adding a label is a reviewed change here, not a
 * string a driver invents.
 */
export const METRIC_LABELS = [
  // Audience family — how many saw it. NEVER summed with engagement.
  "views",
  "impressions",
  "reach",
  // Engagement family — what they did about it.
  "likes",
  "reactions",
  "comments",
  "replies",
  "reposts",
  "quotes",
  "shares",
  "saves",
  "bookmarks",
  "clicks",
  "score",
  // Quality family — ratios and rates. Never summed with anything.
  "upvote_ratio",
] as const;
export type MetricLabel = (typeof METRIC_LABELS)[number];

export type MetricFamily = "audience" | "engagement" | "quality";

/**
 * Which family a label belongs to — EXPLICIT rather than inferred, because
 * the one thing a roll-up must never do is add a ratio to a count. Reddit's
 * `upvote_ratio` is the reason this map exists at all: it is a real,
 * useful number that would be nonsense inside a sum.
 */
export const METRIC_FAMILIES: Readonly<Record<MetricLabel, MetricFamily>> = {
  views: "audience",
  impressions: "audience",
  reach: "audience",
  likes: "engagement",
  reactions: "engagement",
  comments: "engagement",
  replies: "engagement",
  reposts: "engagement",
  quotes: "engagement",
  shares: "engagement",
  saves: "engagement",
  bookmarks: "engagement",
  clicks: "engagement",
  score: "engagement",
  upvote_ratio: "quality",
};

/**
 * WHY a number will never arrive — the distinction the wrap's capability
 * table is FOR, and the one the surface renders:
 *
 *  - `structural` — the platform does not compute this at all. Nothing we
 *    can do, ever, short of the platform shipping it (Bluesky impressions).
 *  - `retired` — the platform HAD it and removed it. Historical rows may
 *    exist and must not be read as current (Facebook's impressions family).
 *  - `gated` — the API exists but access is granted to selected partners.
 *    An application, not a config change (LinkedIn).
 *  - `permissioned` — the API exists and we could have it; THIS token or app
 *    lacks the permission. A reconnect with the right scope fixes it (Meta
 *    insights permissions).
 *  - `no_driver` — we never built the road. Ours to fix, not the platform's.
 */
export type MetricAbsence = "structural" | "retired" | "gated" | "permissioned" | "no_driver";

export interface MetricReported {
  label: MetricLabel;
  /** The platform's own field/metric name, verbatim — travels with the number as provenance. */
  platformField: string;
  note?: string;
}

export interface MetricRefused {
  label: MetricLabel;
  permanence: MetricAbsence;
  /** The operator-facing sentence, in the platform's terms — rendered verbatim by the surface. */
  reason: string;
}

export interface PlatformMetricCapability {
  platform: SocialPlatform;
  /** `null` = no reader is built for this platform at all; every label is absent for `no_driver` reasons. */
  reader: string | null;
  /** What a successful read can return. A label absent from a real response is still ABSENT — this is the ceiling, not a promise. */
  reports: readonly MetricReported[];
  /** What will never arrive, and why — the surface's "not measured" copy. */
  refuses: readonly MetricRefused[];
  /**
   * This platform's best answer to "how many saw it", or `null` when it
   * measures no audience at all. The cross-platform audience roll-up sums
   * exactly these, one per platform, and NAMES which platforms are in it —
   * a chart that silently averaged in the platforms we cannot measure would
   * be the prettiest lie on the surface (the sheet's own words).
   */
  audienceLabel: MetricLabel | null;
  /** Set when reading this platform's metrics COSTS money — the tick has to be able to say so out loud. */
  metered?: string;
  /** The docs this row was read from, so a stale claim is visible rather than assumed current. */
  docs: string;
  verifiedOn: string;
}

/**
 * The matrix. Complete over `SOCIAL_PLATFORMS` on purpose — a missing entry
 * would read as "no limits on what we know", which is never true. Pinned
 * total by a test, exactly like the fit matrix.
 */
export const METRIC_CAPABILITIES: Readonly<Record<SocialPlatform, PlatformMetricCapability>> = {
  /**
   * AppView `app.bsky.feed.getPosts` returns the counts on every postView.
   * Verified against the live lexicon (lexicons/app/bsky/feed/defs.json,
   * `postView`): likeCount, repostCount, replyCount, quoteCount,
   * bookmarkCount — and NOTHING view-shaped. Bluesky computes no impression
   * number anywhere in the protocol, which is why its refusal is structural
   * rather than a permission we could go and ask for.
   */
  bluesky: {
    platform: "bluesky",
    reader: "bluesky-getposts",
    reports: [
      { label: "likes", platformField: "likeCount" },
      { label: "reposts", platformField: "repostCount" },
      { label: "replies", platformField: "replyCount" },
      { label: "quotes", platformField: "quoteCount" },
      {
        label: "bookmarks",
        platformField: "bookmarkCount",
        note: "newer AppViews only — an AppView that omits it yields no row, which is the correct absence",
      },
    ],
    refuses: [
      {
        label: "impressions",
        permanence: "structural",
        reason:
          "no impressions in the API — the AT Protocol's postView carries engagement counts only; Bluesky computes no view or impression number for anyone",
      },
      {
        label: "reach",
        permanence: "structural",
        reason:
          "no impressions in the API — there is no unique-audience number in the protocol to read",
      },
    ],
    audienceLabel: null,
    docs: "https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/defs.json (postView)",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * `GET /2/tweets?ids=…&tweet.fields=public_metrics` → retweet_count,
   * reply_count, like_count, quote_count, bookmark_count, impression_count.
   * The docs put public_metrics behind "any authentication method" with no
   * time limit, for any post — so this is the one platform that hands us an
   * impressions number without a special permission.
   *
   * ⚠ AND IT IS THE ONE THAT COSTS MONEY. X moved to metered pay-per-use
   * with no free read tier; every post this reader measures is a billed
   * resource. That is not a reason to hide the capability — it is a reason
   * the tick reports it and the founder decides, which is what `metered`
   * carries up to the surface.
   *
   * organic_metrics / non_public_metrics (url_link_clicks,
   * user_profile_clicks, engagements) would add click data for our OWN
   * posts, but only inside 30 days of posting and only under user-context
   * auth. Deliberately not read in v1: a metric that silently stops
   * existing on day 31 is a series that lies about its own gap.
   */
  x: {
    platform: "x",
    reader: "x-v2-public-metrics",
    reports: [
      { label: "impressions", platformField: "public_metrics.impression_count" },
      { label: "likes", platformField: "public_metrics.like_count" },
      { label: "replies", platformField: "public_metrics.reply_count" },
      { label: "reposts", platformField: "public_metrics.retweet_count" },
      { label: "quotes", platformField: "public_metrics.quote_count" },
      { label: "bookmarks", platformField: "public_metrics.bookmark_count" },
    ],
    refuses: [
      {
        label: "reach",
        permanence: "structural",
        reason:
          "X reports impressions, not unique reach — public_metrics carries impression_count and no unique-audience figure",
      },
      {
        label: "clicks",
        permanence: "permissioned",
        reason:
          "url_link_clicks lives in non_public_metrics: user-context auth, own posts, and only within 30 days of posting — not read here, because a metric that vanishes on day 31 would leave a hole nothing distinguishes from a failure",
      },
    ],
    audienceLabel: "impressions",
    metered:
      "X reads are billed per resource under its pay-per-use API — every post measured here spends real money",
    docs: "https://docs.x.com/x-api/fundamentals/metrics",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * `GET /{post-id}/insights?metric=…` under `read_insights` +
   * `pages_read_engagement`, with a page token from someone holding the
   * ANALYZE task.
   *
   * ⚠ THE IMPRESSIONS FAMILY IS GONE, and this is the finding that most
   * changes what the Analytics sheet can draw. Meta retired
   * `post_impressions_unique` (and its paid/fan/organic/viral variants) on
   * 2025-06-15 and `post_impressions*` on 2025-11-15, directing callers to
   * `post_media_view`. The sheet's fixture shows Facebook reporting reach;
   * the platform stopped reporting it under that name a year before this
   * lane. What survives IS a unique-audience metric —
   * `post_total_media_view_unique` — so the reach COLUMN lives, under a
   * different platform word, and this row records the swap rather than
   * quietly asking for a metric that now errors.
   */
  facebook: {
    platform: "facebook",
    reader: "facebook-post-insights",
    reports: [
      {
        label: "views",
        platformField: "post_media_view",
        note: "the impressions replacement — times the content was played or displayed",
      },
      {
        label: "reach",
        platformField: "post_total_media_view_unique",
        note: "unique media viewers; the surviving unique-audience metric after the 2025 impressions retirement",
      },
      { label: "clicks", platformField: "post_clicks" },
      {
        label: "reactions",
        platformField: "post_reactions_by_type_total",
        note: "the named reaction types summed — the metric is a per-type map and this is its own stated total",
      },
    ],
    refuses: [
      {
        label: "impressions",
        permanence: "retired",
        reason:
          "Meta retired post_impressions on 2025-11-15 (and post_impressions_unique on 2025-06-15) in favour of post_media_view — asking for it now returns an invalid-metric error, so nothing is asked",
      },
      {
        label: "comments",
        permanence: "no_driver",
        reason:
          "comment and share counts are fields on the post object (comments.summary / shares), not Page Insights metrics — a second call this lane did not build",
      },
      {
        label: "shares",
        permanence: "no_driver",
        reason:
          "comment and share counts are fields on the post object (comments.summary / shares), not Page Insights metrics — a second call this lane did not build",
      },
    ],
    audienceLabel: "reach",
    docs: "https://developers.facebook.com/docs/graph-api/reference/insights/ + .../pages-api/platforminsights/page/deprecated-metrics",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * `GET /{ig-media-id}/insights?metric=…` on the same Graph host the
   * publisher posts through (Facebook Login flavour), under `instagram_basic`
   * + `instagram_manage_insights` + `pages_read_engagement`.
   *
   * `impressions` and `video_views` were deprecated at v22 in favour of
   * `views`; our driver pins v23, so `views` is the only audience metric
   * asked for. `reach` survives and is the unique-audience answer.
   */
  instagram: {
    platform: "instagram",
    reader: "instagram-media-insights",
    reports: [
      { label: "views", platformField: "views", note: "replaced impressions/video_views at v22" },
      { label: "reach", platformField: "reach" },
      { label: "likes", platformField: "likes" },
      { label: "comments", platformField: "comments" },
      { label: "saves", platformField: "saved" },
      { label: "shares", platformField: "shares" },
    ],
    refuses: [
      {
        label: "impressions",
        permanence: "retired",
        reason:
          "Instagram deprecated impressions at Graph v22 in favour of views — the driver pins v23, so the metric no longer exists on this road",
      },
    ],
    audienceLabel: "reach",
    docs: "https://developers.facebook.com/docs/instagram-platform/insights",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * ⛔ NO ROAD, AND IT IS WORTH BEING PRECISE ABOUT WHY — both LinkedIn
   * roads are shut, and for different reasons:
   *
   *  1. `organizationalEntityShareStatistics` (impressions, clicks, likes,
   *     comments, shares, engagement rate) is the Community Management API:
   *     partner-approved, `rw_organization_admin`, and ORGANISATION shares
   *     only. Our driver authors as `urn:li:person:<sub>` — a member post —
   *     so even with partner approval this endpoint would not describe our
   *     posts.
   *  2. `socialActions/{ugcPostUrn}` (likesSummary, commentsSummary) DOES
   *     cover member posts, and the permission that reads them,
   *     `r_member_social_feed`, is marked **Restricted — granted to select
   *     developers only**. `w_member_social_feed` (what our publisher holds)
   *     writes but does not read.
   *
   * So: partner-gated, and doubly so. Not a scope we can add, not a config
   * change — an application. The surface says "partner-gated" and means it.
   */
  linkedin: {
    platform: "linkedin",
    reader: null,
    reports: [],
    refuses: [
      {
        label: "impressions",
        permanence: "gated",
        reason:
          "partner-gated — post impressions live in organizationalEntityShareStatistics (Community Management API, partner-approved, rw_organization_admin) and cover ORGANISATION shares; we author member posts, which that endpoint does not describe",
      },
      {
        label: "reach",
        permanence: "gated",
        reason:
          "partner-gated — same endpoint, same gate; LinkedIn exposes no unique-reach figure for member posts on any road",
      },
      {
        label: "likes",
        permanence: "gated",
        reason:
          "partner-gated — socialActions returns likesSummary for member posts, but reading it needs r_member_social_feed, which LinkedIn marks Restricted and grants to select developers only; our token's w_member_social_feed writes without reading",
      },
      {
        label: "comments",
        permanence: "gated",
        reason:
          "partner-gated — commentsSummary sits behind the same Restricted r_member_social_feed permission",
      },
    ],
    audienceLabel: null,
    docs: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/network-update-social-actions",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * `GET /api/info?id=t3_…` on the OAuth host under the `read` scope — the
   * fullname our publisher already records as `externalPostId` is exactly
   * this endpoint's key.
   *
   * `view_count` exists on the link object but is null for ordinary callers
   * (it is populated for subreddit moderators), so it is refused rather than
   * read: a field that is present-but-null for us would append nothing
   * anyway, and saying so is better than a mystery gap. `upvote_ratio` IS
   * read — it is real and useful — and lands in the `quality` family, where
   * no sum can ever pick it up.
   */
  reddit: {
    platform: "reddit",
    reader: "reddit-info",
    reports: [
      {
        label: "score",
        platformField: "score",
        note: "NET votes (ups minus downs) — a heavily-downvoted post can pull an engagement roll-up down, which is the honest arithmetic",
      },
      { label: "comments", platformField: "num_comments" },
      { label: "upvote_ratio", platformField: "upvote_ratio", note: "a ratio — quality family, never summed" },
    ],
    refuses: [
      {
        label: "impressions",
        permanence: "permissioned",
        reason:
          "view_count is returned only to subreddit moderators — for an ordinary poster the field is null, so no impression figure exists to record",
      },
      {
        label: "reach",
        permanence: "structural",
        reason: "Reddit publishes no unique-audience figure for a post on any endpoint",
      },
    ],
    audienceLabel: null,
    docs: "https://www.reddit.com/dev/api/#GET_api_info",
    verifiedOn: VERIFIED_ON,
  },

  /**
   * No publisher, so no publications, so nothing to measure. TikTok is
   * platform-review-gated and ships no driver at all (the registry's own
   * words); its metrics row exists only so the matrix stays total.
   */
  tiktok: {
    platform: "tiktok",
    reader: null,
    reports: [],
    refuses: [
      {
        label: "views",
        permanence: "no_driver",
        reason:
          "no TikTok driver ships — the platform is review-gated and nothing here has ever posted to it, so there is nothing to measure",
      },
    ],
    audienceLabel: null,
    docs: "n/a — no driver",
    verifiedOn: VERIFIED_ON,
  },
};

/** The matrix lookup. An unknown platform is a programming error, not a branch. */
export function metricCapability(platform: SocialPlatform): PlatformMetricCapability {
  return METRIC_CAPABILITIES[platform];
}

/** Every platform whose reader can answer "how many saw it" — what the audience roll-up is allowed to include. */
export function platformsReportingAudience(): SocialPlatform[] {
  return SOCIAL_PLATFORMS.filter((p) => METRIC_CAPABILITIES[p].audienceLabel !== null);
}

/**
 * The stated reason a platform reports no audience number, for the surface's
 * cell. Prefers the `reach` refusal (the column the operator is looking at),
 * then any audience-family refusal, and falls back to a sentence that is
 * still true rather than an empty string.
 */
export function audienceAbsence(
  platform: SocialPlatform,
): { reason: string; permanence: MetricAbsence } | null {
  const capability = METRIC_CAPABILITIES[platform];
  if (capability.audienceLabel !== null) return null;
  const refusal =
    capability.refuses.find((r) => r.label === "reach") ??
    capability.refuses.find((r) => METRIC_FAMILIES[r.label] === "audience") ??
    capability.refuses[0];
  if (refusal) return { reason: refusal.reason, permanence: refusal.permanence };
  return {
    reason: `${platform} reports no audience metric for a post`,
    permanence: capability.reader === null ? "no_driver" : "structural",
  };
}

/** The labels a platform's reader will ask for — the driver's own request list, derived from the matrix so the two cannot drift. */
export function reportedLabels(platform: SocialPlatform): MetricLabel[] {
  return METRIC_CAPABILITIES[platform].reports.map((r) => r.label);
}
