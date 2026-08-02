import { FINAL_JUDGE_GATE, tenantCtx, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Analytics read route: read-only GET over the engine's read-model —
 * null-ctx guard, the windowDays knob, and the wire truth (ISO dates,
 * capability-verbatim provenance). The honesty semantics themselves are the
 * engine suite's (read-model.test.ts); this exercises the route's own seam.
 * Every metric row is an injected fake — no reader runs, nothing is armed.
 */

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");

let handle: DbHandle | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  runId: string;
  sourceId: string;
  seq: { n: number };
}

/** The engine read-model suite's fixture chain, trimmed: tenant `self` (what resolveTenantCtx resolves) → profile → source → run. */
async function seedSelf(): Promise<Fixture> {
  const r = repos!;
  const tenant = await r.tenants.create({ slug: "self", name: "Demo Studio" });
  const ctx = tenantCtx(tenant.id);
  const profile = await r.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: { company: "Thalon", links: { site: "https://thalon.example" } },
    },
    activate: true,
  });
  const { source } = await r.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("analytics route brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("ar-0") }],
  });
  const run = await r.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["facebook"],
    promptVersion: "fanout-generate.v2",
    model: "test/model",
    generationKey: `${ctx.tenantId}:ar-run`,
  });
  return { ctx, runId: run.id, sourceId: source.id, seq: { n: 0 } };
}

async function publication(f: Fixture, platform: SocialPlatform, publishedAt: Date): Promise<string> {
  const r = repos!;
  const draft = await r.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform,
    body: "A short, fitting post about local work.",
    format: "post",
    generationKey: `${f.ctx.tenantId}:ar-draft-${f.seq.n++}`,
    meta: {},
  });
  await r.drafts.transition(f.ctx, draft.id, "judging");
  await r.judgeResults.append(f.ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await r.drafts.transition(f.ctx, draft.id, "queued");
  const approved = await r.drafts.transition(f.ctx, draft.id, "approved");
  const row = await r.socialPublications.record(f.ctx, {
    draftId: approved.id,
    platform,
    externalPostId: `ext-${platform}-${f.seq.n}`,
    bodyHash: approved.bodyHash,
    publishedAt,
  });
  return row.id;
}

function req(query = ""): Request {
  return new Request(`http://test/api/analytics${query}`);
}

describe("GET /api/analytics", () => {
  it("answers { model: null } when no tenant is seeded — the surface's honest first-run state", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ model: null });
  });

  it("serves the read-model with capability-verbatim provenance and ISO dates", async () => {
    const f = await seedSelf();
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    const pubId = await publication(f, "facebook", daysAgo(3));
    await repos!.publicationMetrics.append(f.ctx, {
      publicationId: pubId,
      metricLabel: "reach",
      metricValue: 6410,
      capturedAt: daysAgo(1),
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const { model } = await res.json();

    expect(model.bound.windowDays).toBe(28);
    expect(model.published.count).toBe(1);
    expect(model.posts).toHaveLength(1);
    const post = model.posts[0];
    expect(post.audience.value).toBe(6410);
    // The platform's own field name travels as provenance — the surface renders it verbatim.
    expect(post.audience.parts[0].platformField).toBe("post_total_media_view_unique");
    // Dates cross the wire as ISO strings.
    expect(typeof post.publishedAt).toBe("string");
    expect(new Date(post.publishedAt).toISOString()).toBe(post.publishedAt);
    expect(model.audience.platformsReporting).toEqual(["facebook"]);
  });

  it("honours ?windowDays — a 20-day-old post is outside a 7-day window", async () => {
    const f = await seedSelf();
    await publication(f, "facebook", new Date(Date.now() - 20 * 86_400_000));

    const wide = await (await GET(req())).json();
    expect(wide.model.posts).toHaveLength(1);

    const narrow = await (await GET(req("?windowDays=7"))).json();
    expect(narrow.model.bound.windowDays).toBe(7);
    expect(narrow.model.posts).toHaveLength(0);
  });

  it("refuses a malformed windowDays loudly — never a quiet default", async () => {
    for (const bad of ["0", "-3", "3.5", "banana", "9000"]) {
      const res = await GET(req(`?windowDays=${bad}`));
      expect(res.status).toBe(400);
    }
  });
});
