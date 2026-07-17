import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import type { Repos } from "../repos";

/**
 * B-crm.5 learn-loop persistence (lead_weight_states + the lead_scores
 * provenance column, migration 0012). Same discipline as
 * sprint7-repos.test.ts: every behavior test doubles as the tenancy-wall
 * proof and the B4.4 events-coverage pin for this repo's write fn.
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

const NEUTRAL = { relevance: 1, fit: 1, completeness: 1, recency: 1 };

function record(overrides: Record<string, unknown> = {}) {
  return {
    multipliers: { ...NEUTRAL, fit: 1.8 },
    reasons: ["fit ×1.8 — endorsed 12 triaged leads, 8 pinned"],
    evidence: { consumed: 104 },
    profileHash: "hash-a",
    evidenceHash: "evidence-1",
    computedAt: new Date(Date.UTC(2026, 6, 17)),
    ...overrides,
  };
}

describe("leadWeightStates repo (B-crm.5)", () => {
  it("appends with its audit event; replaying the same evidence is a structural no-op", async () => {
    const { ctx, repos } = await setup();
    const first = await repos.leadWeightStates.append(ctx, record());
    expect(first.created).toBe(true);
    expect(first.state.multipliers).toEqual({ ...NEUTRAL, fit: 1.8 });

    const events = await repos.events.list(ctx, { entityType: "lead_weight_state" });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("lead_weight_state.recorded");

    // Same (profile, evidence) → the existing version comes back, nothing appended.
    const replay = await repos.leadWeightStates.append(ctx, record());
    expect(replay.created).toBe(false);
    expect(replay.state.id).toBe(first.state.id);
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(1);
    expect(await repos.events.list(ctx, { entityType: "lead_weight_state" })).toHaveLength(1);
  });

  it("new verdicts accrue as new versions; latestForProfile reads the newest for THAT profile only", async () => {
    const { ctx, repos } = await setup();
    const v1 = await repos.leadWeightStates.append(ctx, record());
    const v2 = await repos.leadWeightStates.append(
      ctx,
      record({
        evidenceHash: "evidence-2",
        multipliers: { ...NEUTRAL, fit: 2 },
        computedAt: new Date(Date.UTC(2026, 6, 18)),
      }),
    );
    expect(v2.created).toBe(true);
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(2); // append-only history

    const latest = await repos.leadWeightStates.latestForProfile(ctx, "hash-a");
    expect(latest?.id).toBe(v2.state.id);
    // Profile drift finds nothing — the learned layer disarms until the loop re-runs.
    expect(await repos.leadWeightStates.latestForProfile(ctx, "hash-b")).toBeNull();
    expect(v1.state.id).not.toBe(v2.state.id);
  });

  it("validates at the write door: multipliers must be positive on every signal", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.leadWeightStates.append(ctx, record({ multipliers: { ...NEUTRAL, fit: 0 } })),
    ).rejects.toThrow();
    await expect(
      repos.leadWeightStates.append(ctx, record({ multipliers: { relevance: 1, fit: 1 } })),
    ).rejects.toThrow();
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(0);
  });

  it("holds the tenancy wall: a stranger sees no states and cannot collide on the structural key", async () => {
    const { ctx, other, repos } = await setup();
    await repos.leadWeightStates.append(ctx, record());
    expect(await repos.leadWeightStates.list(other)).toHaveLength(0);
    expect(await repos.leadWeightStates.latestForProfile(other, "hash-a")).toBeNull();

    // Same (profile, evidence) key under ANOTHER tenant is its own row, not a conflict.
    const theirs = await repos.leadWeightStates.append(other, record());
    expect(theirs.created).toBe(true);
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(1);
  });
});

describe("lead_scores weight-state provenance (B-crm.5)", () => {
  it("a score row records which learned state shaped its weights; base-weight rows stay null", async () => {
    const { ctx, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "a@x.example" });
    const { state } = await repos.leadWeightStates.append(ctx, record());

    const base = await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.5,
      reasons: ["completeness 0.2 (1/5 contact fields present)"],
      signals: { completeness: 0.2 },
      profileHash: "hash-a",
      scoredAt: new Date(Date.UTC(2026, 6, 17)),
    });
    expect(base.score.weightStateId).toBeNull();

    const learned = await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.6,
      reasons: ["learned weight adjustments applied: fit ×1.8"],
      signals: { completeness: 0.2 },
      profileHash: "hash-a",
      weightStateId: state.id,
      scoredAt: new Date(Date.UTC(2026, 6, 18)),
    });
    expect(learned.score.weightStateId).toBe(state.id);
    expect(await repos.leadScores.listByLead(ctx, lead.id)).toHaveLength(2);
  });
});
