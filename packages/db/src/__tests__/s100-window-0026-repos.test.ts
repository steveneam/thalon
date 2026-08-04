import { tenantCtx, type EdlInput, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidStateError, NotFoundError } from "../errors";
import type { Repos } from "../repos";
import { fixture, type Fixture } from "./helpers";

/**
 * Contract window 0026 — REMOVAL RETIRES, IT NEVER DESTROYS (founder call at
 * the s99 close). `retired_at` on both `video_cuts` and `video_projects`, the
 * retire/restore verbs over it, and rename on projects.
 *
 * Same discipline as the other window files — every behaviour test doubles as
 * the tenancy-wall proof and the B4.4 events-coverage pin for these write fns
 * (video_cut.retired / restored · video_project.retired / restored / renamed).
 *
 * The cut-removal tests below arrived HERE from s82-window-repos.test.ts,
 * moved whole rather than copied: s82's hard `remove` and this window's
 * `retire` are the same door, and the founder's three ratified refusals
 * survived the change to reversibility. What is new is everything about the
 * way back.
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; other: TenantCtx; repos: Repos }> {
  fx = await fixture();
  const { repos } = fx.handle;
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), repos };
}

/** The smallest legal EDL — one beat, defaults everywhere. */
function minimalEdl(name: string): EdlInput {
  return {
    name,
    output: { width: 1280, height: 720, fps: 24, duration: 5 },
    video: [
      { name: "b1", source: { kind: "take", ref: "motion/keepers/clip-01.mp4" }, duration: 5 },
    ],
  };
}

async function projectWithCuts(repos: Repos, ctx: TenantCtx, count: number) {
  const { project } = await repos.videoProjects.create(ctx, { name: "concept-film" });
  const cuts = [];
  for (let version = 1; version <= count; version += 1) {
    const { cut } = await repos.videoCuts.create(ctx, project.id, {
      name: "master",
      version,
      edl: minimalEdl(`master-v${version}`),
      meta: {},
    });
    cuts.push(cut);
  }
  return { project, cuts };
}

describe("video cuts retire (window 0026 — the s82 delete, made reversible)", () => {
  it("retires a rendered version WITHOUT touching its outputRef — the render is kept", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.recordRender(ctx, cuts[1].id, "renders/master-v2.mp4");

    const { cut, retired } = await repos.videoCuts.retire(ctx, cuts[1].id);
    expect(retired).toBe(true);
    expect(cut.retiredAt).toBeInstanceOf(Date);
    // THE difference from s82's delete: the row survives and so does the ref
    // it names. A retire that dropped either could not honour "Restore brings
    // it back exactly as it is now".
    expect(cut.outputRef).toBe("renders/master-v2.mp4");

    // Gone from every default read...
    expect(await repos.videoCuts.get(ctx, cuts[1].id)).toBeNull();
    expect(await repos.videoCuts.list(ctx, project.id)).toHaveLength(1);
    // ...and reachable only by asking for it, which is the restore door's job.
    expect(await repos.videoCuts.get(ctx, cuts[1].id, { includeRetired: true })).not.toBeNull();
    expect(await repos.videoCuts.list(ctx, project.id, { includeRetired: true })).toHaveLength(2);

    const events = await repos.events.list(ctx, {
      entityType: "video_cut",
      entityId: cuts[1].id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "video_cut.created",
      "video_cut.rendered",
      "video_cut.retired",
    ]);
    const retiredEvent = events.find((e) => e.event === "video_cut.retired");
    expect((retiredEvent?.payload as { outputRef?: string }).outputRef).toBe(
      "renders/master-v2.mp4",
    );
  });

  it("restores it exactly — same row, same EDL, same render, back on every read", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.recordRender(ctx, cuts[1].id, "renders/master-v2.mp4");
    const before = await repos.videoCuts.get(ctx, cuts[1].id);
    await repos.videoCuts.retire(ctx, cuts[1].id);

    const { cut, restored } = await repos.videoCuts.restore(ctx, cuts[1].id);
    expect(restored).toBe(true);
    expect(cut.retiredAt).toBeNull();
    expect(cut.id).toBe(before!.id);
    expect(cut.edl).toEqual(before!.edl);
    expect(cut.outputRef).toBe(before!.outputRef);
    expect(cut.status).toBe(before!.status);
    expect(await repos.videoCuts.list(ctx, project.id)).toHaveLength(2);

    const events = await repos.events.list(ctx, {
      entityType: "video_cut",
      entityId: cuts[1].id,
    });
    expect(events.map((e) => e.event)).toContain("video_cut.restored");
  });

  it("replays a repeated retire and a repeated restore as no-ops — the audit spine stays honest", async () => {
    const { ctx, repos } = await setup();
    const { cuts } = await projectWithCuts(repos, ctx, 2);

    const first = await repos.videoCuts.retire(ctx, cuts[1].id);
    const again = await repos.videoCuts.retire(ctx, cuts[1].id);
    expect(again.retired).toBe(false);
    // First retirement wins: a re-retire must not rewrite WHEN it happened.
    expect(again.cut.retiredAt?.toISOString()).toBe(first.cut.retiredAt?.toISOString());

    await repos.videoCuts.restore(ctx, cuts[1].id);
    const restoredAgain = await repos.videoCuts.restore(ctx, cuts[1].id);
    expect(restoredAgain.restored).toBe(false);

    const events = await repos.events.list(ctx, {
      entityType: "video_cut",
      entityId: cuts[1].id,
    });
    expect(events.filter((e) => e.event === "video_cut.retired")).toHaveLength(1);
    expect(events.filter((e) => e.event === "video_cut.restored")).toHaveLength(1);
  });

  it("(a) refuses an APPROVED cut — it stays on the strip as the evidence of what shipped", async () => {
    const { ctx, repos } = await setup();
    const { cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.recordRender(ctx, cuts[1].id, "renders/master-v2.mp4");
    await repos.videoCuts.approve(ctx, cuts[1].id, {
      gate: "g1-captions",
      verdict: "pass",
      lines: 0,
    });

    await expect(repos.videoCuts.retire(ctx, cuts[1].id)).rejects.toBeInstanceOf(InvalidStateError);
    await expect(repos.videoCuts.retire(ctx, cuts[1].id)).rejects.toThrow(/approved/);
    expect(await repos.videoCuts.get(ctx, cuts[1].id)).not.toBeNull();
  });

  it("(b) refuses a LINEAGE PARENT of a living derived cut, and names the child", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    const { cut: derived } = await repos.videoCuts.create(ctx, project.id, {
      name: "master-9x16",
      version: 1,
      edl: minimalEdl("master-9x16-v1"),
      meta: {},
    });
    await repos.videoCuts.stampLineage(ctx, derived.id, {
      parentCutId: cuts[0].id,
      aspect: "9:16",
    });

    await expect(repos.videoCuts.retire(ctx, cuts[0].id)).rejects.toThrow(/master-9x16/);
    expect(await repos.videoCuts.get(ctx, cuts[0].id)).not.toBeNull();

    // Retire the child first and the parent becomes retirable — the refusal
    // guards the dangling pointer, not the parent forever. Note this proves
    // the refusal reads LIVING children only: the retired child no longer
    // blocks, which is the whole re-scoping window 0026 did to it.
    await repos.videoCuts.retire(ctx, derived.id);
    const { cut } = await repos.videoCuts.retire(ctx, cuts[0].id);
    expect(cut.id).toBe(cuts[0].id);
  });

  it("(c) refuses the project's LAST LIVING cut — a project with nothing to open", async () => {
    const { ctx, repos } = await setup();
    const { cuts } = await projectWithCuts(repos, ctx, 1);
    await expect(repos.videoCuts.retire(ctx, cuts[0].id)).rejects.toThrow(/only remaining cut/);
    expect(await repos.videoCuts.get(ctx, cuts[0].id)).not.toBeNull();
  });

  it("counts only LIVING siblings toward the last-cut refusal", async () => {
    const { ctx, repos } = await setup();
    const { cuts } = await projectWithCuts(repos, ctx, 2);
    // Retiring the first is fine (two living). Retiring the second must then
    // refuse — a retired sibling does not keep a project openable.
    await repos.videoCuts.retire(ctx, cuts[0].id);
    await expect(repos.videoCuts.retire(ctx, cuts[1].id)).rejects.toThrow(/only remaining cut/);
  });

  it("counts only the SAME project's cuts toward the last-cut refusal", async () => {
    const { ctx, repos } = await setup();
    // A second project's cuts must not make another project's only cut look
    // retirable — the refusal is project-scoped, not tenant-scoped.
    const { cuts: lonely } = await projectWithCuts(repos, ctx, 1);
    const { project: second } = await repos.videoProjects.create(ctx, { name: "other-film" });
    await repos.videoCuts.create(ctx, second.id, {
      name: "master",
      version: 1,
      edl: minimalEdl("other-v1"),
      meta: {},
    });
    await expect(repos.videoCuts.retire(ctx, lonely[0].id)).rejects.toThrow(/only remaining cut/);
  });

  it("refuses to CREATE onto a retired (name, version) — the slot is still held", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.retire(ctx, cuts[1].id);

    // Without this refusal the caller would get the RETIRED row back with its
    // OLD edl (create is idempotent, it never overwrites) and never see it.
    await expect(
      repos.videoCuts.create(ctx, project.id, {
        name: "master",
        version: 2,
        edl: minimalEdl("master-v2-again"),
        meta: {},
      }),
    ).rejects.toThrow(/retired/);
  });

  it("keeps a retired slot restorable: work continues at the NEXT version, not on top of it", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.retire(ctx, cuts[1].id);

    // This is the pair that makes retire safe. `create` refusing onto the
    // retired slot (pinned above) is exactly what guarantees no LIVING cut can
    // come to hold (master, 2) while the retired one waits — so the restore
    // below can never lose a race with a twin. Saving carries on at v3.
    const next = await repos.videoCuts.create(ctx, project.id, {
      name: "master",
      version: 3,
      edl: minimalEdl("master-v3"),
      meta: {},
    });
    expect(next.created).toBe(true);

    const { restored } = await repos.videoCuts.restore(ctx, cuts[1].id);
    expect(restored).toBe(true);
    expect(await repos.videoCuts.list(ctx, project.id)).toHaveLength(3);

    // `restore`'s own collision guard is therefore a BACKSTOP, unreachable
    // through today's doors. It is kept deliberately: it is the thing that
    // turns a raw unique-index violation into a sentence if a future writer
    // ever reaches the table another way. If this test's `create` refusal is
    // ever loosened, that guard is what stands between here and a 500.
  });

  it("walls the tenant: a stranger's retire/restore reads as absent, never as a refusal", async () => {
    const { ctx, other, repos } = await setup();
    const { cuts } = await projectWithCuts(repos, ctx, 2);
    await expect(repos.videoCuts.retire(other, cuts[1].id)).rejects.toBeInstanceOf(NotFoundError);
    await repos.videoCuts.retire(ctx, cuts[1].id);
    await expect(repos.videoCuts.restore(other, cuts[1].id)).rejects.toBeInstanceOf(NotFoundError);
    // Even the opt-in read stays behind the wall.
    expect(await repos.videoCuts.get(other, cuts[1].id, { includeRetired: true })).toBeNull();
    expect(await repos.videoCuts.list(other, cuts[1].projectId, { includeRetired: true })).toEqual(
      [],
    );
  });
});

describe("video projects retire / restore (window 0026)", () => {
  it("retires a project out of every default read and restores it whole", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 2);

    const { retired } = await repos.videoProjects.retire(ctx, project.id);
    expect(retired).toBe(true);
    expect(await repos.videoProjects.get(ctx, project.id)).toBeNull();
    expect(await repos.videoProjects.list(ctx)).toEqual([]);
    expect(await repos.videoProjects.get(ctx, project.id, { includeRetired: true })).not.toBeNull();

    // The tree left WITH it, untouched: its cuts were never stamped, so they
    // come back living the moment the project does.
    expect(await repos.videoCuts.list(ctx, project.id)).toHaveLength(2);

    const { restored } = await repos.videoProjects.restore(ctx, project.id);
    expect(restored).toBe(true);
    expect(await repos.videoProjects.list(ctx)).toHaveLength(1);

    const events = await repos.events.list(ctx, {
      entityType: "video_project",
      entityId: project.id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "video_project.created",
      "video_project.retired",
      "video_project.restored",
    ]);
  });

  it("carries NO refusals — an approved cut inside does not pin the project", async () => {
    const { ctx, repos } = await setup();
    const { project, cuts } = await projectWithCuts(repos, ctx, 2);
    await repos.videoCuts.recordRender(ctx, cuts[1].id, "renders/master-v2.mp4");
    await repos.videoCuts.approve(ctx, cuts[1].id, {
      gate: "g1-captions",
      verdict: "pass",
      lines: 0,
    });

    // Deliberate asymmetry with videoCuts.retire: a cut's refusals protect
    // things dangling INSIDE a living project, and a project takes its whole
    // tree with it. Blocking here would block the founder's actual case.
    const { retired } = await repos.videoProjects.retire(ctx, project.id);
    expect(retired).toBe(true);
  });

  it("replays repeated retire/restore as no-ops, first stamp winning", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);

    const first = await repos.videoProjects.retire(ctx, project.id);
    const again = await repos.videoProjects.retire(ctx, project.id);
    expect(again.retired).toBe(false);
    expect(again.project.retiredAt?.toISOString()).toBe(first.project.retiredAt?.toISOString());

    await repos.videoProjects.restore(ctx, project.id);
    expect((await repos.videoProjects.restore(ctx, project.id)).restored).toBe(false);

    const events = await repos.events.list(ctx, {
      entityType: "video_project",
      entityId: project.id,
    });
    expect(events.filter((e) => e.event === "video_project.retired")).toHaveLength(1);
    expect(events.filter((e) => e.event === "video_project.restored")).toHaveLength(1);
  });

  it("refuses to get-or-create onto a RETIRED project's name", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    await repos.videoProjects.retire(ctx, project.id);

    // Without this, the one-prompt runner's get-or-create would hand back a
    // project no read of the operator's can see, then mint takes into it.
    await expect(repos.videoProjects.create(ctx, { name: "concept-film" })).rejects.toThrow(
      /retired/,
    );
  });

  it("walls the tenant on both verbs and on the opt-in read", async () => {
    const { ctx, other, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    await expect(repos.videoProjects.retire(other, project.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await repos.videoProjects.retire(ctx, project.id);
    await expect(repos.videoProjects.restore(other, project.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await repos.videoProjects.get(other, project.id, { includeRetired: true })).toBeNull();
    expect(await repos.videoProjects.list(other, { includeRetired: true })).toEqual([]);
  });
});

describe("video projects rename (window 0026 — refuses, never merges)", () => {
  it("renames, and the old name becomes free to get-or-create", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);

    const { project: renamed, renamed: changed } = await repos.videoProjects.rename(
      ctx,
      project.id,
      { name: "pillar-one" },
    );
    expect(changed).toBe(true);
    expect(renamed.name).toBe("pillar-one");
    expect(renamed.id).toBe(project.id);

    const events = await repos.events.list(ctx, {
      entityType: "video_project",
      entityId: project.id,
    });
    const event = events.find((e) => e.event === "video_project.renamed");
    expect(event?.payload).toMatchObject({ from: "concept-film", to: "pillar-one" });

    const reused = await repos.videoProjects.create(ctx, { name: "concept-film" });
    expect(reused.created).toBe(true);
    expect(reused.project.id).not.toBe(project.id);
  });

  it("REFUSES a collision with a living project rather than merging two into one", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    const { project: second } = await repos.videoProjects.create(ctx, { name: "other-film" });

    // `(tenant, name)` is the get-or-create key: a merge here would mean every
    // later get-or-create for "other-film" lands in what used to be this one.
    await expect(
      repos.videoProjects.rename(ctx, project.id, { name: "other-film" }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      repos.videoProjects.rename(ctx, project.id, { name: "other-film" }),
    ).rejects.toThrow(/merge/);

    // Both survive, unchanged.
    expect((await repos.videoProjects.get(ctx, project.id))!.name).toBe("concept-film");
    expect((await repos.videoProjects.get(ctx, second.id))!.name).toBe("other-film");
  });

  it("REFUSES a collision with a RETIRED project, and says which it is", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    const { project: second } = await repos.videoProjects.create(ctx, { name: "other-film" });
    await repos.videoProjects.retire(ctx, second.id);

    // The unique index does not exempt retired rows. Letting Postgres raise
    // would surface a constraint the operator cannot see anywhere.
    await expect(
      repos.videoProjects.rename(ctx, project.id, { name: "other-film" }),
    ).rejects.toThrow(/retired/);
  });

  it("replays a rename to the SAME name as a no-op, with no event", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);

    const { renamed } = await repos.videoProjects.rename(ctx, project.id, { name: "concept-film" });
    expect(renamed).toBe(false);
    const events = await repos.events.list(ctx, {
      entityType: "video_project",
      entityId: project.id,
    });
    expect(events.filter((e) => e.event === "video_project.renamed")).toHaveLength(0);
  });

  it("trims at the door — leading whitespace must not smuggle a duplicate past the index", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    await repos.videoProjects.create(ctx, { name: "other-film" });

    await expect(
      repos.videoProjects.rename(ctx, project.id, { name: "  other-film  " }),
    ).rejects.toThrow(/other-film/);
  });

  it("refuses a blank name at the write door", async () => {
    const { ctx, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    await expect(repos.videoProjects.rename(ctx, project.id, { name: "   " })).rejects.toThrow();
  });

  it("walls the tenant: a stranger's rename reads as absent", async () => {
    const { ctx, other, repos } = await setup();
    const { project } = await projectWithCuts(repos, ctx, 1);
    await expect(
      repos.videoProjects.rename(other, project.id, { name: "stolen" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await repos.videoProjects.get(ctx, project.id))!.name).toBe("concept-film");
  });
});
