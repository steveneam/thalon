import { NextResponse } from "next/server";
import { edlDiffSchema } from "@thalon/contracts";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";

/**
 * B-ve.4 reject door (AGENTS.md rule 6): an operator rejecting an agent
 * proposal is a CORRECTION — it becomes an eval row in the same change,
 * with the reason required (the reject discipline of the take tables: the
 * reason is the learning material). Origin 'cut_diff_review' keeps the
 * taxonomy honest; a future proposer-tuning harness consumes these rows.
 */

const rejectRequestSchema = z.object({
  diff: edlDiffSchema,
  reason: z.string().min(1),
  ask: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = rejectRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  try {
    const cut = await getCutDetail(repos, ctx, projectId, cutId);
    if (!cut) return NextResponse.json({ error: "video cut not found" }, { status: 404 });

    const row = await repos.evalCases.recordCutDiffReview(ctx, {
      kind: "edl_diff_proposal",
      input: {
        cutId: cut.id,
        cutName: cut.name,
        cutVersion: cut.version,
        ...(parsed.data.ask?.trim() ? { ask: parsed.data.ask.trim() } : {}),
        diff: parsed.data.diff,
      },
      reason: parsed.data.reason,
      sourceRef: cut.id,
    });
    return NextResponse.json({ evalCaseId: row.id }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
