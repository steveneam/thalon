import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Library delete (founder direction, session 39): remove an ingested
 * transcript from the shelf. The repo owns the honesty rules — tenancy wall,
 * refuse-while-referenced, chunk/metric cascade, `source.deleted` audit row.
 * Only `video_transcript` sources are deletable from this surface; other
 * source kinds never belonged to the Library.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const source = await repos.sources.get(ctx, sourceId);
    if (!source || source.kind !== "video_transcript") {
      return NextResponse.json({ error: "transcript not found" }, { status: 404 });
    }
    await repos.sources.remove(ctx, sourceId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
