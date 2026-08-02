import { createBriefSchema } from "@thalon/contracts";
import { deriveCreatePlan, loadPlanContext } from "@thalon/engine";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The wizard's plan-preview door (B-create.4 remainder, spec R6: the plan
 * previews BEFORE anything spends). Pure by construction: `deriveCreatePlan`
 * is a pure function over the tenant's own plan context — this route writes
 * nothing, dispatches nothing and meters nothing. It exists so the platform
 * chips can state each destination's capability verdict (R3 — refusals
 * before spend) from the SAME derivation the run itself will use, never
 * from a parallel guess that could drift.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a create brief — { family, mode, prompt?, platforms?, … }." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const planContext = await loadPlanContext(ctx, repos);
    return NextResponse.json({ plan: deriveCreatePlan(parsed.data, planContext) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
