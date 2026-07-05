import { NextResponse } from "next/server";
import { listRunsFeed } from "@/lib/approve-queue/queries";
import { getStagedRunForFeed } from "@/lib/staged-flow/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Zone 1 feed: fan-out runs, newest first. */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const runs = ctx ? await listRunsFeed(repos, ctx) : [];
  // B5.4 fake-driver seam: the staged fixture chain rides the feed (last —
  // it is the oldest row) so the staged-flow surface is reachable in dev
  // with zero engine wiring. Pass 3 removes this merge when the real staged
  // pipeline persists real runs.
  return NextResponse.json({ runs: [...runs, getStagedRunForFeed()] });
}
