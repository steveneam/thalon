import { SEARCH_TARGET_STATUSES } from "@thalon/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { toTargetRow } from "@/lib/intel/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

const patchSchema = z.object({ status: z.enum(SEARCH_TARGET_STATUSES) });

/**
 * Dismiss / reactivate a keyword target. A dismissal is durable operator
 * signal the compiler respects on recompiles (first-origin-wins); the
 * dismiss → eval-row feedback mechanism waits on the intel-action write door
 * (eval_cases is written by mechanisms only — recorded lane follow-up).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ targetId: string }> },
) {
  const { targetId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status must be "active" or "dismissed".' }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const row = await repos.searchTargets.setStatus(ctx, targetId, parsed.data.status);
    return NextResponse.json({ target: toTargetRow(row) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
