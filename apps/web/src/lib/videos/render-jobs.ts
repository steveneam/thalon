import { randomUUID } from "node:crypto";
import type { RenderJobView } from "./types";

/**
 * B-ve.3 fire-and-poll render registry: a render is minutes of local x264,
 * so the render door answers 202 + a job id and the editor polls. In-process
 * and deliberately unpersisted — renders are deterministic replays of a
 * stored EDL (re-fire after a restart loses nothing but time), and the dev
 * posture is one box, one process (PGlite). Single-flight per cut: firing a
 * cut that is already rendering returns the RUNNING job, never a second
 * ffmpeg race on the same output file.
 */

interface JobRecord extends RenderJobView {
  status: "running" | "done" | "error";
}

const jobs = new Map<string, JobRecord>();
const inFlightByCut = new Map<string, string>();

export function getRenderJob(id: string): RenderJobView | null {
  const job = jobs.get(id);
  return job ? { ...job } : null;
}

/**
 * s82 A4: WHAT IS STILL RUNNING FOR A PROJECT — so a render survives the
 * operator leaving the page.
 *
 * The registry is in-process and holds the only trace of a running ffmpeg;
 * before this, a reload or a walk to another surface lost the job id and the
 * editor came back looking idle while the render went on for minutes. This is
 * a read of what the process already knows — no schema, no persistence, and
 * nothing about the honest posture changes: a job lost to a restart is still
 * lost, and re-firing it is still free (a render is a deterministic replay of
 * a stored EDL).
 *
 * Done and failed jobs are deliberately NOT returned. A finished job is the
 * cut's own state (`outputRef`, `status`) and the surface reads it there; a
 * registry that answered with yesterday's completions would have the surface
 * announcing renders nobody is waiting for.
 */
export function listRunning(projectId: string): RenderJobView[] {
  return [...jobs.values()]
    .filter((job) => job.projectId === projectId && job.status === "running")
    .map((job) => ({ ...job }));
}

/**
 * Start (or join) the render for a cut. `run` resolves to the outputRef it
 * recorded; its failure message is surfaced VERBATIM on the job — the
 * operator reads the actual ffmpeg refusal, not a euphemism.
 */
export function startRenderJob(
  meta: { projectId: string; cutId: string; kind: "render" | "preview"; key?: string },
  run: () => Promise<string>,
): { job: RenderJobView; started: boolean } {
  /*
   * Single-flight is keyed SEPARATELY from the cut id so a working-copy
   * preview and a real render of the same cut cannot join each other's job.
   * They render different EDLs to different files, and answering a preview
   * with a render's job (or the reverse) would show the operator a video that
   * is not the one they asked for — the exact confusion the honest player
   * exists to prevent. Same cut, two lanes.
   */
  const inFlight = inFlightByCut.get(meta.key ?? meta.cutId);
  if (inFlight) {
    const existing = jobs.get(inFlight);
    if (existing && existing.status === "running") {
      return { job: { ...existing }, started: false };
    }
  }
  const job: JobRecord = {
    id: randomUUID(),
    projectId: meta.projectId,
    cutId: meta.cutId,
    kind: meta.kind,
    status: "running",
    outputRef: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(job.id, job);
  inFlightByCut.set(meta.key ?? meta.cutId, job.id);
  run()
    .then(
      (outputRef) => {
        job.status = "done";
        job.outputRef = outputRef;
      },
      (err: unknown) => {
        job.status = "error";
        job.error = err instanceof Error ? err.message : String(err);
      },
    )
    .finally(() => {
      job.finishedAt = new Date().toISOString();
      const key = meta.key ?? meta.cutId;
      if (inFlightByCut.get(key) === job.id) inFlightByCut.delete(key);
    });
  return { job: { ...job }, started: true };
}

/** Test hook — the registry is module state. */
export function resetRenderJobs(): void {
  jobs.clear();
  inFlightByCut.clear();
}
