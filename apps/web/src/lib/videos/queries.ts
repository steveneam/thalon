import { edlSchema, type TenantCtx, type VideoCutStatus, type VideoTakeDisposition, type VideoTakeKind } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { mediaRootOf } from "./media-root";
import type { CutView, EdlSummary, ProjectDetail, ProjectSummary, TakeView } from "./types";

/**
 * B-ve.2 read layer: view shapes over the frozen B-ve.1 repos. Zero writes —
 * this surface deliberately has NO mutation door (the retake verb and the
 * approve transition arrive with B-ve.3/4 behind the judge gate).
 */

/**
 * Summarize a stored EDL for the browse surface. The write door
 * (videoCuts.create) zod-validated it, so a parse failure here is genuine
 * data corruption — loud is correct.
 */
export function summarizeEdl(stored: unknown): EdlSummary {
  const edl = edlSchema.parse(stored);
  return {
    beats: edl.video.length,
    captionLines: edl.captions?.lines.length ?? 0,
    audio:
      edl.audio.length === 0
        ? "silent"
        : edl.audio.every((cue) => cue.mode === "copy")
          ? "copy"
          : "encode",
    width: edl.output.width,
    height: edl.output.height,
    fps: edl.output.fps,
    duration: edl.output.duration,
  };
}

/** keepers before rejects within a slot; slotless (music candidates) last. */
function takeOrder(a: TakeView, b: TakeView): number {
  if ((a.slot === null) !== (b.slot === null)) return a.slot === null ? 1 : -1;
  if (a.slot !== b.slot) return (a.slot ?? "").localeCompare(b.slot ?? "");
  if (a.disposition !== b.disposition) return a.disposition === "keeper" ? -1 : 1;
  return a.ref.localeCompare(b.ref);
}

export async function listProjectSummaries(
  repos: Repos,
  ctx: TenantCtx,
): Promise<ProjectSummary[]> {
  const projects = await repos.videoProjects.list(ctx);
  // The frozen repo surface has no counts door — at browse scale (a handful
  // of projects) reading each project's takes/cuts is fine; a summary query
  // rides a later contract window if this ever shows up in a profile.
  const summaries = await Promise.all(
    projects.map(async (project) => {
      const [takes, cuts] = await Promise.all([
        repos.videoTakes.list(ctx, project.id),
        repos.videoCuts.list(ctx, project.id),
      ]);
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        keepers: takes.filter((t) => t.disposition === "keeper").length,
        rejects: takes.filter((t) => t.disposition === "reject").length,
        cuts: cuts.length,
        createdAt: project.createdAt.toISOString(),
      };
    }),
  );
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProjectDetail(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
): Promise<ProjectDetail | null> {
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) return null;
  const [takes, cuts] = await Promise.all([
    repos.videoTakes.list(ctx, projectId),
    repos.videoCuts.list(ctx, projectId),
  ]);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    playable: mediaRootOf(project.meta) !== null,
    takes: takes
      .map(
        (t): TakeView => ({
          id: t.id,
          slot: t.slot,
          kind: t.kind as VideoTakeKind,
          disposition: t.disposition as VideoTakeDisposition,
          ref: t.ref,
          reason: t.reason,
          provenance: t.provenance as Record<string, unknown>,
          createdAt: t.createdAt.toISOString(),
        }),
      )
      .sort(takeOrder),
    cuts: cuts
      .map(
        (c): CutView => ({
          id: c.id,
          name: c.name,
          version: c.version,
          status: c.status as VideoCutStatus,
          outputRef: c.outputRef,
          edl: summarizeEdl(c.edl),
          createdAt: c.createdAt.toISOString(),
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version),
  };
}
