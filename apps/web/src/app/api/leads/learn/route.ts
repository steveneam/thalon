import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { learnNow } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Learn now (B-crm.5 back half): fold the tenant's triage verdicts into a
 * learned weight state. Zero LLM calls, deterministic and idempotent — a
 * replay over unchanged evidence appends nothing (`created: false`). Never
 * triggers scoring; the state applies on the next Score now.
 */
export async function POST() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    return NextResponse.json(await learnNow(ctx, repos));
  } catch (err) {
    return toErrorResponse(err);
  }
}
