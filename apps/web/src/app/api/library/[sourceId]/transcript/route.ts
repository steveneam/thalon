import { NextResponse } from "next/server";
import { getObjectStore } from "@thalon/platform";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The transcript read (B6.5): a `video_transcript` source's timed segments,
 * straight from the object store — `rawRef` points at the segments bundle
 * `ingestVideoUrl` persisted (`transcripts/<hash>.json`, the B4.6 key
 * scheme). The tenancy wall is the repo get (a foreign sourceId is a 404);
 * the object store is content-addressed and only reachable through that row.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const source = await repos.sources.get(ctx, sourceId);
    if (!source || source.kind !== "video_transcript") {
      return NextResponse.json({ error: "transcript not found" }, { status: 404 });
    }
    if (!source.rawRef) {
      return NextResponse.json({ error: "this source has no stored transcript bundle" }, { status: 404 });
    }
    const raw = await getObjectStore().get(source.rawRef);
    if (!raw) {
      return NextResponse.json(
        { error: "transcript bundle missing from the object store — re-ingest the URL" },
        { status: 404 },
      );
    }
    const segments: unknown = JSON.parse(raw.toString("utf8"));
    const meta = (source.meta ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      sourceId: source.id,
      uri: source.uri,
      provider: typeof meta.transcriptProvider === "string" ? meta.transcriptProvider : null,
      segments,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
