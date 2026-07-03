import { NextResponse } from "next/server";
import { approveDraft } from "@/lib/approve-queue/actions";
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
  try {
    const result = await approveDraft(repos, ctx, draftId, actor);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
