import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { scoreNow } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Score now: NEW leads + ICP-drift re-scores. Deterministic and idempotent —
 * a replay with an unchanged profile appends nothing. Gateway refusals
 * (budget, missing key) surface verbatim, the sweep-route convention.
 */
export async function POST() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    return NextResponse.json(await scoreNow(ctx, repos));
  } catch (err) {
    return toErrorResponse(err);
  }
}
