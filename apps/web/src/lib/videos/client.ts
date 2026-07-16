import type { Edl, EdlDiff, VideoCutAttribution } from "@thalon/contracts";
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

/** Save = create at version+1 (server derives the version; the frozen door never mutates). B-ve.4: an agent-attributed save carries its proposal and is replay-verified at the door. */
export async function saveCut(
  projectId: string,
  body: { name: string; edl: Edl; attribution?: VideoCutAttribution },
): Promise<{ cut: CutDetail; created: boolean }> {
  const res = await fetch(`/api/videos/${projectId}/cuts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<{ cut: CutDetail; created: boolean }>(res);
}

/* B-ve.4 — the AI-assist doors. */

export interface DiffProposal {
  diff: EdlDiff;
  preview: Edl;
  attribution: VideoCutAttribution;
  tokens: { in: number; out: number };
}

/** Ask the agent for an EDL diff against this cut (nothing is stored — apply rides the save door, reject rides the eval door). */
export async function proposeDiff(
  projectId: string,
  cutId: string,
  ask?: string,
): Promise<DiffProposal> {
  const res = await fetch(`/api/videos/${projectId}/cuts/${cutId}/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ask?.trim() ? { ask: ask.trim() } : {}),
  });
  return asJson<DiffProposal>(res);
}

/** Reject a proposal WITH the reason — the correction becomes an eval row (rule 6). */
export async function rejectProposal(
  projectId: string,
  cutId: string,
  body: { diff: EdlDiff; reason: string; ask?: string },
): Promise<{ evalCaseId: string }> {
  const res = await fetch(`/api/videos/${projectId}/cuts/${cutId}/propose/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<{ evalCaseId: string }>(res);
}

export interface CaptionRefusal {
  line: number;
  text: string;
  matches: string[];
}

export type ApproveOutcome =
  | { ok: true; cut: CutDetail }
  | { ok: false; error: string; failures: CaptionRefusal[] };

/** rendered → approved, behind the judge gate; a 422 carries the verbatim per-line refusals — surfaced, never swallowed. */
export async function approveCut(projectId: string, cutId: string): Promise<ApproveOutcome> {
  const res = await fetch(`/api/videos/${projectId}/cuts/${cutId}/approve`, {
    method: "POST",
  });
  if (res.ok) {
    const body = (await res.json()) as { cut: CutDetail };
    return { ok: true, cut: body.cut };
  }
  const body: unknown = await res.json().catch(() => null);
  const parsed = (body ?? {}) as { error?: unknown; failures?: unknown };
  return {
    ok: false,
    error: typeof parsed.error === "string" ? parsed.error : `request failed: ${res.status}`,
    failures: Array.isArray(parsed.failures) ? (parsed.failures as CaptionRefusal[]) : [],
  };
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
