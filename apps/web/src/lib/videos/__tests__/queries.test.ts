import { tenantCtx, type EdlInput, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { getProjectDetail, listProjectSummaries, summarizeEdl } from "../queries";

/** Minimal valid EDL (contracts edlSchema) — one beat, silent, no captions. */
const EDL: EdlInput = {
  name: "test-cut",
  output: { width: 1280, height: 720, fps: 24, duration: 5 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/clip-01.mp4" }, duration: 5 },
  ],
};

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function seedProject(meta: Record<string, unknown> = {}): Promise<{
  ctx: TenantCtx;
  projectId: string;
}> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  const { project } = await handle.repos.videoProjects.create(ctx, {
    name: "concept film",
    description: "the reference project",
    meta,
  });
  await handle.repos.videoTakes.record(ctx, project.id, {
    slot: "beat-01",
    kind: "motion",
    disposition: "keeper",
    ref: "motion/keepers/clip-01.mp4",
  });
  await handle.repos.videoTakes.record(ctx, project.id, {
    slot: "beat-01",
    kind: "motion",
    disposition: "reject",
    ref: "motion/rejects/clip-01-t1-reject.mp4",
    reason: "hand clips through the watch face",
  });
  await handle.repos.videoTakes.record(ctx, project.id, {
    kind: "audio",
    disposition: "keeper",
    ref: "cuts/music-candidates/candidate-G.mp3",
  });
  const { cut } = await handle.repos.videoCuts.create(ctx, project.id, {
    name: "film-16x9",
    version: 1,
    edl: EDL,
  });
  await handle.repos.videoCuts.recordRender(ctx, cut.id, "cuts/film-16x9-master.mp4");
  await handle.repos.videoCuts.create(ctx, project.id, {
    name: "film-16x9",
    version: 2,
    edl: EDL,
  });
  return { ctx, projectId: project.id };
}

describe("listProjectSummaries", () => {
  it("counts keepers, rejects, and cuts per project", async () => {
    const { ctx } = await seedProject();
    const summaries = await listProjectSummaries(handle!.repos, ctx);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      name: "concept film",
      keepers: 2,
      rejects: 1,
      cuts: 2,
    });
    expect(new Date(summaries[0].createdAt).getTime()).not.toBeNaN();
  });
});

describe("getProjectDetail", () => {
  it("orders takes slot-first with keepers before rejects and slotless last, reason on the reject", async () => {
    const { ctx, projectId } = await seedProject();
    const detail = await getProjectDetail(handle!.repos, ctx, projectId);
    expect(detail).not.toBeNull();
    expect(detail!.takes.map((t) => [t.slot, t.disposition])).toEqual([
      ["beat-01", "keeper"],
      ["beat-01", "reject"],
      [null, "keeper"],
    ]);
    expect(detail!.takes[1].reason).toBe("hand clips through the watch face");
  });

  it("sorts cuts by name then newest version first, with the render on record", async () => {
    const { ctx, projectId } = await seedProject();
    const detail = await getProjectDetail(handle!.repos, ctx, projectId);
    expect(detail!.cuts.map((c) => [c.version, c.status, c.outputRef])).toEqual([
      [2, "draft", null],
      [1, "rendered", "cuts/film-16x9-master.mp4"],
    ]);
    expect(detail!.cuts[1].edl).toMatchObject({ beats: 1, audio: "silent", width: 1280 });
  });

  it("playable follows meta.mediaRoot (absent → false, absolute path → true)", async () => {
    const { ctx, projectId } = await seedProject();
    expect((await getProjectDetail(handle!.repos, ctx, projectId))!.playable).toBe(false);
    const { project: withRoot } = await handle!.repos.videoProjects.create(ctx, {
      name: "rooted",
      meta: { mediaRoot: "/data/projects/rooted" },
    });
    expect((await getProjectDetail(handle!.repos, ctx, withRoot.id))!.playable).toBe(true);
  });

  it("returns null for an unknown project", async () => {
    const { ctx } = await seedProject();
    expect(
      await getProjectDetail(handle!.repos, ctx, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});

describe("summarizeEdl", () => {
  it("summarizes lanes: silent / copy / encode + caption count", () => {
    expect(summarizeEdl(EDL)).toEqual({
      beats: 1,
      captionLines: 0,
      audio: "silent",
      width: 1280,
      height: 720,
      fps: 24,
      duration: 5,
    });
    const withAudio = (mode: "copy" | "encode") => ({
      ...EDL,
      audio: [{ source: { kind: "cut", ref: "cuts/master.mp4" }, mode }],
      captions: {
        style: { pointsize: 34 },
        lines: [{ text: "the watch", x: 640, y: 100, fadeIn: 1, fadeOut: 3 }],
      },
    });
    expect(summarizeEdl(withAudio("copy"))).toMatchObject({ audio: "copy", captionLines: 1 });
    expect(summarizeEdl(withAudio("encode"))).toMatchObject({ audio: "encode" });
  });

  it("throws loudly on a corrupt EDL (the write door guarantees validity)", () => {
    expect(() => summarizeEdl({ nonsense: true })).toThrow();
  });
});
