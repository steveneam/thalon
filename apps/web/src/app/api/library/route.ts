import { NextResponse } from "next/server";
import { toLibraryRow, transcriptSeamStatus } from "@/lib/library/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Library read (B6.5; widened s94 for the founder's §5.3 ruling — "ONE
 * Library surface; transcription becomes an ingest kind + a filter"): every
 * grounding source the tenant holds, newest first, each row carrying its
 * `kind`, plus the transcript seam's honest status. The one exclusion is
 * `prompt` — a run's own captured brief is per-run provenance (it grounds
 * the run it belongs to), not an operator shelf item; listing it would bury
 * the shelf under run artifacts.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const seam = transcriptSeamStatus();
  if (!ctx) return NextResponse.json({ sources: [], seam });
  const rows = await repos.sources.list(ctx);
  const sources = rows
    .filter((row) => row.kind !== "prompt")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toLibraryRow);
  return NextResponse.json({ sources, seam });
}
