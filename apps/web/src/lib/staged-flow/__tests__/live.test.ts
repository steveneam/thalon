import {
  DIRECTION_DOC_VERSION,
  directionDocDraftMetaSchema,
  tenantCtx,
  type TenantCtx,
} from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { fixtureStoryboardMeta } from "../fixtures";
import { getLiveStagedFlow } from "../live";

/**
 * s67 pin for the founder's s66 find: REAL one-prompt chains must project a
 * StagedFlowState from the drafts table (they used to 404 as "belongs to no
 * staged flow" because only the demo store answered). Seeded against real
 * (PGlite) repos — the B0.4 test pattern.
 */

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const docMetaFor = (priorDraftId: string) =>
  directionDocDraftMetaSchema.parse({
    doc: {
      docVersion: DIRECTION_DOC_VERSION,
      title: "Fernwood in 60 seconds",
      aspect: "16:9",
      fps: 30,
      pacing: "medium",
      scenes: [
        {
          sceneIndex: 0,
          heading: "Hook",
          narration: "Your metrics don't sleep.",
          onScreenText: null,
          visual: "dark dashboard glow",
          motion: "smooth",
          durationMs: 4000,
        },
      ],
      cta: null,
    },
    family: fixtureStoryboardMeta.family,
    stageKey: "scenes_effects",
    stageIndex: 1,
    priorDraftId,
    groundingSourceIds: fixtureStoryboardMeta.groundingSourceIds,
    promptVersion: "scenes-effects.v1",
    brandProfileVersion: 1,
    platformProfileVersion: fixtureStoryboardMeta.platformProfileVersion,
  });

async function seedChain(): Promise<{ ctx: TenantCtx; storyboard: Draft; doc: Draft }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("brief") });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["video"],
    promptVersion: "staged.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:staged-run`),
  });

  const storyboard = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "video",
    body: "Hook\nProblem\nSolution\nProof",
    generationKey: sha256Hex(`${ctx.tenantId}:sb`),
    format: "storyboard",
    meta: fixtureStoryboardMeta as unknown as Record<string, unknown>,
  });
  await repos.drafts.transition(ctx, storyboard.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: storyboard.id, gate: "g3_final", verdict: "pass" });
  const queued = await repos.drafts.transition(ctx, storyboard.id, "queued");

  const doc = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "video",
    body: "Your metrics don't sleep.",
    generationKey: sha256Hex(`${ctx.tenantId}:doc`),
    format: "direction_doc",
    meta: docMetaFor(storyboard.id) as unknown as Record<string, unknown>,
  });
  await repos.drafts.transition(ctx, doc.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: doc.id, gate: "g3_screen", verdict: "fail" });
  const blocked = await repos.drafts.transition(ctx, doc.id, "blocked", { reason: "tier disagreement" });

  return { ctx, storyboard: queued, doc: blocked };
}

describe("getLiveStagedFlow (the read half of the staged pass-3 swap)", () => {
  it("projects a real chain anchored at its blocked direction_doc — statuses, drafts, verdicts, no candidates", async () => {
    const { ctx, storyboard, doc } = await seedChain();
    const flow = await getLiveStagedFlow(handle!.repos, ctx, doc.id);
    expect(flow).not.toBeNull();
    expect(flow!.source).toBe("live");
    expect(flow!.family).toBe(fixtureStoryboardMeta.family);
    expect(flow!.currentIndex).toBe(1);

    const [structure, scenes, polish] = flow!.stages;
    expect(structure.status).toBe("done");
    expect(structure.draft?.id).toBe(storyboard.id);
    expect(structure.judgeResults.map((r) => r.gate)).toContain("g3_final");
    expect(scenes.status).toBe("current");
    expect(scenes.draft?.id).toBe(doc.id);
    expect(scenes.draft?.status).toBe("blocked");
    expect(scenes.candidates).toBeNull();
    expect(polish.status).toBe("locked");
    expect(polish.draft).toBeNull();
  });

  it("anchoring at the storyboard walks FORWARD to the same chain state", async () => {
    const { ctx, storyboard, doc } = await seedChain();
    const flow = await getLiveStagedFlow(handle!.repos, ctx, storyboard.id);
    expect(flow!.currentIndex).toBe(1);
    expect(flow!.stages[1].draft?.id).toBe(doc.id);
  });

  it("returns null for a non-stage draft and for an unknown id (the route keeps its honest 404)", async () => {
    const { ctx } = await seedChain();
    const { repos } = handle!;
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("p2") });
    const profile = await repos.brandProfiles.getActive(ctx);
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile!.id,
      brandProfileVersion: profile!.version,
      platforms: ["linkedin"],
      promptVersion: "fanout.v1",
      model: "test/model",
      generationKey: sha256Hex(`${ctx.tenantId}:post-run`),
    });
    const post = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "linkedin",
      body: "We shipped a thing.",
      generationKey: sha256Hex(`${ctx.tenantId}:post`),
    });
    expect(await getLiveStagedFlow(repos, ctx, post.id)).toBeNull();
    expect(await getLiveStagedFlow(repos, ctx, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
