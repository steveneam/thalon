import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Runs surface's W1 re-shape read (workspace spec §3 ORIENT, §5.8):
 * create runs are the PARENT records the history nests under, and the
 * footer's day total is the Clay take from `usage_ledger`. One read serves
 * both because they arrive together on the one surface that shows them —
 * a second route would be ceremony.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ runs: [], usageToday: null });
  const [runs, usageToday] = await Promise.all([
    repos.createRuns.list(ctx),
    repos.usageLedger.totalForDay(ctx),
  ]);
  return NextResponse.json({ runs, usageToday });
}
