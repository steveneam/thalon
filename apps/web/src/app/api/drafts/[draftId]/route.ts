import { NextResponse } from "next/server";
import { getDraftDetail } from "@/lib/approve-queue/queries";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Zone 3 panel: full draft body + judge_results for the gate-evidence badge. */
export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const detail = await getDraftDetail(repos, ctx, draftId);
  if (!detail) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  return NextResponse.json(detail);
}
