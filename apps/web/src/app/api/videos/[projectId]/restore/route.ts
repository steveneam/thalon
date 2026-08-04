import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Window 0026 — RESTORE a retired project. Like the cut's restore door it only
 * clears a stamp: retiring destroyed nothing, so the whole tree (takes, cuts,
 * their rendered files) is still exactly where it was and comes back with it.
 *
 * Sanctioned use of the `includeRetired` read opt-in — the door has to be able
 * to see what it is restoring.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const target = await repos.videoProjects.get(ctx, projectId, { includeRetired: true });
    if (!target) return NextResponse.json({ error: "video project not found" }, { status: 404 });
    const { project, restored } = await repos.videoProjects.restore(ctx, projectId);
    return NextResponse.json({
      restored: { id: project.id, name: project.name },
      changed: restored,
    });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
