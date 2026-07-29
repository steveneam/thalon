import { FINAL_JUDGE_GATE, tenantCtx, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos, type SocialPublicationRow } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { analyticsReadModel } from "../read-model";

/**
 * D2 (s87): the Analytics read-model. Every assertion here is one of the
 * sheet's honesty rules, made executable — because each of them is a way the
 * surface could start lying if this file were "simplified" later:
 *
 *   · a platform with no metrics API says so IN WORDS, never a 0 that reads real;
 *   · the roll-up is drawn ONLY over the platforms that report, and SAYS which;
 *   · a row with no metrics gets no sparkline — never a flat line at zero,
 *     because a flat line reads as "measured, and it was nothing";
 *   · every number carries its as-of.
 */

const NOW = new Date(Date.UTC(2026, 6, 29, 14, 38));
const IN_WINDOW = new Date(Date.UTC(2026, 6, 22, 9, 0));
const PREVIOUS_WINDOW = new Date(Date.UTC(2026, 5, 20, 9, 0));
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
    contentHash: sha256Hex("read-model brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("rm-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["bluesky"],
    promptVersion: "fanout-generate.v2",
    model: "test/model",
    generationKey: `${ctx.tenantId}:rm-run`,
  });
  return { ctx, repos, runId: run.id, sourceId: source.id, seq: { n: 0 } };
}

async function publication(
  f: Fixture,
  platform: SocialPlatform,
  publishedAt: Date = IN_WINDOW,
): Promise<SocialPublicationRow> {
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform,
    body: BODY,
    format: "post",
    generationKey: `${f.ctx.tenantId}:rm-draft-${f.seq.n++}`,
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
    publishedAt,
  });
}

async function metric(
  f: Fixture,
  publicationId: string,
  metricLabel: string,
  metricValue: number,
  capturedAt: Date,
): Promise<void> {
  await f.repos.publicationMetrics.append(f.ctx, {
    publicationId,
    metricLabel,
    metricValue,
    capturedAt,
  });
}

describe("analyticsReadModel — the honesty rules", () => {
  it("a platform with no audience API gets the REASON, never a zero", async () => {
    const f = await setup();
    const pub = await publication(f, "bluesky");
    await metric(f, pub.id, "likes", 147, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    const row = model.posts[0];

    expect(row.audience.value).toBeNull();
    expect(row.audience.reason).toContain("no impressions in the API");
    expect(row.audience.absence).toBe("structural");
    // Its engagement, meanwhile, is entirely real — the sheet's exact split.
    expect(row.engagement.value).toBe(147);
    expect(row.engagement.parts).toEqual([
      { label: "likes", value: 147, platformField: "likeCount" },
    ]);
  });

  it("LinkedIn reads 'partner-gated' in BOTH columns — gated, not merely unmeasured", async () => {
    const f = await setup();
    await publication(f, "linkedin");

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    const row = model.posts[0];

    expect(row.audience.value).toBeNull();
    expect(row.engagement.value).toBeNull();
    expect(row.audience.reason).toContain("partner-gated");
    expect(row.engagement.reason).toContain("partner-gated");
    expect(row.audience.absence).toBe("gated");
  });

  it("a measurable platform with no rows YET is 'not_collected' — a different sentence with a different fix", async () => {
    const f = await setup();
    await publication(f, "instagram");

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.posts[0].audience.absence).toBe("not_collected");
    expect(model.posts[0].audience.reason).toContain("has not measured it");
  });

  it("a measured ZERO is a number, not an absence", async () => {
    const f = await setup();
    const pub = await publication(f, "instagram");
    await metric(f, pub.id, "reach", 0, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.posts[0].audience.value).toBe(0);
    expect(model.posts[0].audience.reason).toBeUndefined();
  });

  it("a row with nothing measured gets NO sparkline — never a flat line at zero", async () => {
    const f = await setup();
    await publication(f, "bluesky");
    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.posts[0].trend).toBeNull();
  });

  it("the sparkline follows the audience series where there is one, and engagement where there is not", async () => {
    const f = await setup();
    const ig = await publication(f, "instagram");
    const bsky = await publication(f, "bluesky");
    const earlier = new Date(NOW.getTime() - 60 * 60_000);
    await metric(f, ig.id, "reach", 400, earlier);
    await metric(f, ig.id, "reach", 640, NOW);
    await metric(f, ig.id, "likes", 20, NOW);
    await metric(f, bsky.id, "likes", 9, earlier);
    await metric(f, bsky.id, "likes", 12, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    const igRow = model.posts.find((p) => p.publicationId === ig.id);
    const bskyRow = model.posts.find((p) => p.publicationId === bsky.id);

    expect(igRow?.trend?.label).toBe("reach");
    expect(igRow?.trend?.points.map((p) => p.value)).toEqual([400, 640]);
    // Bluesky has no audience number at all, so its line is its engagement.
    expect(bskyRow?.trend?.label).toBe("likes");
    expect(bskyRow?.trend?.points.map((p) => p.value)).toEqual([9, 12]);
  });

  it("the newest point per label wins — the cell is current, the trend is the whole history", async () => {
    const f = await setup();
    const pub = await publication(f, "instagram");
    await metric(f, pub.id, "reach", 400, new Date(NOW.getTime() - 60 * 60_000));
    await metric(f, pub.id, "reach", 640, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.posts[0].audience.value).toBe(640);
    expect(model.posts[0].audience.asOf?.toISOString()).toBe(NOW.toISOString());
    expect(model.posts[0].trend?.points).toHaveLength(2);
  });

  it("engagement sums the engagement family and NEVER a quality ratio", async () => {
    const f = await setup();
    const pub = await publication(f, "reddit");
    await metric(f, pub.id, "score", 42, NOW);
    await metric(f, pub.id, "comments", 7, NOW);
    await metric(f, pub.id, "upvote_ratio", 0.93, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    // 42 + 7 — the ratio is a real number the surface can still read from the
    // series, but no sum may ever pick it up.
    expect(model.posts[0].engagement.value).toBe(49);
    // Parts follow the capability matrix's declared order — deterministic,
    // so the surface's provenance list never reshuffles between reads.
    expect(model.posts[0].engagement.parts.map((p) => p.label)).toEqual(["score", "comments"]);
  });
});

describe("analyticsReadModel — the tiles", () => {
  it("the audience total names who is IN it and who is not, with each one's reason", async () => {
    const f = await setup();
    const ig = await publication(f, "instagram");
    const fb = await publication(f, "facebook");
    const bsky = await publication(f, "bluesky");
    await metric(f, ig.id, "reach", 4980, NOW);
    await metric(f, fb.id, "reach", 6410, NOW);
    await metric(f, bsky.id, "likes", 147, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);

    expect(model.audience.value).toBe(11390);
    expect(model.audience.platformsReporting).toEqual(["facebook", "instagram"]);
    expect(model.audience.platformsNotReporting.map((p) => p.platform)).toEqual(["bluesky"]);
    expect(model.audience.platformsNotReporting[0].reason).toContain("no impressions in the API");
    // The engagement tile includes Bluesky, because Bluesky's engagement IS real.
    expect(model.engagement.platformsReporting).toContain("bluesky");
  });

  it("a tile with nothing measured is null, not 0 — and lists why", async () => {
    const f = await setup();
    await publication(f, "linkedin");
    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);

    expect(model.audience.value).toBeNull();
    expect(model.audience.delta).toBeNull();
    expect(model.audience.deltaPct).toBeNull();
    expect(model.audience.platformsReporting).toEqual([]);
    expect(model.audience.platformsNotReporting[0].permanence).toBe("gated");
  });

  it("the published count comes from OUR OWN rows, so it is always complete", async () => {
    const f = await setup();
    await publication(f, "bluesky", IN_WINDOW);
    await publication(f, "linkedin", IN_WINDOW);
    await publication(f, "bluesky", PREVIOUS_WINDOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.published).toEqual({ count: 2, previous: 1, delta: 1 });
  });

  it("compares against the preceding window of equal length", async () => {
    const f = await setup();
    const now = await publication(f, "instagram", IN_WINDOW);
    const before = await publication(f, "instagram", PREVIOUS_WINDOW);
    await metric(f, now.id, "reach", 1200, NOW);
    await metric(f, before.id, "reach", 1000, PREVIOUS_WINDOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.audience.value).toBe(1200);
    expect(model.audience.previous).toBe(1000);
    expect(model.audience.delta).toBe(200);
    expect(model.audience.deltaPct).toBeCloseTo(20);
  });

  it("a move from nothing is not a percentage", async () => {
    const f = await setup();
    const now = await publication(f, "instagram", IN_WINDOW);
    const before = await publication(f, "instagram", PREVIOUS_WINDOW);
    await metric(f, now.id, "reach", 1200, NOW);
    await metric(f, before.id, "reach", 0, PREVIOUS_WINDOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    expect(model.audience.previous).toBe(0);
    expect(model.audience.delta).toBe(1200);
    expect(model.audience.deltaPct).toBeNull();
  });
});

describe("analyticsReadModel — channels and bounds", () => {
  it("rolls up per channel, keeping the platform's own absence sentence", async () => {
    const f = await setup();
    const a = await publication(f, "bluesky");
    const b = await publication(f, "bluesky");
    await metric(f, a.id, "likes", 10, NOW);
    await metric(f, b.id, "likes", 5, NOW);

    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, {}, NOW);
    const channel = model.channels.find((c) => c.platform === "bluesky");

    expect(channel?.published).toBe(2);
    expect(channel?.engagement.value).toBe(15);
    expect(channel?.reportsAudience).toBe(false);
    expect(channel?.audience.value).toBeNull();
    expect(channel?.audience.reason).toContain("no impressions in the API");
  });

  it("states the bound rather than reading as 'everything'", async () => {
    const f = await setup();
    await publication(f, "bluesky");
    await publication(f, "bluesky");
    const model = await analyticsReadModel({ repos: f.repos, ctx: f.ctx }, { limit: 1 }, NOW);
    expect(model.bound.totalPublications).toBe(2);
    expect(model.bound.truncated).toBe(true);
  });

  it("is tenant-walled", async () => {
    const f = await setup();
    const pub = await publication(f, "bluesky");
    await metric(f, pub.id, "likes", 10, NOW);
    const other = await f.repos.tenants.create({ slug: "other", name: "Other" });

    const model = await analyticsReadModel(
      { repos: f.repos, ctx: tenantCtx(other.id) },
      {},
      NOW,
    );
    expect(model.posts).toEqual([]);
    expect(model.published.count).toBe(0);
  });
});
