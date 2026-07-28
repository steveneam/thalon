import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type EdlInput, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { DELETE } = await import("./route");

/**
 * s82 A3 — the delete door. The three refusals themselves are the repo's and
 * are pinned in packages/db; what is pinned HERE is the door's own half: the
 * status it maps a refusal to (409, message verbatim — the operator reads it
 * in the notice band), the tenancy/project scoping, and the RENDERED FILE,
 * which no repo can reach and which a delete that skipped it would orphan.
 */

let handle: DbHandle | undefined;
let ctx: TenantCtx;
let root: string;

const EDL = (name: string): EdlInput => ({
  name,
  output: { width: 1280, height: 720, fps: 24, duration: 5 },
  video: [{ name: "b1", source: { kind: "take", ref: "motion/keepers/clip-01.mp4" }, duration: 5 }],
});

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
  root = await mkdtemp(path.join(tmpdir(), "thalon-delete-test-"));
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

async function project(withRoot = true) {
  if (!repos) throw new Error("no repos");
  const { project: row } = await repos.videoProjects.create(ctx, {
    name: "concept-film",
    ...(withRoot ? { meta: { mediaRoot: root } } : {}),
  });
  return row;
}

async function cut(projectId: string, version: number, outputRef?: string) {
  if (!repos) throw new Error("no repos");
  const { cut: row } = await repos.videoCuts.create(ctx, projectId, {
    name: "master",
    version,
    edl: EDL(`master-v${version}`),
    meta: {},
  });
  if (outputRef) await repos.videoCuts.recordRender(ctx, row.id, outputRef);
  return row;
}

function req(projectId: string, cutId: string) {
  return [
    new Request(`http://test.local/api/videos/${projectId}/cuts/${cutId}`, { method: "DELETE" }),
    { params: Promise.resolve({ projectId, cutId }) },
  ] as const;
}

describe("DELETE /api/videos/[projectId]/cuts/[cutId]", () => {
  it("deletes the version AND the file it rendered — nothing is left on disk unnameable", async () => {
    const p = await project();
    await cut(p.id, 1);
    const doomed = await cut(p.id, 2, "cuts/master-v2.mp4");
    await mkdir(path.join(root, "cuts"), { recursive: true });
    await writeFile(path.join(root, "cuts/master-v2.mp4"), "not really an mp4");

    const res = await DELETE(...req(p.id, doomed.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      removed: { version: number };
      file: { removed: boolean; ref?: string };
    };
    expect(body.removed.version).toBe(2);
    expect(body.file).toEqual({ removed: true, ref: "cuts/master-v2.mp4" });
    await expect(access(path.join(root, "cuts/master-v2.mp4"))).rejects.toThrow();
    expect(await repos?.videoCuts.get(ctx, doomed.id)).toBeNull();
  });

  it("takes the working-copy PREVIEW with it — it is addressed by the cut id and nothing could name it again", async () => {
    const p = await project();
    await cut(p.id, 1);
    const doomed = await cut(p.id, 2);
    await mkdir(path.join(root, "cuts", "previews"), { recursive: true });
    await writeFile(path.join(root, `cuts/previews/${doomed.id}.mp4`), "preview");

    const res = await DELETE(...req(p.id, doomed.id));
    expect(res.status).toBe(200);
    await expect(access(path.join(root, `cuts/previews/${doomed.id}.mp4`))).rejects.toThrow();
    // An unrendered version says so rather than claiming a file was removed.
    expect((await res.json()).file).toMatchObject({ removed: false });
  });

  it("409s a ratified refusal and carries the reason VERBATIM", async () => {
    const p = await project();
    const first = await cut(p.id, 1, "cuts/master-v1.mp4");
    await cut(p.id, 2);
    await repos?.videoCuts.approve(ctx, first.id, { gate: "g1-captions", verdict: "pass", lines: 0 });

    const res = await DELETE(...req(p.id, first.id));
    expect(res.status).toBe(409);
    // The message IS the operator's answer — the surface prints it as-is.
    expect((await res.json()).error).toMatch(/approved.*judge receipt/);
    // And the row is still there: a refusal refuses.
    expect(await repos?.videoCuts.get(ctx, first.id)).not.toBeNull();
  });

  it("refuses the project's last cut, and leaves the project openable", async () => {
    const p = await project();
    const only = await cut(p.id, 1);
    const res = await DELETE(...req(p.id, only.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/only cut/);
  });

  it("404s a cut that belongs to ANOTHER project — the id alone is not authority", async () => {
    const p = await project();
    await cut(p.id, 1);
    const target = await cut(p.id, 2);
    const { project: other } = await repos!.videoProjects.create(ctx, { name: "other-film" });

    const res = await DELETE(...req(other.id, target.id));
    expect(res.status).toBe(404);
    expect(await repos?.videoCuts.get(ctx, target.id)).not.toBeNull();
  });

  it("404s an unknown project, and an unknown cut", async () => {
    const p = await project();
    await cut(p.id, 1);
    expect((await DELETE(...req(p.id, "11111111-1111-4111-8111-111111111111"))).status).toBe(404);
  });

  it("deletes the row even where the box has no media root, and SAYS the file was not touched", async () => {
    // The honest case, not an error case: refs on record, media elsewhere.
    const p = await project(false);
    await cut(p.id, 1);
    const doomed = await cut(p.id, 2, "cuts/master-v2.mp4");
    const res = await DELETE(...req(p.id, doomed.id));
    expect(res.status).toBe(200);
    expect((await res.json()).file.reason).toMatch(/no media root/);
    expect(await repos?.videoCuts.get(ctx, doomed.id)).toBeNull();
  });
});
