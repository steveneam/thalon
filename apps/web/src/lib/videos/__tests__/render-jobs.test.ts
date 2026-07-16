import { afterEach, describe, expect, it } from "vitest";
import { getRenderJob, resetRenderJobs, startRenderJob } from "../render-jobs";

/** Deferred so the test drives the job through its states deterministically. */
function deferred() {
  let resolve!: (ref: string) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const META = { projectId: "p1", cutId: "c1" };

afterEach(() => {
  resetRenderJobs();
});

describe("render job registry (fire-and-poll, single-flight per cut)", () => {
  it("runs a job to done and exposes the outputRef", async () => {
    const work = deferred();
    const { job, started } = startRenderJob(META, () => work.promise);
    expect(started).toBe(true);
    expect(getRenderJob(job.id)).toMatchObject({ status: "running", outputRef: null });
    work.resolve("cuts/film-v7.mp4");
    await work.promise;
    await new Promise((r) => setTimeout(r, 0)); // let the .then settle
    expect(getRenderJob(job.id)).toMatchObject({
      status: "done",
      outputRef: "cuts/film-v7.mp4",
    });
    expect(getRenderJob(job.id)?.finishedAt).not.toBeNull();
  });

  it("firing a cut that is already rendering JOINS the running job (never a second ffmpeg race)", async () => {
    const work = deferred();
    const first = startRenderJob(META, () => work.promise);
    const second = startRenderJob(META, () => Promise.resolve("never-runs.mp4"));
    expect(second.started).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    work.resolve("cuts/film-v7.mp4");
    await work.promise;
  });

  it("a different cut renders independently", () => {
    const a = startRenderJob(META, () => deferred().promise);
    const b = startRenderJob({ projectId: "p1", cutId: "c2" }, () => deferred().promise);
    expect(a.job.id).not.toBe(b.job.id);
    expect(b.started).toBe(true);
  });

  it("failure lands the runner's message VERBATIM and frees the cut for a re-fire", async () => {
    const work = deferred();
    const { job } = startRenderJob(META, () => work.promise);
    work.reject(new Error("edl execute: ffmpeg step failed: Invalid data found"));
    await work.promise.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(getRenderJob(job.id)).toMatchObject({
      status: "error",
      error: "edl execute: ffmpeg step failed: Invalid data found",
    });
    const refire = startRenderJob(META, () => Promise.resolve("cuts/ok.mp4"));
    expect(refire.started).toBe(true);
    expect(refire.job.id).not.toBe(job.id);
  });

  it("unknown job ids read as null (404 at the route)", () => {
    expect(getRenderJob("nope")).toBeNull();
  });
});
