import {
  tenantCtx,
  InvalidTransitionError,
  type PlatformProfile,
  type TenantCtx,
} from "@thalon/contracts";
import { BudgetExceededError, openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runFanout } from "../fanout";
import { createFakeDraftGeneratorDriver, type DraftGeneratorDriver } from "../shell/generator";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(
  platformProfiles: Record<string, PlatformProfile> = {},
): Promise<{ ctx: TenantCtx; repos: Repos; sourceId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: [],
      platformProfiles,
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("a launch announcement"),
    chunks: [
      {
        seq: 0,
        text: "We shipped a major feature today.",
        tokenCount: 6,
        contentHash: sha256Hex("chunk-0"),
      },
      {
        seq: 1,
        text: "It cuts onboarding time in half.",
        tokenCount: 7,
        contentHash: sha256Hex("chunk-1"),
      },
    ],
  });
  return { ctx, repos, sourceId: source.id };
}

function countingDriver(calls: string[]): DraftGeneratorDriver {
  const fake = createFakeDraftGeneratorDriver();
  return (req) => {
    calls.push(req.platform);
    return fake(req);
  };
}

describe("runFanout (B1.2 end-to-end, keyless + networkless)", () => {
  it("fans a source out into one draft per platform, all landing in status generated", async () => {
    const { ctx, repos, sourceId } = await setup();
    const calls: string[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver: countingDriver(calls), capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    expect(result.drafts).toHaveLength(2);
    expect(new Set(result.drafts.map((d) => d.platform))).toEqual(new Set(["linkedin", "x"]));

    for (const draft of result.drafts) {
      expect(draft.status).toBe("generated");
      expect(draft.tenantId).toBe(ctx.tenantId);
      expect(draft.fanoutRunId).toBe(result.runId);
      const meta = draft.meta as Record<string, unknown>;
      expect(meta.promptVersion).toBe("fanout-generate.v1");
      expect(meta.brandProfileVersion).toBe(1);
      expect(meta.platformProfileVersion).toBe(`${draft.platform}.v1`);
    }

    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.tenantId).toBe(ctx.tenantId);
    expect(run?.promptVersion).toBe("fanout-generate.v1");
    expect(run?.brandProfileVersion).toBe(1);
  });

  it("prefers a tenant-supplied platform profile over the shipped file default", async () => {
    const { ctx, repos, sourceId } = await setup({
      linkedin: { tone: "tenant custom tone", charLimit: 500 },
    });
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.platformProfileVersion).toBe("brand-profile.v1");
  });

  it("is idempotent: running the same fan-out twice does not duplicate drafts", async () => {
    const { ctx, repos, sourceId } = await setup();
    const calls: string[] = [];
    const driver = countingDriver(calls);

    const first = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver, capTokens: 1_000_000 },
    );
    expect(first.created).toBe(true);
    expect(calls).toHaveLength(2);

    const second = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver, capTokens: 1_000_000 },
    );
    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    // No new generation calls on replay.
    expect(calls).toHaveLength(2);
    expect(second.drafts.map((d) => d.id).sort()).toEqual(first.drafts.map((d) => d.id).sort());

    const drafts = await repos.drafts.listByRun(ctx, first.runId);
    expect(drafts).toHaveLength(2);
  });

  it("a fanned-out draft cannot reach queued or approved without passing through the judge", async () => {
    const { ctx, repos, sourceId } = await setup();
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    const draftId = result.drafts[0].id;

    await expect(repos.drafts.transition(ctx, draftId, "queued")).rejects.toThrow(
      InvalidTransitionError,
    );
    await expect(repos.drafts.transition(ctx, draftId, "approved")).rejects.toThrow(
      InvalidTransitionError,
    );

    const draft = await repos.drafts.get(ctx, draftId);
    expect(draft.status).toBe("generated");
  });

  it("surfaces BudgetExceededError as an operational halt instead of silently degrading", async () => {
    const { ctx, repos, sourceId } = await setup();
    await expect(
      runFanout(
        ctx,
        repos,
        { sourceId, platforms: ["linkedin"] },
        { driver: createFakeDraftGeneratorDriver(), capTokens: 0 },
      ),
    ).rejects.toThrow(BudgetExceededError);
  });
});
