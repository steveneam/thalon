import { tenantCtx, type CreateBriefInput, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../errors";
import { sha256Hex } from "../hash";
import type { Repos } from "../repos";
import type { Draft } from "../types";
import { fixture, type Fixture } from "./helpers";

/**
 * s87 contract-window repos: the Create run ledger (B-create.1) and
 * append-only own-post metrics (D2). Every behavior test doubles as the
 * tenancy-wall proof, and each repo's event emissions are pinned here (the
 * events-coverage ratchet's per-window convention).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{
  ctx: TenantCtx;
  other: TenantCtx;
  repos: Repos;
  draft: Draft;
}> {
  fx = await fixture();
  const { repos } = fx.handle;
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), repos, draft: fx.draft };
}

async function eventNames(): Promise<string[]> {
  const rows = await fx!.handle.repos.events.list(fx!.ctx, { limit: 500 });
  return rows.map((r) => r.event);
}

const BRIEF: CreateBriefInput = {
  family: "post",
  mode: "prompt",
  prompt: "A launch note about the build step.",
};

/* ------------------------------------------------------------------ */
/* create_runs                                                          */
/* ------------------------------------------------------------------ */

describe("createRuns repo (s87 B-create.1 window)", () => {
  it("create is idempotent by generation_key — a double-clicked Generate spends once", async () => {
    const { ctx, repos } = await setup();
    const key = sha256Hex("run-key-1");
    const first = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: key,
    });
    const second = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: key,
    });
    expect(second.id).toBe(first.id);
    // The replay appended nothing to the audit spine either.
    const created = (await eventNames()).filter((e) => e === "create_run.created");
    expect(created).toHaveLength(1);
  });

  it("validates the brief at the write door — an invalid brief stores nothing", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.createRuns.create(ctx, {
        family: "post",
        mode: "prompt",
        // `prompt` must be a non-empty string when present.
        brief: { family: "post", mode: "prompt", prompt: "" } as never,
        generationKey: sha256Hex("bad-brief"),
      }),
    ).rejects.toThrow();
    expect(await repos.createRuns.list(ctx)).toHaveLength(0);
  });

  it("refuses a brief whose family contradicts the run's — one run, one family", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.createRuns.create(ctx, {
        family: "video",
        mode: "prompt",
        brief: BRIEF, // family: "post"
        generationKey: sha256Hex("mismatch"),
      }),
    ).rejects.toThrow(/contradicts/);
  });

  it("an unknown family or mode refuses at the door (the vocabulary is the contract)", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.createRuns.create(ctx, {
        family: "podcast" as never,
        mode: "prompt",
        brief: { ...BRIEF, family: "podcast" as never },
        generationKey: sha256Hex("bad-family"),
      }),
    ).rejects.toThrow();
    await expect(
      repos.createRuns.create(ctx, {
        family: "post",
        mode: "telepathy" as never,
        brief: BRIEF,
        generationKey: sha256Hex("bad-mode"),
      }),
    ).rejects.toThrow();
  });

  it("setStatus pins create_run.status_changed and no-ops on the same word", async () => {
    const { ctx, repos } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-status"),
    });
    await repos.createRuns.setStatus(ctx, run.id, "running");
    await repos.createRuns.setStatus(ctx, run.id, "running");
    const changes = (await eventNames()).filter((e) => e === "create_run.status_changed");
    expect(changes).toHaveLength(1);
    expect((await repos.createRuns.get(ctx, run.id))?.status).toBe("running");
  });

  it("recordPlan validates, replaces whole, and pins create_run.plan_recorded", async () => {
    const { ctx, repos } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-plan"),
    });
    const updated = await repos.createRuns.recordPlan(ctx, run.id, {
      platforms: [
        { platform: "bluesky", admitted: true },
        {
          platform: "instagram",
          admitted: false,
          refusal: {
            code: "media_required",
            message: "Instagram refuses text-only posts — attach an image to this run.",
          },
        },
      ],
      judgeGates: ["denylist", "grounding"],
    });
    const plan = updated.plan as { platforms: { platform: string; admitted: boolean }[] };
    expect(plan.platforms.map((p) => p.platform)).toEqual(["bluesky", "instagram"]);
    expect(await eventNames()).toContain("create_run.plan_recorded");
  });

  it("a refused platform that does not say why is unstorable (R10 made structural)", async () => {
    const { ctx, repos } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-silent-refusal"),
    });
    await expect(
      repos.createRuns.recordPlan(ctx, run.id, {
        platforms: [{ platform: "instagram", admitted: false }],
      }),
    ).rejects.toThrow(/must say why/);
    // …and the mirror image: an admitted platform cannot carry a refusal.
    await expect(
      repos.createRuns.recordPlan(ctx, run.id, {
        platforms: [
          {
            platform: "bluesky",
            admitted: true,
            refusal: { code: "unknown_platform", message: "n/a" },
          },
        ],
      }),
    ).rejects.toThrow(/cannot also carry a refusal/);
  });

  it("recordChildren records partial failure verbatim and re-recording converges", async () => {
    const { ctx, repos, draft } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-children"),
    });
    await repos.createRuns.recordChildren(ctx, run.id, [
      { kind: "draft", id: draft.id },
      { kind: "draft", id: "child-2", error: "instagram refused: media required" },
    ]);
    // The retry lands the same set — replacement, not append.
    const after = await repos.createRuns.recordChildren(ctx, run.id, [
      { kind: "draft", id: draft.id },
      { kind: "draft", id: "child-2", error: "instagram refused: media required" },
    ]);
    const children = after.children as { id: string; error?: string }[];
    expect(children).toHaveLength(2);
    expect(children[1].error).toBe("instagram refused: media required");
    expect(await eventNames()).toContain("create_run.children_recorded");
  });

  it("recordLastError pins both words — recorded and cleared", async () => {
    const { ctx, repos } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-err"),
    });
    await repos.createRuns.recordLastError(ctx, run.id, "gateway refused the call");
    expect((await repos.createRuns.get(ctx, run.id))?.lastError).toBe("gateway refused the call");
    await repos.createRuns.recordLastError(ctx, run.id, null);
    expect((await repos.createRuns.get(ctx, run.id))?.lastError).toBeNull();
    const names = await eventNames();
    expect(names).toContain("create_run.last_error_recorded");
    expect(names).toContain("create_run.last_error_cleared");
  });

  it("tenancy wall: a stranger sees nothing and cannot move the run", async () => {
    const { ctx, other, repos } = await setup();
    const run = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief: BRIEF,
      generationKey: sha256Hex("run-walled"),
    });
    expect(await repos.createRuns.get(other, run.id)).toBeNull();
    expect(await repos.createRuns.getByGenerationKey(other, sha256Hex("run-walled"))).toBeNull();
    expect(await repos.createRuns.list(other)).toHaveLength(0);
    await expect(repos.createRuns.setStatus(other, run.id, "failed")).rejects.toThrow(NotFoundError);
    await expect(repos.createRuns.recordChildren(other, run.id, [])).rejects.toThrow(NotFoundError);
    // The owner's run survived the stranger's probe untouched.
    expect((await repos.createRuns.get(ctx, run.id))?.status).toBe("pending");
  });
});

/* ------------------------------------------------------------------ */
/* publication_metrics                                                  */
/* ------------------------------------------------------------------ */

const AT = new Date("2026-08-01T10:00:00Z");
const LATER = new Date("2026-08-01T11:00:00Z");

async function publication(ctx: TenantCtx, repos: Repos, draftId: string) {
  return repos.socialPublications.record(ctx, {
    draftId,
    platform: "bluesky",
    externalPostId: "at://post/1",
    bodyHash: sha256Hex("published body"),
    publishedAt: AT,
  });
}

describe("publicationMetrics repo (s87 D2 window)", () => {
  it("append is idempotent per (publication, label, window) — a re-run tick appends nothing", async () => {
    const { ctx, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    const first = await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: AT,
    });
    expect(first.created).toBe(true);
    const replay = await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: AT,
    });
    expect(replay.created).toBe(false);
    expect(replay.row.id).toBe(first.row.id);
    expect(await repos.publicationMetrics.series(ctx, pub.id)).toHaveLength(1);
  });

  it("platform is DERIVED from the publication — a caller cannot forge it", async () => {
    const { ctx, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    const { row } = await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "reposts",
      metricValue: 3,
      capturedAt: AT,
    });
    // The input shape has no `platform` field at all; the row still carries
    // the publication's own. This is what keeps the denormalization honest.
    expect(row.platform).toBe("bluesky");
  });

  it("a later window appends a fresh point rather than updating the old one", async () => {
    const { ctx, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: AT,
    });
    await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 30,
      capturedAt: LATER,
    });
    const series = await repos.publicationMetrics.series(ctx, pub.id, { metricLabel: "likes" });
    expect(series.map((r) => r.metricValue)).toEqual([12, 30]);
    const latest = await repos.publicationMetrics.latestPerLabel(ctx, pub.id);
    expect(latest.likes.metricValue).toBe(30);
  });

  it("ABSENCE, NEVER ZERO: an unreported metric has no row and no invented value", async () => {
    const { ctx, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    // Bluesky reports likes/reposts/replies and NOT impressions. The tick
    // writes what it got; the gap stays a gap all the way to the surface.
    await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: AT,
    });
    const latest = await repos.publicationMetrics.latestPerLabel(ctx, pub.id);
    expect(Object.keys(latest)).toEqual(["likes"]);
    expect(latest.impressions).toBeUndefined();
    expect(
      await repos.publicationMetrics.series(ctx, pub.id, { metricLabel: "impressions" }),
    ).toHaveLength(0);
  });

  it("tenancy wall: a stranger's append onto our publication is NotFound, not a write", async () => {
    const { ctx, other, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    await expect(
      repos.publicationMetrics.append(other, {
        publicationId: pub.id,
        metricLabel: "likes",
        metricValue: 999,
        capturedAt: AT,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(await repos.publicationMetrics.series(ctx, pub.id)).toHaveLength(0);
    expect(await repos.publicationMetrics.series(other, pub.id)).toHaveLength(0);
  });

  it("the per-channel roll-up reads only this tenant's rows since the cutoff", async () => {
    const { ctx, other, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: LATER,
    });
    expect(await repos.publicationMetrics.listForPlatform(ctx, "bluesky", AT)).toHaveLength(1);
    // A window that starts after the capture excludes it.
    expect(
      await repos.publicationMetrics.listForPlatform(ctx, "bluesky", new Date("2026-08-02T00:00:00Z")),
    ).toHaveLength(0);
    expect(await repos.publicationMetrics.listForPlatform(other, "bluesky", AT)).toHaveLength(0);
  });

  it("metric appends emit NO events, by design (the source_metrics precedent)", async () => {
    const { ctx, repos, draft } = await setup();
    const pub = await publication(ctx, repos, draft.id);
    const before = await eventNames();
    await repos.publicationMetrics.append(ctx, {
      publicationId: pub.id,
      metricLabel: "likes",
      metricValue: 12,
      capturedAt: AT,
    });
    // A measurement of the outside world is not a state change the operator
    // reconstructs; auditing every tick would bury the spine in noise. The
    // audited fact is the publication itself (`social.published`, above).
    expect(await eventNames()).toEqual(before);
  });
});
