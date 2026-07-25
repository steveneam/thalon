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
    const { results, primary } = await runIntelSweep(repos, ctx);
    const { bundle, cardsCut } = primary;
    return NextResponse.json({
      // Bundle fields describe the trends surface's bundle = the LAST swept
      // source (the s72 multi-source interim); `sources` lists every driver
      // this pass actually swept, and the admission counts span all of them.
      source: bundle.source,
      sources: results.map((r) => r.bundle.source),
      polled: results.reduce((n, r) => n + r.bundle.polled, 0),
      cards: bundle.cards.length,
      cardsCut,
      areasSwept: bundle.areasSwept,
      // B-learn L1: exemplars the admission pass created this sweep, plus any
      // budget-rail refusals VERBATIM (logged, never fatal to the sweep).
      admitted: results.reduce((n, r) => n + r.intake.admissions.admitted.length, 0),
      admissionBudgetRefusals: results.flatMap((r) =>
        r.intake.admissions.budgetRefusals.map((x) => x.reason),
      ),
      sweptAt: new Date(bundle.sweptAtMs).toISOString(),
      nextSweepAt: new Date(bundle.nextSweepAtMs).toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
