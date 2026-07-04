import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { collectGroundingChunks } from "../grounding";
import { runJudgePipeline } from "../pipeline";
import type { JudgeModelDriver, JudgeModelRequest } from "../shell/driver";
import { fixedDriver } from "./fake-drivers";

const PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "shipped", supported: true, chunkRef: "c1" }],
};

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fx {
  ctx: TenantCtx;
  repos: Repos;
  promptSourceId: string;
  docSourceId: string;
  makeDraft(meta?: Record<string, unknown>): Promise<Draft>;
}

async function setup(): Promise<Fx> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const { source: promptSource } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("brief"),
    chunks: [
      { seq: 0, text: "The brief text.", tokenCount: 3, contentHash: sha256Hex("b-0") },
    ],
  });
  const { source: docSource } = await repos.sourceChunks.ingest(ctx, {
    kind: "doc",
    contentHash: sha256Hex("doc"),
    chunks: [
      { seq: 0, text: "The doc fact.", tokenCount: 3, contentHash: sha256Hex("d-0") },
    ],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: promptSource.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["video"],
    promptVersion: "pillar-script-generate.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:grounding-run`),
  });
  let n = 0;
  const makeDraft = (meta?: Record<string, unknown>) =>
    repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: promptSource.id,
      platform: "video",
      body: "We shipped a thing today.",
      generationKey: sha256Hex(`${ctx.tenantId}:grounding-draft-${n++}`),
      ...(meta ? { meta } : {}),
    });
  return { ctx, repos, promptSourceId: promptSource.id, docSourceId: docSource.id, makeDraft };
}

function capturing(captured: JudgeModelRequest[]): JudgeModelDriver {
  const inner = fixedDriver(PASS);
  return async (req) => {
    captured.push(req);
    return inner(req);
  };
}

describe("pipeline-internal grounding assembly (B3.9)", () => {
  it("collectGroundingChunks: meta.groundingSourceIds pulls every listed source, deduped", async () => {
    const fx = await setup();
    const draft = await fx.makeDraft({
      groundingSourceIds: [fx.promptSourceId, fx.docSourceId, fx.docSourceId],
    });
    const chunks = await collectGroundingChunks(fx.ctx, fx.repos, draft);
    expect(chunks.map((c) => c.text).sort()).toEqual(["The brief text.", "The doc fact."]);
  });

  it("collectGroundingChunks: no meta key ⇒ the draft's own source (pre-B3.9 behavior)", async () => {
    const fx = await setup();
    const draft = await fx.makeDraft();
    const chunks = await collectGroundingChunks(fx.ctx, fx.repos, draft);
    expect(chunks.map((c) => c.text)).toEqual(["The brief text."]);
  });

  it("runJudgePipeline WITHOUT chunks self-assembles multi-source grounding — both tiers see every source", async () => {
    const fx = await setup();
    const draft = await fx.makeDraft({
      groundingSourceIds: [fx.promptSourceId, fx.docSourceId],
    });
    const captured: JudgeModelRequest[] = [];
    const outcome = await runJudgePipeline(fx.repos, {
      ctx: fx.ctx,
      draftId: draft.id,
      screenDriver: capturing(captured),
      finalDriver: capturing(captured),
      capTokens: 1_000_000,
    });
    expect(outcome.status).toBe("queued");
    expect(captured).toHaveLength(2);
    for (const req of captured) {
      const texts = req.chunks.map((c) => c.text);
      expect(texts).toContain("The brief text.");
      expect(texts).toContain("The doc fact.");
    }
  });

  it("an explicit chunks override is honored verbatim (tests/pre-assembled callers)", async () => {
    const fx = await setup();
    const draft = await fx.makeDraft({
      groundingSourceIds: [fx.promptSourceId, fx.docSourceId],
    });
    const captured: JudgeModelRequest[] = [];
    await runJudgePipeline(fx.repos, {
      ctx: fx.ctx,
      draftId: draft.id,
      chunks: [{ ref: "override", text: "Only this." }],
      screenDriver: capturing(captured),
      finalDriver: capturing(captured),
      capTokens: 1_000_000,
    });
    for (const req of captured) {
      expect(req.chunks).toEqual([{ ref: "override", text: "Only this." }]);
    }
  });
});
