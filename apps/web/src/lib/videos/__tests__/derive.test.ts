import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tenantCtx, type EdlInput, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { DeriveRefusedError, planCutDerive } from "../derive";

/**
 * B-ve.5 derive door planning: refusal shapes + the success path, with a
 * FAKE ffprobe answering measured dims (the real probe is engine-tested;
 * the real measurement happens in the dogfood run).
 */

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
  delete process.env.THALON_FFPROBE;
});

function fakeFfprobe(stdout: string): string {
  const dir = mkdtempSync(join(tmpdir(), "derive-door-"));
  scratches.push(dir);
  const bin = join(dir, "ffprobe");
  writeFileSync(bin, `#!/bin/bash\necho '${stdout}'\nexit 0`);
  chmodSync(bin, 0o755);
  return bin;
}

const EDL: EdlInput = {
  name: "film-16x9",
  output: { width: 1920, height: 1080, fps: 24, duration: 5 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/clip-01.mp4" }, duration: 5 },
  ],
  captions: {
    style: { pointsize: 44 },
    lines: [{ text: "carried for you", x: 960, y: 640, fadeIn: 1, fadeOut: 4 }],
  },
};

const COPY_EDL: EdlInput = {
  name: "scored",
  output: { width: 1920, height: 1080, fps: 24, duration: 5, video: { mode: "copy" } },
  video: [{ name: "picture", source: { kind: "cut", ref: "cuts/master.mp4" }, duration: 5 }],
};

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function seed(meta: Record<string, unknown> = { mediaRoot: "/media/film" }) {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const ctx: TenantCtx = tenantCtx(tenant.id);
  const { project } = await handle.repos.videoProjects.create(ctx, { name: "film", meta });
  const { cut } = await handle.repos.videoCuts.create(ctx, project.id, {
    name: "film-16x9",
    version: 1,
    edl: EDL,
  });
  return { repos: handle.repos, ctx, projectId: project.id, cut };
}

describe("planCutDerive", () => {
  it("derives a named, versioned, lineage-stamped input with measured seeds", async () => {
    process.env.THALON_FFPROBE = fakeFfprobe('{"streams":[{"width":1280,"height":720}]}');
    const { repos, ctx, projectId, cut } = await seed();
    const planned = await planCutDerive(repos, ctx, projectId, cut.id, { aspect: "9:16" });
    expect(planned.input.name).toBe("film-16x9-9x16");
    expect(planned.input.version).toBe(1);
    expect(planned.lineage).toEqual({ parentCutId: cut.id, aspect: "9:16" });
    expect((planned.input.meta as { lineage?: unknown }).lineage).toEqual(planned.lineage);
    const edl = planned.input.edl as { video: { crop?: unknown; scale?: unknown }[] };
    expect(edl.video[0].crop).toEqual({ width: 404, height: 720, x: 438, y: 0 });
    expect(edl.video[0].scale).toEqual({ width: 1080, height: 1920, flags: "lanczos" });
  });

  it("refuses: bad body 400 · missing project/cut 404 · no media root 422 · copy-mode parent 422", async () => {
    process.env.THALON_FFPROBE = fakeFfprobe('{"streams":[{"width":1280,"height":720}]}');
    const { repos, ctx, projectId, cut } = await seed();

    await expect(
      planCutDerive(repos, ctx, projectId, cut.id, { aspect: "vertical" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      planCutDerive(repos, ctx, "00000000-0000-4000-8000-000000000000", cut.id, {
        aspect: "9:16",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      planCutDerive(repos, ctx, projectId, "00000000-0000-4000-8000-000000000001", {
        aspect: "9:16",
      }),
    ).rejects.toMatchObject({ status: 404 });

    const { cut: copyCut } = await repos.videoCuts.create(ctx, projectId, {
      name: "scored",
      version: 1,
      edl: COPY_EDL,
    });
    await expect(
      planCutDerive(repos, ctx, projectId, copyCut.id, { aspect: "1:1" }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("copy-mode") });
  });

  it("refuses 422 when the project has no media root — geometry is measured, never estimated", async () => {
    const { repos, ctx, projectId, cut } = await seed({});
    await expect(
      planCutDerive(repos, ctx, projectId, cut.id, { aspect: "9:16" }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("media root") });
  });

  it("carries the probe's own refusal when a source cannot be measured", async () => {
    process.env.THALON_FFPROBE = fakeFfprobe('{"streams":[]}');
    const { repos, ctx, projectId, cut } = await seed();
    await expect(
      planCutDerive(repos, ctx, projectId, cut.id, { aspect: "9:16" }),
    ).rejects.toBeInstanceOf(DeriveRefusedError);
  });
});
