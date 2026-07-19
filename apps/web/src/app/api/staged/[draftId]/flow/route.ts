import { NextResponse } from "next/server";
import { getLiveStagedFlow } from "@/lib/staged-flow/live";
import { getStagedFlow } from "@/lib/staged-flow/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The staged flow, anchored at any of its stage drafts. Two sources behind
 * one GET: the B5.4 in-memory demo store answers its fixture ids
 * (interactive, fake drivers); every OTHER stage draft is projected
 * READ-ONLY from the real drafts table (s67, lib/staged-flow/live.ts) so
 * one-prompt chains are inspectable from Approve — the founder's s66 find:
 * real chains answered "belongs to no staged flow". Pick/edit/advance stay
 * demo-only until the pass-3 write half lands as its own bucket.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const demo = getStagedFlow(draftId);
  if (demo) return NextResponse.json(demo);

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const live = await getLiveStagedFlow(repos, ctx, draftId);
    if (!live) {
      return NextResponse.json(
        { error: `draft "${draftId}" belongs to no staged flow` },
        { status: 404 },
      );
    }
    return NextResponse.json(live);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to load the staged flow" },
      { status: 500 },
    );
  }
}
