import {
  edlSchema,
  videoCutAttributionSchema,
  videoCutLineageSchema,
  videoTakePosterSchema,
  type TenantCtx,
  type VideoCutAttribution,
  type VideoCutStatus,
  type VideoTakeDisposition,
  type VideoTakeKind,
  type VideoTakePoster,
} from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { mediaRootOf } from "./media-root";
import type {
  CutDetail,
  CutLineageView,
  CutView,
  EdlSummary,
  ProjectDetail,
  ProjectSummary,
  RetiredCutView,
  RetiredProjectView,
  TakeView,
} from "./types";

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

/**
 * B-ve.5: resolve a cut's `meta.lineage` against its project's cut list —
 * parent name/version from the pinned row, plus that name's LATEST version
 * for the staleness signal. A meta without lineage (every pre-window cut)
 * resolves to null; a malformed one too (the write doors validate, so
 * malformed means legacy hand-writes — the surface stays quiet, not loud).
 */
export function lineageViewFor(
  meta: unknown,
  projectCuts: { id: string; name: string; version: number }[],
): CutLineageView | null {
  const raw =
    typeof meta === "object" && meta !== null ? (meta as { lineage?: unknown }).lineage : undefined;
  if (raw === undefined) return null;
  const parsed = videoCutLineageSchema.safeParse(raw);
  if (!parsed.success) return null;
  const parent = projectCuts.find((c) => c.id === parsed.data.parentCutId) ?? null;
  const latest = parent
    ? projectCuts.reduce((max, c) => (c.name === parent.name ? Math.max(max, c.version) : max), 0)
    : null;
  return {
    parentCutId: parsed.data.parentCutId,
    aspect: parsed.data.aspect,
    parentName: parent?.name ?? null,
    parentVersion: parent?.version ?? null,
    parentLatestVersion: latest,
  };
}

/**
 * B-ve.4: a cut's stored attribution, resolved for the surface. The save
 * door stamps `meta.attribution` itself (never trusting the client), so a
 * missing one means a row written before that door existed — null, which
 * the version strip says out loud rather than guessing an author. A
 * malformed one resolves to null too: the write doors validate, so
 * malformed means a legacy hand-write, and the surface stays quiet.
 */
/**
 * s99: the one-prompt runner stamps `meta.onePrompt` on the cut it creates —
 * engine authorship on record BEFORE the attributed save door touches the
 * row. The surface reads the stamp's presence so the attribution line can
 * say "the one-prompt run" instead of "no attribution recorded".
 */
export function hasOnePromptStamp(meta: unknown): boolean {
  return (
    typeof meta === "object" &&
    meta !== null &&
    typeof (meta as { onePrompt?: unknown }).onePrompt === "object" &&
    (meta as { onePrompt?: unknown }).onePrompt !== null
  );
}

export function attributionOf(meta: unknown): VideoCutAttribution | null {
  const raw =
    typeof meta === "object" && meta !== null
      ? (meta as { attribution?: unknown }).attribution
      : undefined;
  if (raw === undefined) return null;
  const parsed = videoCutAttributionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * s96 (V2): a take's B-media.0 poster, off `meta.posterRef` — the same parse
 * `resolveTakeMedia` applies client-side, done once at the serializer so the
 * editor's frame thumbnails don't re-derive it per block. Absent or malformed
 * resolves to null (poster pending — the honest striped placeholder), exactly
 * as the resolver's own comment rules: "pending" and "none" are the same box.
 */
export function posterOf(meta: unknown): VideoTakePoster | null {
  const raw =
    typeof meta === "object" && meta !== null ? (meta as { posterRef?: unknown }).posterRef : undefined;
  if (raw === undefined || raw === null) return null;
  const parsed = videoTakePosterSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
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

/**
 * Window 0026 — what the grid's restore door points at. Kept as its own read
 * rather than a flag on `listProjectSummaries` so that the counts work above
 * (a takes+cuts read PER PROJECT) is never done for rows nobody is opening.
 */
export async function listRetiredProjects(
  repos: Repos,
  ctx: TenantCtx,
): Promise<RetiredProjectView[]> {
  const projects = await repos.videoProjects.list(ctx, { includeRetired: true });
  return projects
    .filter((p) => p.retiredAt !== null)
    .map((p) => ({ id: p.id, name: p.name, retiredAt: p.retiredAt!.toISOString() }))
    .sort((a, b) => b.retiredAt.localeCompare(a.retiredAt));
}

/** B-ve.3 editor read: one cut with its FULL EDL (tenancy-walled, project-checked). */
export async function getCutDetail(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
  cutId: string,
): Promise<CutDetail | null> {
  const cut = await repos.videoCuts.get(ctx, cutId);
  if (!cut || cut.projectId !== projectId) return null;
  const projectCuts = await repos.videoCuts.list(ctx, projectId);
  return {
    id: cut.id,
    name: cut.name,
    version: cut.version,
    status: cut.status as VideoCutStatus,
    outputRef: cut.outputRef,
    edl: edlSchema.parse(cut.edl),
    lineage: lineageViewFor(cut.meta, projectCuts),
    attribution: attributionOf(cut.meta),
    createdAt: cut.createdAt.toISOString(),
  };
}

export async function getProjectDetail(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
): Promise<ProjectDetail | null> {
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) return null;
  const [takes, cuts, withRetired] = await Promise.all([
    repos.videoTakes.list(ctx, projectId),
    repos.videoCuts.list(ctx, projectId),
    // Window 0026: the second read is what "Cut history" is made of. It is a
    // separate call rather than a filter over one list because every OTHER
    // consumer of `cuts` (lineage resolution, the strip, the version picker)
    // must keep seeing living cuts only.
    repos.videoCuts.list(ctx, projectId, { includeRetired: true }),
  ]);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    playable: mediaRootOf(project.meta) !== null,
    onePrompt: hasOnePromptStamp(project.meta),
    retired: withRetired
      .filter((c) => c.retiredAt !== null)
      .map(
        (c): RetiredCutView => ({
          id: c.id,
          name: c.name,
          version: c.version,
          status: c.status as VideoCutStatus,
          outputRef: c.outputRef,
          retiredAt: c.retiredAt!.toISOString(),
        }),
      )
      // Most recently retired first — the one an operator is most likely to
      // want back is the one they just let go of.
      .sort((a, b) => b.retiredAt.localeCompare(a.retiredAt)),
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
          poster: posterOf(t.meta),
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
          lineage: lineageViewFor(c.meta, cuts),
          attribution: attributionOf(c.meta),
          onePrompt: hasOnePromptStamp(c.meta),
          createdAt: c.createdAt.toISOString(),
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version),
  };
}
