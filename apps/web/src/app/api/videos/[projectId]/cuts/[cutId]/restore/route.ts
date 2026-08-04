import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Window 0026 — RESTORE a retired version, the other half of the door the
 * sheet has been drawing since the mock: "Restore brings it back exactly as it
 * is now." It can be exact because retiring never destroyed anything — the
 * row, its EDL, its `outputRef` and the rendered file on disk are all
 * untouched, so this verb only clears a stamp.
 *
 * It is the ONE sanctioned caller of the `includeRetired` read opt-in: every
 * other read excludes retired rows by default (a retire still visible
 * everywhere is not a retire), but a restore door that could not see what it
 * restores could not exist.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    // The project must be LIVE: restoring a cut into a retired project would
    // put it somewhere no read of the operator's can reach.
    const project = await repos.videoProjects.get(ctx, projectId);
    if (!project) return NextResponse.json({ error: "video project not found" }, { status: 404 });
    const target = await repos.videoCuts.get(ctx, cutId, { includeRetired: true });
    if (!target || target.projectId !== projectId) {
      return NextResponse.json({ error: "video cut not found" }, { status: 404 });
    }
    const { cut, restored } = await repos.videoCuts.restore(ctx, cutId);
    return NextResponse.json({
      restored: {
        id: cut.id,
        name: cut.name,
        version: cut.version,
        status: cut.status,
        outputRef: cut.outputRef,
      },
      changed: restored,
    });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
