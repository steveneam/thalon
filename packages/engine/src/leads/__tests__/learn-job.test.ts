import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { runLeadWeightLearning } from "../learn-job";
import { runLeadScoring, type LeadScoringDeps } from "../scoring-job";

const NOW = Date.UTC(2026, 6, 17, 12, 0, 0);
const HOUR = 3_600_000;

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; deps: LeadScoringDeps }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  storeRoot = mkdtempSync(path.join(tmpdir(), "lead-learning-"));
  const deps: LeadScoringDeps = {
    embedder: createFakeEmbeddingDriver(64),
    objectStore: new LocalObjectStore(storeRoot),
    capTokens: 1_000_000,
  };
  return { ctx: tenantCtx(tenant.id), repos, deps };
}

const ICP_CONFIG = {
  icp: {
    description: "Owner-operated local service business with weak web presence",
    verticals: ["plumbing"],
    roles: ["owner"],
    dealbreakers: ["gambling"],
  },
};

/**
 * relevance rides the fake embedder (deterministic but per-text arbitrary
 * cosines), so the learn config pins the endorsement threshold at 0.99:
 * only fit/completeness/recency sitting at exactly 1 endorse, and the fit
 * outcome is fully controlled — 4 pins all fit-1 over a 0.4 base pin rate
 * clears Wilson (low 0.51) and lifts by 2× (posterior 0.833 / base 0.417).
 */
const LEARN_CONFIG = { endorseThreshold: 0.99 };

/** 4 fit-1 pins, 6 fit-0 dismissals, 1 dealbreaker dismissal, 1 left active. */
async function seedTriagedQueue(ctx: TenantCtx, repos: Repos, deps: LeadScoringDeps) {
  for (let i = 1; i <= 4; i++) {
    await repos.leads.add(ctx, {
      source: "csv",
      email: `pin-${i}@x.example`,
      name: `Pin Lead ${i}`,
      company: `Plumbing Crew ${i}`,
      role: "Owner",
      website: `https://pin-${i}.example.com`,
      notes: "wants steady posts",
    });
  }
  for (let i = 1; i <= 6; i++) {
    await repos.leads.add(ctx, {
      source: "csv",
      email: `miss-${i}@x.example`,
      name: `Miss Lead ${i}`,
      company: `Cloud Suite ${i}`,
      role: "Analyst",
      website: `https://miss-${i}.example.com`,
      notes: "b2b workflow tools",
    });
  }
  await repos.leads.add(ctx, {
    source: "csv",
    email: "db@x.example",
    name: "Db Lead",
    company: "Casino Group",
    role: "Owner",
    website: "https://db.example.com",
    notes: "online gambling venture",
  });
  await repos.leads.add(ctx, {
    source: "csv",
    email: "active@x.example",
    name: "Active Lead",
    company: "Plumbing Crew 9",
    role: "Owner",
    website: "https://active.example.com",
    notes: "still in the queue",
  });
  const scoring = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
  expect(scoring.scored).toBe(12);

  // Triage exactly the way the one door writes it (apps/web triageLeads):
  // the eval row carries what the operator saw — the LATEST score row.
  const triage = async (email: string, action: "pinned" | "dismissed") => {
    const lead = await repos.leads.getByEmail(ctx, email);
    const latest = await repos.leadScores.latestByLead(ctx, lead!.id);
    if (action === "dismissed") await repos.leads.setStatus(ctx, lead!.id, "dismissed");
    else await repos.leads.setPinned(ctx, lead!.id, true);
    await repos.evalCases.recordLeadTriage(ctx, {
      kind: "lead_rank",
      input: {
        leadId: lead!.id,
        score: latest?.score ?? null,
        reasons: (latest?.reasons as string[] | undefined) ?? [],
        profileHash: latest?.profileHash ?? null,
      },
      action,
      sourceRef: `lead:${lead!.id}`,
    });
  };
  for (let i = 1; i <= 4; i++) await triage(`pin-${i}@x.example`, "pinned");
  for (let i = 1; i <= 6; i++) await triage(`miss-${i}@x.example`, "dismissed");
  await triage("db@x.example", "dismissed");
  // active@x.example is left untouched — an active lead writes no eval row.
}

describe("runLeadWeightLearning (B-crm.5)", () => {
  it("is honestly disarmed without an ICP block, and learns nothing from zero verdicts", async () => {
    const { ctx, repos } = await setup();
    const noProfile = await runLeadWeightLearning(ctx, repos, { nowMs: NOW });
    expect(noProfile).toMatchObject({ armed: false, reason: "no active brand profile" });

    await repos.brandProfiles.create(ctx, { config: ICP_CONFIG, activate: true });
    const noVerdicts = await runLeadWeightLearning(ctx, repos, { nowMs: NOW });
    expect(noVerdicts).toMatchObject({ armed: true, verdicts: 0, stateId: null, created: false });
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(0); // no spam states
  });

  it("turns triage verdicts into an auditable weight state; replay appends nothing; new verdicts accrue a new version", async () => {
    const { ctx, repos, deps } = await setup();
    await repos.brandProfiles.create(ctx, { config: ICP_CONFIG, activate: true });
    await seedTriagedQueue(ctx, repos, deps);

    const run = await runLeadWeightLearning(ctx, repos, {
      nowMs: NOW + HOUR,
      config: LEARN_CONFIG,
    });
    expect(run).toMatchObject({ armed: true, rows: 11, verdicts: 11, created: true });
    expect(run.multipliers).toEqual({ relevance: 1, fit: 2, completeness: 1, recency: 1 });
    expect(run.reasons.join("\n")).toContain("fit ×2 — endorsed 4 triaged leads, 4 pinned");

    const state = await repos.leadWeightStates.latestForProfile(ctx, run.profileHash!);
    expect(state?.id).toBe(run.stateId);
    // The dealbreaker verdict landed as rule evidence, not component evidence.
    const evidence = state?.evidence as { componentVerdicts: number; dealbreakers: Record<string, unknown> };
    expect(evidence.componentVerdicts).toBe(10);
    expect(evidence.dealbreakers.gambling).toMatchObject({ verdicts: 1, confirmed: 1 });

    // Replay over the same verdicts: the structural key returns the SAME version.
    const replay = await runLeadWeightLearning(ctx, repos, {
      nowMs: NOW + 2 * HOUR,
      config: LEARN_CONFIG,
    });
    expect(replay).toMatchObject({ created: false, stateId: run.stateId });
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(1);

    // A fresh verdict changes the evidence → a NEW version accrues (append-only audit).
    const active = await repos.leads.getByEmail(ctx, "active@x.example");
    const latest = await repos.leadScores.latestByLead(ctx, active!.id);
    await repos.leads.setPinned(ctx, active!.id, true);
    await repos.evalCases.recordLeadTriage(ctx, {
      kind: "lead_rank",
      input: {
        leadId: active!.id,
        score: latest!.score,
        reasons: latest!.reasons as string[],
        profileHash: latest!.profileHash,
      },
      action: "pinned",
      sourceRef: `lead:${active!.id}`,
    });
    const grown = await runLeadWeightLearning(ctx, repos, {
      nowMs: NOW + 3 * HOUR,
      config: LEARN_CONFIG,
    });
    expect(grown.created).toBe(true);
    expect(grown.stateId).not.toBe(run.stateId);
    expect(grown.verdicts).toBe(12);
    expect(await repos.leadWeightStates.list(ctx)).toHaveLength(2);
  });

  it("the scoring job applies the learned state, re-scores exactly once, and profile drift disarms it until the loop re-runs", async () => {
    const { ctx, repos, deps } = await setup();
    await repos.brandProfiles.create(ctx, { config: ICP_CONFIG, activate: true });
    await seedTriagedQueue(ctx, repos, deps);
    const learned = await runLeadWeightLearning(ctx, repos, {
      nowMs: NOW + HOUR,
      config: LEARN_CONFIG,
    });

    // The weight-state change invalidates every non-dismissed scored lead.
    const applied = await runLeadScoring(ctx, repos, { nowMs: NOW + 2 * HOUR }, deps);
    expect(applied).toMatchObject({
      candidates: 5, // 4 pinned + 1 active; the 7 dismissed stay untouched
      scored: 5,
      rescored: 5,
      weightStateId: learned.stateId,
    });
    const active = await repos.leads.getByEmail(ctx, "active@x.example");
    const rescored = await repos.leadScores.latestByLead(ctx, active!.id);
    expect(rescored?.weightStateId).toBe(learned.stateId); // provenance on the row
    expect((rescored?.reasons as string[]).at(-1)).toBe(
      "learned weight adjustments applied: fit ×2",
    );

    // Replay: same profile, same state → nothing to do.
    const replay = await runLeadScoring(ctx, repos, { nowMs: NOW + 2 * HOUR }, deps);
    expect(replay).toMatchObject({ candidates: 0, scored: 0 });

    // Founder edits the ICP → the learned state no longer applies (it was
    // earned under the old profile): re-score runs on BASE weights.
    await repos.brandProfiles.create(ctx, {
      config: { icp: { ...ICP_CONFIG.icp, regions: ["Sydney"] } },
      activate: true,
    });
    const drifted = await runLeadScoring(ctx, repos, { nowMs: NOW + 3 * HOUR }, deps);
    expect(drifted).toMatchObject({ candidates: 5, scored: 5, weightStateId: null });
    const base = await repos.leadScores.latestByLead(ctx, active!.id);
    expect(base?.weightStateId).toBeNull();
    expect((base?.reasons as string[]).join("\n")).not.toContain("learned weight adjustments");

    // Re-learning under the new profile re-arms application. Component
    // evidence still spans the old-hash verdicts; the per-term dealbreaker
    // stats bind to the current hash, so they are empty until new verdicts
    // land under it — the drift semantics, pinned.
    const relearned = await runLeadWeightLearning(ctx, repos, {
      nowMs: NOW + 4 * HOUR,
      config: LEARN_CONFIG,
    });
    expect(relearned.created).toBe(true);
    expect(relearned.profileHash).not.toBe(learned.profileHash);
    expect(relearned.multipliers).toEqual({ relevance: 1, fit: 2, completeness: 1, recency: 1 });
    const relearnedState = await repos.leadWeightStates.latestForProfile(
      ctx,
      relearned.profileHash!,
    );
    expect((relearnedState?.evidence as { dealbreakers: object }).dealbreakers).toEqual({});

    const reapplied = await runLeadScoring(ctx, repos, { nowMs: NOW + 5 * HOUR }, deps);
    expect(reapplied).toMatchObject({ candidates: 5, scored: 5, weightStateId: relearned.stateId });
  });
});
