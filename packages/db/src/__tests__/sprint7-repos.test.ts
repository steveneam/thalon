import { tenantCtx, InvalidLeadTransitionError, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";
import { NotFoundError } from "../errors";
import type { Repos } from "../repos";
import { leadEmailHash } from "../repos/leads";

/**
 * Sprint-7 contract-window repos (B-crm.1 leads · B-crm.2 lead scores).
 * Same discipline as sprint6-repos.test.ts: every behavior test doubles as
 * the tenancy-wall proof and the B4.4 events-coverage pin for these repos'
 * write fns.
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

describe("leads repo (B-crm.1)", () => {
  it("adds idempotently on the normalized email hash — case/whitespace variants collapse, first intake wins", async () => {
    const { ctx, other, repos } = await setup();
    const first = await repos.leads.add(ctx, {
      source: "csv",
      email: "Jane.Doe@Acme.com",
      name: "Jane Doe",
      company: "Acme Plumbing",
      role: "owner",
      meta: { row: 3 },
    });
    expect(first.created).toBe(true);
    expect(first.lead.email).toBe("Jane.Doe@Acme.com"); // stored as supplied (trimmed)
    expect(first.lead.emailHash).toBe(leadEmailHash("jane.doe@acme.com"));
    expect(first.lead.status).toBe("new");

    // A waitlist-bridge replay of the same human — different casing, extra
    // whitespace — returns the EXISTING lead untouched.
    const replay = await repos.leads.add(ctx, {
      source: "waitlist",
      email: "  jane.doe@ACME.com ",
      notes: "signed up via referral",
    });
    expect(replay.created).toBe(false);
    expect(replay.lead.id).toBe(first.lead.id);
    expect(replay.lead.source).toBe("csv"); // provenance never rewritten
    expect(replay.lead.notes).toBeNull(); // first intake wins
    expect(await repos.leads.list(ctx)).toHaveLength(1);

    // getByEmail resolves any variant of the address.
    const found = await repos.leads.getByEmail(ctx, "JANE.DOE@acme.com");
    expect(found?.id).toBe(first.lead.id);

    // Tenancy walls: same contact is a separate lead per tenant; foreign reads null.
    const foreign = await repos.leads.add(other, { source: "csv", email: "jane.doe@acme.com" });
    expect(foreign.created).toBe(true);
    expect(await repos.leads.get(other, first.lead.id)).toBeNull();

    // The replayed add appended no event (B4.4 pin: lead.created once).
    const events = await repos.events.list(ctx, { entityType: "lead", entityId: first.lead.id });
    expect(events.map((e) => e.event)).toEqual(["lead.created"]);
  });

  it("rejects an invalid lead loudly at the write door — nothing stores", async () => {
    const { ctx, repos } = await setup();
    await expect(repos.leads.add(ctx, { source: "csv", email: "not-an-email" })).rejects.toThrow();
    // A scraped/unknown provenance is structurally impossible.
    await expect(
      repos.leads.add(ctx, { source: "scraped" as never, email: "a@b.co" }),
    ).rejects.toThrow();
    expect(await repos.leads.list(ctx)).toHaveLength(0);
  });

  it("guards status transitions by the contracts rulebook and audits each change", async () => {
    const { ctx, other, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "api", email: "gm@grocer.example" });

    const scored = await repos.leads.setStatus(ctx, lead.id, "scored");
    expect(scored.status).toBe("scored");
    // scored → new is not a thing; dismissed is terminal for now (B-crm.4 extends additively).
    await expect(repos.leads.setStatus(ctx, lead.id, "new")).rejects.toBeInstanceOf(
      InvalidLeadTransitionError,
    );
    const dismissed = await repos.leads.setStatus(ctx, lead.id, "dismissed");
    expect(dismissed.status).toBe("dismissed");
    await expect(repos.leads.setStatus(ctx, lead.id, "scored")).rejects.toBeInstanceOf(
      InvalidLeadTransitionError,
    );

    // Foreign writes 404 before the rulebook is even consulted.
    await expect(repos.leads.setStatus(other, lead.id, "dismissed")).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const events = await repos.events.list(ctx, { entityType: "lead", entityId: lead.id });
    expect(events.map((e) => e.event)).toEqual([
      "lead.created",
      "lead.status_changed",
      "lead.status_changed",
    ]);
    expect(events.at(-1)?.payload).toEqual({ from: "scored", to: "dismissed" });
  });

  it("lists by status — the scoring job's NEW read and the queue's SCORED read", async () => {
    const { ctx, repos } = await setup();
    await repos.leads.add(ctx, { source: "csv", email: "a@x.example" });
    const b = await repos.leads.add(ctx, { source: "csv", email: "b@x.example" });
    await repos.leads.setStatus(ctx, b.lead.id, "scored");
    expect((await repos.leads.list(ctx, { status: "new" })).map((l) => l.email)).toEqual([
      "a@x.example",
    ]);
    expect(await repos.leads.list(ctx, { status: "scored" })).toHaveLength(1);
  });
});

describe("lead scores repo (B-crm.2)", () => {
  it("appends idempotently on (lead, profileHash, scoredAt); profile drift accrues history; latest wins the queue read", async () => {
    const { ctx, other, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "owner@cafe.example" });
    const t1 = new Date("2026-07-13T00:00:00Z");
    const t2 = new Date("2026-07-14T00:00:00Z");

    const first = await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.72,
      reasons: ["strong vertical match: food/café"],
      signals: { fit: 1, completeness: 0.6 },
      profileHash: "icp-v1",
      scoredAt: t1,
    });
    expect(first.created).toBe(true);

    // Replaying the same scoring run appends nothing.
    const replay = await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.99, // even a drifted value cannot rewrite history
      profileHash: "icp-v1",
      scoredAt: t1,
    });
    expect(replay.created).toBe(false);
    expect(replay.score.id).toBe(first.score.id);
    expect(replay.score.score).toBe(0.72);

    // A profile edit changes the hash → re-score accrues as new history.
    await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: 0.35,
      reasons: ["dealbreaker: franchise HQ"],
      profileHash: "icp-v2",
      scoredAt: t2,
    });
    const history = await repos.leadScores.listByLead(ctx, lead.id);
    expect(history.map((s) => s.profileHash)).toEqual(["icp-v1", "icp-v2"]);
    expect((await repos.leadScores.latestByLead(ctx, lead.id))?.score).toBe(0.35);

    // Tenancy walls: foreign reads are empty; the replayed append pinned no second event.
    expect(await repos.leadScores.listByLead(other, lead.id)).toHaveLength(0);
    expect(await repos.leadScores.latestByLead(other, lead.id)).toBeNull();
    const events = await repos.events.list(ctx, { entityType: "lead_score" });
    expect(events.map((e) => e.event)).toEqual(["lead_score.recorded", "lead_score.recorded"]);
  });

  it("refuses to score a foreign or unknown lead — the FK alone is not the tenancy wall", async () => {
    const { ctx, other, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "x@y.example" });
    await expect(
      repos.leadScores.append(other, {
        leadId: lead.id,
        score: 0.5,
        profileHash: "icp-v1",
        scoredAt: new Date("2026-07-13T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an out-of-range score or empty profile hash loudly — nothing stores", async () => {
    const { ctx, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "z@y.example" });
    const scoredAt = new Date("2026-07-13T00:00:00Z");
    await expect(
      repos.leadScores.append(ctx, { leadId: lead.id, score: 1.2, profileHash: "h", scoredAt }),
    ).rejects.toThrow();
    await expect(
      repos.leadScores.append(ctx, { leadId: lead.id, score: 0.5, profileHash: "", scoredAt }),
    ).rejects.toThrow();
    expect(await repos.leadScores.listByLead(ctx, lead.id)).toHaveLength(0);
  });
});
