import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { listProjectSummaries } from "@/lib/videos/queries";

/** Videos surface, list: every project with its keeper/reject/cut counts. Read-only (B-ve.2). */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const projects = ctx ? await listProjectSummaries(repos, ctx) : [];
  return NextResponse.json({ projects });
}
