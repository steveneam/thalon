import { NextResponse } from "next/server";
import { fixtureSweep } from "@/lib/intel/fixtures";
import {
  liveSweepStamp,
  mergedTrendCards,
  readLiveSweeps,
  sourceSweepStamps,
} from "@/lib/intel/live";
import { applyScheduleToStamp } from "@/lib/intel/schedule-stamp";
import { toAreaRow } from "@/lib/intel/serialize";
import { isTrendCardDismissed, listTrendCards } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Trends tab read: REAL monitored areas from the repo + ranked cards.
 *
 * B6.5 armed the seam this route carried since B6.2; B-learn L2 slice 1
 * made the read HONEST across sources: when the poller (`runTrendSweep` —
 * Sweep-now or the scheduler) has persisted bundles, cards are the merged
 * score-ordered UNION of every swept source's bundle (`demo: false`, live
 * cadence stamp from the freshest sweep, plus a per-source stamp line —
 * the s72 interim let the LAST swept source own this read). Before the
 * first sweep the built-in demo dataset renders behind its visible banner
 * exactly as before. Session dismissals filter BOTH eras through the one
 * capture store (durable eval-row write = the next contract window). Area
 * filtering stays CLIENT-side over the cards (B6.4 wrap: `ranked` is per
 * item × area — no extra engine call).
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const areas = ctx ? await repos.monitoredAreas.list(ctx) : [];
  const bundles = ctx ? await readLiveSweeps(ctx.tenantId) : [];
  // B-arm.1: the stamp's "next sweep" is the SCHEDULE's truth in both eras —
  // enabled shows the real next time (or due-now); disabled/absent keeps the
  // honest null (no next sweep), replacing the bundle's advisory arithmetic.
  const schedule = ctx ? await repos.sweepSchedules.get(ctx) : null;
  if (bundles.length > 0) {
    return NextResponse.json({
      areas: areas.map(toAreaRow),
      cards: mergedTrendCards(bundles).filter((card) => !isTrendCardDismissed(card.id)),
      demo: false,
      // readLiveSweeps sorts freshest-first — the headline stamp is the latest sweep.
      sweep: applyScheduleToStamp(liveSweepStamp(bundles[0]), schedule, Date.now()),
      sources: sourceSweepStamps(bundles),
    });
  }
  return NextResponse.json({
    areas: areas.map(toAreaRow),
    cards: listTrendCards(),
    demo: true,
    sweep: applyScheduleToStamp(fixtureSweep, schedule, Date.now()),
    sources: [],
  });
}
