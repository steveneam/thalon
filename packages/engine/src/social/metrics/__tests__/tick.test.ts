import { FINAL_JUDGE_GATE, tenantCtx, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos, type SocialPublicationRow } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { SocialMetricsGatedError, SocialMetricsPermissionError } from "../errors";
import {
  createFakeSocialMetricsReader,
  refusingSocialMetricsReader,
  resolveSocialMetricsReader,
  type SocialMetricsReader,
} from "../registry";
import { collectPublicationMetrics, metricsWindowStart } from "../tick";

/**
 * D2 (s87): the metrics collection tick. Four things are load-bearing and all
 * four are tested as invariants rather than as behaviour:
 *
 *   1. DISARMED MEANS DISARMED — a pass reads and reports, reaching no
 *      platform and writing no row.
 *   2. ABSENCE IS NEVER ZERO — a label the platform did not answer produces
 *      no row at all, and the surface's honesty rests entirely on that.
 *   3. IDEMPOTENT PER BUCKET — a re-run inside the same window appends
 *      nothing, so a retried collection is free rather than a duplicate series.
 *   4. ONE PUBLICATION'S REFUSAL NEVER COSTS THE OTHERS THEIR NUMBERS.
 */

const NOW = new Date(Date.UTC(2026, 6, 29, 14, 38));
const PUBLISHED = new Date(Date.UTC(2026, 6, 27, 9, 0));
const BODY = "A short, fitting post about local work.";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  repos: Repos;
  runId: string;
  sourceId: string;
  seq: { n: number };
}

async function setup(): Promise<Fixture> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: { company: "Thalon", links: { site: "https://thalon.example" } },
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("metrics brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("metrics-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["bluesky"],
    promptVersion: "fanout-generate.v2",
    model: "test/model",
    generationKey: `${ctx.tenantId}:metrics-run`,
  });
  return { ctx, repos, runId: run.id, sourceId: source.id, seq: { n: 0 } };
}

/** One recorded publication, straight through the real ledger repo. */
async function publication(
  f: Fixture,
  opts: { platform?: SocialPlatform; publishedAt?: Date } = {},
): Promise<SocialPublicationRow> {
  const platform = opts.platform ?? "bluesky";
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform,
    body: BODY,
    format: "post",
    generationKey: `${f.ctx.tenantId}:metrics-draft-${f.seq.n++}`,
    meta: {},
  });
  await f.repos.drafts.transition(f.ctx, draft.id, "judging");
  await f.repos.judgeResults.append(f.ctx, {
    draftId: draft.id,
    gate: FINAL_JUDGE_GATE,
    verdict: "pass",
  });
  await f.repos.drafts.transition(f.ctx, draft.id, "queued");
  const approved = await f.repos.drafts.transition(f.ctx, draft.id, "approved");
  return f.repos.socialPublications.record(f.ctx, {
    draftId: approved.id,
    platform,
    externalPostId: `ext-${platform}-${f.seq.n}`,
    bodyHash: approved.bodyHash,
    publishedAt: opts.publishedAt ?? PUBLISHED,
  });
}

function resolver(map: Partial<Record<SocialPlatform, SocialMetricsReader>>) {
  return (platform: SocialPlatform): SocialMetricsReader => {
    const reader = map[platform];
    if (!reader) throw new Error(`test wired no reader for ${platform}`);
    return reader;
  };
}

describe("metricsWindowStart (the idempotency key's third member)", () => {
  it("floors the clock to the bucket, so a replay is byte-identical", () => {
    expect(metricsWindowStart(NOW, 60).toISOString()).toBe("2026-07-29T14:00:00.000Z");
    expect(metricsWindowStart(new Date(Date.UTC(2026, 6, 29, 14, 59, 59)), 60).toISOString()).toBe(
      "2026-07-29T14:00:00.000Z",
    );
    // A different bucket size is a different — still deterministic — grid.
    expect(metricsWindowStart(NOW, 15).toISOString()).toBe("2026-07-29T14:30:00.000Z");
  });
});

describe("collectPublicationMetrics — DISARMED, the shipped posture", () => {
  it("reports what it would measure and touches NOTHING", async () => {
    const f = await setup();
    const pub = await publication(f);
    const reader = createFakeSocialMetricsReader({ platform: "bluesky" });

    const result = await collectPublicationMetrics({ repos: f.repos, ctx: f.ctx }, NOW);

    expect(result.armed).toBe(false);
    expect(result.candidates.map((c) => c.publicationId)).toEqual([pub.id]);
    expect(result.measured).toEqual([]);
    // No reader was even resolved, let alone called.
    expect(reader.calls).toEqual([]);
    const series = await f.repos.publicationMetrics.series(f.ctx, pub.id);
    expect(series).toEqual([]);
  });

  it("prices the pass BEFORE it runs — the deferred platform prints the RULING while disarmed, and is not billed as metered", async () => {
    const f = await setup();
    await publication(f, { platform: "x" });
    const result = await collectPublicationMetrics({ repos: f.repos, ctx: f.ctx }, NOW);
    // X sits under the standing founder deferral, so it reports in `deferred`
    // INSTEAD of `metered`: nothing will be billed, and saying "this pass
    // will bill" would be false. Lifting the deferral (a diff in deferral.ts)
    // puts X back in `metered` — the branch is dormant, not dead.
    expect(result.metered).toEqual([]);
    expect(result.deferred).toEqual([
      {
        platform: "x",
        ruling: expect.stringContaining("only be paid once thalon is ready to launch"),
      },
    ]);
  });

  it("an ARMED pass with no reader seam refuses to run at all — before it reads a single row", async () => {
    const f = await setup();
    await publication(f);
    await expect(
      collectPublicationMetrics({ repos: f.repos, ctx: f.ctx, armed: true }, NOW),
    ).rejects.toThrow(/no resolveReader was wired/);
  });
});

describe("collectPublicationMetrics — ARMED", () => {
  it("appends exactly what the platform answered, and NOTHING for what it did not", async () => {
    const f = await setup();
    const pub = await publication(f);
    const reader = createFakeSocialMetricsReader({
      platform: "bluesky",
      samples: [
        { label: "likes", value: 12, platformField: "likeCount" },
        { label: "reposts", value: 0, platformField: "repostCount" },
      ],
      unavailable: [{ label: "reach", reason: "no impressions in the API" }],
    });

    const result = await collectPublicationMetrics(
      { repos: f.repos, ctx: f.ctx, armed: true, resolveReader: resolver({ bluesky: reader }) },
      NOW,
    );

    expect(result.measured).toHaveLength(1);
    expect(result.measured[0].appended).toBe(2);
    expect(result.measured[0].labels).toEqual(["likes", "reposts"]);

    const series = await f.repos.publicationMetrics.series(f.ctx, pub.id);
    // Compared as a SET on purpose: `series` orders by `(captured_at, id)`
    // and `id` is a random uuid, so two labels written into the SAME bucket
    // come back in an arbitrary order. Harmless for every reader built here
    // (the read-model groups by label before it reads anything), but an
    // order-dependent assertion would be flaky rather than true.
    expect(new Set(series.map((r) => `${r.metricLabel}=${r.metricValue}`))).toEqual(
      new Set(["likes=12", "reposts=0"]),
    );
    // THE RULE: the unreported label has no row. Not a 0 — no row.
    expect(series.some((r) => r.metricLabel === "reach")).toBe(false);
    // A measured zero, meanwhile, IS recorded — the two are different facts.
    expect(series.find((r) => r.metricLabel === "reposts")?.metricValue).toBe(0);
    // Every row carries the bucket, not the raw clock.
    expect(series.every((r) => r.capturedAt.getTime() === result.capturedAt.getTime())).toBe(true);
  });

  it("the platform's own row decides the metric's platform — the tick never asserts one", async () => {
    const f = await setup();
    const pub = await publication(f, { platform: "reddit" });
    const reader = createFakeSocialMetricsReader({
      platform: "reddit",
      samples: [{ label: "score", value: 42, platformField: "score" }],
    });
    await collectPublicationMetrics(
      { repos: f.repos, ctx: f.ctx, armed: true, resolveReader: resolver({ reddit: reader }) },
      NOW,
    );
    const series = await f.repos.publicationMetrics.series(f.ctx, pub.id);
    expect(series[0].platform).toBe("reddit");
  });

  it("re-running inside the same bucket appends nothing — a retried collection is free", async () => {
    const f = await setup();
    const pub = await publication(f);
    const deps = {
      repos: f.repos,
      ctx: f.ctx,
      armed: true,
      resolveReader: resolver({
        bluesky: createFakeSocialMetricsReader({
          platform: "bluesky",
          samples: [{ label: "likes", value: 12, platformField: "likeCount" }],
        }),
      }),
    };

    const first = await collectPublicationMetrics(deps, NOW);
    // 21 minutes later — same hour, same bucket.
    const second = await collectPublicationMetrics(deps, new Date(NOW.getTime() + 21 * 60_000));

    expect(first.measured[0].appended).toBe(1);
    expect(second.measured[0].appended).toBe(0);
    expect(second.measured[0].replayed).toBe(1);
    expect(await f.repos.publicationMetrics.series(f.ctx, pub.id)).toHaveLength(1);
  });

  it("the NEXT bucket appends a new point — the series moves, it does not overwrite", async () => {
    const f = await setup();
    const pub = await publication(f);
    const makeDeps = (likes: number) => ({
      repos: f.repos,
      ctx: f.ctx,
      armed: true,
      resolveReader: resolver({
        bluesky: createFakeSocialMetricsReader({
          platform: "bluesky",
          samples: [{ label: "likes", value: likes, platformField: "likeCount" }],
        }),
      }),
    });

    await collectPublicationMetrics(makeDeps(12), NOW);
    await collectPublicationMetrics(makeDeps(19), new Date(NOW.getTime() + 60 * 60_000));

    const series = await f.repos.publicationMetrics.series(f.ctx, pub.id);
    expect(series.map((r) => r.metricValue)).toEqual([12, 19]);
  });

  it("a typed refusal is recorded as a REFUSAL, with its permanence, and never as a failure", async () => {
    const f = await setup();
    const pub = await publication(f, { platform: "linkedin" });
    const gated = refusingSocialMetricsReader(
      "linkedin",
      new SocialMetricsGatedError("linkedin", "partner-gated — Community Management API"),
    );

    const result = await collectPublicationMetrics(
      { repos: f.repos, ctx: f.ctx, armed: true, resolveReader: resolver({ linkedin: gated }) },
      NOW,
    );

    expect(result.failed).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0].publicationId).toBe(pub.id);
    expect(result.refused[0].permanence).toBe("gated");
    expect(result.refused[0].reason).toContain("partner-gated");
    expect(await f.repos.publicationMetrics.series(f.ctx, pub.id)).toEqual([]);
  });

  it("an ARMED pass through the REAL ratchet reads every other platform and spends NOTHING on X — each X publication a typed refusal, never a silent skip", async () => {
    const f = await setup();
    const bsky = await publication(f, { platform: "bluesky" });
    const xPub = await publication(f, { platform: "x" });
    let xFactoryCalls = 0;
    // The production shape: the ratchet resolves per platform, with perfect
    // credentials for BOTH — proving it is the standing deferral refusing X,
    // not a missing seat.
    const resolveReader = (platform: SocialPlatform) =>
      resolveSocialMetricsReader(
        platform,
        {
          SOCIAL_BLUESKY_ACCESS_TOKEN: "app-password",
          SOCIAL_X_ACCESS_TOKEN: "a-perfectly-good-token",
        },
        {
          bluesky: () =>
            createFakeSocialMetricsReader({
              platform: "bluesky",
              samples: [{ label: "likes", value: 7, platformField: "likeCount" }],
            }),
          x: () => {
            xFactoryCalls += 1;
            return createFakeSocialMetricsReader({ platform: "x" });
          },
        },
      );

    const result = await collectPublicationMetrics(
      { repos: f.repos, ctx: f.ctx, armed: true, resolveReader },
      NOW,
    );

    // Bluesky read normally.
    expect(result.measured.map((m) => m.publicationId)).toEqual([bsky.id]);
    // X refused PER PUBLICATION, typed, with the ruling — not failed, not skipped.
    expect(result.failed).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0].publicationId).toBe(xPub.id);
    expect(result.refused[0].refusal).toBe("deferred_on_cost");
    expect(result.refused[0].permanence).toBe("deferred");
    expect(result.refused[0].reason).toContain("only be paid once thalon is ready to launch");
    // Nothing was spent: the X reader was never even assembled, and no row landed.
    expect(xFactoryCalls).toBe(0);
    expect(await f.repos.publicationMetrics.series(f.ctx, xPub.id)).toEqual([]);
    // The bill print's facts, armed: deferred with the ruling, not metered.
    expect(result.metered).toEqual([]);
    expect(result.deferred.map((d) => d.platform)).toEqual(["x"]);
  });

  it("one publication's failure never blocks the others — the batch finishes", async () => {
    const f = await setup();
    const good = await publication(f, { platform: "bluesky" });
    const bad = await publication(f, { platform: "reddit" });

    const result = await collectPublicationMetrics(
      {
        repos: f.repos,
        ctx: f.ctx,
        armed: true,
        resolveReader: resolver({
          bluesky: createFakeSocialMetricsReader({
            platform: "bluesky",
            samples: [{ label: "likes", value: 5, platformField: "likeCount" }],
          }),
          reddit: createFakeSocialMetricsReader({
            platform: "reddit",
            failWith: new Error("reddit is having a day"),
          }),
        }),
      },
      NOW,
    );

    expect(result.measured.map((m) => m.publicationId)).toEqual([good.id]);
    expect(result.failed.map((x) => x.publicationId)).toEqual([bad.id]);
    // VERBATIM — the operator needs the platform's own sentence.
    expect(result.failed[0].reason).toBe("reddit is having a day");
    expect(await f.repos.publicationMetrics.series(f.ctx, good.id)).toHaveLength(1);
  });

  it("a permission refusal is separated from an outage — different fix, different bucket in the report", async () => {
    const f = await setup();
    await publication(f, { platform: "instagram" });
    const result = await collectPublicationMetrics(
      {
        repos: f.repos,
        ctx: f.ctx,
        armed: true,
        resolveReader: resolver({
          instagram: createFakeSocialMetricsReader({
            platform: "instagram",
            failWith: new SocialMetricsPermissionError("instagram", 400, "(#10) needs insights"),
          }),
        }),
      },
      NOW,
    );
    expect(result.failed).toEqual([]);
    expect(result.refused[0].permanence).toBe("permissioned");
    expect(result.refused[0].refusal).toBe("permission_missing");
  });

  it("only publications inside the window are measured — an old post is not re-read for nothing", async () => {
    const f = await setup();
    const recent = await publication(f, { publishedAt: PUBLISHED });
    await publication(f, { publishedAt: new Date(Date.UTC(2026, 3, 1)) });

    const result = await collectPublicationMetrics(
      {
        repos: f.repos,
        ctx: f.ctx,
        armed: true,
        windowDays: 30,
        resolveReader: resolver({
          bluesky: createFakeSocialMetricsReader({ platform: "bluesky" }),
        }),
      },
      NOW,
    );

    expect(result.candidates.map((c) => c.publicationId)).toEqual([recent.id]);
    expect(result.measured).toHaveLength(1);
  });

  it("states its own bound rather than reading as 'everything'", async () => {
    const f = await setup();
    await publication(f);
    await publication(f);
    const result = await collectPublicationMetrics(
      { repos: f.repos, ctx: f.ctx, limit: 1 },
      NOW,
    );
    expect(result.bound).toEqual({
      limit: 1,
      windowDays: 30,
      totalPublications: 2,
      truncated: true,
    });
  });

  it("is tenant-walled: another tenant's publications are neither read nor written", async () => {
    const f = await setup();
    const mine = await publication(f);
    const other = await f.repos.tenants.create({ slug: "other", name: "Other" });
    const otherCtx = tenantCtx(other.id);

    const result = await collectPublicationMetrics(
      {
        repos: f.repos,
        ctx: otherCtx,
        armed: true,
        resolveReader: resolver({
          bluesky: createFakeSocialMetricsReader({ platform: "bluesky" }),
        }),
      },
      NOW,
    );

    expect(result.candidates).toEqual([]);
    expect(await f.repos.publicationMetrics.series(f.ctx, mine.id)).toEqual([]);
  });

  it("appends NO events — a measurement is not a state change (the source_metrics precedent)", async () => {
    const f = await setup();
    const pub = await publication(f);
    await collectPublicationMetrics(
      {
        repos: f.repos,
        ctx: f.ctx,
        armed: true,
        resolveReader: resolver({
          bluesky: createFakeSocialMetricsReader({ platform: "bluesky" }),
        }),
      },
      NOW,
    );
    const events = await f.repos.events.list(f.ctx, { entityType: "publication_metric" });
    expect(events).toEqual([]);
    // The publication's own audit trail is untouched by measuring it.
    const pubEvents = await f.repos.events.list(f.ctx, {
      entityType: "social_publication",
      entityId: pub.id,
    });
    expect(pubEvents.map((e) => e.event)).toEqual(["social.published"]);
  });
});
