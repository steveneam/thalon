import { NextResponse } from "next/server";
import { toLibraryRow, transcriptSeamStatus } from "@/lib/library/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Library read (B6.5): every ingested `video_transcript` source, newest
 * first, plus the transcript seam's honest status (which provider the env
 * selects, whether the hosted vendor is keyed). Other source kinds
 * (exemplars, docs, pages) stay on their own surfaces — this list is the
 * operator's transcript shelf.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  const seam = transcriptSeamStatus();
  if (!ctx) return NextResponse.json({ sources: [], seam });
  const rows = await repos.sources.list(ctx);
  const sources = rows
    .filter((row) => row.kind === "video_transcript")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toLibraryRow);
  return NextResponse.json({ sources, seam });
}
