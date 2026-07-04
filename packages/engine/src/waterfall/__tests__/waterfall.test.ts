import {
  tenantCtx,
  InvalidTransitionError,
  type PlatformProfile,
  type TenantCtx,
} from "@thalon/contracts";
import { BudgetExceededError, openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runWaterfall } from "../waterfall";
import { createFakeHighlightSelectDriver, type HighlightSelectDriver } from "../shell/generator";
import type { WindowConfig } from "../windows";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

// Small ms scale so fixture transcripts stay short and readable; the default
// production bounds (windows.ts DEFAULT_WINDOW_CONFIG) are exercised by
// windows.test.ts instead.
const WINDOW_CONFIG: WindowConfig = { minDurationMs: 1_000, maxDurationMs: 10_000, pauseGapMs: 300 };

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
  // Two natural beats: chunks 0-1 are contiguous (no pause), then a 500ms gap
  // (>= pauseGapMs) before chunk 2 — two candidate windows under WINDOW_CONFIG.
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "video_transcript",
    contentHash: sha256Hex("a pillar transcript"),
    chunks: [
      {
        seq: 0,
        text: "Here is the first big idea from the talk.",
        startMs: 0,
        endMs: 2_000,
        tokenCount: 8,
        contentHash: sha256Hex("chunk-0"),
      },
      {
        seq: 1,
        text: "It keeps going for a moment more.",
        startMs: 2_000,
        endMs: 4_000,
        tokenCount: 7,
        contentHash: sha256Hex("chunk-1"),
      },
      {
        seq: 2,
        text: "Now a totally separate second idea.",
        startMs: 4_500,
        endMs: 6_500,
        tokenCount: 6,
        contentHash: sha256Hex("chunk-2"),
      },
    ],
  });
  return { ctx, repos, sourceId: source.id };
}

function countingDriver(calls: string[]): HighlightSelectDriver {
  const fake = createFakeHighlightSelectDriver();
  return (req) => {
    calls.push(req.platform);
    return fake(req);
  };
}

describe("runWaterfall (B2.3 end-to-end, keyless + networkless)", () => {
  it("cuts one clip_plan draft per selected clip per platform, all landing in status generated", async () => {
    const { ctx, repos, sourceId } = await setup();
    const calls: string[] = [];
    const result = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"], windowConfig: WINDOW_CONFIG },
      { driver: countingDriver(calls), capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    // 2 candidate windows x 2 platforms = 4 drafts (fake driver selects every window).
    expect(result.drafts).toHaveLength(4);
    expect(new Set(result.drafts.map((d) => d.platform))).toEqual(new Set(["linkedin", "x"]));
    expect(calls.sort()).toEqual(["linkedin", "x"]);

    for (const draft of result.drafts) {
      expect(draft.status).toBe("generated");
      expect(draft.format).toBe("clip_plan");
      expect(draft.tenantId).toBe(ctx.tenantId);
      expect(draft.fanoutRunId).toBe(result.runId);
      const meta = draft.meta as Record<string, unknown>;
      expect(meta.promptVersion).toBe("highlight-select.v1");
      expect(meta.brandProfileVersion).toBe(1);
      expect(meta.platformProfileVersion).toBe(`${draft.platform}.v1`);
      expect(typeof meta.startMs).toBe("number");
      expect(typeof meta.endMs).toBe("number");
      expect(meta.endMs as number).toBeGreaterThan(meta.startMs as number);
      expect(Array.isArray(meta.chunkSeqs)).toBe(true);
      expect(draft.body).toBe(
        [meta.hook, meta.captions, meta.platformCopy].join("\n\n"),
      );
    }

    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.tenantId).toBe(ctx.tenantId);
    expect(run?.promptVersion).toBe("highlight-select.v1");
    expect(run?.brandProfileVersion).toBe(1);
  });

  it("prefers a tenant-supplied platform profile over the shipped file default", async () => {
    const { ctx, repos, sourceId } = await setup({
      linkedin: { tone: "tenant custom tone", charLimit: 500 },
    });
    const result = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
      { driver: createFakeHighlightSelectDriver(), capTokens: 1_000_000 },
    );
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.platformProfileVersion).toBe("brand-profile.v1");
  });

  it("is idempotent: running the same waterfall twice does not duplicate drafts", async () => {
    const { ctx, repos, sourceId } = await setup();
    const calls: string[] = [];
    const driver = countingDriver(calls);

    const first = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"], windowConfig: WINDOW_CONFIG },
      { driver, capTokens: 1_000_000 },
    );
    expect(first.created).toBe(true);
    expect(calls).toHaveLength(2);

    const second = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"], windowConfig: WINDOW_CONFIG },
      { driver, capTokens: 1_000_000 },
    );
    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    // No new shell calls on replay.
    expect(calls).toHaveLength(2);
    expect(second.drafts.map((d) => d.id).sort()).toEqual(first.drafts.map((d) => d.id).sort());

    const drafts = await repos.drafts.listByRun(ctx, first.runId);
    expect(drafts).toHaveLength(4);
  });

  it("recovers a schema-invalid candidate via bounded repair retries before persisting", async () => {
    const { ctx, repos, sourceId } = await setup();
    const fake = createFakeHighlightSelectDriver();
    let attempts = 0;
    const repairingDriver: HighlightSelectDriver = async (req) => {
      attempts += 1;
      // First attempt: schema-invalid (empty clips array fails min(1)).
      if (attempts === 1) return { candidate: { clips: [] }, tokensIn: 1, tokensOut: 1 };
      return fake(req);
    };

    const result = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
      { driver: repairingDriver, capTokens: 1_000_000 },
    );

    expect(attempts).toBe(2); // one failed attempt, then a successful repair
    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts.every((d) => d.status === "generated")).toBe(true);
  });

  it("recovers a duplicate-windowIndex candidate via bounded repair retries before persisting", async () => {
    const { ctx, repos, sourceId } = await setup();
    const fake = createFakeHighlightSelectDriver();
    let attempts = 0;
    const repairingDriver: HighlightSelectDriver = async (req) => {
      attempts += 1;
      // First attempt: the same window selected twice — schema-shaped and
      // in-range, but a duplicate would collide on the draft generation key
      // (content-addressed on the window's time range) mid-persist.
      if (attempts === 1) {
        return {
          candidate: {
            clips: [
              { windowIndex: 0, hook: "hook a", captions: "captions a", platformCopy: "copy a" },
              { windowIndex: 0, hook: "hook b", captions: "captions b", platformCopy: "copy b" },
            ],
          },
          tokensIn: 1,
          tokensOut: 1,
        };
      }
      return fake(req);
    };

    const result = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
      { driver: repairingDriver, capTokens: 1_000_000 },
    );

    expect(attempts).toBe(2); // one rejected duplicate attempt, then a successful repair
    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts.every((d) => d.status === "generated")).toBe(true);
  });

  it("persists nothing for a platform whose shell only ever duplicates a window, keeping the platform backfillable", async () => {
    const { ctx, repos, sourceId } = await setup();
    const duplicatingDriver: HighlightSelectDriver = async () => ({
      candidate: {
        clips: [
          { windowIndex: 0, hook: "hook a", captions: "captions a", platformCopy: "copy a" },
          { windowIndex: 0, hook: "hook b", captions: "captions b", platformCopy: "copy b" },
        ],
      },
      tokensIn: 1,
      tokensOut: 1,
    });

    await expect(
      runWaterfall(
        ctx,
        repos,
        { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
        { driver: duplicatingDriver, capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/selected more than once/);

    // Nothing persisted for the platform — a later replay backfills it whole
    // instead of skipping a half-persisted platform forever.
    const draftEvents = await repos.events.list(ctx, { entityType: "draft" });
    expect(draftEvents).toHaveLength(0);
  });

  it("backfills only the platforms missing after a prior irrecoverable failure, reusing the same run and the untouched drafts", async () => {
    const { ctx, repos, sourceId } = await setup();
    const fake = createFakeHighlightSelectDriver();
    const firstCallCounts: Record<string, number> = {};
    // "x" always returns an empty clips array — schema-invalid (fails
    // min(1)) — irrecoverable after the bounded 3 repair attempts. "linkedin"
    // is healthy and succeeds on its first attempt, before "x" is reached
    // (platforms are processed in sorted order: linkedin, then x).
    const flakyDriver: HighlightSelectDriver = async (req) => {
      firstCallCounts[req.platform] = (firstCallCounts[req.platform] ?? 0) + 1;
      if (req.platform === "x") return { candidate: { clips: [] }, tokensIn: 1, tokensOut: 1 };
      return fake(req);
    };

    await expect(
      runWaterfall(
        ctx,
        repos,
        { sourceId, platforms: ["linkedin", "x"], windowConfig: WINDOW_CONFIG },
        { driver: flakyDriver, capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/irrecoverable/);

    expect(firstCallCounts.linkedin).toBe(1);
    expect(firstCallCounts.x).toBe(3); // DEFAULT_MAX_ATTEMPTS bounded repair-retries, all exhausted

    const runEventsBefore = await repos.events.list(ctx, { entityType: "fanout_run" });
    expect(runEventsBefore).toHaveLength(1);
    const runIdBefore = runEventsBefore[0].entityId;
    // linkedin selected both candidate windows -> 2 persisted drafts -> 2 events.
    const draftEventsBefore = await repos.events.list(ctx, { entityType: "draft" });
    expect(draftEventsBefore).toHaveLength(2);
    const linkedinDraftIdsBefore = draftEventsBefore.map((e) => e.entityId).sort();

    const secondCallCounts: Record<string, number> = {};
    const healthyDriver: HighlightSelectDriver = (req) => {
      secondCallCounts[req.platform] = (secondCallCounts[req.platform] ?? 0) + 1;
      return fake(req);
    };
    const second = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin", "x"], windowConfig: WINDOW_CONFIG },
      { driver: healthyDriver, capTokens: 1_000_000 },
    );

    expect(second.runId).toBe(runIdBefore);
    expect(second.created).toBe(false);
    expect(second.drafts).toHaveLength(4); // 2 linkedin (reused) + 2 x (backfilled)
    // Only the missing platform was (re)generated.
    expect(secondCallCounts.linkedin).toBeUndefined();
    expect(secondCallCounts.x).toBe(1);
    // The original linkedin drafts were reused untouched, not regenerated.
    const linkedinDraftIds = second.drafts
      .filter((d) => d.platform === "linkedin")
      .map((d) => d.id)
      .sort();
    expect(linkedinDraftIds).toEqual(linkedinDraftIdsBefore);

    const drafts = await repos.drafts.listByRun(ctx, runIdBefore);
    expect(drafts).toHaveLength(4);
  });

  it("a clip_plan draft cannot reach queued or approved without passing through the judge", async () => {
    const { ctx, repos, sourceId } = await setup();
    const result = await runWaterfall(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
      { driver: createFakeHighlightSelectDriver(), capTokens: 1_000_000 },
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
      runWaterfall(
        ctx,
        repos,
        { sourceId, platforms: ["linkedin"], windowConfig: WINDOW_CONFIG },
        { driver: createFakeHighlightSelectDriver(), capTokens: 0 },
      ),
    ).rejects.toThrow(BudgetExceededError);
  });

  it("throws when the source produces no candidate clip windows", async () => {
    const { ctx, repos, sourceId } = await setup();
    await expect(
      runWaterfall(
        ctx,
        repos,
        {
          sourceId,
          platforms: ["linkedin"],
          // No candidate meets a 1-hour minimum duration.
          windowConfig: { minDurationMs: 3_600_000, maxDurationMs: 3_600_000, pauseGapMs: 300 },
        },
        { driver: createFakeHighlightSelectDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/no candidate clip windows/);
  });
});
