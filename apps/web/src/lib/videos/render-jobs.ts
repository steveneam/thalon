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
 * Start (or join) the render for a cut. `run` resolves to the outputRef it
 * recorded; its failure message is surfaced VERBATIM on the job — the
 * operator reads the actual ffmpeg refusal, not a euphemism.
 */
export function startRenderJob(
  meta: { projectId: string; cutId: string },
  run: () => Promise<string>,
): { job: RenderJobView; started: boolean } {
  const inFlight = inFlightByCut.get(meta.cutId);
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
    status: "running",
    outputRef: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(job.id, job);
  inFlightByCut.set(meta.cutId, job.id);
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
      if (inFlightByCut.get(meta.cutId) === job.id) inFlightByCut.delete(meta.cutId);
    });
  return { job: { ...job }, started: true };
}

/** Test hook — the registry is module state. */
export function resetRenderJobs(): void {
  jobs.clear();
  inFlightByCut.clear();
}
