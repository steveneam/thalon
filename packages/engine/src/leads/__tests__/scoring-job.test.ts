import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { runLeadScoring, type LeadScoringDeps } from "../scoring-job";

const NOW = Date.UTC(2026, 6, 13, 12, 0, 0);

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
  storeRoot = mkdtempSync(path.join(tmpdir(), "lead-scoring-"));
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
    verticals: ["trades/plumbing"],
    roles: ["owner"],
    dealbreakers: ["gambling"],
  },
};

describe("runLeadScoring (B-crm.2)", () => {
  it("is honestly disarmed without an ICP block", async () => {
    const { ctx, repos, deps } = await setup();
    await repos.leads.add(ctx, { source: "csv", email: "a@x.example" });

    const noProfile = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
    expect(noProfile).toMatchObject({ armed: false, reason: "no active brand profile", scored: 0 });

    await repos.brandProfiles.create(ctx, { config: {}, activate: true });
    const noIcp = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
    expect(noIcp.armed).toBe(false);
    expect(noIcp.reason).toMatch(/no ICP block/);
    expect((await repos.leads.list(ctx, { status: "new" }))).toHaveLength(1); // untouched
  });

  it("scores every NEW lead, flips them to scored, and an exact replay appends nothing", async () => {
    const { ctx, repos, deps } = await setup();
    await repos.brandProfiles.create(ctx, { config: ICP_CONFIG, activate: true });
    await repos.leads.add(ctx, {
      source: "csv",
      email: "owner@plumbing.example",
      company: "Sydney Plumbing Co",
      role: "Owner",
    });
    // An email-only lead: no embeddable text — must NOT enter the embed
    // batch (the 8a2bbba lesson) but must still score.
    await repos.leads.add(ctx, { source: "waitlist", email: "bare@x.example" });
    const dismissed = await repos.leads.add(ctx, { source: "csv", email: "no@x.example" });
    await repos.leads.setStatus(ctx, dismissed.lead.id, "dismissed");

    const run = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
    expect(run).toMatchObject({ armed: true, candidates: 2, scored: 2, rescored: 0 });

    expect(await repos.leads.list(ctx, { status: "new" })).toHaveLength(0);
    expect(await repos.leads.list(ctx, { status: "scored" })).toHaveLength(2);
    // Dismissed leads are never scored — dismissal is operator signal.
    expect(await repos.leadScores.listByLead(ctx, dismissed.lead.id)).toHaveLength(0);

    const bare = await repos.leads.getByEmail(ctx, "bare@x.example");
    const bareScore = await repos.leadScores.latestByLead(ctx, bare!.id);
    expect((bareScore!.reasons as string[])[0]).toMatch(/relevance disarmed/);
    const strong = await repos.leads.getByEmail(ctx, "owner@plumbing.example");
    const strongScore = await repos.leadScores.latestByLead(ctx, strong!.id);
    expect(strongScore!.score).toBeGreaterThan(0.5);
    expect(strongScore!.profileHash).toBe(run.profileHash);

    // Exact replay: same clock, same profile → nothing appended, nothing flipped.
    const replay = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
    expect(replay).toMatchObject({ candidates: 0, scored: 0 });
  });

  it("re-scores exactly the leads whose latest score predates an ICP edit", async () => {
    const { ctx, repos, deps } = await setup();
    await repos.brandProfiles.create(ctx, { config: ICP_CONFIG, activate: true });
    await repos.leads.add(ctx, { source: "csv", email: "a@x.example", company: "Plumbing Co" });
    const first = await runLeadScoring(ctx, repos, { nowMs: NOW }, deps);
    expect(first.scored).toBe(1);

    // The founder edits the ICP → new active profile version → drift.
    await repos.brandProfiles.create(ctx, {
      config: { icp: { ...ICP_CONFIG.icp, regions: ["AU"] } },
      activate: true,
    });
    const second = await runLeadScoring(ctx, repos, { nowMs: NOW + 3_600_000 }, deps);
    expect(second).toMatchObject({ candidates: 1, scored: 1, rescored: 1 });
    expect(second.profileHash).not.toBe(first.profileHash);

    const lead = await repos.leads.getByEmail(ctx, "a@x.example");
    const history = await repos.leadScores.listByLead(ctx, lead!.id);
    expect(history).toHaveLength(2); // append-only — the queue reads the latest
  });
});
