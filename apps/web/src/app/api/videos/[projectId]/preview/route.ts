import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { startRenderJob } from "@/lib/videos/render-jobs";
import { prepareCutPreview, RenderRefusedError, runCutPreview } from "@/lib/videos/render";

/**
 * WORKING-COPY PREVIEW door: the same fire-and-poll shape as the render door,
 * against an EDL the caller supplies instead of the one on the row. The
 * operator can finally SEE an unsaved edit rather than being told the player is
 * showing something else.
 *
 * It writes no rows. `prepareCutPreview` renders to an overwritable file under
 * `cuts/previews/` and never calls `recordRender`, so nothing about an unsaved
 * EDL enters the version history. The poll is the render door's own
 * `GET ?jobId=` — one registry, and the job carries a `key` so a preview and a
 * render of the same cut never join each other.
 *
 * LOCAL COMPUTE, ZERO CREDITS (A17): ffmpeg on this box, no vendor call, no
 * platform call — inside the sequence gate by the founder's own line.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const cutId =
    body && typeof body === "object" && typeof (body as { cutId?: unknown }).cutId === "string"
      ? (body as { cutId: string }).cutId
      : null;
  if (!cutId) return NextResponse.json({ error: "missing cutId" }, { status: 400 });
  const edl = body && typeof body === "object" ? (body as { edl?: unknown }).edl : undefined;
  if (edl === undefined) return NextResponse.json({ error: "missing edl" }, { status: 400 });
  try {
    // The EDL is parsed inside prepareCutPreview, at the boundary — a
    // working copy arriving from a browser is never trusted for shape.
    const prepared = await prepareCutPreview(repos, ctx, projectId, cutId, edl);
    const { job, started } = startRenderJob(
      { projectId, cutId, kind: "preview", key: `${cutId}:preview` },
      () => runCutPreview(prepared),
    );
    return NextResponse.json({ job, started, outputRef: prepared.outputRef }, { status: 202 });
  } catch (err) {
    if (err instanceof RenderRefusedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "preview failed to start" },
      { status: 500 },
    );
  }
}
