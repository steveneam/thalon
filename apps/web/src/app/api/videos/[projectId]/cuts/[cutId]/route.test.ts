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
const { POST: RESTORE } = await import("./restore/route");

/**
 * Window 0026 — the RETIRE door (s82's delete, made reversible) and its
 * restore twin. The three refusals themselves are the repo's and are pinned in
 * packages/db; what is pinned HERE is the door's own half: the status it maps
 * a refusal to (409, message verbatim — the operator reads it in the notice
 * band), the tenancy/project scoping, and — the reason this file changed at
 * all — THE FILE ON DISK, which the old door deleted and this one must not
 * touch. A retire that unlinked the render would make the sheet's confirm
 * ("Restore brings it back exactly as it is now") a lie.
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
  root = await mkdtemp(path.join(tmpdir(), "thalon-retire-test-"));
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

describe("DELETE /api/videos/[projectId]/cuts/[cutId] — retire", () => {
  it("retires the version and LEAVES THE RENDERED FILE ON DISK", async () => {
    const p = await project();
    await cut(p.id, 1);
    const leaving = await cut(p.id, 2, "cuts/master-v2.mp4");
    await mkdir(path.join(root, "cuts"), { recursive: true });
    await writeFile(path.join(root, "cuts/master-v2.mp4"), "not really an mp4");

    const res = await DELETE(...req(p.id, leaving.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      retired: { version: number; outputRef: string | null };
      changed: boolean;
    };
    expect(body.retired.version).toBe(2);
    expect(body.changed).toBe(true);
    // The two facts that ARE window 0026, stated as assertions: the ref
    // survives on the row, and the bytes survive on disk.
    expect(body.retired.outputRef).toBe("cuts/master-v2.mp4");
    await expect(access(path.join(root, "cuts/master-v2.mp4"))).resolves.toBeUndefined();
    // Gone from the default read, which is what "retired" means here.
    expect(await repos?.videoCuts.get(ctx, leaving.id)).toBeNull();
  });

  it("leaves the working-copy PREVIEW alone too — a restore must find everything", async () => {
    const p = await project();
    await cut(p.id, 1);
    const leaving = await cut(p.id, 2);
    await mkdir(path.join(root, "cuts", "previews"), { recursive: true });
    await writeFile(path.join(root, `cuts/previews/${leaving.id}.mp4`), "preview");

    const res = await DELETE(...req(p.id, leaving.id));
    expect(res.status).toBe(200);
    await expect(
      access(path.join(root, `cuts/previews/${leaving.id}.mp4`)),
    ).resolves.toBeUndefined();
  });

  it("404s a SECOND retire — the door reads the living set, where the cut no longer is", async () => {
    const p = await project();
    await cut(p.id, 1);
    const leaving = await cut(p.id, 2);
    expect((await DELETE(...req(p.id, leaving.id))).status).toBe(200);

    // Not a converge-to-200: this door's pre-read is the DEFAULT read, so a
    // retired cut is genuinely absent from where it looks — which is the same
    // answer it gives for any other id that is not on the strip. (The repo's
    // own retire still converges; it is simply not reachable from here, and
    // the restore door is where a retired cut is addressable.)
    const res = await DELETE(...req(p.id, leaving.id));
    expect(res.status).toBe(404);
  });

  it("409s a ratified refusal and carries the reason VERBATIM", async () => {
    const p = await project();
    const first = await cut(p.id, 1, "cuts/master-v1.mp4");
    await cut(p.id, 2);
    await repos?.videoCuts.approve(ctx, first.id, {
      gate: "g1-captions",
      verdict: "pass",
      lines: 0,
    });

    const res = await DELETE(...req(p.id, first.id));
    expect(res.status).toBe(409);
    // The message IS the operator's answer — the surface prints it as-is.
    expect((await res.json()).error).toMatch(/approved.*judge receipt/);
    // And the row is still there: a refusal refuses.
    expect(await repos?.videoCuts.get(ctx, first.id)).not.toBeNull();
  });

  it("refuses the project's last living cut, and leaves the project openable", async () => {
    const p = await project();
    const only = await cut(p.id, 1);
    const res = await DELETE(...req(p.id, only.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/only remaining cut/);
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

  it("retires where the box has no media root — there was never a file question to answer", async () => {
    // The honest case, not an error case: refs on record, media elsewhere.
    const p = await project(false);
    await cut(p.id, 1);
    const leaving = await cut(p.id, 2, "cuts/master-v2.mp4");
    const res = await DELETE(...req(p.id, leaving.id));
    expect(res.status).toBe(200);
    expect((await res.json()).retired.outputRef).toBe("cuts/master-v2.mp4");
    expect(await repos?.videoCuts.get(ctx, leaving.id)).toBeNull();
  });
});

function restoreReq(projectId: string, cutId: string) {
  return [
    new Request(`http://test.local/api/videos/${projectId}/cuts/${cutId}/restore`, {
      method: "POST",
    }),
    { params: Promise.resolve({ projectId, cutId }) },
  ] as const;
}

describe("POST /api/videos/[projectId]/cuts/[cutId]/restore", () => {
  it("brings the version back EXACTLY — same row, same render, on the strip again", async () => {
    const p = await project();
    await cut(p.id, 1);
    const leaving = await cut(p.id, 2, "cuts/master-v2.mp4");
    await mkdir(path.join(root, "cuts"), { recursive: true });
    await writeFile(path.join(root, "cuts/master-v2.mp4"), "not really an mp4");
    await DELETE(...req(p.id, leaving.id));

    const res = await RESTORE(...restoreReq(p.id, leaving.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      restored: { id: string; version: number; outputRef: string | null };
      changed: boolean;
    };
    expect(body.changed).toBe(true);
    expect(body.restored.id).toBe(leaving.id);
    expect(body.restored.outputRef).toBe("cuts/master-v2.mp4");
    // Back on the default read, and the file it names is still there.
    expect(await repos?.videoCuts.get(ctx, leaving.id)).not.toBeNull();
    await expect(access(path.join(root, "cuts/master-v2.mp4"))).resolves.toBeUndefined();
  });

  it("converges: restoring a living version is a 200 saying nothing changed", async () => {
    const p = await project();
    const living = await cut(p.id, 1);
    const res = await RESTORE(...restoreReq(p.id, living.id));
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(false);
  });

  it("404s a retired cut asked for through ANOTHER project's door", async () => {
    const p = await project();
    await cut(p.id, 1);
    const target = await cut(p.id, 2);
    await DELETE(...req(p.id, target.id));
    const { project: other } = await repos!.videoProjects.create(ctx, { name: "other-film" });

    const res = await RESTORE(...restoreReq(other.id, target.id));
    expect(res.status).toBe(404);
  });

  it("404s when the PROJECT is retired — nothing restores into somewhere unreachable", async () => {
    const p = await project();
    await cut(p.id, 1);
    const target = await cut(p.id, 2);
    await DELETE(...req(p.id, target.id));
    await repos!.videoProjects.retire(ctx, p.id);

    const res = await RESTORE(...restoreReq(p.id, target.id));
    expect(res.status).toBe(404);
  });
});
