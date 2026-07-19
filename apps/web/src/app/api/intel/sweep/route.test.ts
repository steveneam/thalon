import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { createFakeEmbeddingDriver, createFakeTrendSource, runTrendSweep, type TrendItem } from "@thalon/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST: SWEEP } = await import("./route");
const { GET: TRENDS } = await import("../trends/route");
const { POST: DISMISS } = await import("../trends/[cardId]/dismiss/route");
const { POST: PROMOTE } = await import("../trends/[cardId]/promote/route");

let handle: DbHandle | undefined;
let dataDir: string | undefined;
let savedDataDir: string | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  savedDataDir = process.env.THALON_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "thalon-intel-sweep-"));
  process.env.THALON_DATA_DIR = dataDir;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
  if (savedDataDir === undefined) delete process.env.THALON_DATA_DIR;
  else process.env.THALON_DATA_DIR = savedDataDir;
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

const NOW = 1_750_000_000_000;
const AREA = { name: "AI video tooling", description: "Deterministic render pipelines for faceless channels" };
const ITEMS: TrendItem[] = [
  {
    externalId: "hot",
    url: "https://platform.test/hot",
    text: AREA.description,
    account: "alpha",
    publishedAt: NOW - 24 * 3_600_000,
    metrics: { views: 120_000, shares: 3_000, bookmarks: 5_000 },
  },
];

async function seedTenant() {
  const tenant = await repos!.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos!.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return ctx;
}

/** Persist a live bundle the routes will read — the engine service with injected keyless fakes. */
async function seedLiveSweep(ctx: { tenantId: string }) {
  await repos!.monitoredAreas.create(ctx, AREA);
  return runTrendSweep(
    ctx,
    repos!,
    { nowMs: NOW, intervalMs: 4 * 3_600_000 },
    { source: createFakeTrendSource(ITEMS), embedder: createFakeEmbeddingDriver(), capTokens: 1_000_000 },
  );
}

describe("/api/intel sweep-armed reads", () => {
  it("503s Sweep-now before a workspace profile exists, and runs the env-selected (fake, empty) source after", async () => {
    expect((await SWEEP()).status).toBe(503);

    const ctx = await seedTenant();
    const res = await SWEEP();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ source: "fake", polled: 0, cards: 0 });
    expect(typeof body.sweptAt).toBe("string");

    // Even an empty sweep arms the live read — but the stamp's "next sweep"
    // is the SCHEDULE's truth (B-arm.1): without an enabled schedule it
    // stays honestly null, never the bundle's advisory arithmetic.
    const trends = await (await TRENDS()).json();
    expect(trends.demo).toBe(false);
    expect(trends.cards).toEqual([]);
    expect(trends.sweep.nextSweepAt).toBeNull();

    // Enabling a schedule flips the stamp to the real next-sweep time.
    await repos!.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 240 });
    await repos!.sweepSchedules.markSwept(ctx, new Date());
    const scheduled = await (await TRENDS()).json();
    expect(scheduled.sweep.nextSweepAt).not.toBeNull();
    expect(scheduled.sweep.dueNow).toBe(false);
  });

  it("serves live ranked cards after a sweep — same wire shape, no dossier fabricated", async () => {
    const ctx = await seedTenant();
    await seedLiveSweep(ctx);

    const trends = await (await TRENDS()).json();
    expect(trends.demo).toBe(false);
    expect(trends.cards).toHaveLength(1);
    const card = trends.cards[0];
    expect(card).toMatchObject({
      externalId: "hot",
      areaName: AREA.name,
      isOutlier: true,
      account: "alpha",
      source: "fake",
    });
    expect(card.dossier).toBeUndefined();
    expect(card.reasons.length).toBeGreaterThan(0);
    expect(card.publishedAt).toBe(new Date(NOW - 24 * 3_600_000).toISOString());
  });

  it("dismiss and promote act on LIVE cards through the one capture door", async () => {
    const ctx = await seedTenant();
    const { bundle } = await seedLiveSweep(ctx);
    const cardId = bundle.cards[0].id;

    const promoted = await PROMOTE(
      new Request("http://localhost/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ family: "video" }),
      }),
      { params: Promise.resolve({ cardId }) },
    );
    expect(promoted.status).toBe(200);
    const { capture, createHref } = await promoted.json();
    expect(createHref).toContain("/app/create?ctx=");
    // No dossier yet → no title/angle in the payload; the raw item context still rides.
    expect(capture.payload).toMatchObject({ family: "video", externalId: "hot", areaName: AREA.name });
    expect(capture.payload.title).toBeUndefined();

    const dismissed = await DISMISS(new Request("http://localhost/dismiss", { method: "POST" }), {
      params: Promise.resolve({ cardId }),
    });
    expect(dismissed.status).toBe(200);
    const trends = await (await TRENDS()).json();
    expect(trends.cards).toEqual([]); // session-dismissed live card filters out
  });
});
