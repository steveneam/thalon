import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { IrrecoverableGenerationError, openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runKeywordExpansion } from "../expansion";
import { createFakeKeywordExpansionDriver, type KeywordExpansionDriver } from "../shell/expander";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const IDENTITY = {
  company: "Acme Motion",
  oneLiner: "Content automation for small teams.",
  audience: "Solo founders",
  offers: ["Automated video production"],
  links: {},
  facts: [],
  topics: ["content automation"],
};

async function setup(opts: { identity?: Record<string, unknown> | null; denylist?: string[] } = {}): Promise<{
  ctx: TenantCtx;
  repos: Repos;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: opts.denylist ?? [],
      platformProfiles: {},
      ...(opts.identity === null ? {} : { identity: opts.identity ?? IDENTITY }),
    },
    activate: true,
  });
  return { ctx, repos };
}

/** A driver returning exactly the given candidates (schema-shaped), with fixed token counts. */
function fixedDriver(keywords: Array<{ keyword: string; rationale: string }>): KeywordExpansionDriver {
  return async () => ({ candidate: { keywords }, tokensIn: 5, tokensOut: 5 });
}

describe("runKeywordExpansion (B6.8 — judged AI expansion, keyless via fake shell)", () => {
  it("persists grounded survivors as origin ai_expansion with rationale + prompt provenance", async () => {
    const { ctx, repos } = await setup();
    const result = await runKeywordExpansion(
      ctx,
      repos,
      {},
      { driver: fixedDriver([
        { keyword: "Content Automation vs manual posting", rationale: "commercial-intent comparison for the content automation topic" },
        { keyword: "automated video production pricing", rationale: "pricing intent on the video offer" },
      ]), capTokens: 1_000_000 },
    );

    expect(result.proposed).toBe(2);
    expect(result.rejected).toEqual([]);
    expect(result.persisted).toEqual([
      { keyword: "content automation vs manual posting", created: true },
      { keyword: "automated video production pricing", created: true },
    ]);
    expect(result.promptVersion).toBe("keyword-expand.v1");

    const stored = await repos.searchTargets.list(ctx);
    const target = stored.find((t) => t.keyword === "automated video production pricing")!;
    expect(target.origin).toBe("ai_expansion");
    expect(target.meta).toMatchObject({
      rationale: "pricing intent on the video offer",
      promptVersion: "keyword-expand.v1",
      brandProfileVersion: 1,
    });
    expect((target.meta as { groundingOverlap: number }).groundingOverlap).toBeGreaterThan(0.5);
  });

  it("G1-screens candidates against the tenant denylist — keyword AND rationale", async () => {
    const { ctx, repos } = await setup({ denylist: ["guaranteed rankings"] });
    const result = await runKeywordExpansion(
      ctx,
      repos,
      {},
      { driver: fixedDriver([
        { keyword: "content automation guaranteed rankings", rationale: "x" },
        { keyword: "content automation basics", rationale: "we promise guaranteed rankings here" },
        { keyword: "content automation for solo founders", rationale: "clean" },
      ]), capTokens: 1_000_000 },
    );
    expect(result.rejected).toEqual([
      { keyword: "content automation guaranteed rankings", reason: "denylist: matched guaranteed rankings" },
      { keyword: "content automation basics", reason: "denylist: matched guaranteed rankings" },
    ]);
    expect(result.persisted.map((p) => p.keyword)).toEqual(["content automation for solo founders"]);
  });

  it("rejects ungrounded keywords with the overlap ratio in the reason — outside vocabulary never persists", async () => {
    const { ctx, repos } = await setup();
    const result = await runKeywordExpansion(
      ctx,
      repos,
      {},
      { driver: fixedDriver([
        { keyword: "enterprise blockchain compliance suite", rationale: "invented" },
        { keyword: "best of the best", rationale: "scaffold words only" },
        { keyword: "what is content automation", rationale: "grounded" },
      ]), capTokens: 1_000_000 },
    );
    expect(result.rejected).toEqual([
      {
        keyword: "enterprise blockchain compliance suite",
        reason: "ungrounded: 0/4 content words appear in the profile identity (need ≥ 0.5)",
      },
      {
        keyword: "best of the best",
        reason: "ungrounded: only scaffold/function words — no content to ground",
      },
    ]);
    expect(result.persisted.map((p) => p.keyword)).toEqual(["what is content automation"]);
  });

  it("replays idempotently against existing targets and never rewrites first origin", async () => {
    const { ctx, repos } = await setup();
    await repos.searchTargets.add(ctx, {
      keyword: "content automation basics",
      origin: "operator",
      meta: {},
    });
    const driver = fixedDriver([{ keyword: "content automation basics", rationale: "r" }]);

    const result = await runKeywordExpansion(ctx, repos, {}, { driver, capTokens: 1_000_000 });
    expect(result.persisted).toEqual([{ keyword: "content automation basics", created: false }]);
    const stored = await repos.searchTargets.list(ctx);
    expect(stored).toHaveLength(1);
    expect(stored[0].origin).toBe("operator"); // first origin wins
  });

  it("hands the shell every existing keyword (all statuses) so dismissals are never re-proposed", async () => {
    const { ctx, repos } = await setup();
    const { target } = await repos.searchTargets.add(ctx, {
      keyword: "content automation basics",
      origin: "operator",
      meta: {},
    });
    await repos.searchTargets.setStatus(ctx, target.id, "dismissed");

    let seen: string[] = [];
    const spyDriver: KeywordExpansionDriver = async (req) => {
      seen = req.existingKeywords;
      return { candidate: { keywords: [{ keyword: "content automation faq", rationale: "r" }] }, tokensIn: 1, tokensOut: 1 };
    };
    await runKeywordExpansion(ctx, repos, {}, { driver: spyDriver, capTokens: 1_000_000 });
    expect(seen).toEqual(["content automation basics"]);
  });

  it("meters every attempt through the gateway guard — token spend lands in the usage ledger", async () => {
    const { ctx, repos } = await setup();
    await runKeywordExpansion(
      ctx,
      repos,
      {},
      { driver: fixedDriver([{ keyword: "content automation faq", rationale: "r" }]), capTokens: 1_000_000 },
    );
    const totals = await repos.usageLedger.totalForDay(ctx);
    expect(totals.tokensIn).toBe(5);
    expect(totals.tokensOut).toBe(5);
  });

  it("throws IrrecoverableGenerationError with lastError after bounded repair on persistent garbage", async () => {
    const { ctx, repos } = await setup();
    let calls = 0;
    const garbage: KeywordExpansionDriver = async () => {
      calls++;
      return { candidate: { nonsense: true }, tokensIn: 1, tokensOut: 1 };
    };
    await expect(
      runKeywordExpansion(ctx, repos, {}, { driver: garbage, capTokens: 1_000_000 }),
    ).rejects.toThrow(IrrecoverableGenerationError);
    expect(calls).toBe(3); // bounded, every attempt metered
    expect(await repos.searchTargets.list(ctx)).toEqual([]); // nothing persisted on failure
  });

  it("throws loudly when the identity is empty — nothing to ground to", async () => {
    const { ctx, repos } = await setup({ identity: null });
    await expect(
      runKeywordExpansion(ctx, repos, {}, { driver: createFakeKeywordExpansionDriver(), capTokens: 1_000_000 }),
    ).rejects.toThrow(/empty identity/);
  });

  it("the shipped fake driver expands the identity's own topics — grounded end-to-end, deterministic", async () => {
    const { ctx, repos } = await setup();
    const first = await runKeywordExpansion(
      ctx,
      repos,
      { count: 5 },
      { driver: createFakeKeywordExpansionDriver(), capTokens: 1_000_000 },
    );
    expect(first.persisted.length).toBeGreaterThan(0);
    expect(first.rejected).toEqual([]);

    // Deterministic: a replay proposes the same keywords, all already existing.
    const replay = await runKeywordExpansion(
      ctx,
      repos,
      { count: 5 },
      { driver: createFakeKeywordExpansionDriver(), capTokens: 1_000_000 },
    );
    expect(replay.persisted.every((p) => !p.created)).toBe(true);
  });
});
