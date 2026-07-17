import { outreachEmailDraftMetaSchema, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runOutreachEmail } from "../compose";
import {
  createFakeOutreachEmailDriver,
  type GenerateOutreachEmailRequest,
  type OutreachEmailDriver,
} from "../shell/generator";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const RECIPIENT = { leadId: "lead-1", email: "sam@riverbendplumbing.example", name: "Sam Reyes" };

async function setup(identity?: Record<string, unknown>): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  briefSourceId: string;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: [],
      platformProfiles: {},
      ...(identity ? { identity } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("lead brief"),
    chunks: [
      {
        seq: 0,
        text: "Sam Reyes runs Riverbend Plumbing. Pain point: their website never brings in local work.",
        tokenCount: 16,
        contentHash: sha256Hex("brief-0"),
      },
    ],
  });
  return { ctx, repos, briefSourceId: source.id };
}

function capturingDriver(captured: GenerateOutreachEmailRequest[]): OutreachEmailDriver {
  const fake = createFakeOutreachEmailDriver();
  return (req) => {
    captured.push(req);
    return fake(req);
  };
}

describe("runOutreachEmail (B-crm.4 front half, keyless + networkless)", () => {
  it("lead brief -> ONE outreach_email draft in status generated with the pinned meta contract", async () => {
    const { ctx, repos, briefSourceId } = await setup({ company: "Thalon" });
    const captured: GenerateOutreachEmailRequest[] = [];
    const result = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: RECIPIENT },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    expect(result.draft.status).toBe("generated");
    expect(result.draft.format).toBe("outreach_email");
    expect(result.draft.platform).toBe("email");
    expect(result.draft.tenantId).toBe(ctx.tenantId);

    const meta = outreachEmailDraftMetaSchema.parse(result.draft.meta);
    // The judged body is subject + email body (the registry expectedBody join) —
    // the subject is INSIDE the claim surface the judge reads.
    expect(result.draft.body).toBe([meta.subject, meta.emailBody].join("\n\n"));
    expect(meta.recipient).toEqual(RECIPIENT);
    expect(meta.groundingSourceIds).toEqual([briefSourceId]);
    expect(meta.promptVersion).toBe("outreach-email-generate.v2");

    // The shell saw the brief as its ONLY lead material, plus voice + identity.
    expect(captured).toHaveLength(1);
    expect(captured[0].leadBrief).toContain("Riverbend Plumbing");
    expect(captured[0].recipient).toEqual({ email: RECIPIENT.email, name: RECIPIENT.name });
    expect(captured[0].identityBlock).toContain("Thalon");
  });

  it("is idempotent on the composed key: an identical re-compose returns the SAME draft with zero shell calls", async () => {
    const { ctx, repos, briefSourceId } = await setup();
    const captured: GenerateOutreachEmailRequest[] = [];
    const first = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: RECIPIENT },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );
    const again = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: RECIPIENT },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );
    expect(again.created).toBe(false);
    expect(again.draft.id).toBe(first.draft.id);
    expect(captured).toHaveLength(1);
  });

  it("a different lead over the same brief source is a DIFFERENT run (leadId is key material)", async () => {
    const { ctx, repos, briefSourceId } = await setup();
    const first = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: RECIPIENT },
      { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
    );
    const other = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: { leadId: "lead-2", email: "kim@example.com", name: null } },
      { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
    );
    expect(other.draft.id).not.toBe(first.draft.id);
    expect(other.runId).not.toBe(first.runId);
  });

  it("refuses a non-prompt brief source and a missing profile, loudly", async () => {
    const { ctx, repos } = await setup();
    const { source: docSource } = await repos.sourceChunks.ingest(ctx, {
      kind: "doc",
      contentHash: sha256Hex("doc"),
      chunks: [{ seq: 0, text: "doc text", tokenCount: 2, contentHash: sha256Hex("doc-0") }],
    });
    await expect(
      runOutreachEmail(
        ctx,
        repos,
        { briefSourceId: docSource.id, recipient: RECIPIENT },
        { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/expected "prompt"/);
    await expect(
      runOutreachEmail(
        ctx,
        repos,
        { briefSourceId: "00000000-0000-4000-8000-000000000000", recipient: RECIPIENT },
        { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/not found/);
  });

  it("records the lead on the run params (provenance) and meters the shell through the usage ledger", async () => {
    const { ctx, repos, briefSourceId } = await setup();
    const result = await runOutreachEmail(
      ctx,
      repos,
      { briefSourceId, recipient: RECIPIENT },
      { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
    );
    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.params).toMatchObject({ leadId: RECIPIENT.leadId });
    const spent = await repos.usageLedger.totalForDay(ctx);
    expect(spent.tokensIn + spent.tokensOut).toBeGreaterThan(0);
  });
});
