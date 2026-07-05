import { NextResponse } from "next/server";
import { listRunDrafts } from "@/lib/approve-queue/queries";
import { listStagedRunDrafts } from "@/lib/staged-flow/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Zone 2 grid: drafts belonging to one fan-out run. */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  // B5.4 fake-driver seam (see ../../route.ts): staged fixture drafts come
  // from the in-memory store, before any tenant/db resolution.
  const staged = listStagedRunDrafts(runId);
  if (staged) return NextResponse.json({ drafts: staged });
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ drafts: [] });
  const drafts = await listRunDrafts(repos, ctx, runId);
  return NextResponse.json({ drafts });
}
