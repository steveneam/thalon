import { afterEach, describe, expect, it } from "vitest";
import { BudgetExceededError } from "../errors";
import { llmCacheKey, sha256Hex } from "../hash";
import { fixture, type Fixture } from "./helpers";

let fx: Fixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("usage ledger (amendment A2)", () => {
  it("accumulates per tenant × day × model and hard-stops at the cap with an event", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const day = "2026-07-03";
    await repos.usageLedger.record(fx.ctx, {
      model: "test/model",
      tokensIn: 400,
      tokensOut: 100,
      day,
    });
    await repos.usageLedger.record(fx.ctx, {
      model: "test/model",
      tokensIn: 300,
      tokensOut: 200,
      day,
    });
    expect(await repos.usageLedger.totalForDay(fx.ctx, day)).toMatchObject({
      tokensIn: 700,
      tokensOut: 300,
    });

    // Under the cap: allowed.
    await repos.usageLedger.assertWithinBudget(fx.ctx, { capTokens: 1001, day });

    // At/over the cap: hard stop + budget.exceeded event survives the throw.
    await expect(
      repos.usageLedger.assertWithinBudget(fx.ctx, { capTokens: 1000, day }),
    ).rejects.toThrow(BudgetExceededError);
    const events = await repos.events.list(fx.ctx, { entityType: "tenant" });
    expect(events.map((e) => e.event)).toContain("budget.exceeded");
  });
});

describe("content-addressed caches (SPINE §2.7)", () => {
  it("llmCacheKey is stable across param object ordering", () => {
    const a = llmCacheKey({
      promptVersion: "fanout.v1",
      model: "m",
      params: { temperature: 0.2, topP: 0.9 },
      inputHash: sha256Hex("in"),
    });
    const b = llmCacheKey({
      inputHash: sha256Hex("in"),
      params: { topP: 0.9, temperature: 0.2 },
      model: "m",
      promptVersion: "fanout.v1",
    });
    expect(a).toBe(b);
  });

  it("llm cache: miss → put → hit with counted hits; duplicate put is a no-op", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const key = llmCacheKey({
      promptVersion: "v1",
      model: "m",
      params: {},
      inputHash: sha256Hex("x"),
    });
    expect(await repos.caches.llm.get(key)).toBeNull();
    await repos.caches.llm.put(fx.ctx, { key, valueRef: "objects/gen/1" });
    await repos.caches.llm.put(fx.ctx, { key, valueRef: "objects/gen/other" });
    const first = await repos.caches.llm.get(key);
    expect(first).toMatchObject({ valueRef: "objects/gen/1", hitCount: 1 });
    const second = await repos.caches.llm.get(key);
    expect(second?.hitCount).toBe(2);
  });

  it("retrieval cache round-trips a top-k result", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const key = "k1";
    const result = [{ chunkId: "c1", score: 0.92 }];
    await repos.caches.retrieval.put(fx.ctx, { key, result });
    expect((await repos.caches.retrieval.get(key))?.result).toEqual(result);
  });
});

describe("idempotent generation (deterministic-core doctrine)", () => {
  it("replaying a fanout run and draft with the same generation_key returns the original rows", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const run1 = await repos.fanoutRuns.get(fx.ctx, fx.draft.fanoutRunId);
    const run2 = await repos.fanoutRuns.create(fx.ctx, {
      sourceId: fx.draft.sourceId,
      brandProfileId: run1!.brandProfileId,
      brandProfileVersion: run1!.brandProfileVersion,
      platforms: ["alpha"],
      promptVersion: "fanout.v1",
      model: "test/model",
      generationKey: run1!.generationKey,
    });
    expect(run2.id).toBe(run1!.id);

    const draft2 = await repos.drafts.create(fx.ctx, {
      fanoutRunId: run1!.id,
      sourceId: fx.draft.sourceId,
      platform: "alpha",
      body: "Different body, same key — must NOT create a second draft.",
      generationKey: fx.draft.generationKey,
    });
    expect(draft2.id).toBe(fx.draft.id);
    expect(draft2.body).toBe(fx.draft.body);
  });
});
