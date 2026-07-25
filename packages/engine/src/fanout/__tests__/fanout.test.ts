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
  /** B7.e: bucket → platforms routing table on the tenant's active profile. */
  routing?: Record<string, string[]>,
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
      ...(routing ? { routing } : {}),
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
      expect(meta.promptVersion).toBe("fanout-generate.v2");
      expect(meta.brandProfileVersion).toBe(1);
      expect(meta.platformProfileVersion).toBe(`${draft.platform}.v1`);
    }

    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.tenantId).toBe(ctx.tenantId);
    expect(run?.promptVersion).toBe("fanout-generate.v2");
    expect(run?.brandProfileVersion).toBe(1);
    // s63: the lifecycle word is real now — a finished run says so.
    expect(run?.status).toBe("complete");
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

  it("self-heals a pre-lifecycle row: a fast-path replay over a fully-drafted run marks it complete without a generation call", async () => {
    const { ctx, repos, sourceId } = await setup();
    const calls: string[] = [];
    const driver = countingDriver(calls);
    const first = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver, capTokens: 1_000_000 },
    );
    // Simulate a row written before status had a writer (the W-audit's three
    // "pending" runs with judged drafts).
    await repos.fanoutRuns.setStatus(ctx, first.runId, "pending");

    const second = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver, capTokens: 1_000_000 },
    );
    expect(second.runId).toBe(first.runId);
    expect(calls).toHaveLength(2); // still only the first call's generations
    expect((await repos.fanoutRuns.get(ctx, first.runId))?.status).toBe("complete");
  });

  it("backfills only the platforms missing after a prior irrecoverable failure, reusing the same run and the untouched draft", async () => {
    const { ctx, repos, sourceId } = await setup();
    const fake = createFakeDraftGeneratorDriver();
    const firstCallCounts: Record<string, number> = {};
    // "x" is always schema-invalid (empty body fails fanoutShellOutputSchema's
    // min(1)) — irrecoverable after the bounded 3 repair attempts. "linkedin"
    // is healthy and succeeds on its first attempt, before "x" is reached
    // (platforms are processed in sorted order: linkedin, then x).
    const flakyDriver: DraftGeneratorDriver = async (req) => {
      firstCallCounts[req.platform] = (firstCallCounts[req.platform] ?? 0) + 1;
      if (req.platform === "x") return { candidate: { body: "" }, tokensIn: 1, tokensOut: 1 };
      return fake(req);
    };

    await expect(
      runFanout(
        ctx,
        repos,
        { sourceId, platforms: ["linkedin", "x"] },
        { driver: flakyDriver, capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/irrecoverable/);

    expect(firstCallCounts.linkedin).toBe(1);
    expect(firstCallCounts.x).toBe(3); // DEFAULT_MAX_ATTEMPTS bounded repair-retries, all exhausted

    // The run and the one successful draft persisted despite the throw —
    // recovered here via the events audit spine (I4), since runFanout itself
    // has nothing left to hand back after throwing.
    const runEventsBefore = await repos.events.list(ctx, { entityType: "fanout_run" });
    expect(runEventsBefore.map((e) => e.event)).toEqual([
      "fanout_run.created",
      "fanout_run.status_changed", // pending → running
      "fanout_run.last_error_recorded", // B4.5: x's failure is on the run row for triage
      "fanout_run.status_changed", // running → failed
    ]);
    const runIdBefore = runEventsBefore[0].entityId;
    expect((await repos.fanoutRuns.get(ctx, runIdBefore))?.status).toBe("failed");
    const draftEventsBefore = await repos.events.list(ctx, { entityType: "draft" });
    expect(draftEventsBefore).toHaveLength(1);
    const linkedinDraftIdBefore = draftEventsBefore[0].entityId;

    const secondCallCounts: Record<string, number> = {};
    const healthyDriver: DraftGeneratorDriver = (req) => {
      secondCallCounts[req.platform] = (secondCallCounts[req.platform] ?? 0) + 1;
      return fake(req);
    };
    const second = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"] },
      { driver: healthyDriver, capTokens: 1_000_000 },
    );

    expect(second.runId).toBe(runIdBefore);
    expect(second.created).toBe(false);
    expect(second.drafts).toHaveLength(2);
    // Only the missing platform was (re)generated.
    expect(secondCallCounts.linkedin).toBeUndefined();
    expect(secondCallCounts.x).toBe(1);
    // The original linkedin draft was reused untouched, not regenerated.
    const linkedinDraft = second.drafts.find((d) => d.platform === "linkedin");
    expect(linkedinDraft?.id).toBe(linkedinDraftIdBefore);

    const drafts = await repos.drafts.listByRun(ctx, runIdBefore);
    expect(drafts).toHaveLength(2);

    // B4.5: the completed backfill cleared the run's triage record; s63: and
    // the lifecycle word followed (failed → running → complete).
    const healed = await repos.fanoutRuns.get(ctx, runIdBefore);
    expect(healed?.lastError).toBeNull();
    expect(healed?.status).toBe("complete");
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

describe("runFanout — B7.e routing table (bucket → platforms as tenant config)", () => {
  it("a routed bucket REPLACES the caller's platforms and records provenance on the run", async () => {
    const { ctx, repos, sourceId } = await setup({}, { launch: ["linkedin", "x"] });
    const calls: string[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["bluesky"], bucket: "launch" },
      { driver: countingDriver(calls), capTokens: 1_000_000 },
    );

    expect(new Set(result.drafts.map((d) => d.platform))).toEqual(new Set(["linkedin", "x"]));
    expect(calls).not.toContain("bluesky");

    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.params).toEqual({ bucket: "launch", routed: true });
  });

  it("an unrouted bucket keeps the caller's platforms (default behavior), provenance says routed:false", async () => {
    const { ctx, repos, sourceId } = await setup({}, { launch: ["linkedin"] });
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["x"], bucket: "weekly-recap" },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    expect(result.drafts.map((d) => d.platform)).toEqual(["x"]);
    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.params).toEqual({ bucket: "weekly-recap", routed: false });
  });

  it("no routing config on the profile ⇒ bucket is provenance only", async () => {
    const { ctx, repos, sourceId } = await setup();
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], bucket: "launch" },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    expect(result.drafts.map((d) => d.platform)).toEqual(["linkedin"]);
  });

  it("no bucket ⇒ byte-identical pre-B7.e behavior, params stay unset", async () => {
    const { ctx, repos, sourceId } = await setup({}, { launch: ["linkedin"] });
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["x"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    expect(result.drafts.map((d) => d.platform)).toEqual(["x"]);
    const run = await repos.fanoutRuns.get(ctx, result.runId);
    // The column default — exactly what a pre-B7.e bucketless run stored.
    expect(run?.params).toEqual({});
  });

  it("idempotency operates on EFFECTIVE platforms: a routed run and the equivalent explicit run are the same run", async () => {
    const { ctx, repos, sourceId } = await setup({}, { launch: ["linkedin"] });
    const routed = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["x"], bucket: "launch" },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    const explicit = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    expect(explicit.created).toBe(false);
    expect(explicit.runId).toBe(routed.runId);
  });
});
