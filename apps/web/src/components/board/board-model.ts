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
}

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

export function intelCards(cards: TrendCard[], limit: number): BoardCard[] {
  return cards.slice(0, limit).map((card) => ({
    id: `intel-${card.id}`,
    // The dossier's first ready title when generation armed for this card;
    // otherwise the source text itself — never an invented headline.
    title: card.dossier?.titles[0] ?? card.text,
    meta: card.areaName,
    thumb: card.thumbnailUrl ? null : "source",
    thumbUrl: card.thumbnailUrl,
    href: "/app/intel",
    score: card.score,
  }));
}

export function composingCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return assets
    .filter((a) => COMPOSING.has(a.status))
    .map((asset) => ({
      id: asset.draftId,
      title: assetTitle(asset),
      meta: `drafting · ${ageLabel(new Date(asset.generatedAt), now)} in`,
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    }));
}

export function judgeCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return assets
    .filter((a) => AT_JUDGE.has(a.status))
    .map((asset) => ({
      id: asset.draftId,
      title: assetTitle(asset),
      meta:
        asset.gates.length > 0
          ? `${asset.gates.length} gate${asset.gates.length === 1 ? "" : "s"} · running`
          : `at the judge · ${ageLabel(new Date(asset.generatedAt), now)} in`,
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    }));
}

/** Everything waiting on the operator, OLDEST FIRST — the queue's own order. */
export function waitingCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return assets
    .filter((a) => WAITING.has(a.status))
    .sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime())
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

export function approvedCards(assets: PipelineAsset[]): BoardCard[] {
  return assets
    .filter((a) => APPROVED.has(a.status))
    .map((asset) => ({
      id: asset.draftId,
      title: assetTitle(asset),
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
): BoardCard[] {
  const byDraft = new Map(assets.map((a) => [a.draftId, a]));
  return [...slots]
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
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
}): BoardColumn[] {
  const { assets, slots, trends, now } = input;
  const build = (
    id: string,
    label: string,
    cards: BoardCard[],
    empty: string,
    signal?: boolean,
  ): BoardColumn => ({
    id,
    label,
    cards: cards.slice(0, COLUMN_CARD_BOUND),
    count: cards.length,
    empty,
    signal,
  });

  return [
    build(
      "intel",
      "Intel picks",
      intelCards(trends, COLUMN_CARD_BOUND),
      "No cards yet — the sweep's rising items land here.",
    ),
    build(
      "composing",
      "Composing",
      composingCards(assets, now),
      "Nothing composing right now.",
    ),
    build("judge", "At the judge", judgeCards(assets, now), "Nothing at the judge."),
    build(
      "waiting",
      "Waiting on you",
      waitingCards(assets, now),
      "Nothing waiting — you’re clear.",
      true,
    ),
    build(
      "approved",
      "Approved",
      approvedCards(assets),
      "Nothing approved yet — approving is your click, never the engine’s.",
    ),
    build(
      "planned",
      "Planned",
      plannedCards(slots, assets),
      "No plans yet — approve a draft, then plan its slot.",
    ),
  ];
}
