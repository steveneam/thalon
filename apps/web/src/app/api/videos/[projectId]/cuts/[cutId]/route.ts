import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
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

/**
 * Window 0026 — RETIRE A VERSION, over the frozen `videoCuts.retire`. This
 * door was s82's hard delete; the founder's call at the s99 close made removal
 * REVERSIBLE, and the door changed shape with it.
 *
 * What it no longer does is the interesting half: it does not touch the disk.
 * The old door's own job was unlinking the rendered mp4 so it would not be
 * orphaned by the vanished row — but nothing vanishes now, the row keeps its
 * `outputRef`, and the file it names is exactly what `POST …/restore` brings
 * back. Deleting it here would have made the sheet's confirm ("Restore brings
 * it back exactly as it is now") a lie the first time an operator believed it.
 *
 * The three refusals remain the repo's, inside the transaction, where they
 * cannot be talked past: an approved cut carries its judge receipt, a lineage
 * parent anchors a living derived cut's provenance, and the project's last
 * living cut is what makes the project openable.
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
    // another project of the same tenant 404s here rather than being retired
    // through the wrong project's door.
    const target = await repos.videoCuts.get(ctx, cutId);
    if (!target || target.projectId !== projectId) {
      return NextResponse.json({ error: "video cut not found" }, { status: 404 });
    }
    const { cut, retired } = await repos.videoCuts.retire(ctx, cutId);
    return NextResponse.json({
      retired: {
        id: cut.id,
        name: cut.name,
        version: cut.version,
        status: cut.status,
        outputRef: cut.outputRef,
      },
      // False when the cut was already retired — the door converges rather
      // than erroring, and says which of the two happened.
      changed: retired,
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
