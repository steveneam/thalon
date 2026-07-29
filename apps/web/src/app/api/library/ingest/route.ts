import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { runVideoIngest, videoIngestInputSchema } from "@/lib/library/ingest";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Paste a video URL → a timed `video_transcript` source (B6.5, the charter
 * row's "video-URL ingest surface"). Thin per doctrine: parse → delegate to
 * the lib's engine call (apps/web's first engine site — SPINE §80, the
 * judge-runner precedent) → serialize. Provider failures surface VERBATIM
 * as the error body — "hosted-vendor is not configured — set
 * TRANSCRIPT_VENDOR_URL…" is the honest UI copy, not a translated one.
 *
 * Spend is opt-in per request (s79): the body's optional `aiEnhance` is the
 * operator's toggle. A body without it — an old client, a curl — ingests
 * free, because the route adds no default of its own.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = videoIngestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Paste a full video URL (https://…)." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const result = await runVideoIngest(repos, ctx, parsed.data);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
