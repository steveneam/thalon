import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { mediaRootOf } from "@/lib/videos/media-root";
import { parseByteRange, resolveMediaFile } from "@/lib/videos/media";

/**
 * B-ve.2 guarded playback: streams ONE project file after the tenancy wall
 * (project resolved through the ctx), the contract's project-relative ref
 * guard, the media-type allowlist, and root containment (lib/videos/media).
 * Range requests supported so <video> can scrub. Read-only, box-local, 0cr.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) return NextResponse.json({ error: "video project not found" }, { status: 404 });
  const root = mediaRootOf(project.meta);
  if (!root) {
    return NextResponse.json(
      { error: "project has no media root configured on this box" },
      { status: 404 },
    );
  }
  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "missing ?ref" }, { status: 400 });
  const resolved = resolveMediaFile(root, ref);
  if (!resolved.ok) return NextResponse.json({ error: resolved.reason }, { status: 400 });
  const fileStat = await stat(resolved.absPath).catch(() => null);
  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "media file not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": resolved.contentType,
    "Accept-Ranges": "bytes",
    // A take ref is its identity (immutable per project discipline) — cache
    // briefly but privately; this is box-local operator media, never public.
    "Cache-Control": "private, max-age=3600",
  };
  const range = parseByteRange(request.headers.get("range"), fileStat.size);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileStat.size}` },
    });
  }
  const { start, end } = range ?? { start: 0, end: fileStat.size - 1 };
  const stream = Readable.toWeb(
    createReadStream(resolved.absPath, { start, end }),
  ) as ReadableStream;
  headers["Content-Length"] = String(end - start + 1);
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${fileStat.size}`;
  return new NextResponse(stream, { status: range ? 206 : 200, headers });
}
