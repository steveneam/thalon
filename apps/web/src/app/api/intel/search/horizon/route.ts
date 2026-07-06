import { NextResponse } from "next/server";
import { fixtureHorizonCards } from "@/lib/intel/fixtures";

/**
 * The Search tab's horizon-opportunity read.
 *
 * B6.2 fake-driver seam (the B5.4 precedent): cards are the built-in demo
 * dataset (`demo: true`, visible banner) extending the engine fake's
 * queries. The REAL read is engine math over stored `search_snapshots`
 * (`runSearchIntake` → `runHorizonScan`) — engine-side by doctrine
 * (apps/web is engine-free), so it arms when the B6.5+ poller persists
 * horizon results (or a job route runs the scan) after GSC goes live at the
 * B6.7 deploy. This route then swaps its card source; the components and
 * wire shape (HorizonScore) stay put.
 */
export async function GET() {
  return NextResponse.json({ cards: fixtureHorizonCards, demo: true });
}
