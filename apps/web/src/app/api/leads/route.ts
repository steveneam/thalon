import { NextResponse } from "next/server";
import { readLeadsPayload } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** The Leads queue read: every lead joined with its latest score + whether scoring is armed. */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({
      leads: [],
      scoringArmed: false,
      currentProfileHash: null,
      learnedWeights: { state: null, staleForProfile: false },
      counts: { new: 0, scored: 0, dismissed: 0 },
    });
  }
  return NextResponse.json(await readLeadsPayload(ctx, repos));
}
