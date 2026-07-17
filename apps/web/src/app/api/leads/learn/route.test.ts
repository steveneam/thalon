import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST } = await import("./route");

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

async function seedTenant(config: Record<string, unknown>): Promise<TenantCtx> {
  const tenant = await repos!.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos!.brandProfiles.create(ctx, { config, activate: true });
  return ctx;
}

/** A verdict row exactly as the one triage door writes it — reasons readable by the learn core. */
async function recordVerdict(ctx: TenantCtx, action: "pinned" | "dismissed"): Promise<void> {
  const { lead } = await repos!.leads.add(ctx, {
    source: "csv",
    email: `${action}-${Math.random().toString(36).slice(2)}@x.example`,
  });
  await repos!.evalCases.recordLeadTriage(ctx, {
    kind: "lead_rank",
    input: {
      leadId: lead.id,
      score: 0.8,
      reasons: [
        'fit 1 (role "Owner" matches "owner")',
        "completeness 0.8 (4/5 contact fields present)",
        "recency 1 (added 0d ago)",
      ],
      profileHash: "icp-v1",
    },
    action,
    sourceRef: `lead:${lead.id}`,
  });
}

/**
 * The learn loop itself is covered engine-side (learn-job.test.ts) — this
 * pins the thin-route contract: authorize → learnNow → serialize the FULL
 * result, and idempotency straight through the door (a replay reports
 * created:false with the same state id).
 */
describe("POST /api/leads/learn", () => {
  it("503s before the tenant is seeded — set up the workspace first", async () => {
    const res = await POST();
    expect(res.status).toBe(503);
  });

  it("reports not-armed verbatim when the active profile has no ICP block", async () => {
    await seedTenant({ voice: {}, denylist: [], platformProfiles: {} });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      armed: false,
      reason: "the active profile has no ICP block — lead scoring is not armed",
      stateId: null,
      created: false,
    });
  });

  it("learns a state from triage verdicts, then a replay appends nothing (created:false, same id)", async () => {
    const ctx = await seedTenant({ icp: { description: "owner-operated local service business" } });
    await recordVerdict(ctx, "pinned");
    await recordVerdict(ctx, "dismissed");

    const first = await (await POST()).json();
    expect(first).toMatchObject({ armed: true, rows: 2, verdicts: 2, created: true });
    expect(first.stateId).toBeTruthy();
    // The full result crosses the wire — the provenance surface needs all of it.
    expect(Object.keys(first.multipliers).sort()).toEqual([
      "completeness",
      "fit",
      "recency",
      "relevance",
    ]);
    expect(first.reasons.length).toBeGreaterThan(0);
    expect(first.profileHash).toBeTruthy();

    const replay = await (await POST()).json();
    expect(replay).toMatchObject({ armed: true, created: false, stateId: first.stateId });
  });
});
