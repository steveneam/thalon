import { heatBand } from "@/components/intel/heat-grade";
import { compactCount, freshnessStamp, suggestedExit } from "@/components/intel/launchpad";
import { timeAgo, timeUntil } from "@/lib/workspace/format";
import { resolveTrendItemMedia, type MediaResolution } from "@/lib/media/resolve";
import type { AreaRow, CreateFamily, TrendCard, TrendsPayload } from "@/lib/intel/types";

/**
 * A trend card's media (B-media.0). Drivers pass a platform thumbnail
 * through and never synthesize one, so a card without a thumbnail resolves
 * `empty` and the sheet's legend stands in.
 *
 * The sweep stamp rides along when the read plumbed it and is simply absent
 * otherwise — it is provenance metadata, never a gate. Gating the thumbnail
 * on it would hide a poster we actually hold to protect a field nobody reads.
 */
function trendCardMedia(card: TrendCard): MediaResolution {
  return resolveTrendItemMedia({
    thumbnailUrl: card.thumbnailUrl,
    thumbnailWidth: card.thumbnailWidth,
    thumbnailHeight: card.thumbnailHeight,
    capturedAt: card.capturedAt,
  });
}

/**
 * The view model the Intel sheet draws (Intel.dc.html). Every field here is
 * something the sheet renders literally, so the port stays a port: step 1
 * feeds these shapes the sheet's own placeholder content, step 2 maps real
 * `TrendCard` rows onto the same shapes. Nothing in the markup formats data
 * — the formatting lives here, unit-tested beside the surface.
 */

/** One row of the "Why it's moving" band — [name | magnitude bar | text]. */
export interface ReasonView {
  /** "Velocity 0.92" — the ranker's signal name, capitalized, with its score. */
  name: string;
  /** Bar width, 0–100. */
  percent: number;
  /** The bar's thermal fill, e.g. "var(--heat-hot)". */
  heat: string;
  /** The readable half of the reason. */
  text: string;
  /** The full reason string, verbatim from the ranker (hover truth). */
  title: string;
}

/** The expanded dossier card — one card at a time, the sheet's launchpad. */
export interface DossierView {
  id: string;
  /** Thermal word-in-pill: the word IS the text channel, never colour alone. */
  band: { word: string; pill: string; fill: string };
  /** Rank magnitude 0–100 + the exact score in the hover title. */
  percent: number;
  scoreTitle: string;
  isOutlier: boolean;
  /** "rising 3h · catchable" — only rising/hot cards earn it. */
  freshness: string | null;
  headline: string;
  prov: {
    account: string;
    /** "24.6k views" — absent when the source reports no view count. */
    views: string | null;
    age: string;
    sourceLabel: string;
    url?: string;
    areaName: string;
  };
  /** The card's media, already resolved (B-media.0) — never synthesized for demo cards. */
  media: MediaResolution;
  /** The sheet's placeholder legend inside the striped thumb. */
  thumbLabel: string;
  reasons: ReasonView[];
  titles: string[];
  angles: string[];
  hook: string | null;
  /** The pre-picked exit: word + primary weight, a default and never a gate. */
  suggested: { family: CreateFamily; label: string; reason: string };
}

/** One compact row of the "More rising" card. */
export interface RisingView {
  id: string;
  band: { word: string; pill: string };
  media: MediaResolution;
  thumbLabel: string;
  text: string;
  /** "YouTube · 12.1k · 5h ago" — the row's mono data stamp. */
  data: string;
  url?: string;
}

/** A watch chip — a monitored area as the sheet draws it. */
export interface WatchView {
  id: string;
  name: string;
  description: string;
  paused: boolean;
}

/* ── The mapping: wire rows → what the sheet draws ───────────────────── */

/** Platform names as the sheet writes them; anything else keeps its own name, capitalized. */
const SOURCE_LABELS: Record<string, string> = {
  bluesky: "Bluesky",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  reddit: "Reddit",
  fake: "Demo driver",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

const BANDS = {
  hot: { word: "Hot", pill: "pill-heat-hot", fill: "var(--heat-hot)" },
  rising: { word: "Rising", pill: "pill-heat-rising", fill: "var(--heat-rising)" },
  warm: { word: "Warm", pill: "pill-heat-warm", fill: "var(--heat-warm)" },
  cool: { word: "Cool", pill: "pill-heat-cool", fill: "var(--heat-cool)" },
} as const;

/** The thermal grammar the sheet draws: the WORD is the text channel, the colour is the glance. */
export function bandOf(score: number): { word: string; pill: string; fill: string } {
  return BANDS[heatBand(score)];
}

/**
 * The sheet's reason rows read hot → rising → warm down the column, in
 * score order — the colour marks a signal's RANK among this card's reasons,
 * not its own band (the sheet draws Velocity 0.92 hot and Freshness 0.92
 * rising). A fourth reason continues the ramp to cool.
 */
const REASON_HEAT = ["var(--heat-hot)", "var(--heat-rising)", "var(--heat-warm)", "var(--heat-cool)"];

/**
 * One ranker reason string → the sheet's [name | bar | text] row. The
 * ranker's grammar is `signal 0.92 (detail; detail)` (packages/engine
 * trend/ranker.ts), with `relevance disarmed (…)` as the scoreless variant.
 * Nothing is invented: the row shows the signal, its score and its FIRST
 * detail clause, and the full string verbatim rides in the hover title.
 */
export function parseReason(reason: string): { name: string; score: number; text: string; title: string } {
  const match = /^([a-z]+)\s+(\d+(?:\.\d+)?)\s*(.*)$/i.exec(reason);
  const signal = (match?.[1] ?? reason.split(" ")[0] ?? "").toLowerCase();
  const name = signal.charAt(0).toUpperCase() + signal.slice(1);
  const score = match ? Number(match[2]) : 0;
  let text = (match ? match[3] : reason.slice(signal.length)).trim();
  // `(detail; detail)` → the first clause; a trailing parenthetical (the
  // relevance row's cosine) demotes to the title with the rest.
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1);
  text = text.split("; ")[0];
  const paren = text.indexOf(" (");
  if (paren > 0) text = text.slice(0, paren);
  return {
    name: match ? `${name} ${match[2]}` : name,
    score,
    text,
    title: reason,
  };
}

export function reasonViews(reasons: readonly string[]): ReasonView[] {
  return reasons
    .map(parseReason)
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({
      name: r.name,
      percent: Math.round(Math.min(1, Math.max(0, r.score)) * 100),
      heat: REASON_HEAT[Math.min(i, REASON_HEAT.length - 1)],
      text: r.text,
      title: r.title,
    }));
}

/** The striped placeholder's legend, in the sheet's own vocabulary. */
function thumbLabel(card: TrendCard, big: boolean): string {
  if (card.source === "youtube") return "yt thumb";
  return big ? "post media" : "post img";
}

export function toDossierView(card: TrendCard, now: number = Date.now()): DossierView {
  const views = typeof card.metrics.views === "number" ? card.metrics.views : null;
  const suggested = suggestedExit(card);
  return {
    id: card.id,
    band: bandOf(card.score),
    percent: Math.round(Math.min(1, Math.max(0, card.score)) * 100),
    scoreTitle: `rank score ${card.score.toFixed(2)} of 1 — ${card.areaName}`,
    isOutlier: card.isOutlier,
    freshness: freshnessStamp(card, now),
    headline: card.text,
    prov: {
      account: card.account,
      views: views === null ? null : `${compactCount(views)} views`,
      age: timeAgo(card.publishedAt, now),
      sourceLabel: sourceLabel(card.source),
      url: card.url,
      areaName: card.areaName,
    },
    media: trendCardMedia(card),
    thumbLabel: thumbLabel(card, true),
    reasons: reasonViews(card.reasons),
    titles: card.dossier?.titles ?? [],
    angles: card.dossier?.angles ?? [],
    hook: card.dossier?.hook ?? null,
    suggested: { family: suggested.family, label: suggested.family, reason: suggested.reason },
  };
}

export function toRisingView(card: TrendCard, now: number = Date.now()): RisingView {
  const views = typeof card.metrics.views === "number" ? card.metrics.views : null;
  const band = bandOf(card.score);
  return {
    id: card.id,
    band: { word: band.word, pill: band.pill },
    media: trendCardMedia(card),
    thumbLabel: thumbLabel(card, false),
    text: card.text,
    data: [sourceLabel(card.source), views === null ? null : compactCount(views), timeAgo(card.publishedAt, now)]
      .filter((part): part is string => part !== null)
      .join(" · "),
    url: card.url,
  };
}

export function toWatchViews(areas: readonly AreaRow[]): WatchView[] {
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    description: area.description,
    paused: area.status === "paused",
  }));
}

/**
 * The header's sweep stamp — the sheet's "Swept 2h ago · next in 4h ·
 * YouTube + Bluesky", built from the read's own truth and never rounded up
 * into a promise: the next segment is the SCHEDULE (real time, "due now",
 * or the honest absence), and the platform segment NAMES the demo era while
 * the fake-driver dataset is what's on screen. The per-source stamps
 * (B-learn L2 slice 1) ride in the hover title, one line per platform.
 */
export function sweepStamp(
  payload: TrendsPayload,
  now: number = Date.now(),
): { text: string; title: string | undefined } {
  const { sweep, demo } = payload;
  const next = sweep.dueNow
    ? "sweep due now"
    : sweep.nextSweepAt
      ? `next ${timeUntil(sweep.nextSweepAt, now)}`
      : "no next sweep scheduled";
  const sources = payload.sources ?? [];
  const platforms = demo
    ? "demo dataset — no live sweep yet"
    : sources.length > 0
      ? sources.map((s) => sourceLabel(s.source)).join(" + ")
      : null;
  return {
    text: [`Swept ${timeAgo(sweep.lastSweptAt, now)}`, next, platforms]
      .filter((part): part is string => part !== null)
      .join(" · "),
    title:
      sources.length > 0
        ? sources
            .map((s) => `${sourceLabel(s.source)}: ${s.cards} cards, swept ${timeAgo(s.lastSweptAt, now)}`)
            .join("\n")
        : undefined,
  };
}
