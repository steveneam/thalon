import { applyAiEdit, type AiEditProposal } from "@thalon/engine";
import { gatewayJudgeDriver } from "@thalon/judge";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * The Composer's AI-edit APPLY door: lands an accepted proposal through the
 * existing edit door (approvals `edit` — one transaction writes the edit
 * diff, the eval row, swaps the body) and re-judges before the variant can
 * leave (spec R8; AGENTS.md rule 4). The engine refuses when the draft moved
 * since the proposal — the divergence model made visible, never a silent
 * overwrite.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  const body: unknown = await request.json().catch(() => ({}));
  const raw =
    typeof body === "object" && body !== null
      ? (body as { proposal?: unknown; runId?: unknown }).proposal
      : undefined;
  const p = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  const proposal: AiEditProposal | null =
    p &&
    str(p.instruction) &&
    typeof p.priorBody === "string" &&
    str(p.priorBodyHash) &&
    str(p.proposedBody)
      ? {
          draftId,
          instruction: p.instruction as string,
          priorBody: p.priorBody as string,
          priorBodyHash: p.priorBodyHash as string,
          proposedBody: p.proposedBody as string,
        }
      : null;
  if (!proposal) {
    return NextResponse.json({ error: "a complete proposal is required" }, { status: 400 });
  }

  try {
    const result = await applyAiEdit(
      ctx,
      repos,
      {
        proposal,
        runId: str((body as { runId?: unknown }).runId),
      },
      { screenDriver: gatewayJudgeDriver(), finalDriver: gatewayJudgeDriver() },
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
