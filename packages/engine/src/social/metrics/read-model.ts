import { socialPlatformSchema, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import type { Repos, SocialPublicationRow } from "@thalon/db";
import {
  audienceAbsence,
  metricCapability,
  METRIC_FAMILIES,
  type MetricAbsence,
  type MetricLabel,
} from "./capability";
import { standingMetricsDeferral } from "./deferral";

/**
 * D2 (s87): the ANALYTICS READ-MODEL — engine-side only, no UI. What the
 * Analytics sheet's tiles, per-post table and per-channel roll-up need, in
 * one shape, with the honesty rules already applied so the surface cannot
 * accidentally un-apply them.
 *
 * ⚠ THE RULE THIS FILE EXISTS TO KEEP, in the sheet's own words: *"a chart
 * that silently averaged in the platforms we cannot measure would be the
 * prettiest lie on this surface"*. Three consequences, all structural here:
 *
 *   1. **Every roll-up names its members.** An audience total carries
 *      `platformsReporting` AND `platformsNotReporting` with each one's
 *      reason — the tile's "3 of 5 platforms report reach" line is data, not
 *      a sentence someone typed under a number.
 *   2. **An absent number is `null`, never 0**, and always arrives with a
 *      reason and a permanence. `value: 0` on this model means a platform
 *      measured zero, which is a different fact and reads differently.
 *   3. **A row with nothing measured gets no trend at all** (`trend: null`),
 *      because a flat line at zero reads as "measured, and it was nothing".
 *
 * Families never mix: the audience roll-up sums each platform's ONE declared
 * audience label (Facebook's `reach`, X's `impressions` — different platform
 * words for the nearest honest answer, named per platform in `parts`), the
 * engagement roll-up sums the engagement family, and the `quality` family
 * (Reddit's `upvote_ratio`) is never summed by anything.
 */

/**
 * The metric row shape, DERIVED from the frozen repo's own read rather than
 * re-declared here. `@thalon/db` does not re-export the row type, and adding
 * an export to its public surface would be an edit outside this lane's file
 * set — deriving keeps the repo the single authority on its own shape either
 * way, so a column change lands here as a type error rather than as drift.
 */
type PublicationMetricRow = Awaited<
  ReturnType<Repos["publicationMetrics"]["series"]>
>[number];

/** How many publications one read considers, newest first. */
const DEFAULT_LIMIT = 100;
/** The default window the sheet draws. */
const DEFAULT_WINDOW_DAYS = 28;

/**
 * One number on the surface, or an honest hole where it would be.
 * `value === null` and `value === 0` are DIFFERENT facts and the surface
 * renders them differently: the first is a sentence, the second is a zero.
 */
export interface MetricCell {
  value: number | null;
  /** What went into `value`, with each platform's own field name — the tooltip's provenance. */
  parts: Array<{ label: MetricLabel; value: number; platformField: string }>;
  /** Why there is no number. Present only when `value === null`. */
  reason?: string;
  /** Permanent, retired, gated, permissioned, or simply not collected yet. */
  absence?: MetricAbsence | "not_collected";
  /** The `captured_at` of the newest row behind `value` — every number on this surface carries its as-of. */
  asOf: Date | null;
}

export interface PostAnalyticsRow {
  publicationId: string;
  draftId: string;
  platform: SocialPlatform;
  externalPostId: string;
  publishedAt: Date;
  /** "How many saw it", in this platform's nearest honest term. */
  audience: MetricCell;
  engagement: MetricCell;
  /**
   * The row's sparkline: the audience series where the platform reports one,
   * else the engagement series. `null` = draw NOTHING — never a flat zero.
   */
  trend: { label: MetricLabel; points: Array<{ at: Date; value: number }> } | null;
  /** Newest measurement of any kind on this post. `null` = never measured. */
  asOf: Date | null;
}

export interface ChannelAnalyticsRow {
  platform: SocialPlatform;
  /** Publications on this platform inside the window. */
  published: number;
  audience: MetricCell;
  engagement: MetricCell;
  /** False = this platform reports no audience figure at all; the surface writes the reason, not a 0. */
  reportsAudience: boolean;
  asOf: Date | null;
}

export interface AnalyticsTile {
  value: number | null;
  /** The same measure over the preceding window of equal length — `null` when it cannot be known. */
  previous: number | null;
  /** `value - previous`, or `null` when either side is unknown. */
  delta: number | null;
  /** The percentage move, or `null`. Deliberately absent when `previous` is 0: a jump from nothing is not a percentage. */
  deltaPct: number | null;
  /** Platforms whose numbers are IN this total. */
  platformsReporting: SocialPlatform[];
  /** Platforms posted to in the window that are NOT in it, each with its reason — the tile's honest footnote. */
  platformsNotReporting: Array<{ platform: SocialPlatform; reason: string; permanence: MetricAbsence }>;
  asOf: Date | null;
}

export interface AnalyticsReadModel {
  window: { from: Date; to: Date };
  /** The comparison window: the same length, immediately before. */
  previousWindow: { from: Date; to: Date };
  /** Publications in the window — from OUR OWN rows, so this one is always complete. */
  published: { count: number; previous: number; delta: number };
  audience: AnalyticsTile;
  engagement: AnalyticsTile;
  posts: PostAnalyticsRow[];
  channels: ChannelAnalyticsRow[];
  /**
   * The bound, stated. `truncated` = the page did not reach the start of the
   * previous window, so the deltas are computed over less than they claim and
   * the surface must say so rather than presenting them as complete.
   */
  bound: { limit: number; windowDays: number; totalPublications: number; truncated: boolean };
}

export interface AnalyticsReadModelDeps {
  repos: Repos;
  ctx: TenantCtx;
}

export interface AnalyticsReadModelInput {
  /** Window length in days (the sheet's "Last 28 days"). */
  windowDays?: number;
  /** How many recent publications to consider — covers BOTH windows. */
  limit?: number;
}

/**
 * THE read. One publications page, then ONE batch series read across every
 * publication in BOTH windows (`seriesForPublications` — s87's stated flag,
 * resolved by this lane with an additive repo method and no schema change).
 * Two queries total, where the spine's first cut made `1 + N` (one `series`
 * per publication, ≤100 at the default bound). The series shape is kept over
 * `latestPerLabel` for the same reason as before: ascending order answers
 * both questions at once — the last write per label IS the newest value, and
 * the whole series IS the sparkline.
 *
 * The clock is an argument, as everywhere else in the engine.
 */
export async function analyticsReadModel(
  deps: AnalyticsReadModelDeps,
  input: AnalyticsReadModelInput,
  now: Date,
): Promise<AnalyticsReadModel> {
  const { repos, ctx } = deps;
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const limit = input.limit ?? DEFAULT_LIMIT;
  const windowMs = windowDays * 24 * 60 * 60_000;
  const to = now;
  const from = new Date(now.getTime() - windowMs);
  const previousWindow = { from: new Date(from.getTime() - windowMs), to: from };

  const { rows, total } = await repos.socialPublications.listRecent(ctx, limit);
  const current = rows.filter((r) => inRange(r.publishedAt, from, to));
  const previous = rows.filter((r) => inRange(r.publishedAt, previousWindow.from, previousWindow.to));

  // The page ran out before the comparison window began — the deltas below
  // are over a partial previous window and the surface has to know.
  const oldest = rows[rows.length - 1]?.publishedAt;
  const truncated =
    total > rows.length && (oldest === undefined || oldest.getTime() > previousWindow.from.getTime());

  // One batch read covers both windows — a publication with no rows simply
  // has no key, and its absence is worded from the capability matrix below.
  const seriesById = await repos.publicationMetrics.seriesForPublications(ctx, [
    ...current.map((r) => r.id),
    ...previous.map((r) => r.id),
  ]);
  const posts = current.map((row) => postRow(row, seriesById[row.id] ?? []));
  // The comparison window's numbers are needed as totals only, never as rows.
  const previousRows = previous.map((row) => postRow(row, seriesById[row.id] ?? []));

  return {
    window: { from, to },
    previousWindow,
    published: {
      count: current.length,
      previous: previous.length,
      delta: current.length - previous.length,
    },
    audience: tile(posts, previousRows, "audience"),
    engagement: tile(posts, previousRows, "engagement"),
    posts,
    channels: channelRows(posts),
    bound: { limit, windowDays, totalPublications: total, truncated },
  };
}

function inRange(at: Date, from: Date, to: Date): boolean {
  const t = at.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/** One publication's row, built from its whole series — pure over rows the batch read already fetched. */
function postRow(row: SocialPublicationRow, series: PublicationMetricRow[]): PostAnalyticsRow {
  const platform = socialPlatformSchema.parse(row.platform);
  const capability = metricCapability(platform);

  // series() is oldest-first, so the last write per label IS the newest.
  const latest = new Map<string, PublicationMetricRow>();
  const byLabel = new Map<string, PublicationMetricRow[]>();
  for (const metric of series) {
    latest.set(metric.metricLabel, metric);
    const points = byLabel.get(metric.metricLabel);
    if (points) points.push(metric);
    else byLabel.set(metric.metricLabel, [metric]);
  }

  const audience = audienceCell(platform, latest);
  const engagement = engagementCell(platform, latest);

  // The sparkline follows whichever family this platform can actually
  // measure. A platform with no audience number gets an engagement
  // sparkline; a post with nothing measured gets NO line at all.
  const trendLabel =
    capability.audienceLabel !== null && latest.has(capability.audienceLabel)
      ? capability.audienceLabel
      : bestEngagementLabel(platform, latest);
  const points = trendLabel ? (byLabel.get(trendLabel) ?? []) : [];
  const trend =
    trendLabel && points.length > 0
      ? {
          label: trendLabel,
          points: points.map((p) => ({ at: p.capturedAt, value: p.metricValue })),
        }
      : null;

  return {
    publicationId: row.id,
    draftId: row.draftId,
    platform,
    externalPostId: row.externalPostId,
    publishedAt: row.publishedAt,
    audience,
    engagement,
    trend,
    asOf: newest([audience.asOf, engagement.asOf]),
  };
}

/**
 * The audience cell. A platform with no audience label at all gets the
 * matrix's stated reason (Bluesky's "no impressions in the API", LinkedIn's
 * "partner-gated"); a platform that HAS one but has no row yet gets
 * `not_collected`, which is a different sentence with a different fix.
 */
function audienceCell(
  platform: SocialPlatform,
  latest: Map<string, PublicationMetricRow>,
): MetricCell {
  const capability = metricCapability(platform);
  const label = capability.audienceLabel;
  if (label === null) {
    const absence = audienceAbsence(platform);
    return {
      value: null,
      parts: [],
      reason: absence?.reason,
      absence: absence?.permanence,
      asOf: null,
    };
  }
  const metric = latest.get(label);
  if (!metric) {
    // A standing deferral is "we won't yet", NEVER "not collected yet" —
    // the second sentence invites the accidental armed pass the founder's
    // ruling exists to prevent. A historical row, if one exists, still
    // renders above: deferral explains new absence, it erases nothing.
    const deferral = standingMetricsDeferral(platform);
    if (deferral !== undefined) {
      return { value: null, parts: [], reason: deferral, absence: "deferred", asOf: null };
    }
    return {
      value: null,
      parts: [],
      reason: `no ${label} recorded for this post yet — the metrics tick has not measured it`,
      absence: "not_collected",
      asOf: null,
    };
  }
  const platformField =
    capability.reports.find((r) => r.label === label)?.platformField ?? label;
  return {
    value: metric.metricValue,
    parts: [{ label, value: metric.metricValue, platformField }],
    asOf: metric.capturedAt,
  };
}

/** The engagement cell: every engagement-family label this post has, summed. Quality-family labels can never reach it. */
function engagementCell(
  platform: SocialPlatform,
  latest: Map<string, PublicationMetricRow>,
): MetricCell {
  const capability = metricCapability(platform);
  const parts: MetricCell["parts"] = [];
  let asOf: Date | null = null;
  for (const reported of capability.reports) {
    if (METRIC_FAMILIES[reported.label] !== "engagement") continue;
    const metric = latest.get(reported.label);
    if (!metric) continue;
    parts.push({
      label: reported.label,
      value: metric.metricValue,
      platformField: reported.platformField,
    });
    asOf = newest([asOf, metric.capturedAt]);
  }
  if (parts.length === 0) {
    // Same rule as the audience cell: a deferred platform's empty cell says
    // "we won't yet" with the ruling, not "the tick has not measured it".
    const deferral = standingMetricsDeferral(platform);
    if (deferral !== undefined) {
      return { value: null, parts: [], reason: deferral, absence: "deferred", asOf: null };
    }
    const reports = capability.reports.some((r) => METRIC_FAMILIES[r.label] === "engagement");
    return {
      value: null,
      parts: [],
      reason: reports
        ? "no engagement recorded for this post yet — the metrics tick has not measured it"
        : (capability.refuses[0]?.reason ??
          `${platform} reports no engagement metric for a post`),
      absence: reports ? "not_collected" : (capability.refuses[0]?.permanence ?? "structural"),
      asOf: null,
    };
  }
  return { value: parts.reduce((sum, p) => sum + p.value, 0), parts, asOf };
}

/** The engagement label with the most signal for a sparkline — the platform's first reported engagement metric that actually has rows. */
function bestEngagementLabel(
  platform: SocialPlatform,
  latest: Map<string, PublicationMetricRow>,
): MetricLabel | null {
  for (const reported of metricCapability(platform).reports) {
    if (METRIC_FAMILIES[reported.label] !== "engagement") continue;
    if (latest.has(reported.label)) return reported.label;
  }
  return null;
}

/**
 * A headline tile. The total is over the platforms that answered; the ones
 * that did not are listed BY NAME with their reason, so the surface's
 * "N of M platforms" line and its footnote come from the same read.
 */
function tile(
  posts: PostAnalyticsRow[],
  previousPosts: PostAnalyticsRow[],
  family: "audience" | "engagement",
): AnalyticsTile {
  const measured = summarise(posts, family);
  const before = summarise(previousPosts, family);

  const notReporting = new Map<
    SocialPlatform,
    { platform: SocialPlatform; reason: string; permanence: MetricAbsence }
  >();
  for (const post of posts) {
    const cell = post[family];
    if (cell.value !== null) continue;
    if (notReporting.has(post.platform)) continue;
    if (measured.platforms.has(post.platform)) continue;
    notReporting.set(post.platform, {
      platform: post.platform,
      reason: cell.reason ?? `${post.platform} reported no ${family} figure`,
      permanence: (cell.absence === "not_collected" ? "permissioned" : cell.absence) ?? "structural",
    });
  }

  const value = measured.platforms.size > 0 ? measured.total : null;
  const previous = before.platforms.size > 0 ? before.total : null;
  return {
    value,
    previous,
    delta: value !== null && previous !== null ? value - previous : null,
    // A move from nothing is not a percentage — the surface shows the raw
    // delta instead of a "+∞%" that means nothing.
    deltaPct:
      value !== null && previous !== null && previous !== 0
        ? ((value - previous) / previous) * 100
        : null,
    platformsReporting: [...measured.platforms].sort(),
    platformsNotReporting: [...notReporting.values()].sort((a, b) =>
      a.platform < b.platform ? -1 : 1,
    ),
    asOf: measured.asOf,
  };
}

function summarise(
  posts: PostAnalyticsRow[],
  family: "audience" | "engagement",
): { total: number; platforms: Set<SocialPlatform>; asOf: Date | null } {
  let total = 0;
  const platforms = new Set<SocialPlatform>();
  let asOf: Date | null = null;
  for (const post of posts) {
    const cell = post[family];
    if (cell.value === null) continue;
    total += cell.value;
    platforms.add(post.platform);
    asOf = newest([asOf, cell.asOf]);
  }
  return { total, platforms, asOf };
}

/** The per-channel roll-up, over the same page of publications the posts came from — never a wider claim than was read. */
function channelRows(posts: PostAnalyticsRow[]): ChannelAnalyticsRow[] {
  const byPlatform = new Map<SocialPlatform, PostAnalyticsRow[]>();
  for (const post of posts) {
    const bucket = byPlatform.get(post.platform);
    if (bucket) bucket.push(post);
    else byPlatform.set(post.platform, [post]);
  }
  return [...byPlatform.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([platform, rows]) => {
      const capability = metricCapability(platform);
      const audience = rollUp(rows, "audience", platform);
      const engagement = rollUp(rows, "engagement", platform);
      return {
        platform,
        published: rows.length,
        audience,
        engagement,
        reportsAudience: capability.audienceLabel !== null,
        asOf: newest([audience.asOf, engagement.asOf]),
      };
    });
}

function rollUp(
  rows: PostAnalyticsRow[],
  family: "audience" | "engagement",
  platform: SocialPlatform,
): MetricCell {
  const parts: MetricCell["parts"] = [];
  let total = 0;
  let measured = 0;
  let asOf: Date | null = null;
  for (const row of rows) {
    const cell = row[family];
    if (cell.value === null) continue;
    total += cell.value;
    measured += 1;
    asOf = newest([asOf, cell.asOf]);
    for (const part of cell.parts) {
      const existing = parts.find((p) => p.label === part.label);
      if (existing) existing.value += part.value;
      else parts.push({ ...part });
    }
  }
  if (measured === 0) {
    // Every post on this channel is unmeasured — carry the first row's reason
    // rather than inventing a channel-level one, so the sentence the operator
    // reads is the platform's own.
    const first = rows[0]?.[family];
    return {
      value: null,
      parts: [],
      reason: first?.reason ?? `${platform} reported no ${family} figure`,
      absence: first?.absence ?? "structural",
      asOf: null,
    };
  }
  return { value: total, parts, asOf };
}

function newest(dates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const date of dates) {
    if (date === null) continue;
    if (best === null || date.getTime() > best.getTime()) best = date;
  }
  return best;
}
