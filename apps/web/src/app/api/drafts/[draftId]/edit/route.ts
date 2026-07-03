import { NextResponse } from "next/server";
import { editDraft } from "@/lib/approve-queue/actions";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Edit-then-approve: this call captures the edit (edit_diffs + eval_cases, same transaction) and sends the draft back to `judging` for re-gating; a separate approve call is required once it re-queues. */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const editedBody =
    typeof body === "object" && body !== null ? (body as { editedBody?: unknown }).editedBody : undefined;
  if (typeof editedBody !== "string" || editedBody.length === 0) {
    return NextResponse.json({ error: "editedBody is required" }, { status: 400 });
  }
  const actor =
    typeof body === "object" && body !== null && typeof (body as { actor?: unknown }).actor === "string"
      ? (body as { actor: string }).actor
      : undefined;
  try {
    const result = await editDraft(repos, ctx, draftId, editedBody, actor);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
