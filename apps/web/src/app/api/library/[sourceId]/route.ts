import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Library delete (founder direction, session 39): remove an ingested
 * transcript from the shelf. The repo owns the honesty rules — tenancy wall,
 * refuse-while-referenced, chunk/metric cascade, `source.deleted` audit row.
 * The Library now lists every source kind (§5.3, s94) but delete stays
 * `video_transcript`-scoped: the other kinds' cascade rules (an admitted
 * Intel capture a dossier references, a demo crawl) are uncharted, and the
 * surface gates its delete verb the same way.
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
