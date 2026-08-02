import { analyticsReadModel } from "@thalon/engine";
import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Analytics surface's ONE read: the engine's analytics read-model
 * (two queries total, honesty rules already applied) over the tenant's
 * publications. Read-only — no reader is armed, no platform is called;
 * everything here comes from rows the tick already wrote. The clock is
 * taken at the route edge because the engine wants it as an argument.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("windowDays");
  let windowDays = 28;
  if (raw !== null) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      return NextResponse.json(
        { error: "windowDays must be an integer between 1 and 365" },
        { status: 400 },
      );
    }
    windowDays = parsed;
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ model: null });
  const model = await analyticsReadModel({ repos, ctx }, { windowDays }, new Date());
  return NextResponse.json({ model });
}
