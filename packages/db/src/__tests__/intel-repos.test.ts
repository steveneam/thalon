import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import { NotFoundError } from "../errors";
import type { Repos } from "../repos";

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

describe("watchlists repo (B4.3)", () => {
  it("creates tenant-scoped runtime config, lists by driver, updates with a fresh updatedAt — all audited", async () => {
    const { ctx, other, repos } = await setup();
    const created = await repos.watchlists.create(ctx, {
      source: "youtube",
      accounts: ["@maker"],
      queries: ["build in public"],
    });
    expect(created.tenantId).toBe(ctx.tenantId);
    expect(await repos.watchlists.get(other, created.id)).toBeNull(); // tenancy wall

    const updated = await repos.watchlists.update(ctx, created.id, { accounts: ["@maker", "@peer"] });
    expect(updated.accounts).toEqual(["@maker", "@peer"]);
    expect(updated.queries).toEqual(["build in public"]);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

    expect(await repos.watchlists.listBySource(ctx, "youtube")).toHaveLength(1);
    expect(await repos.watchlists.listBySource(ctx, "bluesky")).toHaveLength(0);

    await expect(
      repos.watchlists.update(other, created.id, { queries: ["steal"] }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const events = await repos.events.list(ctx, { entityType: "watchlist", entityId: created.id });
    expect(events.map((e) => e.event)).toEqual(["watchlist.created", "watchlist.updated"]);
  });
});

describe("trend snapshots repo (B4.3)", () => {
  it("appends idempotently on (tenant, source, item, capturedAt), reads back in capture order, audits creations only", async () => {
    const { ctx, other, repos } = await setup();
    const base = {
      source: "youtube",
      externalId: "vid-1",
      account: "@maker",
      publishedAt: new Date("2026-07-01T00:00:00Z"),
      metrics: { views: 100 },
    };
    const t1 = new Date("2026-07-05T00:00:00Z");
    const t2 = new Date("2026-07-05T01:00:00Z");

    const first = await repos.trendSnapshots.append(ctx, { ...base, capturedAt: t1 });
    expect(first.created).toBe(true);
    const replay = await repos.trendSnapshots.append(ctx, { ...base, metrics: { views: 999 }, capturedAt: t1 });
    expect(replay.created).toBe(false);
    expect(replay.snapshot.id).toBe(first.snapshot.id);
    expect(replay.snapshot.metrics).toEqual({ views: 100 }); // history rows are never rewritten

    const second = await repos.trendSnapshots.append(ctx, { ...base, metrics: { views: 400 }, capturedAt: t2 });
    expect(second.created).toBe(true);

    const history = await repos.trendSnapshots.listByItem(ctx, { source: "youtube", externalId: "vid-1" });
    expect(history.map((s) => s.capturedAt.getTime())).toEqual([t1.getTime(), t2.getTime()]);

    // Same item key under ANOTHER tenant is a separate history (tenant-salted unique index).
    const foreign = await repos.trendSnapshots.append(other, { ...base, capturedAt: t1 });
    expect(foreign.created).toBe(true);
    expect(await repos.trendSnapshots.listByAccount(other, { source: "youtube", account: "@maker" })).toHaveLength(1);
    expect(await repos.trendSnapshots.listByAccount(ctx, { source: "youtube", account: "@maker" })).toHaveLength(2);

    const events = await repos.events.list(ctx, { entityType: "trend_snapshot", limit: 100 });
    expect(events).toHaveLength(2); // the replay appended no event
  });
});
