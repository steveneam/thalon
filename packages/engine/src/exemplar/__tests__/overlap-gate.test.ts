import { tenantCtx, InvalidTransitionError, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { checkNgramOverlap, EXEMPLAR_OVERLAP_GATE, runExemplarOverlapGate } from "../overlap-gate";

describe("checkNgramOverlap (pure core gate, SPINE §1 doctrine)", () => {
  const exemplar = {
    sourceId: "src-1",
    chunkId: "chunk-1",
    text: "Our repair clinic keeps usable gear out of landfill every single month",
  };

  it("flags a verbatim 8-word run reused from an exemplar chunk", () => {
    const result = checkNgramOverlap(
      "Come by — our repair clinic keeps usable gear out of landfill, it's great.",
      [exemplar],
    );
    expect(result.breached).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].exemplarChunkId).toBe("chunk-1");
  });

  it("does not flag a paraphrase that shares only a few words", () => {
    const result = checkNgramOverlap(
      "We host a free gear-repair clinic every first Saturday of the month.",
      [exemplar],
    );
    expect(result.breached).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("does not flag unrelated short bodies below the n-gram size", () => {
    const result = checkNgramOverlap("Short post.", [exemplar]);
    expect(result.breached).toBe(false);
  });

  it("is case- and punctuation-insensitive", () => {
    const result = checkNgramOverlap(
      "OUR REPAIR CLINIC KEEPS USABLE GEAR OUT OF LANDFILL, guaranteed.",
      [exemplar],
    );
    expect(result.breached).toBe(true);
  });

  it("is deterministic: identical inputs always yield identical output", () => {
    const body = "Our repair clinic keeps usable gear out of landfill and more.";
    expect(checkNgramOverlap(body, [exemplar])).toEqual(checkNgramOverlap(body, [exemplar]));
  });
});

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setupDraft(body: string): Promise<{ ctx: TenantCtx; repos: Repos; draftId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("pillar source"),
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:run`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "linkedin",
    body,
    generationKey: sha256Hex(`${ctx.tenantId}:draft`),
  });
  return { ctx, repos, draftId: draft.id };
}

describe("runExemplarOverlapGate (B2.4 invariant: exemplars are grounding-only, never republished)", () => {
  const exemplarChunks = [
    {
      sourceId: "src-1",
      chunkId: "chunk-1",
      text: "Our repair clinic keeps usable gear out of landfill every single month",
    },
  ];

  it("a verbatim-reuse draft is driven to blocked with an exemplar_overlap judge_results row, and can never reach queued", async () => {
    const { ctx, repos, draftId } = await setupDraft(
      "Come by — our repair clinic keeps usable gear out of landfill, it's great.",
    );

    const outcome = await runExemplarOverlapGate(repos, { ctx, draftId, exemplarChunks });
    expect(outcome.status).toBe("blocked");

    const draft = await repos.drafts.get(ctx, draftId);
    expect(draft.status).toBe("blocked");

    const rows = await repos.judgeResults.listForDraft(ctx, draftId);
    expect(rows.map((r) => r.gate)).toContain(EXEMPLAR_OVERLAP_GATE);
    const gateRow = rows.find((r) => r.gate === EXEMPLAR_OVERLAP_GATE);
    expect(gateRow?.verdict).toBe("fail");
    expect(gateRow?.bodyHash).toBe(draft.bodyHash);

    await expect(repos.drafts.transition(ctx, draftId, "queued")).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("a clean (non-overlapping) draft is left untouched in generated status, ready for the normal judge harness", async () => {
    const { ctx, repos, draftId } = await setupDraft(
      "We host a free gear-repair clinic every first Saturday of the month.",
    );

    const outcome = await runExemplarOverlapGate(repos, { ctx, draftId, exemplarChunks });
    expect(outcome.status).toBe("clear");

    const draft = await repos.drafts.get(ctx, draftId);
    expect(draft.status).toBe("generated");

    const rows = await repos.judgeResults.listForDraft(ctx, draftId);
    expect(rows).toHaveLength(0);
  });
});
