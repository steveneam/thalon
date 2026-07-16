import { asJson } from "@/lib/approve-queue/client";
import type { ProjectDetail, ProjectSummary } from "./types";

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
