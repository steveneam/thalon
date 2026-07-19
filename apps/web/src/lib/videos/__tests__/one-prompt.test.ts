import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import {
  createFakeDirectionPolishDriver,
  createFakeDirectionScenesDriver,
  createFakeEmbeddingDriver,
  createFakeStoryboardStageDriver,
} from "@thalon/engine";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import { generateOnePromptVideo, type OnePromptVideoServiceDeps } from "../one-prompt";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const JUDGE_PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "grounded", supported: true, chunkRef: "c1" }],
};
const JUDGE_FAIL = { verdict: "fail" as const, claims: [{ claim: "ungrounded", supported: false }] };

/** Always-the-same-candidate G3 driver — keeps every test keyless (the approve-queue test convention). */
function fixedJudgeDriver(candidate: unknown): JudgeModelDriver {
  return async () => ({ candidate, tokensIn: 1, tokensOut: 1 });
}

function keylessDeps(overrides: Partial<OnePromptVideoServiceDeps> = {}): OnePromptVideoServiceDeps {
  return {
    ingest: { embedder: createFakeEmbeddingDriver(), capTokens: 1_000_000 },
    staged: {
      structureDriver: createFakeStoryboardStageDriver(),
      scenesDriver: createFakeDirectionScenesDriver(),
      polishDriver: createFakeDirectionPolishDriver(),
      capTokens: 1_000_000,
    },
    judge: {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_PASS),
      capTokens: 1_000_000,
    },
    now: () => new Date("2026-07-19T00:00:00.000Z"),
    ...overrides,
  };
}

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return { ctx, repos };
}

describe("generateOnePromptVideo (one-prompt video door, keyless + networkless)", () => {
  it("brief → judged direction doc IN THE QUEUE + staged project/takes/cut — the wire shape carries the trail", async () => {
    const { ctx, repos } = await setup();
    const result = await generateOnePromptVideo(
      ctx,
      repos,
      { prompt: "Introduce the staged flow.", sourceUrl: "https://example.com/x" },
      keylessDeps(),
    );

    expect(result.status).toBe("queued");
    expect(result.stageKeys).toEqual(["structure", "scenes_effects", "polish"]);
    const draft = await repos.drafts.get(ctx, result.draftId);
    expect(draft.format).toBe("direction_doc");
    expect(draft.status).toBe("queued");

    // The staged project tree exists and honestly carries NO rendered output.
    const project = await repos.videoProjects.get(ctx, result.projectId!);
    expect(project?.name).toBe(result.projectName);
    expect(await repos.videoTakes.list(ctx, project!.id)).toHaveLength(result.takeCount!);
    const cut = await repos.videoCuts.get(ctx, result.cutId!);
    expect(cut?.status).toBe("draft");
    expect(cut?.outputRef).toBeNull();
  });

  it("a blocked stage surfaces honestly — blocked wire state, no project staged", async () => {
    const { ctx, repos } = await setup();
    const result = await generateOnePromptVideo(
      ctx,
      repos,
      { prompt: "Introduce the staged flow." },
      keylessDeps({
        judge: {
          screenDriver: fixedJudgeDriver(JUDGE_PASS),
          finalDriver: fixedJudgeDriver(JUDGE_FAIL), // tier disagreement ⇒ blocked (I3)
          capTokens: 1_000_000,
        },
      }),
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedStageKey).toBe("structure");
    expect(result.projectId).toBeUndefined();
    expect(await repos.videoProjects.list(ctx)).toHaveLength(0);
    const draft = await repos.drafts.get(ctx, result.draftId);
    expect(draft.status).toBe("blocked");
  });
});
