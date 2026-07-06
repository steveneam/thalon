import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { toTargetRow } from "@/lib/intel/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Keyword targets, all statuses — dismissed rows stay visible (dismissed-never-deleted). */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ targets: [] });
  const rows = await repos.searchTargets.list(ctx);
  return NextResponse.json({ targets: rows.map(toTargetRow) });
}

const addSchema = z.object({
  keyword: z
    .string()
    .max(200)
    .transform((s) => s.trim())
    .pipe(z.string().min(1)),
});

/**
 * Operator-added keyword target. Origin is pinned to "operator" here — the
 * profile_seed/ai_expansion origins belong to the B6.8 compiler paths, which
 * run engine-side when B6.5/B6.6 wire them; first origin wins on replays.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a keyword to target." }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { target, created } = await repos.searchTargets.add(ctx, {
      keyword: parsed.data.keyword,
      origin: "operator",
      meta: {},
    });
    return NextResponse.json({ target: toTargetRow(target), created }, { status: created ? 201 : 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
