import { thumbLabel } from "@/components/dashboard/dashboard-model";
import {
  briefTopic,
  elapsedWord,
  type RunRow,
} from "@/components/runs/runs-model";
import type { CreateRunWire } from "@/lib/create/client";
import type { IntelPickWire } from "@/lib/intel/types";
import { isStagedDraftFormat } from "@/lib/staged-flow/types";
import { platformLabel } from "@/lib/workspace/format";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";
import { dayKey, waitingSince } from "@/lib/workspace/week";

/**
 * Pure derivations behind the Dashboard's BOARD state (the s91 pipeline-board
 * redraw of Board.dc.html, verdicted s91b: "board approved"). Columns run in
 * LOOP ORDER — Intel picks → Generating → At the judge → In Approve →
 * Scheduled → Published — and every column is a real lifecycle slice of an
 * existing read, never a hand-kept status. The feet carry the day's in/out
 * where a recorded instant exists ON THE WIRE, and an honest "–" where none
 * does (a number nobody recorded is not a zero).
 */

export interface BoardMetaSpan {
  text: string;
  /** Renders in the data face (`.t-data`) — the sheet's slot-time spans. */
  data?: boolean;
}

export interface BoardCard {
  id: string;
  title: string;
  /** Blocked work's title rides the error channel (the sheet's err-coloured title). */
  titleError?: boolean;
  /** The judge's failing line, VERBATIM, under the title (the sheet's `.k-reason`). */
  reason?: string;
  /** The state chip ahead of the meta spans — ✓/✗ judge, drafting, gates n/m. */
  pill?: { tone: "ok" | "err" | "idle"; label: string };
  /** Intel picks carry their rank band; nothing else does (heat pill in the view). */
  score?: number;
  meta: BoardMetaSpan[];
  /** Striped-thumb mono label; null = no media referenced (the sheet's text cards). */
  thumb: string | null;
  /** A real image behind the thumb frame when the source gave us one. */
  thumbUrl?: string;
  /** null = no detail surface exists yet — the card renders doorless, never dead. */
  href: string | null;
}

/**
 * One side of a column's foot. `null` = the crossing's instant is not on any
 * read this surface has — rendered "–", stated rather than faked.
 */
export interface BoardFoot {
  in: number | null;
  out: number | null;
  /** Published's own right-side grammar — "last Thu" / "today" (sheet foot). */
  outWord?: string;
}

export type BoardColumnId =
  | "picks"
  | "generating"
  | "judge"
  | "approve"
  | "scheduled"
  | "published";

export interface BoardColumn {
  id: BoardColumnId;
  label: string;
  cards: BoardCard[];
  /** The TOTAL — a bounded body scrolls, the count never shrinks (Bounded-List Rule). */
  count: number;
  /** Copy for a genuinely empty column: what WOULD land here. */
  empty: string;
  /** In Approve wears the warn dress: the ONE human gate (sheet inline styles → a state). */
  warn?: boolean;
  foot: BoardFoot;
}

const GENERATED = new Set(["generated"]);
const AT_JUDGE = new Set(["judging"]);
const WAITING = new Set(["queued", "blocked"]);

/** The sheet draws four cards in the tallest column; a real column scrolls. */
export const COLUMN_CARD_BOUND = 12;

/**
 * Waits on the OPERATOR — the same rule the pulse counts by (lib/workspace/
 * pulse.ts). A staged artifact (`storyboard`/`direction_doc`) sits in
 * queued/blocked but its verb is ADVANCE, not approve/reject (founder ruling,
 * s79 close) — and the In Approve column takes `Math.max(pulse.needsYou, own
 * count)` in the view, so this MUST keep agreeing with the pulse.
 */
function waitsOnOperator(asset: Pick<PipelineAsset, "status" | "format">): boolean {
  return WAITING.has(asset.status) && !isStagedDraftFormat(asset.format);
}

/**
 * The sheet's age grammar — "45m", "2h", "26h". Deliberately NOT timeAgo's
 * day rollover: 26 hours is a day and a bit of someone waiting, and "1d"
 * would hide it.
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
 * PLATFORM-LED title for the mid-loop columns: the one distinguishing token of
 * a fan-out's siblings goes where the two-line clamp can never cut it (s77
 * finding). In Approve carries the platform in its meta instead, and the
 * Scheduled/Published columns put it LAST — both per the amended sheet's own
 * fixture grammar.
 */
function platformTitle(asset: PipelineAsset): string {
  return `${platformLabel(asset.platform)} · ${asset.excerpt || (asset.format ?? "draft")}`;
}

/** "<excerpt> · <Platform>" — the Scheduled/Published card grammar (sheet fixture). */
function platformLastTitle(asset: PipelineAsset): string {
  return `${asset.excerpt || (asset.format ?? "draft")} · ${platformLabel(asset.platform)}`;
}

function ordered(
  assets: PipelineAsset[],
  instant: (asset: PipelineAsset) => Date,
): PipelineAsset[] {
  return [...assets].sort((a, b) => instant(a).getTime() - instant(b).getTime());
}

const generatedAt = (asset: PipelineAsset) => new Date(asset.generatedAt);

/** How many of these instants fall on `now`'s own day — the feet's one sum. */
export function todayCount(
  instants: Array<string | Date | null | undefined>,
  now: Date,
): number {
  const today = dayKey(now);
  return instants.filter(
    (at) => at != null && dayKey(at instanceof Date ? at : new Date(at)) === today,
  ).length;
}

/** "Fri 18:00" — the sheet's slot-time grammar (short weekday, 24h clock). */
export function slotTimeLabel(at: Date): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(at);
  return `${weekday} ${`${at.getHours()}`.padStart(2, "0")}:${`${at.getMinutes()}`.padStart(2, "0")}`;
}

/**
 * The Published grammar for a day: "today", a short weekday inside the last
 * week, else "19 Jul" (en-GB, the sheet's own dates).
 */
export function publishedDayLabel(at: Date, now: Date): string {
  if (dayKey(at) === dayKey(now)) return "today";
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(at);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(at);
}

/**
 * Intel picks — PICKS ONLY (the sheet's own correction: an unpicked trend
 * lives on Intel, not in the pipeline). A pick is a `trend_promote` capture;
 * newest first, the way the operator just made them.
 */
export function pickCards(picks: IntelPickWire[]): BoardCard[] {
  return [...picks]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((pick) => ({
      id: `pick-${pick.captureId}`,
      title: pick.title,
      score: pick.score ?? undefined,
      meta: [{ text: `picked · ${pick.family}` }],
      // No thumbnail from the source: the striped placeholder names the source
      // it came from rather than a generic word (never a synthesized image).
      thumb: pick.thumbnailUrl ? null : pick.source,
      thumbUrl: pick.thumbnailUrl ?? undefined,
      href: "/app/intel",
    }));
}

/**
 * Generating — the in-flight work from BOTH run reads (the Runs surface's own
 * running-now derivation) plus drafts the engine has generated but not yet
 * judged. Elapsed is real math ("24s in"), never a fixture.
 */
export function generatingCards(
  runs: RunRow[],
  createRuns: CreateRunWire[],
  assets: PipelineAsset[],
  now: Date,
): BoardCard[] {
  const liveRunCards: BoardCard[] = runs
    .filter((row) => row.live)
    .map((row) => ({
      id: `run-${row.id}`,
      title: row.lead,
      pill: { tone: "idle" as const, label: "running" },
      meta: [{ text: `${elapsedWord(row.at.toISOString(), now)} in` }],
      thumb: row.thumb,
      href: row.href,
    }));
  const liveCreateCards: BoardCard[] = createRuns
    .filter((run) => run.status === "pending" || run.status === "running")
    .map((run) => ({
      id: `create-${run.id}`,
      title: `Create run · ${briefTopic(run.brief) ?? run.family}`,
      pill: { tone: "idle" as const, label: "running" },
      meta: [{ text: `${elapsedWord(run.createdAt, now)} in` }],
      thumb: null,
      // A create run has no detail surface yet — doorless, never dead (Runs precedent).
      href: null,
    }));
  const drafting: BoardCard[] = ordered(
    assets.filter((a) => GENERATED.has(a.status)),
    generatedAt,
  ).map((asset) => ({
    id: asset.draftId,
    title: platformTitle(asset),
    pill: { tone: "idle" as const, label: "drafting" },
    meta: [{ text: `${elapsedWord(asset.generatedAt, now)} in` }],
    thumb: thumbLabel(asset),
    href: approveHref(asset),
  }));
  return [...liveRunCards, ...liveCreateCards, ...drafting];
}

/** At the judge — "gates 2/4" is passed-of-total for the draft's CURRENT body hash. */
export function judgeCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return ordered(assets.filter((a) => AT_JUDGE.has(a.status)), generatedAt).map((asset) => {
    const total = asset.gates.length;
    const passed = asset.gates.filter((gate) => gate.verdict === "pass").length;
    return {
      id: asset.draftId,
      title: platformTitle(asset),
      pill: {
        tone: "idle" as const,
        label: total > 0 ? `gates ${passed}/${total}` : "at the judge",
      },
      meta: [
        { text: total > 0 ? "running" : `${ageLabel(new Date(asset.generatedAt), now)} in` },
      ],
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    };
  });
}

/**
 * In Approve — the ONE human gate, oldest first (the queue's own order).
 * Every card carries its judge verdict as a chip (Hume: evaluation rides the
 * row); a blocked card leads with its own title in the error channel and the
 * judge's failing line VERBATIM beneath it.
 */
export function approveColumnCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return ordered(assets.filter(waitsOnOperator), waitingSince).map((asset) => {
    const blocked = asset.status === "blocked";
    const age = ageLabel(waitingSince(asset), now);
    return {
      id: asset.draftId,
      title: assetTitle(asset),
      titleError: blocked,
      reason: blocked ? asset.reasons[0] : undefined,
      pill: blocked
        ? { tone: "err" as const, label: "✗ judge" }
        : { tone: "ok" as const, label: "✓ judge" },
      meta: [{ text: blocked ? `your edit · ${age}` : `${platformLabel(asset.platform)} · ${age}` }],
      thumb: thumbLabel(asset),
      href: approveHref(asset),
    };
  });
}

/**
 * Scheduled — the plan's slots forward in time, plus approved drafts that
 * have no slot yet: approval's out IS this column's inbox, and losing decided
 * work between two columns would break "cards move when the work moves". The
 * slotless card says its own state ("ready to plan — no slot yet") instead of
 * wearing a time nobody chose.
 */
export function scheduledCards(
  slots: PlannedSlotWire[],
  assets: PipelineAsset[],
): BoardCard[] {
  const byDraft = new Map(assets.map((a) => [a.draftId, a]));
  const planned = new Set(slots.map((slot) => slot.draftId));
  const slotCards: BoardCard[] = [...slots]
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
    .map((slot) => {
      const asset = byDraft.get(slot.draftId);
      return {
        id: `slot-${slot.draftId}`,
        title: asset ? platformLastTitle(asset) : `Planned · ${platformLabel(slot.platform)}`,
        meta: [
          { text: slotTimeLabel(new Date(slot.scheduledFor)), data: true },
          { text: "door unarmed — a plan" },
        ],
        thumb: asset ? thumbLabel(asset) : null,
        href: asset ? approveHref(asset) : "/app/schedule",
      };
    });
  const readyToPlan: BoardCard[] = ordered(
    assets.filter(
      (a) => a.status === "approved" && a.publishedAt === null && !planned.has(a.draftId),
    ),
    (asset) => new Date(asset.decidedAt ?? asset.generatedAt),
  ).map((asset) => ({
    id: asset.draftId,
    title: platformLastTitle(asset),
    meta: [{ text: "ready to plan — no slot yet" }],
    thumb: thumbLabel(asset),
    href: approveHref(asset),
  }));
  return [...slotCards, ...readyToPlan];
}

/** Published — newest first; "view live ↗" only when a deploy recorded a live ref. */
export function publishedCards(assets: PipelineAsset[], now: Date): BoardCard[] {
  return assets
    .filter((a) => a.publishedAt !== null)
    .sort(
      (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
    )
    .map((asset) => {
      const day = publishedDayLabel(new Date(asset.publishedAt as string), now);
      return {
        id: asset.draftId,
        title: platformLastTitle(asset),
        meta: [{ text: asset.deployRef !== null ? `view live ↗ · ${day}` : day }],
        thumb: thumbLabel(asset),
        href: asset.deployRef ?? approveHref(asset),
      };
    });
}

export interface BoardViewInput {
  /** null = that read hasn't resolved (loading or failed) — its numbers render "–". */
  picks: IntelPickWire[] | null;
  runs: RunRow[] | null;
  createRuns: CreateRunWire[] | null;
  /** The plan read's two halves arrive together; null = the plan read is unresolved. */
  assets: PipelineAsset[] | null;
  slots: PlannedSlotWire[] | null;
  now: Date;
}

/**
 * The six columns in loop order, feet included. Feet math, column by column —
 * each side is a recorded instant crossing a stage boundary today, and the
 * SAME instant is deliberately two columns' opposite sides (generation's out
 * is the judge's in; a fan-out multiplies, so Generating-in ≥ picks-out is
 * TRUE, not an error):
 *
 *   picks       in = promote captures today          out = not on the wire (no
 *               capture→run link is recorded)
 *   generating  in = runs started today (both reads)  out = drafts generated today
 *   judge       in = drafts generated today           out = drafts judged today
 *   approve     in = drafts judged today              out = decisions today
 *   scheduled   in = not on the wire (slots carry no  out = published today (the
 *               planned-at instant)                   tick consumes the slot)
 *   published   in = published today                  right side = last publish day
 */
export function boardColumns(input: BoardViewInput): BoardColumn[] {
  const { picks, runs, createRuns, assets, slots, now } = input;

  const build = (
    id: BoardColumnId,
    label: string,
    cards: BoardCard[] | null,
    empty: string,
    foot: BoardFoot,
    warn?: boolean,
  ): BoardColumn => ({
    id,
    label,
    cards: (cards ?? []).slice(0, COLUMN_CARD_BOUND),
    count: cards?.length ?? 0,
    empty,
    warn,
    foot,
  });

  const runStarts =
    runs !== null && createRuns !== null
      ? [
          ...runs.map((row) => row.at),
          ...createRuns.map((run) => run.createdAt),
        ]
      : null;
  const generatedToday = assets !== null ? todayCount(assets.map((a) => a.generatedAt), now) : null;
  const publishedAssets = assets?.filter((a) => a.publishedAt !== null) ?? [];
  const publishedToday = assets !== null ? todayCount(assets.map((a) => a.publishedAt), now) : null;
  const newestPublish = publishedAssets
    .map((a) => new Date(a.publishedAt as string))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return [
    build(
      "picks",
      "Intel picks",
      picks === null ? null : pickCards(picks),
      "No picks yet — promote a trend on Intel and it starts the loop here.",
      { in: picks !== null ? todayCount(picks.map((p) => p.at), now) : null, out: null },
    ),
    build(
      "generating",
      "Generating",
      runs === null && createRuns === null && assets === null
        ? null
        : generatingCards(runs ?? [], createRuns ?? [], assets ?? [], now),
      "Nothing generating right now.",
      { in: runStarts !== null ? todayCount(runStarts, now) : null, out: generatedToday },
    ),
    build(
      "judge",
      "At the judge",
      assets === null ? null : judgeCards(assets, now),
      "Nothing at the judge.",
      {
        in: generatedToday,
        out: assets !== null ? todayCount(assets.map((a) => a.judgedAt), now) : null,
      },
    ),
    build(
      "approve",
      "In Approve",
      assets === null ? null : approveColumnCards(assets, now),
      "Nothing waiting — you’re clear.",
      {
        in: assets !== null ? todayCount(assets.map((a) => a.judgedAt), now) : null,
        out: assets !== null ? todayCount(assets.map((a) => a.decidedAt), now) : null,
      },
      true,
    ),
    build(
      "scheduled",
      "Scheduled",
      assets === null || slots === null ? null : scheduledCards(slots, assets),
      "No plans yet — approve a draft, then plan its slot.",
      { in: null, out: publishedToday },
    ),
    build(
      "published",
      "Published",
      assets === null ? null : publishedCards(assets, now),
      "Nothing published yet — approved work ships from the queue.",
      {
        in: publishedToday,
        out: null,
        outWord:
          publishedToday !== null && publishedToday > 0
            ? "today"
            : newestPublish
              ? `last ${publishedDayLabel(newestPublish, now)}`
              : "none yet",
      },
    ),
  ];
}

/** The foot's data span — "2 in · 2 out", with "–" for a side no read records. */
export function footText(foot: BoardFoot): string {
  const left = `${foot.in ?? "–"} in`;
  const right = foot.outWord ?? `${foot.out ?? "–"} out`;
  return `${left} · ${right}`;
}
