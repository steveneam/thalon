import { isStagedDraftFormat } from "@/lib/staged-flow/types";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";
import { waitingSince, type WeekDay } from "@/lib/workspace/week";
import { platformLabel } from "@/lib/workspace/format";

/**
 * Pure derivations behind the Dashboard sheet's bands (DOCTRINE 0 rebuild):
 * every number and row the surface shows comes from these, so the honesty
 * rules stay unit-testable — no fabricated counts, no real-looking zeros.
 */

const WAITING = new Set(["queued", "blocked"]);
const DECIDED = new Set(["approved", "rejected", "published"]);

/**
 * Waits on the OPERATOR — the same rule the pulse counts by (pulse.ts), so the
 * needs-you card's rows and the badge's number cannot disagree. A staged
 * artifact (`storyboard`/`direction_doc`) sits in queued/blocked but its verb
 * is ADVANCE, not approve/reject, so it is not the operator's queue (founder
 * ruling, s79 close). Both derivations must move together or the card's
 * "N of M read" line states a gap that isn't there.
 */
function waitsOnOperator(asset: Pick<PipelineAsset, "status" | "format">): boolean {
  return WAITING.has(asset.status) && !isStagedDraftFormat(asset.format);
}

// platformLabel now has ONE home (lib/workspace/format.ts) — re-exported
// here so the surfaces and tests that import it from the exemplar keep working.
// One home for the label map (lib/workspace/format.ts); re-exported so the
// surfaces and tests that import it from this model keep working.
export { platformLabel };

/** The striped-thumb mono label for a media-bearing format — null = no thumb (text posts render without one, per the sheet). */
export function thumbLabel(asset: Pick<PipelineAsset, "format" | "platform">): string | null {
  const format = asset.format ?? "";
  if (format.includes("video") || format.includes("clip")) return "clip frame";
  if (format.includes("image") || format.includes("visual")) return "post image";
  if (format === "web_page" || asset.platform === "web") return "page hero";
  return null;
}

/** Drafts at the judge gate: generated, no verdict for the current body yet, not decided. */
export function composingCount(assets: PipelineAsset[]): number {
  return assets.filter((a) => a.judgedAt === null && !DECIDED.has(a.status)).length;
}

/** Whole hours the oldest queued/blocked draft has waited — null when nothing waits. */
export function oldestWaitHours(assets: PipelineAsset[], now: Date): number | null {
  const waiting = assets.filter(waitsOnOperator);
  if (waiting.length === 0) return null;
  const oldest = Math.min(...waiting.map((a) => waitingSince(a).getTime()));
  return Math.max(0, Math.floor((now.getTime() - oldest) / 3_600_000));
}

export interface NeedsYouRow {
  draftId: string;
  href: string;
  blocked: boolean;
  /** The sheet's lead line: "LinkedIn · post" / "Blocked by the judge · LinkedIn post". */
  lead: string;
  excerpt: string;
  /** First judge reason, blocked rows only — rendered in the error channel. */
  reason: string | null;
  thumb: string | null;
  at: Date;
}

/** Everything waiting on the operator, OLDEST FIRST (the sheet's footer states the order). */
export function needsYouRows(assets: PipelineAsset[]): NeedsYouRow[] {
  return assets
    .filter(waitsOnOperator)
    .sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime())
    .map((a) => {
      const blocked = a.status === "blocked";
      const format = (a.format ?? "post").replace(/_/g, " ");
      return {
        draftId: a.draftId,
        href: `/app/approve?run=${encodeURIComponent(a.runId)}&draft=${encodeURIComponent(a.draftId)}`,
        blocked,
        // The sheet's two lead grammars: "LinkedIn · clip plan" for review
        // rows, "Blocked by the judge · LinkedIn post" for judge blocks.
        lead: blocked
          ? `Blocked by the judge · ${platformLabel(a.platform)} ${format}`
          : `${platformLabel(a.platform)} · ${format}`,
        excerpt: a.excerpt,
        reason: blocked ? (a.reasons[0] ?? "blocked — reasons attached") : null,
        thumb: thumbLabel(a),
        at: waitingSince(a),
      };
    });
}

export interface PublishedRow {
  draftId: string;
  title: string;
  /** Live URL when the deploy recorded one — "view live ↗" arms only then. */
  liveHref: string | null;
  thumb: string;
  at: Date;
}

/** Latest published work, newest first, bounded to the sheet's three cards. */
export function publishedRows(assets: PipelineAsset[], limit = 3): PublishedRow[] {
  return assets
    .filter((a) => a.publishedAt !== null)
    .sort(
      (a, b) => new Date(b.publishedAt as string).getTime() - new Date(a.publishedAt as string).getTime(),
    )
    .slice(0, limit)
    .map((a) => ({
      draftId: a.draftId,
      title: `${platformLabel(a.platform)} · ${a.excerpt || (a.format ?? "post")}`,
      liveHref: a.deployRef,
      thumb: thumbLabel(a) ?? "post image",
      at: new Date(a.publishedAt as string),
    }));
}

/** Planned slots bucketed into the visible week — the tile count and the week card's dashed marks. */
export function slotsInWeek(slots: PlannedSlotWire[], days: WeekDay[]): PlannedSlotWire[] {
  if (days.length === 0) return [];
  const start = days[0].date.getTime();
  const end = new Date(days[days.length - 1].date).setHours(24, 0, 0, 0);
  return slots.filter((s) => {
    const at = new Date(s.scheduledFor).getTime();
    return at >= start && at < end;
  });
}

/* ── The setup band (W1 sheet amendment — Hex's "Set up your workspace · N of 4",
   gap §5.1's answer: a dismissible band over existing surfaces, no route, no
   wizard, every step skippable) ── */

export interface SetupStep {
  key: "channel" | "profile" | "create" | "approve";
  /** The step's resting words — "Connect a channel". */
  label: string;
  done: boolean;
  /** Where the step's door leads while it is pending. */
  href: string;
  /** The door's words — the FIRST pending step renders these as its link. */
  doorLabel: string;
}

export interface SetupState {
  steps: SetupStep[];
  doneCount: number;
  allDone: boolean;
}

/**
 * The four steps' truth, each from a real read: a connected integration
 * card, the active brand profile, any fan-out run, any recorded approval.
 * The approve door carries the live waiting count (the sheet's "First
 * approve — 4 waiting →") only when something actually waits.
 */
export function setupState(input: {
  channelConnected: boolean;
  hasProfile: boolean;
  hasRun: boolean;
  hasApproval: boolean;
  needsYou: number;
}): SetupState {
  const steps: SetupStep[] = [
    {
      key: "channel",
      label: "Connect a channel",
      done: input.channelConnected,
      href: "/app/settings",
      doorLabel: "Connect a channel →",
    },
    {
      key: "profile",
      label: "Make a profile",
      done: input.hasProfile,
      href: "/app/profiles",
      doorLabel: "Make a profile →",
    },
    {
      key: "create",
      label: "First create",
      done: input.hasRun,
      href: "/app/create",
      doorLabel: "First create →",
    },
    {
      key: "approve",
      label: "First approve",
      done: input.hasApproval,
      href: "/app/approve",
      doorLabel:
        input.needsYou > 0
          ? `First approve — ${input.needsYou} waiting →`
          : "Walk the approve queue →",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, allDone: doneCount === steps.length };
}
