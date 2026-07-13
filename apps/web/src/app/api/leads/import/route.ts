import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { importCsvAndScore } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

const importRequestSchema = z.object({
  /** The CSV text itself — parsed, ingested, discarded; never persisted as a file. */
  csv: z.string().min(1).max(5_000_000),
});

/** CSV → leads → scored queue in one call. The report is honest per row (added/duplicate/invalid + reasons). */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send { csv } — the file's text content (max 5 MB)." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { report, scoring } = await importCsvAndScore(ctx, repos, parsed.data.csv);
    return NextResponse.json({ report, scoring });
  } catch (err) {
    return toErrorResponse(err);
  }
}
