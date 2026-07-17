import path from "node:path";
import { NextResponse } from "next/server";
import {
  EdlProposeError,
  probeSourceDims,
  proposeEdlDiff,
  SourceProbeError,
  type SourceDimsByRef,
} from "@thalon/engine";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { mediaRootOf } from "@/lib/videos/media-root";
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
 *
 * B-ve.7: the door probes the beat lane's measured source dims (the derive
 * door's ffprobe machinery) and passes them into the propose call — the
 * prompt context carries the bounds, and dry-apply refuses any crop window
 * that leaves them. No media root = no dims: caption/music asks still work,
 * crop ops refuse ("measured, never estimated" binds the agent too). A
 * copy-mode cut skips the probe — its picture carries no croppable beats.
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
    const project = await repos.videoProjects.get(ctx, projectId);
    if (!project) return NextResponse.json({ error: "video project not found" }, { status: 404 });
    const cut = await getCutDetail(repos, ctx, projectId, cutId);
    if (!cut) return NextResponse.json({ error: "video cut not found" }, { status: 404 });

    const root = mediaRootOf(project.meta);
    let dims: SourceDimsByRef | undefined;
    if (root && cut.edl.output.video.mode !== "copy") {
      try {
        dims = await probeSourceDims(
          cut.edl.video.map((clip) => clip.source.ref),
          { resolve: (ref) => path.join(root, ref) },
        );
      } catch (err) {
        // Media claimed but unmeasurable: refuse loudly (the derive door's
        // posture) — a propose over unprobeable media would quietly downgrade
        // to guess-or-nothing.
        if (err instanceof SourceProbeError) {
          return NextResponse.json({ error: err.message }, { status: 422 });
        }
        throw err;
      }
    }

    const proposal = await proposeEdlDiff(ctx, repos, {
      edl: cut.edl,
      ask: parsed.data.ask,
      dims,
    });
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
