import type { HorizonCard } from "@/lib/intel/types";

/**
 * The plain-language read of a horizon card (founder s74: "those don't mean
 * much to the general user — they just want to know the end point
 * significance").
 *
 * The operator-facing surface answers ONE question — is this worth acting on
 * and why — while position/impressions/CTR/snapshots and the ranker's own
 * verbatim reason strings move one level down, behind a disclosure and
 * tooltips. Nothing is deleted: the math stays available and attributable,
 * it just stops being the headline.
 *
 * Honesty rules this module keeps:
 *  - the SIGNAL COUNT is `reasons.length` — the engine emits exactly one line
 *    per rule that fired, so the score is the engine's own count, never a
 *    re-derived guess with thresholds that could drift out of sync;
 *  - each plain clause is CLASSIFIED from the engine's own vocabulary and
 *    carries its verbatim string as the tooltip, so a reader can always see
 *    the sentence the math actually wrote (an unrecognised reason falls back
 *    to that verbatim string rather than being dropped);
 *  - a missing number reads "–", never a fabricated zero.
 */

/** The horizon math fires at most these three rules. */
export const HORIZON_SIGNALS = 3;

export interface HorizonClause {
  /** The plain-language claim shown to the operator. */
  text: string;
  /** The ranker's own sentence — the tooltip/provenance behind the claim. */
  verbatim: string;
}

export interface HorizonRead {
  /** The end-point significance, in the operator's terms. */
  verdict: string;
  /** How many of the horizon rules fired, per the engine's own reason list. */
  signals: number;
  /** One plain clause per fired rule, each carrying its verbatim reason. */
  clauses: HorizonClause[];
  /** The plain-language metric lines — the disclosure's content. */
  metrics: string[];
}

/** The engine writes each reason starting with the signal it describes. */
function clauseFor(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.startsWith("position")) return "page 1 is in reach";
  if (r.startsWith("impressions")) return "demand is growing";
  if (r.startsWith("ctr")) return "you’re under-clicked for where you rank";
  return null;
}

function fmtPct(value: number): string {
  // CTRs are small fractions; one decimal of a percent is the readable unit.
  return `${(value * 100).toFixed(1)}%`;
}

export function horizonRead(card: HorizonCard): HorizonRead {
  const clauses: HorizonClause[] = card.reasons.map((reason) => ({
    text: clauseFor(reason) ?? reason,
    verbatim: reason,
  }));
  const signals = card.reasons.length;

  let verdict: string;
  if (card.isOpportunity) {
    verdict = "Worth targeting now";
  } else if (signals > 0) {
    verdict = "Worth watching";
  } else if (card.position !== null && card.position < 8) {
    verdict = "Already ranking well";
  } else if (card.position !== null && card.position > 20) {
    verdict = "Too far back to target yet";
  } else {
    verdict = "Not enough signal yet";
  }

  const metrics: string[] = [
    card.position === null ? "Rank unknown" : `Ranks #${card.position.toFixed(1)}`,
    card.latestImpressions === null
      ? "Impressions unknown"
      : `${card.latestImpressions} impressions${
          card.impressionsGrowth === null ? "" : `, up ${card.impressionsGrowth.toFixed(2)}×`
        }`,
    card.ctr === null
      ? "Click rate unknown"
      : `Clicked ${fmtPct(card.ctr)} of the time${
          card.expectedCtr === null || card.expectedCtr === 0
            ? ""
            : ` — ${(card.ctr / card.expectedCtr).toFixed(2)}× what this rank usually earns (${fmtPct(card.expectedCtr)})`
        }`,
    `From ${card.snapshots} snapshot${card.snapshots === 1 ? "" : "s"}`,
  ];
  if (card.page) metrics.push(card.page);

  return { verdict, signals, clauses, metrics };
}
