import { NextResponse } from "next/server";
import { rejectDraft } from "@/lib/approve-queue/actions";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

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
  // The operator's stated reason (s90 window): present ⇒ the rejection is a
  // correction and lands an eval_cases row in the same transaction. The
  // repo trims and treats blank as absent — no policing here.
  const reason =
    typeof body === "object" && body !== null && typeof (body as { reason?: unknown }).reason === "string"
      ? (body as { reason: string }).reason
      : undefined;
  try {
    const result = await rejectDraft(repos, ctx, draftId, actor, reason);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
