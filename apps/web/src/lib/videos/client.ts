import type { Edl } from "@thalon/contracts";
import { asJson } from "@/lib/approve-queue/client";
import type { CutDetail, ProjectDetail, ProjectSummary, RenderJobView } from "./types";

export async function fetchProjectSummaries(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/videos");
  const body = await asJson<{ projects: ProjectSummary[] }>(res);
  return body.projects;
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const res = await fetch(`/api/videos/${projectId}`);
  if (res.status === 404) return null;
  return asJson<ProjectDetail>(res);
}

/** The guarded playback URL for a project-relative ref (media route, B-ve.2). */
export function mediaUrl(projectId: string, ref: string): string {
  return `/api/videos/${projectId}/media?ref=${encodeURIComponent(ref)}`;
}

/* B-ve.3 — the editor's doors. */

export async function fetchCutDetail(projectId: string, cutId: string): Promise<CutDetail | null> {
  const res = await fetch(`/api/videos/${projectId}/cuts/${cutId}`);
  if (res.status === 404) return null;
  return asJson<CutDetail>(res);
}

/** Save = create at version+1 (server derives the version; the frozen door never mutates). */
export async function saveCut(
  projectId: string,
  body: { name: string; edl: Edl },
): Promise<{ cut: CutDetail; created: boolean }> {
  const res = await fetch(`/api/videos/${projectId}/cuts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<{ cut: CutDetail; created: boolean }>(res);
}

/** Fire the server render (202; idempotent while one is already running for the cut). */
export async function startRender(
  projectId: string,
  cutId: string,
): Promise<{ job: RenderJobView; started: boolean }> {
  const res = await fetch(`/api/videos/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cutId }),
  });
  return asJson<{ job: RenderJobView; started: boolean }>(res);
}

export async function fetchRenderJob(
  projectId: string,
  jobId: string,
): Promise<RenderJobView | null> {
  const res = await fetch(`/api/videos/${projectId}/render?jobId=${encodeURIComponent(jobId)}`);
  if (res.status === 404) return null;
  return asJson<RenderJobView>(res);
}
