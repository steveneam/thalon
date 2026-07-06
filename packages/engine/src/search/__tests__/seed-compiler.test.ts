import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { compileSearchTargets, compileSeedKeywords } from "../seed-compiler";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const IDENTITY = {
  company: "Acme Motion",
  audience: "Solo founders",
  offers: ["Automated video production"],
  links: {},
  facts: [],
  topics: ["content automation"],
};

async function setup(identity: Record<string, unknown> = IDENTITY): Promise<{
  ctx: TenantCtx;
  repos: Repos;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {}, identity },
    activate: true,
  });
  return { ctx, repos };
}

describe("compileSeedKeywords (B6.8 deterministic expansion — pure core, zero LLM)", () => {
  it("expands topics × offers × audience × forms deterministically, normalized and deduped", () => {
    const result = compileSeedKeywords(IDENTITY);
    const keywords = result.keywords.map((k) => k.keyword);
    expect(keywords).toEqual([
      "content automation",
      "what is content automation",
      "how does content automation work",
      "best content automation",
      "content automation for solo founders",
      "automated video production",
      "what is automated video production",
      "how does automated video production work",
      "best automated video production",
      "automated video production for solo founders",
    ]);
    // Provenance rides every keyword — which identity field seeded it, under which form.
    expect(result.keywords[1].meta).toEqual({
      seededFrom: { field: "topics", value: "content automation" },
      form: "what is {subject}",
    });
    expect(result.keywords[5].meta.seededFrom.field).toBe("offers");
    expect(result.skipped).toEqual([]);
    expect(result.truncated).toBe(0);

    // Byte-stable: the same identity always compiles to the identical list.
    expect(compileSeedKeywords(IDENTITY)).toEqual(result);
  });

  it("audience-shaped forms are reported (not silently dropped) when the identity has no audience", () => {
    const result = compileSeedKeywords({ ...IDENTITY, audience: undefined });
    expect(result.keywords.map((k) => k.keyword)).not.toContainEqual(
      expect.stringContaining(" for "),
    );
    expect(result.skipped).toEqual([
      { form: "{subject} for {audience}", reason: "form needs {audience} but the identity has none" },
    ]);
  });

  it("skips statement-length subjects with a reason and counts the maxKeywords overflow", () => {
    const longOffer = "we build a fully managed end-to-end content pipeline that plans, scripts, renders and schedules everything for you";
    const result = compileSeedKeywords(
      { ...IDENTITY, offers: [longOffer] },
      { maxKeywords: 3 },
    );
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ reason: expect.stringMatching(/exceeds 80 chars/) }),
    );
    expect(result.keywords).toHaveLength(3);
    expect(result.truncated).toBe(2); // topic expanded to 5 forms; 2 dropped by the cap, visibly
  });

  it("normalizes casing/whitespace/trailing punctuation so recompiles are byte-stable", () => {
    const result = compileSeedKeywords({
      ...IDENTITY,
      topics: ["  Content   Automation. "],
      offers: [],
      audience: "SOLO Founders!",
    });
    expect(result.keywords[0].keyword).toBe("content automation");
    expect(result.keywords.at(-1)!.keyword).toBe("content automation for solo founders");
  });

  it("forms are config — a tenant reshapes the expansion as data", () => {
    const result = compileSeedKeywords(IDENTITY, { forms: ["{subject} pricing"] });
    expect(result.keywords.map((k) => k.keyword)).toEqual([
      "content automation pricing",
      "automated video production pricing",
    ]);
  });
});

describe("compileSearchTargets (persisting orchestrator — idempotent recompiles)", () => {
  it("persists every compiled keyword as origin profile_seed and replays cleanly", async () => {
    const { ctx, repos } = await setup();

    const first = await compileSearchTargets(ctx, repos);
    expect(first.keywords).toHaveLength(10);
    expect(first.created).toBe(10);
    expect(first.existing).toBe(0);

    const stored = await repos.searchTargets.list(ctx);
    expect(stored).toHaveLength(10);
    expect(new Set(stored.map((t) => t.origin))).toEqual(new Set(["profile_seed"]));
    const sample = stored.find((t) => t.keyword === "what is content automation")!;
    expect(sample.meta).toEqual({
      seededFrom: { field: "topics", value: "content automation" },
      form: "what is {subject}",
    });

    // Recompile: zero new rows, everything reported as existing.
    const replay = await compileSearchTargets(ctx, repos);
    expect(replay.created).toBe(0);
    expect(replay.existing).toBe(10);
    expect(await repos.searchTargets.list(ctx)).toHaveLength(10);
  });

  it("first origin wins: an operator-added keyword the compiler re-derives stays operator, and a dismissal survives recompiles", async () => {
    const { ctx, repos } = await setup();
    const { target } = await repos.searchTargets.add(ctx, {
      keyword: "content automation",
      origin: "operator",
      meta: {},
    });
    await repos.searchTargets.setStatus(ctx, target.id, "dismissed");

    const result = await compileSearchTargets(ctx, repos);
    expect(result.created).toBe(9);
    expect(result.existing).toBe(1);

    const kept = (await repos.searchTargets.list(ctx)).find(
      (t) => t.keyword === "content automation",
    )!;
    expect(kept.origin).toBe("operator");
    expect(kept.status).toBe("dismissed");
  });

  it("throws when the tenant has no active brand profile — there is no identity to expand", async () => {
    handle = await openTestDb();
    const { repos } = handle;
    const tenant = await repos.tenants.create({ slug: "bare", name: "Bare" });
    await expect(compileSearchTargets(tenantCtx(tenant.id), repos)).rejects.toThrow(
      /no active brand profile/,
    );
  });
});
