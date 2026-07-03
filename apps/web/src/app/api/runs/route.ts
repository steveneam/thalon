import { NextResponse } from "next/server";
import { listRunsFeed } from "@/lib/approve-queue/queries";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Zone 1 feed: fan-out runs, newest first. */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ runs: [] });
  const runs = await listRunsFeed(repos, ctx);
  return NextResponse.json({ runs });
}
