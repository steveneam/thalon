import { platformLabel } from "@/lib/workspace/format";
import type { PipelineAsset } from "@/lib/workspace/types";
import type { AnalyticsModelWire, MetricCellWire } from "./client";

/**
 * The Analytics surface's presentation model — pure over the wire shapes, so
 * every honesty rule the sheet states is testable without a DOM:
 *
 *   · `value === null` and `value === 0` are DIFFERENT facts: the first
 *     renders as a sentence (with the platform's own reason riding the
 *     title), the second as a zero.
 *   · a delta from `previous: 0` is NOT a percentage — the raw delta shows.
 *   · a row with no series gets NO sparkline — never a flat line at zero.
 *   · every number carries its as-of, and provenance keeps the platform's
 *     own field name verbatim (`post_total_media_view_unique`, …).
 */

/**
 * Audience-family labels, mirrored from the capability matrix's
 * `METRIC_FAMILIES` (packages/engine/src/social/metrics/capability.ts).
 * Restated rather than imported because the engine's index also exports
 * server-side reader/tick modules this client bundle must not pull in;
 * the mirror is PINNED against the engine by analytics-model.test.ts, so
 * drift lands as a red test, not as a chart quietly mixing families.
 */
export const AUDIENCE_LABELS: ReadonlySet<string> = new Set(["views", "impressions", "reach"]);

/* ── formatters ─────────────────────────────────────────────────────────── */

/** The sheet's number register: `6,410` below 10k, `18.2k` above, tabular. */
export function fmtCount(n: number): string {
  const compact = (x: number, unit: string): string => {
    const s = (Math.round(x * 10) / 10).toFixed(1);
    return `${s.endsWith(".0") ? s.slice(0, -2) : s}${unit}`;
  };
  if (n >= 1_000_000) return compact(n / 1_000_000, "M");
  if (n >= 10_000) return compact(n / 1_000, "k");
  return n.toLocaleString("en-GB");
}

/** The sheet's date register: `22 Jul`. */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The s83b as-of grammar: `25 Jul 14:38`. */
export function fmtAsOf(d: Date): string {
  return `${fmtDay(d)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/* ── cells ──────────────────────────────────────────────────────────────── */

export interface CellView {
  kind: "number" | "absence";
  /** The FACT in the cell: a formatted number, or the absence's short honest word. */
  text: string;
  /** The RATIONALE behind the glyph: full reason, or as-of + per-field provenance. */
  title: string;
}

/**
 * The cell word for an honest hole. `deferred` gets its own word (the s87
 * ruling: "we won't yet", never "not collected"); `not_collected` names the
 * different fix; everything else leads with the platform reason's first
 * clause ("partner-gated", "no impressions in the API") — the full sentence
 * rides the title.
 */
export function absenceWord(cell: MetricCellWire): string {
  if (cell.absence === "deferred") return "deferred";
  if (cell.absence === "not_collected") return "not measured yet";
  const clause = cell.reason?.split(" — ")[0]?.trim();
  return clause !== undefined && clause !== "" ? clause : "not measured";
}

export function cellView(cell: MetricCellWire): CellView {
  if (cell.value === null) {
    return {
      kind: "absence",
      text: absenceWord(cell),
      title: cell.reason ?? "not measured",
    };
  }
  const asOf =
    cell.asOf !== null ? `as of ${fmtAsOf(new Date(cell.asOf))}` : "no capture time recorded";
  const parts = cell.parts.map(
    (p) => `${p.label} ${p.value.toLocaleString("en-GB")} — ${p.platformField}`,
  );
  return { kind: "number", text: fmtCount(cell.value), title: [asOf, ...parts].join("\n") };
}

/* ── post rows ──────────────────────────────────────────────────────────── */

export interface FeedsView {
  /** Never "✓ vN" today: the metrics→profile loop has no wire read, so no row may claim it fed back. */
  text: "pending" | "nothing to feed";
  title: string;
}

export interface PostView {
  id: string;
  draftId: string;
  platform: string;
  title: string;
  sub: string;
  /** The sheet's `.pmedia` chip word, or null = no chip (text posts draw none). */
  media: string | null;
  sentAt: Date;
  audience: CellView;
  engagement: CellView;
  /** Raw values kept beside the views for the sort keys — absences sort last, whatever the direction. */
  audienceValue: number | null;
  engagementValue: number | null;
  /** `null` = draw NOTHING (no series, or a single capture — one point has no shape). */
  trend: { label: string; values: number[] } | null;
  feeds: FeedsView;
}

/**
 * Join the read-model's rows to the plan read's lineage rows by draftId —
 * the same join Runs does — for the post cell's excerpt/format. A post the
 * plan window doesn't cover renders what the wire knows (platform + external
 * id), never an invented title.
 */
export function postViews(model: AnalyticsModelWire, assets: PipelineAsset[]): PostView[] {
  const byDraft = new Map(assets.map((a) => [a.draftId, a]));
  return model.posts.map((row) => {
    const asset = byDraft.get(row.draftId);
    const excerpt = asset?.excerpt.trim();
    const isVideo = asset?.format !== null && asset?.format !== undefined && asset.format.includes("video");
    const hasMetrics = row.audience.value !== null || row.engagement.value !== null;
    return {
      id: row.publicationId,
      draftId: row.draftId,
      platform: row.platform,
      title: excerpt !== undefined && excerpt !== "" ? excerpt : `Post on ${platformLabel(row.platform)}`,
      sub: asset
        ? [asset.format ?? "post", asset.deployRef].filter(Boolean).join(" · ")
        : row.externalPostId,
      media: isVideo ? "clip" : null,
      sentAt: new Date(row.publishedAt),
      audience: cellView(row.audience),
      engagement: cellView(row.engagement),
      audienceValue: row.audience.value,
      engagementValue: row.engagement.value,
      trend:
        row.trend !== null && row.trend.points.length >= 2
          ? { label: row.trend.label, values: row.trend.points.map((p) => p.value) }
          : null,
      feeds: hasMetrics
        ? {
            text: "pending",
            title:
              "Metrics exist, but the measure→profile write-back isn't wired yet — nothing has fed back.",
          }
        : {
            text: "nothing to feed",
            title: "No measured metrics on this post — there is nothing to feed back.",
          },
    };
  });
}

export type PostSort = "sent" | "reach" | "engagement";

export interface PostViewKnobs {
  platform: string | null;
  sort: PostSort;
  dir: "asc" | "desc";
}

/** Presentation-only view knobs. Absence cells sort LAST whatever the direction — a hole is not a small number. */
export function applyPostView(posts: PostView[], knobs: PostViewKnobs): PostView[] {
  const rows = knobs.platform !== null ? posts.filter((p) => p.platform === knobs.platform) : [...posts];
  const key = (p: PostView): number | null =>
    knobs.sort === "sent" ? p.sentAt.getTime() : knobs.sort === "reach" ? p.audienceValue : p.engagementValue;
  const sign = knobs.dir === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null && kb === null) return b.sentAt.getTime() - a.sentAt.getTime();
    if (ka === null) return 1;
    if (kb === null) return -1;
    if (ka !== kb) return sign * (ka - kb);
    return b.sentAt.getTime() - a.sentAt.getTime();
  });
  return rows;
}

/** The platform knob's option list — only platforms actually in the window. */
export function platformOptions(model: AnalyticsModelWire): string[] {
  return [...new Set(model.posts.map((p) => p.platform))].sort();
}

/* ── sparklines & the 28-day chart ──────────────────────────────────────── */

/**
 * SVG paths for a sparkline/area over evenly-spaced values. `null` for fewer
 * than two points — one capture has no shape, and drawing a flat line would
 * read as "measured, and it was nothing".
 */
export function sparkPaths(
  values: number[],
  w: number,
  h: number,
): { line: string; fill: string } | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const pad = 2;
  const pt = (v: number, i: number): string => {
    const x = (i / (values.length - 1)) * w;
    const y = span === 0 ? h / 2 : pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  };
  const line = `M${values.map((v, i) => pt(v, i)).join(" L")}`;
  return { line, fill: `${line} L${w},${h} L0,${h} Z` };
}

export interface DailySeries {
  /** One value per window day: the total as KNOWN by that day's end (last capture ≤ day, per post, summed). */
  values: number[];
  /** Who is in the line — the members every roll-up must name. */
  platforms: string[];
}

/**
 * The honest daily reconstruction: metric captures are cumulative snapshots,
 * so each day carries each post's last-known value, summed over the posts
 * whose series belongs to `family`. Empty when no post has such a series —
 * an empty chart, never an invented curve.
 */
export function dailyCumulative(
  model: AnalyticsModelWire,
  family: "audience" | "engagement",
): DailySeries {
  const posts = model.posts.filter(
    (p) => p.trend !== null && AUDIENCE_LABELS.has(p.trend.label) === (family === "audience"),
  );
  const platforms = [...new Set(posts.map((p) => p.platform))].sort();
  if (posts.length === 0) return { values: [], platforms };
  const from = new Date(model.window.from).getTime();
  const to = new Date(model.window.to).getTime();
  const days = model.bound.windowDays;
  const step = (to - from) / days;
  const values: number[] = [];
  for (let d = 1; d <= days; d += 1) {
    const cut = from + step * d;
    let total = 0;
    for (const post of posts) {
      let latest = 0;
      for (const point of post.trend?.points ?? []) {
        if (new Date(point.at).getTime() > cut) break; // series() is oldest-first
        latest = point.value;
      }
      total += latest;
    }
    values.push(total);
  }
  return { values, platforms };
}

/** The Published tile's spark: cumulative publications per day — always real, from our own rows. */
export function publishedDaily(model: AnalyticsModelWire): number[] {
  if (model.posts.length === 0) return [];
  const from = new Date(model.window.from).getTime();
  const to = new Date(model.window.to).getTime();
  const days = model.bound.windowDays;
  const step = (to - from) / days;
  const sent = model.posts.map((p) => new Date(p.publishedAt).getTime());
  const values: number[] = [];
  for (let d = 1; d <= days; d += 1) {
    const cut = from + step * d;
    values.push(sent.filter((t) => t <= cut).length);
  }
  return values;
}

export interface ChartView {
  reach: DailySeries | null;
  engagement: DailySeries | null;
  /** Five evenly-spaced date labels across the window — the sheet's `.x-ax`. */
  axis: string[];
  /** The "how this line is built" copy — every line names its members. */
  tip: string;
}

export function chartView(model: AnalyticsModelWire): ChartView {
  const reach = dailyCumulative(model, "audience");
  const engagement = dailyCumulative(model, "engagement");
  const from = new Date(model.window.from).getTime();
  const to = new Date(model.window.to).getTime();
  const axis = [0, 0.25, 0.5, 0.75, 1].map((f) => fmtDay(new Date(from + (to - from) * f)));
  const notIn = model.channels
    .filter((c) => !reach.platforms.includes(c.platform))
    .map((c) => platformLabel(c.platform));

  const sentences: string[] = [];
  if (reach.platforms.length > 0) {
    sentences.push(
      `Drawn over the ${reach.platforms.length} platform${reach.platforms.length === 1 ? " that reports" : "s that report"} reach (${reach.platforms.map(platformLabel).join(", ")}).`,
    );
    if (notIn.length > 0) {
      sentences.push(
        `${notIn.join(" and ")} ${notIn.length === 1 ? "is" : "are"} not in it: averaging in what we cannot measure would flatter the number.`,
      );
    }
  } else {
    sentences.push(
      "No reach series exists yet — the metrics tick has not measured anything in this window, so no reach line is drawn.",
    );
  }
  if (engagement.platforms.length > 0) {
    sentences.push(
      `The engagement line covers ${engagement.platforms.map(platformLabel).join(", ")} — the platform${engagement.platforms.length === 1 ? "" : "s"} whose series is engagement.`,
    );
  }

  return {
    reach: reach.values.length >= 2 ? reach : null,
    engagement: engagement.values.length >= 2 ? engagement : null,
    axis,
    tip: sentences.join(" "),
  };
}

/* ── tiles ──────────────────────────────────────────────────────────────── */

export interface TileView {
  ctx: string;
  /** "—" = nothing measured (a hole, explained by `note`/`title`) — deliberately not a 0. */
  fact: string;
  delta: { text: string; cls: "delta-up" | "delta-flat" } | null;
  /** The tile's honest footnote — the sheet's `.asof` line. */
  note: string;
  /** The rationale (each missing platform's own reason), for the tile's title. */
  title?: string;
  spark: { values: number[]; ok: boolean } | null;
}

export function publishedTile(model: AnalyticsModelWire): TileView {
  const { count, delta } = model.published;
  const daily = publishedDaily(model);
  return {
    ctx: "Published",
    fact: String(count),
    delta:
      delta === 0
        ? null
        : { text: delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`, cls: delta > 0 ? "delta-up" : "delta-flat" },
    note: "complete · from our own rows",
    spark: daily.length >= 2 && count > 0 ? { values: daily, ok: true } : null,
  };
}

export function measureTile(model: AnalyticsModelWire, family: "audience" | "engagement"): TileView {
  const tile = family === "audience" ? model.audience : model.engagement;
  const ctx = family === "audience" ? "Reach" : "Engagement";
  const channelCount = model.channels.length;
  const reporting = tile.platformsReporting.length;
  const excluded = tile.platformsNotReporting;
  const title =
    excluded.length > 0
      ? excluded.map((p) => `${platformLabel(p.platform)} — ${p.reason}`).join("\n")
      : undefined;

  if (tile.value === null) {
    return {
      ctx,
      fact: "—",
      delta: null,
      note:
        channelCount === 0
          ? "nothing published in this window"
          : "nothing measured yet — the metrics tick has not run",
      title,
      spark: null,
    };
  }

  let delta: TileView["delta"] = null;
  if (tile.deltaPct !== null) {
    const pct = Math.round(tile.deltaPct);
    delta = {
      text: pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : "±0%",
      cls: pct > 0 ? "delta-up" : "delta-flat",
    };
  } else if (tile.delta !== null) {
    // previous was 0 (or unknowable): a move from nothing is not a percentage.
    delta = {
      text: tile.delta > 0 ? `+${fmtCount(tile.delta)}` : tile.delta < 0 ? `−${fmtCount(Math.abs(tile.delta))}` : "±0",
      cls: tile.delta > 0 ? "delta-up" : "delta-flat",
    };
  }

  const excludedNames = excluded.map((p) => platformLabel(p.platform)).join(" + ");
  const daily = dailyCumulative(model, family);
  return {
    ctx,
    fact: fmtCount(tile.value),
    delta,
    note:
      family === "audience"
        ? `${reporting} of ${channelCount} platforms report reach`
        : `${reporting} of ${channelCount} platforms${excluded.length > 0 ? ` · ${excludedNames} excluded` : ""}`,
    title,
    spark: daily.values.length >= 2 ? { values: daily.values, ok: false } : null,
  };
}

/**
 * The sheet's fourth tile fixtures a metrics→profile loop ("6 of 14") that
 * has NO wire read yet — the write-back is not built. A fabricated 0 would
 * read as "the loop ran and nothing fed", so the tile renders the hole and
 * the sentence instead.
 */
export function steeringTile(model: AnalyticsModelWire): TileView {
  return {
    ctx: "Steering the next run",
    fact: "—",
    delta: { text: `of ${model.published.count}`, cls: "delta-flat" },
    note: "the metrics→profile loop isn't wired yet",
    title:
      "No post's metrics have reached a profile: the measure→profile write-back is not built yet. When it lands, this counts posts whose metrics fed the active profile.",
    spark: null,
  };
}

/* ── the band lines ─────────────────────────────────────────────────────── */

/** The newest capture behind anything on the surface — the headline as-of. */
export function newestAsOf(model: AnalyticsModelWire): Date | null {
  let best: Date | null = null;
  const consider = (iso: string | null): void => {
    if (iso === null) return;
    const d = new Date(iso);
    if (best === null || d.getTime() > best.getTime()) best = d;
  };
  consider(model.audience.asOf);
  consider(model.engagement.asOf);
  for (const post of model.posts) consider(post.asOf);
  return best;
}

/** The table's end-of-data line — the bound stated, never a view that reads as "everything". */
export function endLine(model: AnalyticsModelWire, shown: number, narrowed: boolean): string {
  if (narrowed) {
    return `${shown} of ${model.posts.length} in this window shown · narrowed by the platform filter`;
  }
  const total = model.bound.totalPublications;
  if (model.bound.truncated) {
    return `${shown} of ${total} shown · the read stopped at ${model.bound.limit} publications`;
  }
  if (total > shown) {
    return `${shown} of ${total} shown · the rest fall outside ${model.bound.windowDays} days`;
  }
  return `all ${shown} publication${shown === 1 ? "" : "s"} shown`;
}
