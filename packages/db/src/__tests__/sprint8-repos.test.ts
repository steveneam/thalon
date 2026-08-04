import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import { NotFoundError } from "../errors";
import { sha256Hex } from "../hash";
import type { Repos } from "../repos";
import { DuplicatePublicationError } from "../repos/social-publications";
import { fixture, type Fixture } from "./helpers";

/**
 * Sprint-8 contract-window repos (entitlements seam · social publication
 * ledger · sweep schedules). Same discipline as sprint7-repos.test.ts:
 * every behavior test doubles as the tenancy-wall proof and the B4.4
 * events-coverage pin for these repos' write fns.
 */

let handle: DbHandle | undefined;
let fx: Fixture | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; other: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self", plan: "internal" });
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: tenantCtx(tenant.id), other: tenantCtx(stranger.id), repos };
}

async function eventNames(repos: Repos, ctx: TenantCtx): Promise<string[]> {
  const rows = await repos.events.list(ctx, { limit: 100 });
  return rows.map((r) => r.event);
}

describe("tenants plan (Sprint-8 window)", () => {
  it("new tenants default to starter; explicit plan is validated at the door", async () => {
    const { repos } = await setup();
    const t = await repos.tenants.create({ slug: "acme", name: "Acme" });
    expect(t.plan).toBe("starter");
    await expect(
      repos.tenants.create({ slug: "bad", name: "Bad", plan: "enterprise" as never }),
    ).rejects.toThrow();
  });

  it("setPlan flips the tier with an event; same-value replay writes nothing", async () => {
    const { repos } = await setup();
    const t = await repos.tenants.create({ slug: "acme", name: "Acme" });
    const flipped = await repos.tenants.setPlan(t.id, "max");
    expect(flipped.plan).toBe("max");
    const names = await eventNames(repos, tenantCtx(t.id));
    expect(names).toContain("tenant.plan_changed");
    const replay = await repos.tenants.setPlan(t.id, "max");
    expect(replay.plan).toBe("max");
    const after = await eventNames(repos, tenantCtx(t.id));
    expect(after.filter((n) => n === "tenant.plan_changed")).toHaveLength(1);
    await expect(repos.tenants.setPlan(crypto.randomUUID(), "max")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("entitlements repo (Sprint-8 window — the founder's flip switch)", () => {
  it("tier defaults gate the founder-named surfaces: internal/max see them, starter does not", async () => {
    const { ctx, repos } = await setup();
    const self = await repos.entitlements.getEffective(ctx);
    expect(self.plan).toBe("internal");
    expect(self.features).toEqual({ sites_templates: true, crm: true, social_publishing: true });

    const starter = await repos.tenants.create({ slug: "acme", name: "Acme" });
    const eff = await repos.entitlements.getEffective(tenantCtx(starter.id));
    expect(eff.plan).toBe("starter");
    expect(eff.features).toEqual({
      sites_templates: false,
      crm: false,
      social_publishing: false,
    });

    const paid = await repos.tenants.create({ slug: "big", name: "Big", plan: "max" });
    const top = await repos.entitlements.getEffective(tenantCtx(paid.id));
    expect(top.features).toEqual({ sites_templates: true, crm: true, social_publishing: true });
  });

  it("a per-tenant override beats the tier default both directions, and clearing restores it", async () => {
    const { repos } = await setup();
    const starter = await repos.tenants.create({ slug: "acme", name: "Acme" });
    const ctx = tenantCtx(starter.id);
    await repos.entitlements.setOverride(ctx, { feature: "crm", enabled: true });
    expect((await repos.entitlements.getEffective(ctx)).features.crm).toBe(true);
    await repos.entitlements.clearOverride(ctx, "crm");
    expect((await repos.entitlements.getEffective(ctx)).features.crm).toBe(false);
    const names = await eventNames(repos, ctx);
    expect(names).toContain("entitlement.override_set");
    expect(names).toContain("entitlement.override_cleared");
  });

  it("same-value override replay writes nothing; invalid feature fails loud at the door", async () => {
    const { ctx, repos } = await setup();
    await repos.entitlements.setOverride(ctx, { feature: "sites_templates", enabled: false });
    await repos.entitlements.setOverride(ctx, { feature: "sites_templates", enabled: false });
    const names = await eventNames(repos, ctx);
    expect(names.filter((n) => n === "entitlement.override_set")).toHaveLength(1);
    await expect(
      repos.entitlements.setOverride(ctx, { feature: "everything", enabled: true }),
    ).rejects.toThrow();
    // clearing an absent override is an idempotent no-op, not an error
    await repos.entitlements.clearOverride(ctx, "crm");
  });

  it("is tenancy-walled: overrides never leak across tenants", async () => {
    const { ctx, other, repos } = await setup();
    await repos.entitlements.setOverride(ctx, { feature: "crm", enabled: true });
    expect(await repos.entitlements.listOverrides(other)).toHaveLength(0);
    expect((await repos.entitlements.getEffective(other)).features.crm).toBe(false);
  });
});

describe("social publications repo (Sprint-8 window — the B-pub ledger)", () => {
  it("records a platform-accepted publication with its event; double-post fails loud", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const row = await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:1",
      bodyHash: sha256Hex(fx.draft.body),
      publishedAt: new Date("2026-07-19T03:00:00Z"),
    });
    expect(row.externalPostId).toBe("urn:li:share:1");
    expect(await eventNames(repos, fx.ctx)).toContain("social.published");
    await expect(
      repos.socialPublications.record(fx.ctx, {
        draftId: fx.draft.id,
        platform: "linkedin",
        externalPostId: "urn:li:share:2",
        bodyHash: sha256Hex(fx.draft.body),
        publishedAt: new Date("2026-07-19T03:01:00Z"),
      }),
    ).rejects.toThrow(DuplicatePublicationError);
  });

  it("cross-posting the same draft to a DIFFERENT platform stays legal; platform is validated", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:1",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-19T03:00:00Z"),
    });
    const x = await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "x",
      externalPostId: "1234567890",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-19T03:02:00Z"),
    });
    expect(x.platform).toBe("x");
    expect(await repos.socialPublications.listForDraft(fx.ctx, fx.draft.id)).toHaveLength(2);
    await expect(
      repos.socialPublications.record(fx.ctx, {
        draftId: fx.draft.id,
        platform: "myspace",
        externalPostId: "n",
        bodyHash: "abc",
        publishedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("listRecent (B-int.2 published-view) returns newest first, bounded, with the honest total — tenancy-walled", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
    const other = tenantCtx(stranger.id);
    await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:1",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-19T03:00:00Z"),
    });
    await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "x",
      externalPostId: "1234567890",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-20T03:00:00Z"),
    });
    await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "facebook",
      externalPostId: "197_122",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-21T03:00:00Z"),
    });

    const bounded = await repos.socialPublications.listRecent(fx.ctx, 2);
    expect(bounded.total).toBe(3);
    expect(bounded.rows.map((r) => r.platform)).toEqual(["facebook", "x"]);

    const theirs = await repos.socialPublications.listRecent(other, 10);
    expect(theirs.total).toBe(0);
    expect(theirs.rows).toHaveLength(0);
  });

  it("countSince serves the cap/day rung per platform, tenancy-walled", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
    const other = tenantCtx(stranger.id);
    await repos.socialPublications.record(fx.ctx, {
      draftId: fx.draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:1",
      bodyHash: "abc",
      publishedAt: new Date("2026-07-19T03:00:00Z"),
    });
    const since = new Date("2026-07-19T00:00:00Z");
    expect(await repos.socialPublications.countSince(fx.ctx, "linkedin", since)).toBe(1);
    expect(await repos.socialPublications.countSince(fx.ctx, "x", since)).toBe(0);
    expect(await repos.socialPublications.countSince(other, "linkedin", since)).toBe(0);
    expect(await repos.socialPublications.listForDraft(other, fx.draft.id)).toHaveLength(0);
  });
});

describe("sweep schedules repo (Sprint-8 window — B-arm.1's timer contract)", () => {
  it("upserts one row per tenant with contract bounds enforced at the door", async () => {
    const { ctx, repos } = await setup();
    expect(await repos.sweepSchedules.get(ctx)).toBeNull();
    const row = await repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 60 });
    expect(row.enabled).toBe(true);
    expect(row.cadenceMinutes).toBe(60);
    const updated = await repos.sweepSchedules.upsert(ctx, {
      enabled: true,
      cadenceMinutes: 120,
    });
    expect(updated.id).toBe(row.id);
    expect(updated.cadenceMinutes).toBe(120);
    await expect(
      repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 5 }),
    ).rejects.toThrow(); // under the 15-minute floor
    await expect(
      repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 2000 }),
    ).rejects.toThrow(); // over the 24-hour ceiling
  });

  it("emits on real change only; markSwept records the honest clock; tenancy-walled", async () => {
    const { ctx, other, repos } = await setup();
    await repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 240 });
    await repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 240 }); // replay
    let names = await eventNames(repos, ctx);
    expect(names.filter((n) => n === "sweep.schedule_updated")).toHaveLength(1);

    const at = new Date("2026-07-19T04:00:00Z");
    const swept = await repos.sweepSchedules.markSwept(ctx, at);
    expect(swept.lastSweepAt?.toISOString()).toBe(at.toISOString());
    names = await eventNames(repos, ctx);
    expect(names).toContain("sweep.schedule_swept");

    expect(await repos.sweepSchedules.get(other)).toBeNull();
    await expect(repos.sweepSchedules.markSwept(other, at)).rejects.toThrow(NotFoundError);
  });

  it("window 2: listAll is the scheduler's one system-level read — every tenant's row, cross-tenant by design", async () => {
    const { ctx, other, repos } = await setup();
    expect(await repos.sweepSchedules.listAll()).toEqual([]);
    await repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 60 });
    await repos.sweepSchedules.upsert(other, { enabled: false, cadenceMinutes: 240 });
    const all = await repos.sweepSchedules.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.tenantId).sort()).toEqual(
      [ctx.tenantId, other.tenantId].sort(),
    );
  });

  it("window 2: markFailed appends the failure event verbatim, leaves the row untouched, and is tenancy-walled", async () => {
    const { ctx, other, repos } = await setup();
    const row = await repos.sweepSchedules.upsert(ctx, { enabled: true, cadenceMinutes: 60 });
    const at = new Date("2026-07-19T05:00:00Z");
    await repos.sweepSchedules.markFailed(ctx, { at, reason: "driver refused: key missing" });
    // Repeat failures are repeat facts — every real failure appends.
    await repos.sweepSchedules.markFailed(ctx, { at, reason: "driver refused: key missing" });
    const rows = await repos.events.list(ctx, {
      entityType: "sweep_schedule",
      entityId: row.id,
    });
    const failed = rows.filter((r) => r.event === "sweep.schedule_failed");
    expect(failed).toHaveLength(2);
    expect(failed[0].payload).toEqual({
      at: at.toISOString(),
      reason: "driver refused: key missing",
    });
    // The row is untouched: last_sweep_at stays the honest SUCCESS clock.
    expect((await repos.sweepSchedules.get(ctx))?.lastSweepAt).toBeNull();
    await expect(
      repos.sweepSchedules.markFailed(other, { at, reason: "x" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("brand profile config columns (Sprint-8 window 2 — the outreach + social persistence gaps closed)", () => {
  it("create carries the social and outreach blocks to the ROW, and getActive serves them back", async () => {
    const { ctx, repos } = await setup();
    const profile = await repos.brandProfiles.create(ctx, {
      config: {
        voice: {},
        denylist: [],
        platformProfiles: {},
        // s102: the write door parses the block, so a config written without
        // an arm state reads back `off` — absence disarms, inside a block as
        // well as at block level.
        social: { linkedin: { maxPostsPerDay: 2 } },
        outreach: { dailyBatchCap: 5 },
      },
      activate: true,
    });
    expect(profile.social).toEqual({ linkedin: { maxPostsPerDay: 2, armState: "off" } });
    // The write door parses the block, so stored outreach carries the schema defaults.
    expect((profile.outreach as { dailyBatchCap: number }).dailyBatchCap).toBe(5);
    const active = await repos.brandProfiles.getActive(ctx);
    expect(active?.social).toEqual({ linkedin: { maxPostsPerDay: 2, armState: "off" } });
    expect((active?.outreach as { dailyBatchCap: number }).dailyBatchCap).toBe(5);
  });

  it("absent blocks stay NULL — absence disarms the publish and send doors; invalid blocks fail loud at the door", async () => {
    const { ctx, repos } = await setup();
    const bare = await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    expect(bare.social).toBeNull();
    expect(bare.outreach).toBeNull();
    await expect(
      repos.brandProfiles.create(ctx, {
        config: {
          voice: {},
          denylist: [],
          platformProfiles: {},
          social: { linkedin: { maxPostsPerDay: 99 } },
        },
      }),
    ).rejects.toThrow(); // over the contracts ceiling — nothing stores
  });
});
