import { NextResponse } from "next/server";
import { toAreaRow } from "@/lib/intel/serialize";
import { listTrendCards } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Trends tab read: REAL monitored areas from the repo + ranked cards.
 *
 * B6.2 fake-driver seam (the B5.4 precedent): cards come from the built-in
 * demo dataset (`demo: true`, rendered with a visible banner) because
 * nothing persists ranked intake output yet — the B6.5 poller lands
 * `monitoredAreas.list(ctx, {status:"active"}) → runTrendIntake({areas})`
 * engine-side and this route swaps its card source for the persisted
 * results. Area filtering stays CLIENT-side over the cards (B6.4 wrap:
 * `ranked` is per item × area — no extra engine call).
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const areas = ctx ? await repos.monitoredAreas.list(ctx) : [];
  return NextResponse.json({
    areas: areas.map(toAreaRow),
    cards: listTrendCards(),
    demo: true,
  });
}
