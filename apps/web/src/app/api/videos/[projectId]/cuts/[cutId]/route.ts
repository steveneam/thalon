import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { mediaRootOf } from "@/lib/videos/media-root";
import { removeCutFiles } from "@/lib/videos/output-file";
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

/**
 * s82 A3 — DELETE A VERSION, over the frozen `videoCuts.remove` (W1).
 *
 * The three refusals are the founder's ratified default (plan §3 call #2) and
 * live in the repo, inside the transaction, where they cannot be talked past:
 * an approved cut carries its judge receipt, a lineage parent anchors a living
 * derived cut's provenance, and the project's last cut is what makes the
 * project openable. This door's own job is the half a repo cannot do — the
 * RENDERED FILE. `remove()` hands the deleted row's `outputRef` back precisely
 * so it does not get orphaned.
 *
 * The row goes first and the file second, deliberately: a failed unlink leaves
 * a nameless file on disk, while a failed delete after a successful unlink
 * would leave a version claiming a render that is gone. The response says
 * which happened either way — the file half is reported, never assumed.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const project = await repos.videoProjects.get(ctx, projectId);
    if (!project) return NextResponse.json({ error: "video project not found" }, { status: 404 });
    // Project-scoped before the repo's own tenancy wall, so a cut id from
    // another project of the same tenant 404s here rather than being deleted
    // through the wrong project's door.
    const target = await repos.videoCuts.get(ctx, cutId);
    if (!target || target.projectId !== projectId) {
      return NextResponse.json({ error: "video cut not found" }, { status: 404 });
    }
    const { removed } = await repos.videoCuts.remove(ctx, cutId);
    const file = await removeCutFiles(mediaRootOf(project.meta), removed);
    return NextResponse.json({
      removed: {
        id: removed.id,
        name: removed.name,
        version: removed.version,
        status: removed.status,
        outputRef: removed.outputRef,
      },
      file,
    });
  } catch (err) {
    // A ratified refusal is a STATE conflict, not a malformed request, and its
    // message is the operator's answer — it travels verbatim.
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
