import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
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

/**
 * Window 0026 — RENAME a project. The live grid's two near-duplicate one-prompt
 * runs are the case the founder named at the s99 close, and his call came with
 * the one rule that matters: **rename REFUSES on a collision, it never
 * merges.** `(tenant, name)` is not merely unique, it is the get-or-create
 * idempotency key, so "rename A to B where B exists" would quietly mean "every
 * future get-or-create for B now lands in what used to be A".
 *
 * The refusal lives in the repo; this door's own half is turning it into a 409
 * whose message is the operator's answer, and rejecting a malformed body as a
 * 400 (which is what a missing/blank name is — not a state conflict).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "a project needs a name" }, { status: 400 });
  }
  try {
    const { project, renamed } = await repos.videoProjects.rename(ctx, projectId, { name });
    return NextResponse.json({
      project: { id: project.id, name: project.name },
      // False when the name was already what was asked for — a no-op the door
      // reports rather than dressing up as a change.
      changed: renamed,
    });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}

/**
 * Window 0026 — RETIRE a project: it leaves the grid, and nothing else happens
 * to it. Its cuts, takes, rendered files, judge receipts and events all stay
 * exactly where they are, which is what lets `POST …/restore` bring the whole
 * tree back unchanged.
 *
 * Unlike a cut's retire this one carries NO refusals, and the asymmetry is
 * deliberate: a cut's refusals protect things left dangling INSIDE a living
 * project, and a project that leaves takes its whole tree with it.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const { project, retired } = await repos.videoProjects.retire(ctx, projectId);
    return NextResponse.json({
      retired: { id: project.id, name: project.name },
      changed: retired,
    });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
