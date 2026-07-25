import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import type { Repos } from "../repos";

/**
 * B-learn L0 contract-window repo (trend_admissions — the durable
 * admission-cap ledger). Same discipline as sprint8-repos.test.ts: every
 * behavior test doubles as the tenancy-wall proof and the B4.4
 * events-coverage pin for this repo's write fn. The cap-under-races pin is
 * the window's half of the s72 "Cap honesty" race (engine trend/
 * admission.ts); the lane pins the sweep-level half when it swaps the
 * in-memory count for this repo.
 */

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const NOON = Date.UTC(2026, 6, 25, 12, 0, 0); // 2026-07-25T12:00Z
const NEXT_DAY = NOON + 24 * 3_600_000;

async function setup(): Promise<{
  ctx: TenantCtx;
  other: TenantCtx;
  repos: Repos;
  areaId: string;
  otherAreaId: string;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self", plan: "internal" });
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  const ctx = tenantCtx(tenant.id);
  const other = tenantCtx(stranger.id);
  const area = await repos.monitoredAreas.create(ctx, {
    name: "Frontier AI models",
    description: "frontier model launches and capabilities",
  });
  const otherArea = await repos.monitoredAreas.create(other, {
    name: "Frontier AI models",
    description: "the same watch, another tenant",
  });
  return { ctx, other, repos, areaId: area.id, otherAreaId: otherArea.id };
}

function claimInput(areaId: string, n: number, overrides: Record<string, unknown> = {}) {
  return {
    areaId,
    nowMs: NOON,
    cap: 3,
    contentHash: `hash-${n}`,
    source: "bluesky",
    externalId: `at://post/${n}`,
    ...overrides,
  };
}

describe("trend admissions repo (B-learn L0 window — the durable cap ledger)", () => {
  it("claims fill slots monotonically, refuse at cap with the honest count, and emit per CREATED claim", async () => {
    const { ctx, repos, areaId } = await setup();
    for (let n = 1; n <= 3; n++) {
      const res = await repos.trendAdmissions.claim(ctx, claimInput(areaId, n));
      if (!res.claimed) throw new Error("expected a claim");
      expect(res.created).toBe(true);
      expect(res.claim.slot).toBe(n);
      expect(res.claim.day).toBe("2026-07-25");
    }
    const refused = await repos.trendAdmissions.claim(ctx, claimInput(areaId, 4));
    expect(refused).toEqual({ claimed: false, capUsed: 3 });

    const events = await repos.events.list(ctx, { limit: 100 });
    expect(events.filter((e) => e.event === "trend_admission.claimed")).toHaveLength(3);
    expect(await repos.trendAdmissions.countsForDay(ctx, NOON)).toEqual(new Map([[areaId, 3]]));
  });

  it("re-claiming the same content the same day is an idempotent replay: same slot back, no new row, no event", async () => {
    const { ctx, repos, areaId } = await setup();
    const first = await repos.trendAdmissions.claim(ctx, claimInput(areaId, 1));
    const replay = await repos.trendAdmissions.claim(ctx, claimInput(areaId, 1));
    if (!first.claimed || !replay.claimed) throw new Error("expected claims");
    expect(replay.created).toBe(false);
    expect(replay.claim.id).toBe(first.claim.id);
    expect(replay.claim.slot).toBe(first.claim.slot);
    const events = await repos.events.list(ctx, { limit: 100 });
    expect(events.filter((e) => e.event === "trend_admission.claimed")).toHaveLength(1);
    expect((await repos.trendAdmissions.countsForDay(ctx, NOON)).get(areaId)).toBe(1);
  });

  it("the cap holds under interleaved claims — more contenders than slots never overshoots", async () => {
    const { ctx, repos, areaId } = await setup();
    const results = await Promise.all(
      Array.from({ length: 7 }, (_, n) =>
        repos.trendAdmissions.claim(ctx, claimInput(areaId, n)),
      ),
    );
    const admitted = results.filter((r) => r.claimed);
    expect(admitted).toHaveLength(3);
    expect(admitted.map((r) => (r.claimed ? r.claim.slot : 0)).sort()).toEqual([1, 2, 3]);
    expect((await repos.trendAdmissions.countsForDay(ctx, NOON)).get(areaId)).toBe(3);
  });

  it("the day key comes from the ARGUMENT clock: a new UTC day opens fresh slots; counts stay per-day honest", async () => {
    const { ctx, repos, areaId } = await setup();
    await repos.trendAdmissions.claim(ctx, claimInput(areaId, 1, { cap: 1 }));
    expect(await repos.trendAdmissions.claim(ctx, claimInput(areaId, 2, { cap: 1 }))).toEqual({
      claimed: false,
      capUsed: 1,
    });
    const tomorrow = await repos.trendAdmissions.claim(
      ctx,
      claimInput(areaId, 2, { cap: 1, nowMs: NEXT_DAY }),
    );
    if (!tomorrow.claimed) throw new Error("expected a claim");
    expect(tomorrow.claim.day).toBe("2026-07-26");
    expect(tomorrow.claim.slot).toBe(1);
    expect((await repos.trendAdmissions.countsForDay(ctx, NOON)).get(areaId)).toBe(1);
    expect((await repos.trendAdmissions.countsForDay(ctx, NEXT_DAY)).get(areaId)).toBe(1);
  });

  it("cap 0 refuses immediately — watch-but-never-admit is honest config", async () => {
    const { ctx, repos, areaId } = await setup();
    expect(await repos.trendAdmissions.claim(ctx, claimInput(areaId, 1, { cap: 0 }))).toEqual({
      claimed: false,
      capUsed: 0,
    });
  });

  it("is tenancy-walled: identical content in another tenant claims its own slot; counts never leak", async () => {
    const { ctx, other, repos, areaId, otherAreaId } = await setup();
    await repos.trendAdmissions.claim(ctx, claimInput(areaId, 1));
    const theirs = await repos.trendAdmissions.claim(other, claimInput(otherAreaId, 1));
    if (!theirs.claimed) throw new Error("expected a claim");
    expect(theirs.created).toBe(true); // same content hash, own tenant-salted key
    expect(theirs.claim.slot).toBe(1);
    expect((await repos.trendAdmissions.countsForDay(ctx, NOON)).get(areaId)).toBe(1);
    expect(await repos.trendAdmissions.countsForDay(other, NOON)).toEqual(
      new Map([[otherAreaId, 1]]),
    );
  });

  it("invalid input fails loud at the door — nothing stores", async () => {
    const { ctx, repos, areaId } = await setup();
    await expect(
      repos.trendAdmissions.claim(ctx, claimInput("not-a-uuid", 1)),
    ).rejects.toThrow();
    await expect(
      repos.trendAdmissions.claim(ctx, claimInput(areaId, 1, { contentHash: "" })),
    ).rejects.toThrow();
    await expect(
      repos.trendAdmissions.claim(ctx, claimInput(areaId, 1, { cap: -1 })),
    ).rejects.toThrow();
    expect(await repos.trendAdmissions.countsForDay(ctx, NOON)).toEqual(new Map());
  });
});
