import { readPublishedView } from "@thalon/engine";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-int.2: the published view — what actually went out, and where. Joins
 * the social publication ledger with the own-site posts bundle (web
 * deployRefs), merged newest-first with honest totals behind the bound.
 * Closes FEATURE-MAP's `/blog` partial: the workspace path to what got
 * published.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const view = await readPublishedView(ctx, repos, { limit: 50 });
    return NextResponse.json(view);
  } catch (err) {
    return toErrorResponse(err);
  }
}
