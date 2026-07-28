import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getRenderJob, listRunning, startRenderJob } from "@/lib/videos/render-jobs";
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
    const { job, started } = startRenderJob({ projectId, cutId, kind: "render" }, () =>
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

/**
 * The poll (`?jobId=`) and, since s82 A4, the RESUME (`?running=1`): what is
 * still rendering for this project, so a surface that comes back after a
 * reload can pick the job up instead of starting fresh and looking idle.
 *
 * The resume read is tenancy-walled through the project — a job view carries
 * only ids and status, but "does this project exist for you" is not a question
 * an unauthenticated caller gets to answer for free. The `?jobId` poll keeps
 * its existing shape: an unguessable uuid, and 404 for anything else.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const search = new URL(request.url).searchParams;
  const jobId = search.get("jobId");
  if (jobId) {
    const job = getRenderJob(jobId);
    if (!job) return NextResponse.json({ error: "render job not found" }, { status: 404 });
    return NextResponse.json(job);
  }
  if (search.get("running") === null) {
    return NextResponse.json({ error: "missing ?jobId or ?running" }, { status: 400 });
  }
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) return NextResponse.json({ error: "video project not found" }, { status: 404 });
  return NextResponse.json({ jobs: listRunning(projectId) });
}
