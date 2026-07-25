import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { runIntelSweep } from "@/lib/intel/sweep-runner";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Sweep-now (B6.5): one live sweep through the env-selected TrendSource,
 * persisted for the trends read. Thin per doctrine (SPINE §80): authorize →
 * call the engine service → return the bundle summary. Driver refusals
 * (missing Bluesky credentials, an over-budget watchlist) surface VERBATIM
 * — the operator reads the actual knob to turn, not a euphemism.
 */
export async function POST() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { bundle, cardsCut, intake } = await runIntelSweep(repos, ctx);
    return NextResponse.json({
      source: bundle.source,
      polled: bundle.polled,
      cards: bundle.cards.length,
      cardsCut,
      areasSwept: bundle.areasSwept,
      // B-learn L1: exemplars the admission pass created this sweep, plus any
      // budget-rail refusals VERBATIM (logged, never fatal to the sweep).
      admitted: intake.admissions.admitted.length,
      admissionBudgetRefusals: intake.admissions.budgetRefusals.map((r) => r.reason),
      sweptAt: new Date(bundle.sweptAtMs).toISOString(),
      nextSweepAt: new Date(bundle.nextSweepAtMs).toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
