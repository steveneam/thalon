import { afterEach, describe, expect, it } from "vitest";
import { getRenderJob, listRunning, resetRenderJobs, startRenderJob } from "../render-jobs";

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

const META = { projectId: "p1", cutId: "c1", kind: "render" } as const;

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

  it("a PREVIEW and a render of the same cut never join each other", async () => {
    /*
     * s81: single-flight is keyed separately from the cut id. They render
     * different EDLs (stored vs working copy) to different files, so answering
     * one with the other's job would show the operator a video that is not the
     * one they asked for — the exact confusion the honest player prevents.
     */
    const render = deferred();
    const preview = deferred();
    const first = startRenderJob(META, () => render.promise);
    const second = startRenderJob({ ...META, kind: "preview", key: "c1:preview" }, () => preview.promise);
    expect(second.started).toBe(true);
    expect(second.job.id).not.toBe(first.job.id);
    render.resolve("cuts/film-v7.mp4");
    preview.resolve("cuts/previews/c1.mp4");
    await Promise.all([render.promise, preview.promise]);
    await new Promise((r) => setTimeout(r, 0));
    expect(getRenderJob(first.job.id)?.outputRef).toBe("cuts/film-v7.mp4");
    expect(getRenderJob(second.job.id)?.outputRef).toBe("cuts/previews/c1.mp4");
  });

  it("two previews of the same cut DO still single-flight", async () => {
    const work = deferred();
    const meta = { ...META, kind: "preview", key: "c1:preview" } as const;
    const first = startRenderJob(meta, () => work.promise);
    const second = startRenderJob(meta, () => Promise.resolve("never-runs.mp4"));
    expect(second.started).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    work.resolve("cuts/previews/c1.mp4");
    await work.promise;
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
    const b = startRenderJob({ projectId: "p1", cutId: "c2", kind: "render" }, () => deferred().promise);
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

describe("listRunning (s82 A4 — a render survives leaving the page)", () => {
  it("answers with this project's RUNNING work, and says which kind each one is", async () => {
    const render = deferred();
    const preview = deferred();
    startRenderJob(META, () => render.promise);
    startRenderJob({ ...META, kind: "preview", key: "c1:preview" }, () => preview.promise);
    startRenderJob({ projectId: "p2", cutId: "c9", kind: "render" }, () => deferred().promise);

    const running = listRunning("p1");
    expect(running).toHaveLength(2);
    expect(running.map((j) => j.kind).sort()).toEqual(["preview", "render"]);
    // Another project's render is another project's business.
    expect(listRunning("p2").map((j) => j.cutId)).toEqual(["c9"]);
    expect(listRunning("nobody")).toEqual([]);

    render.resolve("cuts/film-v7.mp4");
    preview.resolve("cuts/previews/c1.mp4");
    await Promise.all([render.promise, preview.promise]);
  });

  it("drops a job the moment it finishes — a claim about work in flight has to expire", async () => {
    /*
     * The surface announces "a render is in flight for v6" from this list. A
     * registry that went on returning yesterday's completions would have the
     * editor announcing renders nobody is waiting for, which is the same
     * dishonesty as saying nothing while ffmpeg works.
     */
    const work = deferred();
    startRenderJob(META, () => work.promise);
    expect(listRunning("p1")).toHaveLength(1);
    work.resolve("cuts/film-v7.mp4");
    await work.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(listRunning("p1")).toEqual([]);
  });

  it("drops a FAILED job too — the failure is the job's own, not a render still coming", async () => {
    const work = deferred();
    startRenderJob(META, () => work.promise);
    work.reject(new Error("ffmpeg step failed"));
    await work.promise.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(listRunning("p1")).toEqual([]);
  });
});
