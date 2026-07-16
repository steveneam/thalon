import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { edlSchema, type TenantCtx, type VideoSourceRef } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { compileEdl, executePlan, type EdlPlan } from "@thalon/engine";
import { mediaRootOf } from "./media-root";

/**
 * B-ve.3 server render: compileEdl → plates → one ffmpeg run → recordRender,
 * the film-replay recipe against a project's media root. Everything cheap is
 * checked in `prepareCutRender` so the door can refuse with a 4xx BEFORE the
 * job fires; the minutes-long work happens in `runCutRender` behind the
 * fire-and-poll registry. Output lands at `cuts/<name>-v<version>.mp4` under
 * the media root (the reference tree shape) — deterministic per EDL, so
 * overwriting a stale partial from a failed attempt is safe by construction.
 */

export interface PreparedRender {
  cutId: string;
  root: string;
  plan: EdlPlan;
  outputRef: string;
}

export class RenderRefusedError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "RenderRefusedError";
  }
}

export async function prepareCutRender(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
  cutId: string,
): Promise<PreparedRender> {
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) throw new RenderRefusedError("video project not found", 404);
  const root = mediaRootOf(project.meta);
  if (!root) {
    throw new RenderRefusedError(
      "project has no media root configured on this box — import media first (npm run videos:import)",
      422,
    );
  }
  const cut = await repos.videoCuts.get(ctx, cutId);
  if (!cut || cut.projectId !== projectId) throw new RenderRefusedError("video cut not found", 404);
  if (cut.status !== "draft") {
    throw new RenderRefusedError(
      `cut is already ${cut.status} — a rendered cut's EDL is immutable; edit it into a new version instead`,
      409,
    );
  }
  let plan: EdlPlan;
  try {
    plan = compileEdl(edlSchema.parse(cut.edl));
  } catch (err) {
    throw new RenderRefusedError(err instanceof Error ? err.message : "EDL does not compile", 422);
  }
  return { cutId, root, plan, outputRef: `cuts/${cut.name}-v${cut.version}.mp4` };
}

/** The minutes-long half: execute the plan, then draft → rendered with the outputRef the EDL actually rebuilds (the s47 provenance lesson). */
export async function runCutRender(
  repos: Repos,
  ctx: TenantCtx,
  prepared: PreparedRender,
): Promise<string> {
  await mkdir(path.join(prepared.root, "cuts"), { recursive: true });
  const scratch = await mkdtemp(path.join(tmpdir(), "thalon-render-"));
  try {
    await executePlan(prepared.plan, {
      resolve: (ref: VideoSourceRef) => path.join(prepared.root, ref.ref),
      output: path.join(prepared.root, prepared.outputRef),
      plateDir: scratch,
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  await repos.videoCuts.recordRender(ctx, prepared.cutId, prepared.outputRef);
  return prepared.outputRef;
}
