import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { listProjectSummaries, listRetiredProjects } from "@/lib/videos/queries";

/**
 * Videos surface, list: every LIVING project with its keeper/reject/cut counts,
 * plus (window 0026) the retired ones the grid's restore door names. Read-only.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ projects: [], retired: [] });
  const [projects, retired] = await Promise.all([
    listProjectSummaries(repos, ctx),
    listRetiredProjects(repos, ctx),
  ]);
  return NextResponse.json({ projects, retired });
}
