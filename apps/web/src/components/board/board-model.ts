import { thumbLabel } from "@/components/dashboard/dashboard-model";
import type { TrendCard } from "@/lib/intel/types";
import { platformLabel } from "@/lib/workspace/format";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";
import { waitingSince } from "@/lib/workspace/week";

/**
 * Pure derivations behind the Board sheet's six columns (DOCTRINE 0 rebuild).
 * The board is the SAME day the Dashboard shows, laid out as the pipeline —
 * so every column is a real lifecycle slice of the plan read, never a
 * hand-kept status. A draft appears in exactly one column, and the column it
 * is in is the state the engine actually recorded.
 */

export interface BoardCard {
  id: string;
  /** The card's two-line title — an EXCERPT wherever the draft has one. */
  title: string;
  /** The line under it: platform, age, gate count — the sheet's meta grammar. */
  meta: string;
  /** Striped-thumb mono label; null = no media referenced (the sheet's text cards). */
  thumb: string | null;
  /** A real image behind the thumb frame when the source gave us one. */
  thumbUrl?: string;
  href: string;
  /** Blocked work states it in the error channel — never in amber (brand ≠ status). */
  error?: boolean;
  /** Intel cards carry their rank band; nothing else does. */
  score?: number;
}

export interface BoardColumn {
  id: string;
  label: string;
  cards: BoardCard[];
  /** The TOTAL — a bounded body scrolls, the count never shrinks (Bounded-List Rule). */
  count: number;
  /** Copy for a genuinely empty column: what WOULD land here. */
  empty: string;
  /** The needs-you column wears the signal channel; nothing else may. */
  signal?: boolean;
  /**
   * A platform filter is active but this column's cards carry no platform, so
   * it is deliberately NOT narrowed — the column says so rather than letting
   * the operator read an unfiltered column as a filtered one.
   */
  unfiltered?: boolean;
}

/**
 * The operator's view knobs (founder s77: "re-introduce the good things (like
 * filters, sort by …) from the old design" — he named a platform filter and a
 * sort; the s77 fan-out reached the same conclusion here independently).
 *
 * Sort DEFAULTS to "oldest", which is not an arbitrary default: the waiting
 * column has always been oldest-first ("the queue's own order" — what has been
 * waiting longest is what needs you most), and the planned column has always
 * run forward in time. So the default reproduces today's board exactly, and the
 * knob only ever reverses it.
 */
export type BoardSort = "oldest" | "newest";

const COMPOSING = new Set(["generated"]);
const AT_JUDGE = new Set(["judging"]);
const WAITING = new Set(["queued", "blocked"]);
const APPROVED = new Set(["approved", "published"]);

/**
 * The sheet's age grammar — "45m", "2h", "26h". Deliberately NOT timeAgo's
 * day rollover: the board's cards say how long something has been sitting,
 * and "1d" hides that 26 hours is a day and a bit of someone waiting.
 */
export function ageLabel(since: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

function approveHref(asset: Pick<PipelineAsset, "runId" | "draftId">): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

/** The draft's own first line where it has one — the sheet's cards are excerpts. */
function assetTitle(asset: PipelineAsset): string {
  return asset.excerpt || `${platformLabel(asset.platform)} · ${asset.format ?? "draft"}`;
}

/**
 * PLATFORM-LED title, which is what the sheet actually draws in every column
 * except Waiting: "Deterministic-video explainer · LinkedIn" reads as
 * `Blog · inside the build-step pipeline`, `Facebook · launch film post`
 * (Board.dc.html). The port dropped the platform and substituted the draft's
 * 120-char excerpt, and `.k-title` is a two-line clamp at 12px in a ~164px
 * card — so a fan-out's siblings, whose excerpts diverge only after ~70
 * characters, rendered as byte-identical cards. Leading with the platform puts
 * the one distinguishing token where the clamp can never cut it (s77 finding,
 * board-model.ts:138).
 *
 * The Waiting column deliberately does NOT use this: the sheet gives its meta
 * line `LinkedIn · 26h`, so its platform is already named there.
 */
function platformTitle(asset: PipelineAsset): string {
  const platform = platformLabel(asset.platform);
  const rest = asset.excerpt || (asset.format ?? "draft");
  return `${platform} · ${rest}`;
}

/**
 * Card order inside a column, by the instant that column's OWN meta line talks
 * about — so "oldest first" means the same thing in every column rather than
 * whatever timestamp happened to be handy.
 */
function ordered(
  assets: PipelineAsset[],
  instant: (asset: PipelineAsset) => Date,
  sort: BoardSort,
): PipelineAsset[] {
  const direction = sort === "newest" ? -1 : 1;
  return [...assets].sort((a, b) => direction * (instant(a).getTime() - instant(b).getTime()));
}

const generatedAt = (asset: PipelineAsset) => new Date(asset.generatedAt);

/** Every platform the pipeline ACTUALLY holds — a filter that can only offer real values. */
export function boardPlatformOptions(
  assets: PipelineAsset[],
  slots: PlannedSlotWire[],
): string[] {
  const seen = new Set<string>();
  for (const asset of assets) seen.add(asset.platform);
  for (const slot of slots) seen.add(slot.platform);
  return [...seen].sort((a, b) => platformLabel(a).localeCompare(platformLabel(b)));
}

export function intelCards(cards: TrendCard[], limit: number): BoardCard[] {
  return cards.slice(0, limit).map((card) => ({
    id: `intel-${card.id}`,
    // The dossier's first ready title when generation armed for this card;
    // otherwise the source text itself — never an invented headline.
    title: card.dossier?.titles[0] ?? card.text,
    meta: card.areaName,
    // No thumbnail from this driver: the striped placeholder names the source
    // it came from rather than a generic word (never a synthesized image).
    thumb: card.thumbnailUrl ? null : card.source,
    thumbUrl: card.thumbnailUrl,
    href: "/app/intel",
    score: card.score,
  }));
}

export function composingCards(
  assets: PipelineAsset[],
  now: Date,
  sort: BoardSort = "oldest",
): BoardCard[] {
  return ordered(assets.filter((a) => COMPOSING.has(a.status)), generatedAt, sort)
    .map((asset) => ({
      id: asset.draftId,
      title: platformTitle(asset),
      meta: `drafting · ${ageLabel(new Date(asset.generatedAt), now)} in`,
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    }));
}

export function judgeCards(
  assets: PipelineAsset[],
  now: Date,
  sort: BoardSort = "oldest",
): BoardCard[] {
  return ordered(assets.filter((a) => AT_JUDGE.has(a.status)), generatedAt, sort)
    .map((asset) => ({
      id: asset.draftId,
      title: platformTitle(asset),
      meta:
        asset.gates.length > 0
          ? `${asset.gates.length} gate${asset.gates.length === 1 ? "" : "s"} · running`
          : `at the judge · ${ageLabel(new Date(asset.generatedAt), now)} in`,
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    }));
}

/** Everything waiting on the operator, OLDEST FIRST by default — the queue's own order. */
export function waitingCards(
  assets: PipelineAsset[],
  now: Date,
  sort: BoardSort = "oldest",
): BoardCard[] {
  return ordered(assets.filter((a) => WAITING.has(a.status)), waitingSince, sort)
    .map((asset) => {
      const blocked = asset.status === "blocked";
      const age = ageLabel(waitingSince(asset), now);
      return {
        id: asset.draftId,
        title: blocked ? (asset.reasons[0] ?? assetTitle(asset)) : assetTitle(asset),
        meta: blocked ? `needs your edit · ${age}` : `${platformLabel(asset.platform)} · ${age}`,
        thumb: thumbLabel(asset),
        href: approveHref(asset),
        error: blocked,
      };
    });
}

export function approvedCards(
  assets: PipelineAsset[],
  sort: BoardSort = "oldest",
): BoardCard[] {
  return ordered(
    assets.filter((a) => APPROVED.has(a.status)),
    // The instant this column's meta talks about is the DECISION; an approved
    // draft the engine never stamped falls back to when it was drafted.
    (asset) => new Date(asset.decidedAt ?? asset.generatedAt),
    sort,
  )
    .map((asset) => ({
      id: asset.draftId,
      title: platformTitle(asset),
      // "published ↗" only when a deploy actually recorded a live ref;
      // an approved draft is honestly still waiting for a plan.
      meta: asset.publishedAt !== null ? "published ↗" : "ready to plan",
      thumb: thumbLabel(asset),
      href: asset.deployRef ?? approveHref(asset),
    }));
}

/** "Friday 18:00 · Facebook" — the sheet's own plan grammar. */
export function plannedCards(
  slots: PlannedSlotWire[],
  assets: PipelineAsset[],
  sort: BoardSort = "oldest",
): BoardCard[] {
  const byDraft = new Map(assets.map((a) => [a.draftId, a]));
  const direction = sort === "newest" ? -1 : 1;
  return [...slots]
    .sort(
      (a, b) =>
        direction *
        (new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    )
    .map((slot) => {
      const at = new Date(slot.scheduledFor);
      const asset = byDraft.get(slot.draftId);
      return {
        id: `slot-${slot.draftId}`,
        title: `${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(at)} ${`${at.getHours()}`.padStart(2, "0")}:${`${at.getMinutes()}`.padStart(2, "0")} · ${platformLabel(slot.platform)}`,
        meta: "door unarmed — a plan",
        thumb: null,
        href: asset ? approveHref(asset) : "/app/calendar",
      };
    });
}

/** The sheet draws four cards in the tallest column; a real column scrolls. */
export const COLUMN_CARD_BOUND = 12;

export function boardColumns(input: {
  assets: PipelineAsset[];
  slots: PlannedSlotWire[];
  trends: TrendCard[];
  now: Date;
  /** null = every platform. Narrows the pipeline columns only — see `unfiltered`. */
  platform?: string | null;
  sort?: BoardSort;
}): BoardColumn[] {
  const { assets: allAssets, slots: allSlots, trends, now } = input;
  const platform = input.platform ?? null;
  const sort = input.sort ?? "oldest";
  // The filter narrows what the columns are BUILT from, so a column's count and
  // its cards always describe the same set (the Bounded-List Rule holds either
  // way — count stays the filtered total, never what happens to fit).
  const assets =
    platform === null ? allAssets : allAssets.filter((asset) => asset.platform === platform);
  const slots =
    platform === null ? allSlots : allSlots.filter((slot) => slot.platform === platform);

  const build = (
    id: string,
    label: string,
    cards: BoardCard[],
    empty: string,
    extra?: { signal?: boolean; unfiltered?: boolean },
  ): BoardColumn => ({
    id,
    label,
    cards: cards.slice(0, COLUMN_CARD_BOUND),
    count: cards.length,
    empty,
    signal: extra?.signal,
    unfiltered: extra?.unfiltered,
  });

  return [
    build(
      "intel",
      "Intel picks",
      intelCards(trends, COLUMN_CARD_BOUND),
      "No cards yet — the sweep's rising items land here.",
      // A sweep card is a TREND, not a draft: it has no platform to filter by
      // (a family is only chosen when it is promoted into Create). So the
      // platform filter deliberately does not reach this column, and the column
      // says so rather than passing for narrowed.
      { unfiltered: platform !== null },
    ),
    build(
      "composing",
      "Composing",
      composingCards(assets, now, sort),
      "Nothing composing right now.",
    ),
    build("judge", "At the judge", judgeCards(assets, now, sort), "Nothing at the judge."),
    build(
      "waiting",
      "Waiting on you",
      waitingCards(assets, now, sort),
      "Nothing waiting — you’re clear.",
      { signal: true },
    ),
    build(
      "approved",
      "Approved",
      approvedCards(assets, sort),
      "Nothing approved yet — approving is your click, never the engine’s.",
    ),
    build(
      "planned",
      "Planned",
      plannedCards(slots, assets, sort),
      "No plans yet — approve a draft, then plan its slot.",
    ),
  ];
}
