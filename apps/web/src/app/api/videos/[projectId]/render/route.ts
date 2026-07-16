import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getRenderJob, startRenderJob } from "@/lib/videos/render-jobs";
import { prepareCutRender, RenderRefusedError, runCutRender } from "@/lib/videos/render";

/**
 * B-ve.3 render door, fire-and-poll: POST validates everything cheap
 * (project, media root, draft status, the EDL compiles) and answers 202
 * with a job; GET ?jobId= is the poll. The render itself is minutes of
 * LOCAL ffmpeg/magick — 0 vendor credits by construction (A17 invariant) —
 * and lands `cuts/<name>-v<n>.mp4` under the media root before
 * recordRender flips draft → rendered.
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
  try {
    const prepared = await prepareCutRender(repos, ctx, projectId, cutId);
    const { job, started } = startRenderJob({ projectId, cutId }, () =>
      runCutRender(repos, ctx, prepared),
    );
    return NextResponse.json({ job, started }, { status: 202 });
  } catch (err) {
    if (err instanceof RenderRefusedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "render failed to start" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "missing ?jobId" }, { status: 400 });
  const job = getRenderJob(jobId);
  if (!job) return NextResponse.json({ error: "render job not found" }, { status: 404 });
  return NextResponse.json(job);
}
