import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getProjectDetail } from "@/lib/videos/queries";

/** Videos surface, detail: takes (reasons inline), cuts (EDL summaries), provenance. Read-only (B-ve.2). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const detail = await getProjectDetail(repos, ctx, projectId);
  if (!detail) return NextResponse.json({ error: "video project not found" }, { status: 404 });
  return NextResponse.json(detail);
}
