import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SPOTS_PER_REFERRAL } from "../position";

// Deterministic code sequence so the collision-retry path is drivable.
const codeQueue: string[] = [];
vi.mock("../referral-code", async (importOriginal) => {
  const real = await importOriginal<typeof import("../referral-code")>();
  return {
    ...real,
    generateReferralCode: () => codeQueue.shift() ?? real.generateReferralCode(),
  };
});

// Import AFTER the mock so join.ts binds the mocked generator.
const { joinWaitlist } = await import("../join");

let handle: DbHandle | undefined;

afterEach(async () => {
  codeQueue.length = 0;
  await handle?.close();
  handle = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; repos: DbHandle["repos"] }> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  return { ctx: tenantCtx(tenant.id), repos: handle.repos };
}

describe("joinWaitlist (B6.1, over the frozen contract)", () => {
  it("first signup gets position 1 and a shareable referral URL", async () => {
    const { ctx, repos } = await setup();
    const result = await joinWaitlist(repos, ctx, { email: "a@example.com" });
    expect(result).toMatchObject({
      created: true,
      position: 1,
      effectivePosition: 1,
      referrals: 0,
      total: 1,
    });
    expect(result.referralUrl).toBe(`https://thalon.example/?ref=${result.referralCode}`);
  });

  it("re-signup is idempotent: same entry, same code, created:false", async () => {
    const { ctx, repos } = await setup();
    const first = await joinWaitlist(repos, ctx, { email: "a@example.com" });
    await joinWaitlist(repos, ctx, { email: "b@example.com" });
    const replay = await joinWaitlist(repos, ctx, { email: "a@example.com" });
    expect(replay.created).toBe(false);
    expect(replay.position).toBe(first.position);
    expect(replay.referralCode).toBe(first.referralCode);
    expect(replay.total).toBe(2);
  });

  it("referrals move the referrer up by the advertised spots", async () => {
    const { ctx, repos } = await setup();
    for (let i = 1; i <= 6; i++) {
      await joinWaitlist(repos, ctx, { email: `filler${i}@example.com` });
    }
    const referrer = await joinWaitlist(repos, ctx, { email: "referrer@example.com" });
    expect(referrer.position).toBe(7);

    await joinWaitlist(repos, ctx, { email: "friend@example.com", ref: referrer.referralCode });
    const after = await joinWaitlist(repos, ctx, { email: "referrer@example.com" });
    expect(after.referrals).toBe(1);
    expect(after.effectivePosition).toBe(7 - SPOTS_PER_REFERRAL);
    expect(after.total).toBe(8);
  });

  it("an unknown ref code degrades to a direct signup — never blocks the join", async () => {
    const { ctx, repos } = await setup();
    const result = await joinWaitlist(repos, ctx, {
      email: "a@example.com",
      ref: "no-such-code",
    });
    expect(result.created).toBe(true);
    const entry = await repos.waitlist.getByEmail(ctx, "a@example.com");
    expect(entry?.referredBy).toBeNull();
  });

  it("retries a referral-code collision with fresh entropy", async () => {
    const { ctx, repos } = await setup();
    codeQueue.push("collide2222");
    await joinWaitlist(repos, ctx, { email: "a@example.com" });
    // Next signup draws the SAME code first — the unique index must throw,
    // and the loop must retry with the follow-up code.
    codeQueue.push("collide2222", "fresh333333");
    const second = await joinWaitlist(repos, ctx, { email: "b@example.com" });
    expect(second.created).toBe(true);
    expect(second.referralCode).toBe("fresh333333");
  });
});
