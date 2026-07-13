import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { syncWaitlistAndScore } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Bridge every waitlist signup into leads (idempotent — the dedupe key does the work), then score. */
export async function POST() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { sync, scoring } = await syncWaitlistAndScore(ctx, repos);
    return NextResponse.json({ sync, scoring });
  } catch (err) {
    return toErrorResponse(err);
  }
}
