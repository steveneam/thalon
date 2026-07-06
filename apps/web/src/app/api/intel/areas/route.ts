import { monitoredAreaSchema } from "@thalon/contracts";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { toAreaRow } from "@/lib/intel/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/** Monitored-areas manager reads ALL statuses — paused areas stay visible (paused-never-deleted). */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ areas: [] });
  const rows = await repos.monitoredAreas.list(ctx);
  return NextResponse.json({ areas: rows.map(toAreaRow) });
}

/** Thin per doctrine: parse against the CONTRACT shape, delegate to the repo's write door. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = monitoredAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "An area needs a name and a description — the description drives query expansion and relevance ranking." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const row = await repos.monitoredAreas.create(ctx, parsed.data);
    return NextResponse.json({ area: toAreaRow(row) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
