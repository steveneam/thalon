import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRenderJobs, startRenderJob } from "@/lib/videos/render-jobs";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");

/**
 * s82 A4 — the render door's RESUME read. POST is deliberately not exercised
 * here (it fires real local ffmpeg); what this pins is the GET contract the
 * editor comes back to after a reload, including the wall around it: a
 * project id is not authority, so the resume list resolves the project through
 * the tenant first.
 */

let handle: DbHandle | undefined;
let ctx: TenantCtx;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  resetRenderJobs();
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

function get(projectId: string, query: string) {
  return [
    new Request(`http://test.local/api/videos/${projectId}/render${query}`),
    { params: Promise.resolve({ projectId }) },
  ] as const;
}

describe("GET /api/videos/[projectId]/render", () => {
  it("still answers the poll by job id, and 404s an unknown one", async () => {
    const { project } = await repos!.videoProjects.create(ctx, { name: "concept-film" });
    const { job } = startRenderJob(
      { projectId: project.id, cutId: "c1", kind: "render" },
      () => new Promise<string>(() => {}),
    );
    const found = await GET(...get(project.id, `?jobId=${job.id}`));
    expect(found.status).toBe(200);
    expect((await found.json()).id).toBe(job.id);
    expect((await GET(...get(project.id, "?jobId=nope"))).status).toBe(404);
  });

  it("400s a read that asks for neither a job nor the running list", async () => {
    const { project } = await repos!.videoProjects.create(ctx, { name: "concept-film" });
    expect((await GET(...get(project.id, ""))).status).toBe(400);
  });

  it("answers ?running=1 with this project's running work, kinds included", async () => {
    const { project } = await repos!.videoProjects.create(ctx, { name: "concept-film" });
    startRenderJob(
      { projectId: project.id, cutId: "c1", kind: "render" },
      () => new Promise<string>(() => {}),
    );
    startRenderJob(
      { projectId: project.id, cutId: "c1", kind: "preview", key: "c1:preview" },
      () => new Promise<string>(() => {}),
    );
    const res = await GET(...get(project.id, "?running=1"));
    expect(res.status).toBe(200);
    const { jobs } = (await res.json()) as { jobs: { kind: string; status: string }[] };
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.status === "running")).toBe(true);
    expect(jobs.map((j) => j.kind).sort()).toEqual(["preview", "render"]);
  });

  it("404s the running list for a project this tenant does not have", async () => {
    // The job view carries only ids, but "does this project exist for you" is
    // not a question an unwalled read gets to answer.
    const res = await GET(...get("11111111-1111-4111-8111-111111111111", "?running=1"));
    expect(res.status).toBe(404);
  });
});
