import { NextResponse } from "next/server";
import { listRunDrafts } from "@/lib/approve-queue/queries";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Zone 2 grid: drafts belonging to one fan-out run. */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ drafts: [] });
  const drafts = await listRunDrafts(repos, ctx, runId);
  return NextResponse.json({ drafts });
}
