import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { createFakeEmbeddingDriver, createFakeOutreachEmailDriver } from "@thalon/engine";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import { ComposeEmailError, composeEmailDraft, renderOutreachBrief, type ComposeEmailDeps } from "../service";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const JUDGE_PASS = { verdict: "pass" as const, claims: [{ claim: "grounded", supported: true, chunkRef: "c1" }] };

/** Always-the-same-candidate G3 driver — keeps every compose test keyless (the approve-queue test convention). */
function fixedJudgeDriver(candidate: unknown): JudgeModelDriver {
  return async () => ({ candidate, tokensIn: 1, tokensOut: 1 });
}

function keylessDeps(overrides: Partial<ComposeEmailDeps> = {}): ComposeEmailDeps {
  return {
    ingest: { embedder: createFakeEmbeddingDriver(), capTokens: 1_000_000 },
    compose: { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
    judge: {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_PASS),
      capTokens: 1_000_000,
    },
    ...overrides,
  };
}

async function setup(config: Record<string, unknown> = {}): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  leadId: string;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {}, ...config },
    activate: true,
  });
  const { lead } = await repos.leads.add(ctx, {
    source: "csv",
    email: "sam@riverbendplumbing.example",
    name: "Sam Reyes",
    company: "Riverbend Plumbing",
    role: "Owner",
    painPoint: "website never brings in local work",
  });
  return { ctx, repos, leadId: lead.id };
}

const CONTEXT = {
  contact: "Sam Reyes",
  company: "Riverbend Plumbing",
  painPoint: "website never brings in local work",
};

describe("composeEmailDraft (→Email draft-only slice, keyless + networkless)", () => {
  it("pruned context → brief source → judged outreach_email draft PARKED IN THE QUEUE (no send path anywhere)", async () => {
    const { ctx, repos, leadId } = await setup();
    const result = await composeEmailDraft(ctx, repos, { leadId, context: CONTEXT }, keylessDeps());

    expect(result.status).toBe("queued");
    expect(result.alreadyComposed).toBe(false);

    const draft = await repos.drafts.get(ctx, result.draftId);
    expect(draft.format).toBe("outreach_email");
    expect(draft.platform).toBe("email");
    expect(draft.status).toBe("queued");

    // The brief source IS the grounding: exactly what the operator kept.
    const meta = draft.meta as { groundingSourceIds: string[]; recipient: { email: string } };
    expect(meta.recipient.email).toBe("sam@riverbendplumbing.example");
    const chunks = await repos.sourceChunks.listBySource(ctx, meta.groundingSourceIds[0]);
    const briefText = chunks.map((c) => c.text).join("\n\n");
    expect(briefText).toContain("Pain point (in the lead's words): website never brings in local work");

    // The full judge trail exists: g1 + both g3 tiers appended.
    const results = await repos.judgeResults.listForDraft(ctx, draft.id);
    const gates = results.map((r) => r.gate);
    expect(gates).toContain("g1");
    expect(gates).toContain("g3_screen");
    expect(gates).toContain("g3_final");
  });

  it("a pruned chip NEVER reaches the brief (removed company stays out)", async () => {
    const { ctx, repos, leadId } = await setup();
    const result = await composeEmailDraft(
      ctx,
      repos,
      { leadId, context: { painPoint: CONTEXT.painPoint } },
      keylessDeps(),
    );
    const draft = await repos.drafts.get(ctx, result.draftId);
    const meta = draft.meta as { groundingSourceIds: string[] };
    const chunks = await repos.sourceChunks.listBySource(ctx, meta.groundingSourceIds[0]);
    const briefText = chunks.map((c) => c.text).join("\n\n");
    expect(briefText).not.toContain("Riverbend Plumbing");
  });

  it("the g1 denylist blocks an email like any other draft — full gate, honest reason", async () => {
    const { ctx, repos, leadId } = await setup({ denylist: ["thought"] });
    // The fake driver's subject always contains "A thought for …".
    const result = await composeEmailDraft(ctx, repos, { leadId, context: CONTEXT }, keylessDeps());
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("g1 denylist fail");
  });

  it("the B7.a cadence gate arms on the email platform from profile config", async () => {
    const { ctx, repos, leadId } = await setup({ cadence: { email: { maxPerDay: 1 } } });
    const first = await composeEmailDraft(ctx, repos, { leadId, context: CONTEXT }, keylessDeps());
    expect(first.status).toBe("queued");

    // A SECOND lead the same day: over the 1/day email cadence → blocked before model spend.
    const { lead: lead2 } = await repos.leads.add(ctx, {
      source: "csv",
      email: "kim@harborcafe.example",
      name: "Kim Ito",
      company: "Harbor Cafe",
      painPoint: "no online ordering",
    });
    const second = await composeEmailDraft(
      ctx,
      repos,
      { leadId: lead2.id, context: { painPoint: "no online ordering" } },
      keylessDeps(),
    );
    expect(second.status).toBe("blocked");
    expect(second.blockedReason).toBe('cadence limit for "email"');
  });

  it("an identical re-compose returns the SAME draft already past the judge — zero new spend, no state fight", async () => {
    const { ctx, repos, leadId } = await setup();
    const first = await composeEmailDraft(ctx, repos, { leadId, context: CONTEXT }, keylessDeps());
    const again = await composeEmailDraft(ctx, repos, { leadId, context: CONTEXT }, keylessDeps());
    expect(again.draftId).toBe(first.draftId);
    expect(again.alreadyComposed).toBe(true);
    expect(again.status).toBe("queued");
  });

  it("refuses loudly: unknown lead (404) and an empty brief (400)", async () => {
    const { ctx, repos, leadId } = await setup();
    await expect(
      composeEmailDraft(
        ctx,
        repos,
        { leadId: "00000000-0000-4000-8000-000000000000", context: CONTEXT },
        keylessDeps(),
      ),
    ).rejects.toMatchObject({ httpStatus: 404 });
    await expect(composeEmailDraft(ctx, repos, { leadId }, keylessDeps())).rejects.toMatchObject({
      httpStatus: 400,
    });
  });

  it("renderOutreachBrief is deterministic, field-ordered, and skips absent fields", () => {
    expect(
      renderOutreachBrief({
        leadId: "x",
        prompt: "  mention the local angle  ",
        context: { contact: "Sam", painPoint: "no leads" },
      }),
    ).toBe("Contact: Sam\nPain point (in the lead's words): no leads\nOperator direction: mention the local angle");
    expect(() => renderOutreachBrief({ leadId: "x" })).toThrow(ComposeEmailError);
  });
});
