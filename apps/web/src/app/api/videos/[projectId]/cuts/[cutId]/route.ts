import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";

/** B-ve.3 editor read: one cut WITH its full EDL (the browse detail ships summaries only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const cut = await getCutDetail(repos, ctx, projectId, cutId);
  if (!cut) return NextResponse.json({ error: "video cut not found" }, { status: 404 });
  return NextResponse.json(cut);
}
