import {
  InvalidVideoCutTransitionError,
  tenantCtx,
  type EdlInput,
  type TenantCtx,
} from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import { NotFoundError } from "../errors";
import type { Repos } from "../repos";

/**
 * B-ve.1 contract-window repos (video projects · takes · cuts, ADR 0010).
 * Same discipline as sprint7-repos.test.ts: every behavior test doubles as
 * the tenancy-wall proof and the B4.4 events-coverage pin for these repos'
 * write fns.
 */

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; other: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: tenantCtx(tenant.id), other: tenantCtx(stranger.id), repos };
}

/** The smallest legal EDL — one beat, defaults everywhere. */
function minimalEdl(name = "test-cut"): EdlInput {
  return {
    name,
    output: { width: 1280, height: 720, fps: 24, duration: 5 },
    video: [
      {
        name: "b1",
        source: { kind: "take", ref: "motion/keepers/clip-01.mp4" },
        duration: 5,
      },
    ],
  };
}

describe("video projects repo (B-ve.1)", () => {
  it("creates idempotently on (tenant, name) — replay returns the existing project untouched", async () => {
    const { ctx, other, repos } = await setup();
    const first = await repos.videoProjects.create(ctx, {
      name: "concept-film",
      description: "the reference film",
    });
    expect(first.created).toBe(true);

    const replay = await repos.videoProjects.create(ctx, { name: "concept-film" });
    expect(replay.created).toBe(false);
    expect(replay.project.id).toBe(first.project.id);
    expect(replay.project.description).toBe("the reference film"); // first origin wins
    expect(await repos.videoProjects.list(ctx)).toHaveLength(1);

    // Tenancy walls: same name is a separate project per tenant; foreign reads null.
    const foreign = await repos.videoProjects.create(other, { name: "concept-film" });
    expect(foreign.created).toBe(true);
    expect(await repos.videoProjects.get(other, first.project.id)).toBeNull();

    // B4.4 pin: the replayed create appended no second event.
    const events = await repos.events.list(ctx, {
      entityType: "video_project",
      entityId: first.project.id,
    });
    expect(events.map((e) => e.event)).toEqual(["video_project.created"]);
  });
});

describe("video takes repo (B-ve.1)", () => {
  it("records idempotently on (tenant, project, ref); rejects require reasons; dispositions audit", async () => {
    const { ctx, other, repos } = await setup();
    const { project } = await repos.videoProjects.create(ctx, { name: "film" });

    const first = await repos.videoTakes.record(ctx, project.id, {
      slot: "beat-01",
      kind: "motion",
      ref: "motion/keepers/clip-01.mp4",
      provenance: { model: "vendor-model-x", credits: 40 },
    });
    expect(first.created).toBe(true);
    expect(first.take.disposition).toBe("keeper");

    // Replay returns the existing row untouched.
    const replay = await repos.videoTakes.record(ctx, project.id, {
      slot: "beat-01",
      kind: "motion",
      ref: "motion/keepers/clip-01.mp4",
    });
    expect(replay.created).toBe(false);
    expect(replay.take.id).toBe(first.take.id);

    // A reject without a reason is refused loudly at the schema door.
    await expect(
      repos.videoTakes.record(ctx, project.id, {
        slot: "beat-01",
        kind: "motion",
        disposition: "reject",
        ref: "motion/rejects/clip-01-t1.mp4",
      }),
    ).rejects.toThrow();
    const withReason = await repos.videoTakes.record(ctx, project.id, {
      slot: "beat-01",
      kind: "motion",
      disposition: "reject",
      ref: "motion/rejects/clip-01-t1.mp4",
      reason: "falcon wing clips the frame edge",
    });
    expect(withReason.take.reason).toBe("falcon wing clips the frame edge");

    // The retake verb: keeper -> reject requires a reason too; same-value is a no-op.
    await expect(
      repos.videoTakes.setDisposition(ctx, first.take.id, "reject"),
    ).rejects.toThrow();
    const demoted = await repos.videoTakes.setDisposition(
      ctx,
      first.take.id,
      "reject",
      "superseded by the s43 retake",
    );
    expect(demoted.reason).toBe("superseded by the s43 retake");
    await repos.videoTakes.setDisposition(ctx, first.take.id, "reject", "again"); // no-op
    const promoted = await repos.videoTakes.setDisposition(ctx, first.take.id, "keeper");
    expect(promoted.reason).toBeNull();

    // Slot/disposition reads — the beat lane.
    expect(await repos.videoTakes.list(ctx, project.id, { slot: "beat-01" })).toHaveLength(2);
    expect(
      await repos.videoTakes.list(ctx, project.id, { disposition: "reject" }),
    ).toHaveLength(1);

    // Tenancy walls: recording into a foreign project 404s; foreign reads empty.
    await expect(
      repos.videoTakes.record(other, project.id, {
        kind: "motion",
        ref: "motion/keepers/clip-01.mp4",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await repos.videoTakes.list(other, project.id)).toHaveLength(0);
    await expect(
      repos.videoTakes.setDisposition(other, first.take.id, "keeper"),
    ).rejects.toBeInstanceOf(NotFoundError);

    // B4.4 pins: recorded once (replay silent), then the two REAL disposition
    // changes (the same-value re-apply emitted nothing).
    const events = await repos.events.list(ctx, {
      entityType: "video_take",
      entityId: first.take.id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "video_take.recorded",
      "video_take.disposition_changed",
      "video_take.disposition_changed",
    ]);
    expect(events.at(-1)?.payload).toEqual({ from: "reject", to: "keeper", reason: null });
  });

  it("path-traversing refs are refused at the write door — nothing stores", async () => {
    const { ctx, repos } = await setup();
    const { project } = await repos.videoProjects.create(ctx, { name: "film" });
    for (const ref of ["../outside.mp4", "/abs/path.mp4", "a//b.mp4", "a\\b.mp4"]) {
      await expect(
        repos.videoTakes.record(ctx, project.id, { kind: "motion", ref }),
      ).rejects.toThrow();
    }
    expect(await repos.videoTakes.list(ctx, project.id)).toHaveLength(0);
  });
});

describe("video cuts repo (B-ve.1)", () => {
  it("creates idempotently on (tenant, project, name, version); the EDL validates at the write door", async () => {
    const { ctx, other, repos } = await setup();
    const { project } = await repos.videoProjects.create(ctx, { name: "film" });

    const first = await repos.videoCuts.create(ctx, project.id, {
      name: "master-16x9",
      version: 1,
      edl: minimalEdl("master-16x9"),
    });
    expect(first.created).toBe(true);
    expect(first.cut.status).toBe("draft");

    // Replaying the same (name, version) returns the row UNTOUCHED — an EDL
    // is immutable per version, a re-edit is a new version.
    const replay = await repos.videoCuts.create(ctx, project.id, {
      name: "master-16x9",
      version: 1,
      edl: { ...minimalEdl("master-16x9"), output: { width: 999, height: 9, fps: 1, duration: 1 } },
    });
    expect(replay.created).toBe(false);
    expect((replay.cut.edl as { output: { width: number } }).output.width).toBe(1280);

    const v2 = await repos.videoCuts.create(ctx, project.id, {
      name: "master-16x9",
      version: 2,
      edl: minimalEdl("master-16x9"),
    });
    expect(v2.created).toBe(true);

    // Garbage EDLs are refused loudly — nothing stores.
    await expect(
      repos.videoCuts.create(ctx, project.id, {
        name: "bad",
        version: 1,
        edl: { name: "bad" } as never,
      }),
    ).rejects.toThrow();
    await expect(
      repos.videoCuts.create(ctx, project.id, {
        name: "bad",
        version: 1,
        edl: {
          ...minimalEdl("bad"),
          video: [
            {
              name: "b1",
              source: { kind: "take", ref: "../escape.mp4" },
              duration: 5,
            },
          ],
        },
      }),
    ).rejects.toThrow();
    expect(await repos.videoCuts.list(ctx, project.id)).toHaveLength(2);

    // Tenancy walls: creating into a foreign project 404s; foreign reads null/empty.
    await expect(
      repos.videoCuts.create(other, project.id, {
        name: "master-16x9",
        version: 3,
        edl: minimalEdl(),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await repos.videoCuts.get(other, first.cut.id)).toBeNull();

    // B4.4 pin: the replayed create appended no second event.
    const events = await repos.events.list(ctx, {
      entityType: "video_cut",
      entityId: first.cut.id,
    });
    expect(events.map((e) => e.event)).toEqual(["video_cut.created"]);
  });

  it("recordRender walks draft -> rendered by the rulebook and audits; re-render is refused", async () => {
    const { ctx, other, repos } = await setup();
    const { project } = await repos.videoProjects.create(ctx, { name: "film" });
    const { cut } = await repos.videoCuts.create(ctx, project.id, {
      name: "master",
      version: 1,
      edl: minimalEdl(),
    });

    const rendered = await repos.videoCuts.recordRender(ctx, cut.id, "cuts/master-v1.mp4");
    expect(rendered.status).toBe("rendered");
    expect(rendered.outputRef).toBe("cuts/master-v1.mp4");

    // rendered -> rendered is not a transition; the rulebook throws.
    await expect(
      repos.videoCuts.recordRender(ctx, cut.id, "cuts/master-v1b.mp4"),
    ).rejects.toBeInstanceOf(InvalidVideoCutTransitionError);

    // Foreign writes 404 before the rulebook is even consulted.
    await expect(
      repos.videoCuts.recordRender(other, cut.id, "cuts/x.mp4"),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Status reads — the project surface.
    expect(await repos.videoCuts.list(ctx, project.id, { status: "rendered" })).toHaveLength(1);
    expect(await repos.videoCuts.list(ctx, project.id, { status: "draft" })).toHaveLength(0);

    const events = await repos.events.list(ctx, { entityType: "video_cut", entityId: cut.id });
    expect(events.map((e) => e.event)).toEqual(["video_cut.created", "video_cut.rendered"]);
  });

  it("ships NO approve door (ADR 0010): the repo surface is pinned — the approved transition arrives with B-ve.3/4 behind the judge gate", async () => {
    const { repos } = await setup();
    expect(Object.keys(repos.videoCuts).sort()).toEqual([
      "create",
      "get",
      "list",
      "recordRender",
    ]);
  });
});
