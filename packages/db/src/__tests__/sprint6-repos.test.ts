import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import { NotFoundError } from "../errors";
import type { Repos } from "../repos";

/**
 * Sprint-6 contract-window repos (B6.1 waitlist · B6.4 monitored areas ·
 * B6.8 search targets/snapshots). Same discipline as intel-repos.test.ts:
 * every behavior test doubles as the tenancy-wall proof and the B4.4
 * events-coverage pin for these repos' write fns.
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

describe("monitored areas repo (B6.4)", () => {
  it("creates validated config, lists by status, pauses instead of deleting — all audited", async () => {
    const { ctx, other, repos } = await setup();
    const created = await repos.monitoredAreas.create(ctx, {
      name: "agentic coding",
      description: "AI coding agents, harnesses, evals — what makers ship and argue about",
      config: { weights: { relevance: 2 }, maxQueriesPerSweep: 3 },
    });
    expect(created.tenantId).toBe(ctx.tenantId);
    expect(created.status).toBe("active");
    expect(created.config).toEqual({ weights: { relevance: 2 }, maxQueriesPerSweep: 3 });
    expect(await repos.monitoredAreas.get(other, created.id)).toBeNull(); // tenancy wall

    const paused = await repos.monitoredAreas.update(ctx, created.id, { status: "paused" });
    expect(paused.status).toBe("paused");
    expect(paused.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    expect(await repos.monitoredAreas.list(ctx, { status: "active" })).toHaveLength(0);
    expect(await repos.monitoredAreas.list(ctx)).toHaveLength(1);

    await expect(
      repos.monitoredAreas.update(other, created.id, { name: "steal" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const events = await repos.events.list(ctx, {
      entityType: "monitored_area",
      entityId: created.id,
    });
    expect(events.map((e) => e.event)).toEqual(["monitored_area.created", "monitored_area.updated"]);
  });

  it("rejects invalid config loudly at the write door — nothing stores", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.monitoredAreas.create(ctx, {
        name: "bad",
        description: "negative weight",
        config: { weights: { relevance: -1 } },
      }),
    ).rejects.toThrow();
    expect(await repos.monitoredAreas.list(ctx)).toHaveLength(0);
  });
});

describe("search targets repo (B6.8)", () => {
  it("adds idempotently on (tenant, keyword) — first origin wins, dismissals survive recompiles", async () => {
    const { ctx, other, repos } = await setup();
    const first = await repos.searchTargets.add(ctx, {
      keyword: "ai content engine",
      origin: "operator",
    });
    expect(first.created).toBe(true);

    // The compiler re-deriving an operator keyword replays cleanly, unchanged.
    const replay = await repos.searchTargets.add(ctx, {
      keyword: "ai content engine",
      origin: "profile_seed",
      meta: { seededFrom: "topics" },
    });
    expect(replay.created).toBe(false);
    expect(replay.target.id).toBe(first.target.id);
    expect(replay.target.origin).toBe("operator"); // provenance never rewritten
    expect(replay.target.meta).toEqual({});

    const dismissed = await repos.searchTargets.setStatus(ctx, first.target.id, "dismissed");
    expect(dismissed.status).toBe("dismissed");
    const recompile = await repos.searchTargets.add(ctx, {
      keyword: "ai content engine",
      origin: "profile_seed",
    });
    expect(recompile.target.status).toBe("dismissed"); // dismissal is durable signal

    expect(await repos.searchTargets.list(ctx, { status: "active" })).toHaveLength(0);
    expect(await repos.searchTargets.list(ctx)).toHaveLength(1);

    // Tenancy walls: same keyword is a separate row per tenant; foreign writes 404.
    const foreign = await repos.searchTargets.add(other, {
      keyword: "ai content engine",
      origin: "operator",
    });
    expect(foreign.created).toBe(true);
    expect(await repos.searchTargets.get(other, first.target.id)).toBeNull();
    await expect(
      repos.searchTargets.setStatus(other, first.target.id, "active"),
    ).rejects.toBeInstanceOf(NotFoundError);

    const events = await repos.events.list(ctx, {
      entityType: "search_target",
      entityId: first.target.id,
    });
    // The two replayed adds appended no events.
    expect(events.map((e) => e.event)).toEqual([
      "search_target.created",
      "search_target.status_changed",
    ]);
  });

  it("rejects an unknown origin loudly at the write door", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.searchTargets.add(ctx, {
        keyword: "x",
        origin: "scraped" as never,
      }),
    ).rejects.toThrow();
  });
});

describe("search snapshots repo (B6.8)", () => {
  it("appends idempotently on (tenant, source, query, page, capturedAt), reads back in capture order, audits creations only", async () => {
    const { ctx, other, repos } = await setup();
    const base = {
      source: "gsc",
      query: "how to automate social posts",
      metrics: { impressions: 120, clicks: 2, position: 14.2 },
    };
    const t1 = new Date("2026-07-05T00:00:00Z");
    const t2 = new Date("2026-07-06T00:00:00Z");

    const first = await repos.searchSnapshots.append(ctx, { ...base, capturedAt: t1 });
    expect(first.created).toBe(true);
    expect(first.snapshot.page).toBe(""); // site-level aggregate keeps the key total

    const replay = await repos.searchSnapshots.append(ctx, {
      ...base,
      metrics: { impressions: 999 },
      capturedAt: t1,
    });
    expect(replay.created).toBe(false);
    expect(replay.snapshot.id).toBe(first.snapshot.id);
    expect(replay.snapshot.metrics).toEqual(base.metrics); // history rows are never rewritten

    // Same query at the same instant on a DIFFERENT page is its own history row.
    const paged = await repos.searchSnapshots.append(ctx, {
      ...base,
      page: "https://example.com/features",
      capturedAt: t1,
    });
    expect(paged.created).toBe(true);

    const second = await repos.searchSnapshots.append(ctx, {
      ...base,
      metrics: { impressions: 260, clicks: 5, position: 11.8 },
      capturedAt: t2,
    });
    expect(second.created).toBe(true);

    const history = await repos.searchSnapshots.listByQuery(ctx, {
      source: "gsc",
      query: base.query,
    });
    expect(history.map((s) => s.capturedAt.getTime())).toEqual([
      t1.getTime(),
      t1.getTime(),
      t2.getTime(),
    ]);

    // Same key under ANOTHER tenant is a separate history (tenant-salted unique index).
    const foreign = await repos.searchSnapshots.append(other, { ...base, capturedAt: t1 });
    expect(foreign.created).toBe(true);
    expect(await repos.searchSnapshots.listBySource(other, "gsc")).toHaveLength(1);
    expect(await repos.searchSnapshots.listBySource(ctx, "gsc")).toHaveLength(3);

    const events = await repos.events.list(ctx, { entityType: "search_snapshot", limit: 100 });
    expect(events).toHaveLength(3); // the replay appended no event
  });
});

describe("waitlist repo (B6.1)", () => {
  it("joins idempotently on (tenant, email), assigns monotonic positions, counts referrals — audited on creation only", async () => {
    const { ctx, other, repos } = await setup();
    const alice = await repos.waitlist.join(ctx, {
      email: "alice@example.com",
      referralCode: "alice-code",
    });
    expect(alice.created).toBe(true);
    expect(alice.entry.position).toBe(1);

    // Signing up twice returns the existing entry — original code AND position.
    const again = await repos.waitlist.join(ctx, {
      email: "alice@example.com",
      referralCode: "fresh-code-never-used",
    });
    expect(again.created).toBe(false);
    expect(again.entry.id).toBe(alice.entry.id);
    expect(again.entry.referralCode).toBe("alice-code");

    // Referral link resolves, and referred signups queue behind with provenance.
    const referrer = await repos.waitlist.getByReferralCode(ctx, "alice-code");
    expect(referrer?.id).toBe(alice.entry.id);
    const bob = await repos.waitlist.join(ctx, {
      email: "bob@example.com",
      referralCode: "bob-code",
      referredBy: alice.entry.id,
    });
    expect(bob.entry.position).toBe(2);
    expect(bob.entry.referredBy).toBe(alice.entry.id);
    expect(await repos.waitlist.countReferrals(ctx, alice.entry.id)).toBe(1);
    expect(await repos.waitlist.count(ctx)).toBe(2);

    // Tenancy walls: positions, emails, and codes are all per-tenant.
    const foreign = await repos.waitlist.join(other, {
      email: "alice@example.com",
      referralCode: "alice-code",
    });
    expect(foreign.created).toBe(true);
    expect(foreign.entry.position).toBe(1);
    expect(await repos.waitlist.getByEmail(other, "bob@example.com")).toBeNull();
    expect(await repos.waitlist.countReferrals(other, alice.entry.id)).toBe(0);

    const events = await repos.events.list(ctx, { entityType: "waitlist", limit: 100 });
    expect(events.map((e) => e.event)).toEqual(["waitlist.joined", "waitlist.joined"]);
    expect((events[1].payload as { referred: boolean }).referred).toBe(true);
  });

  it("fails loud when a NEW email collides on someone else's referral code — never silently attaches", async () => {
    const { ctx, repos } = await setup();
    await repos.waitlist.join(ctx, { email: "alice@example.com", referralCode: "taken" });
    // Only the email index arbitrates the idempotent path; a code collision
    // is the raw unique violation — the caller regenerates and retries.
    await expect(
      repos.waitlist.join(ctx, { email: "carol@example.com", referralCode: "taken" }),
    ).rejects.toThrow();
    expect(await repos.waitlist.count(ctx)).toBe(1); // nothing stored
  });
});
