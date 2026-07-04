import { NextResponse } from "next/server";
import { reJudgeDraft } from "@/lib/approve-queue/actions";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Operator re-judge: re-runs judging on the UNMODIFIED draft (a `blocked` retry, or releasing a `judging` draft an operational halt stranded). */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const actor =
    typeof body === "object" && body !== null && typeof (body as { actor?: unknown }).actor === "string"
      ? (body as { actor: string }).actor
      : undefined;
  try {
    const result = await reJudgeDraft(repos, ctx, draftId, actor);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
