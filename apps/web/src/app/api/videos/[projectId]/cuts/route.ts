import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";
import { planCutSave } from "@/lib/videos/save";

/**
 * B-ve.3 save door: an edit is ALWAYS a new version — the server derives
 * version = max(name)+1 and writes through the frozen videoCuts.create
 * (structurally idempotent, zod at the door, event in-transaction). The EDL
 * is compile-checked before it stores (422 = the compiler's own refusal,
 * verbatim). No mutation, no approve — the judge gate binds at B-ve.4.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  try {
    const existing = await repos.videoCuts.list(ctx, projectId);
    const planned = planCutSave(existing, body);
    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: planned.status });
    }
    const { cut, created } = await repos.videoCuts.create(ctx, projectId, planned.input);
    const detail = await getCutDetail(repos, ctx, projectId, cut.id);
    return NextResponse.json({ cut: detail, created }, { status: created ? 201 : 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
