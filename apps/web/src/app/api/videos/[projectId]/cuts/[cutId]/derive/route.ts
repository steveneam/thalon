import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { DeriveRefusedError, planCutDerive } from "@/lib/videos/derive";
import { getCutDetail } from "@/lib/videos/queries";

/**
 * B-ve.5 derive door: POST { aspect: "9:16" | "1:1", name? } → a NEW cut
 * whose EDL is the parent's timeline recomposed for the target canvas —
 * measured centered-window seeds (every source ffprobe'd under the media
 * root), lineage stamped server-side at `meta.lineage`, operator-attributed.
 * Own-engine recut, 0 credits by construction (A17); vendor reframe cannot
 * be expressed here. Copy-mode parents refuse 422 with the honest reason.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  try {
    const planned = await planCutDerive(repos, ctx, projectId, cutId, body);
    const { cut, created } = await repos.videoCuts.create(ctx, projectId, planned.input);
    const detail = await getCutDetail(repos, ctx, projectId, cut.id);
    return NextResponse.json({ cut: detail, created }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof DeriveRefusedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return toErrorResponse(err);
  }
}
