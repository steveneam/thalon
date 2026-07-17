import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { learnNow, readLeadsPayload } from "../service";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { icp: { description: "owner-operated local service business" } },
    activate: true,
  });
  return { ctx, repos };
}

/** A verdict row as the one triage door writes it — reasons readable by the learn core. */
async function recordVerdict(ctx: TenantCtx, repos: Repos, leadId: string): Promise<void> {
  await repos.evalCases.recordLeadTriage(ctx, {
    kind: "lead_rank",
    input: {
      leadId,
      score: 0.8,
      reasons: [
        "completeness 0.8 (4/5 contact fields present)",
        "recency 1 (added 0d ago)",
      ],
      profileHash: "icp-v1",
    },
    action: "pinned",
    sourceRef: `lead:${leadId}`,
  });
}

describe("readLeadsPayload learned-weights provenance (B-crm.5 back half)", () => {
  it("reports base weights honestly before any learning has run", async () => {
    const { ctx, repos } = await setup();
    const payload = await readLeadsPayload(ctx, repos);
    expect(payload.scoringArmed).toBe(true);
    expect(payload.learnedWeights).toEqual({ state: null, staleForProfile: false });
  });

  it("joins the latest state for the CURRENT profile and carries per-card weightStateId", async () => {
    const { ctx, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "jane@x.example" });
    await recordVerdict(ctx, repos, lead.id);

    const learned = await learnNow(ctx, repos);
    expect(learned).toMatchObject({ armed: true, created: true, verdicts: 1 });

    const payload = await readLeadsPayload(ctx, repos);
    const state = payload.learnedWeights.state;
    expect(state).not.toBeNull();
    expect(state!.id).toBe(learned.stateId);
    expect(state!.verdicts).toBe(1);
    expect(state!.rows).toBe(1);
    expect(state!.multipliers).toEqual(learned.multipliers);
    expect(Date.parse(state!.computedAt)).not.toBeNaN();
    expect(payload.learnedWeights.staleForProfile).toBe(false);

    // What the LAST score actually applied rides the card, verbatim from lead_scores.
    await repos.leads.setStatus(ctx, lead.id, "scored");
    await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.8,
      reasons: ["completeness 0.8 (4/5 contact fields present)"],
      signals: {},
      profileHash: payload.currentProfileHash!,
      weightStateId: learned.stateId,
      scoredAt: new Date("2026-07-17T00:00:00.000Z"),
    });
    const rescored = await readLeadsPayload(ctx, repos);
    expect(rescored.leads[0].weightStateId).toBe(learned.stateId);
  });

  it("a drifted ICP disarms the learned state and says so (staleForProfile), never an error", async () => {
    const { ctx, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "sam@x.example" });
    await recordVerdict(ctx, repos, lead.id);
    await learnNow(ctx, repos);

    await repos.brandProfiles.create(ctx, {
      config: { icp: { description: "a completely different customer" } },
      activate: true,
    });
    const payload = await readLeadsPayload(ctx, repos);
    expect(payload.learnedWeights).toEqual({ state: null, staleForProfile: true });
  });
});
