import { NextResponse } from "next/server";
import { EdlProposeError, proposeEdlDiff } from "@thalon/engine";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";

/**
 * B-ve.4 propose door (ADR 0010): the agent proposes an EDL DIFF against
 * this cut — never a new EDL. The engine core validates the candidate (zod
 * boundary + dry-apply) before anything reaches the operator; the response
 * carries the diff, the applied preview, and the full attribution block the
 * save door will demand if the operator applies it. Nothing is stored here:
 * the only doors that write are save (replay-verified) and reject (an eval
 * row). The LLM call rides the gateway/claude-cli seam — Higgsfield is
 * structurally absent from this path (A17 invariant).
 */

const proposeRequestSchema = z.object({
  ask: z.string().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = proposeRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  try {
    const cut = await getCutDetail(repos, ctx, projectId, cutId);
    if (!cut) return NextResponse.json({ error: "video cut not found" }, { status: 404 });

    const proposal = await proposeEdlDiff(ctx, repos, { edl: cut.edl, ask: parsed.data.ask });
    return NextResponse.json({
      diff: proposal.diff,
      preview: proposal.preview,
      attribution: {
        authoredBy: "agent" as const,
        proposal: {
          baseCutId: cut.id,
          model: proposal.model,
          promptName: proposal.promptName,
          promptHash: proposal.promptHash,
          ...(parsed.data.ask?.trim() ? { ask: parsed.data.ask.trim() } : {}),
          diff: proposal.diff,
          decidedBy: "operator" as const,
        },
      },
      tokens: { in: proposal.tokensIn, out: proposal.tokensOut },
    });
  } catch (err) {
    if (err instanceof EdlProposeError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return toErrorResponse(err);
  }
}
