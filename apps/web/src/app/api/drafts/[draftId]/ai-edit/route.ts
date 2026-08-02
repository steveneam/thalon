import { aiEditDraft } from "@thalon/engine";
import { gatewayJudgeDriver } from "@thalon/judge";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Composer's AI-edit PROPOSE door (B-create.4 — the built-but-doorless
 * verb from the create-shells + judge-candidate lanes gets its route).
 * Writes nothing: the engine proposes a rewrite, the candidate judge checks
 * it, and a refusal carries the reason verbatim — the operator's known-good
 * text is never touched. Applying is a separate door (./apply), which is
 * what makes the propose→inspect→apply flow honest.
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
  const instruction =
    typeof body === "object" && body !== null
      ? (body as { instruction?: unknown }).instruction
      : undefined;
  if (typeof instruction !== "string" || instruction.trim() === "") {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  try {
    // The same driver wiring as every judge path in this app (judge-runner.ts):
    // the real gateway driver per tier; metering happens inside the pipeline.
    const result = await aiEditDraft(
      ctx,
      repos,
      { draftId, instruction },
      { screenDriver: gatewayJudgeDriver(), finalDriver: gatewayJudgeDriver() },
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
