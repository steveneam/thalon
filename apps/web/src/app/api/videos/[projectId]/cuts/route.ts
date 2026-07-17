import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";
import { planCutSave, verifyAgentReplay } from "@/lib/videos/save";

/**
 * B-ve.3 save door: an edit is ALWAYS a new version — the server derives
 * version = max(name)+1 and writes through the frozen videoCuts.create
 * (structurally idempotent, zod at the door, event in-transaction). The EDL
 * is compile-checked before it stores (422 = the compiler's own refusal,
 * verbatim).
 *
 * B-ve.4: every save is attributed (default operator); an agent-attributed
 * save is REPLAY-VERIFIED — the door loads the attributed base cut through
 * the tenancy wall, re-applies the diff, and refuses 422 unless the result
 * is exactly the submitted EDL. AI edits ride this same door, provably.
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
    if (planned.lineage) {
      const parent = await repos.videoCuts.get(ctx, planned.lineage.parentCutId);
      if (!parent || parent.projectId !== projectId) {
        return NextResponse.json(
          { error: "lineage parent not found in this project" },
          { status: 422 },
        );
      }
    }
    if (planned.attribution.authoredBy === "agent" && planned.attribution.proposal) {
      const base = await getCutDetail(repos, ctx, projectId, planned.attribution.proposal.baseCutId);
      if (!base) {
        return NextResponse.json(
          { error: "attributed base cut not found in this project" },
          { status: 422 },
        );
      }
      const verified = verifyAgentReplay(planned.attribution, base.edl, planned.edl);
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error }, { status: verified.status });
      }
    }
    const { cut, created } = await repos.videoCuts.create(ctx, projectId, planned.input);
    const detail = await getCutDetail(repos, ctx, projectId, cut.id);
    return NextResponse.json({ cut: detail, created }, { status: created ? 201 : 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
