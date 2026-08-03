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

/**
 * PREVIEW THE WORKING COPY — the same local ffmpeg run against an EDL that has
 * not been saved, and the last of the editor's honest-player gaps.
 *
 * The player could already SAY it was showing the previous render while the
 * working copy was dirty (s80); it still could not show the operator what they
 * had actually built. This is that verb. It is compute, not credits — no
 * vendor call, no platform call — and so it sits inside the sequence gate by
 * the founder's own line: draw it where the money is.
 *
 * THREE DELIBERATE DIFFERENCES from `prepareCutRender`, because a preview is
 * not a render:
 *
 *  - IT TAKES THE EDL FROM THE CALLER, not from the row. That is the entire
 *    point: the working copy exists only in the browser until Save. It is
 *    parsed through `edlSchema` here, at the boundary, exactly like every
 *    other door — the client is never trusted for shape.
 *  - IT DOES NOT REFUSE A NON-DRAFT CUT. `prepareCutRender` refuses one
 *    because a rendered cut's stored EDL is immutable; but a preview renders
 *    the operator's UNSAVED next version, which is precisely what you want to
 *    look at before deciding to save it. On this project every cut is already
 *    rendered or approved, so the draft-only rule would have made preview
 *    unusable on all of them.
 *  - IT NEVER CALLS `recordRender`. A preview leaves no provenance and does
 *    not touch `outputRef`: nothing about an unsaved EDL belongs in the
 *    version history, and a cut must never claim to have been rendered from
 *    an EDL no one can reproduce.
 *
 * The output is one overwritable file per cut under `cuts/previews/`, which
 * the take importer already skips as cut output rather than source material.
 */
export async function prepareCutPreview(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
  cutId: string,
  edl: unknown,
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
  let plan: EdlPlan;
  try {
    plan = compileEdl(edlSchema.parse(edl));
  } catch (err) {
    throw new RenderRefusedError(err instanceof Error ? err.message : "EDL does not compile", 422);
  }
  return { cutId, root, plan, outputRef: `cuts/previews/${cutId}.mp4` };
}

/** The minutes-long half of a PREVIEW: execute the plan and stop. No recordRender — see above. */
export async function runCutPreview(prepared: PreparedRender): Promise<string> {
  await mkdir(path.join(prepared.root, "cuts", "previews"), { recursive: true });
  const scratch = await mkdtemp(path.join(tmpdir(), "thalon-preview-"));
  try {
    await executePlan(prepared.plan, {
      resolve: (ref: VideoSourceRef) => path.join(prepared.root, ref.ref),
      output: path.join(prepared.root, prepared.outputRef),
      plateDir: scratch,
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return prepared.outputRef;
}

/** The minutes-long half: execute the plan, then draft → rendered with the outputRef the EDL actually rebuilds (the s47 provenance lesson). */
export async function runCutRender(
  repos: Repos,
  ctx: TenantCtx,
  prepared: PreparedRender,
): Promise<string> {
  await mkdir(path.join(prepared.root, "cuts"), { recursive: true });
  const scratch = await mkdtemp(path.join(tmpdir(), "thalon-render-"));
  const startedAt = Date.now();
  try {
    await executePlan(prepared.plan, {
      resolve: (ref: VideoSourceRef) => path.join(prepared.root, ref.ref),
      output: path.join(prepared.root, prepared.outputRef),
      plateDir: scratch,
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  // V7: the render's measured wall time rides the rendered event — a real
  // elapsed, never an estimate.
  await repos.videoCuts.recordRender(
    ctx,
    prepared.cutId,
    prepared.outputRef,
    Date.now() - startedAt,
  );
  return prepared.outputRef;
}
