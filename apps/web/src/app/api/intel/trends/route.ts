import { NextResponse } from "next/server";
import { fixtureSweep } from "@/lib/intel/fixtures";
import { liveSweepStamp, readLiveSweep, toTrendCard } from "@/lib/intel/live";
import { toAreaRow } from "@/lib/intel/serialize";
import { isTrendCardDismissed, listTrendCards } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Trends tab read: REAL monitored areas from the repo + ranked cards.
 *
 * B6.5 armed the seam this route carried since B6.2: when the poller
 * (`runTrendSweep` — Sweep-now today, cron at B6.7) has persisted a bundle,
 * cards come from it (`demo: false`, live cadence stamp); before the first
 * sweep the built-in demo dataset renders behind its visible banner exactly
 * as before. Session dismissals filter BOTH eras through the one capture
 * store (durable eval-row write = the next contract window). Area filtering
 * stays CLIENT-side over the cards (B6.4 wrap: `ranked` is per item × area
 * — no extra engine call).
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const areas = ctx ? await repos.monitoredAreas.list(ctx) : [];
  const bundle = ctx ? await readLiveSweep(ctx.tenantId) : null;
  if (bundle) {
    return NextResponse.json({
      areas: areas.map(toAreaRow),
      cards: bundle.cards.map(toTrendCard).filter((card) => !isTrendCardDismissed(card.id)),
      demo: false,
      sweep: liveSweepStamp(bundle),
    });
  }
  return NextResponse.json({
    areas: areas.map(toAreaRow),
    cards: listTrendCards(),
    demo: true,
    sweep: fixtureSweep,
  });
}
