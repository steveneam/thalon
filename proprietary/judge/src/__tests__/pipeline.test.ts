import { InvariantViolationError } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runJudgePipeline } from "../pipeline";
import { fixedDriver, withCallCount } from "./fake-drivers";
import { judgeFixture, type JudgeFixture } from "./fixtures";

const PASS = { verdict: "pass" as const, claims: [{ claim: "shipped", supported: true, chunkRef: "c1" }] };
const FAIL = { verdict: "fail" as const, claims: [{ claim: "shipped", supported: false }] };

let fx: JudgeFixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("runJudgePipeline — two-tier orchestration (SPINE §1.1, §2.3)", () => {
  it("g1 fail ⇒ blocked with ZERO model calls", async () => {
    fx = await judgeFixture({
      denylist: ["guaranteed returns"],
      body: "guaranteed returns on day one.",
    });
    const screen = withCallCount(fixedDriver(PASS));
    const final = withCallCount(fixedDriver(PASS));
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: screen.driver,
      finalDriver: final.driver,
    });
    expect(outcome.status).toBe("blocked");
    expect(outcome.status === "blocked" && outcome.reason).toMatch(/g1 denylist/);
    expect(screen.count).toBe(0);
    expect(final.count).toBe(0);
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate)).toEqual(["g1"]);
  });

  it("pass/pass ⇒ queued, both tiers recorded against the current body hash", async () => {
    fx = await judgeFixture();
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome.status).toBe("queued");
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate).sort()).toEqual(["g1", "g3_final", "g3_screen"]);
    expect(rows.every((r) => r.bodyHash === fx!.draft.bodyHash)).toBe(true);
  });

  it("screen pass / final fail ⇒ blocked (final is the gate; a screen pass never overrides it)", async () => {
    fx = await judgeFixture();
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(FAIL),
    });
    expect(outcome.status).toBe("blocked");
  });

  it("screen fail / final pass ⇒ blocked (tier disagreement, never a silent pass)", async () => {
    fx = await judgeFixture();
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: fixedDriver(FAIL),
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome.status).toBe("blocked");
    expect(outcome.status === "blocked" && outcome.reason).toMatch(/disagreement/);
  });

  it("fail/fail ⇒ blocked", async () => {
    fx = await judgeFixture();
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: fixedDriver(FAIL),
      finalDriver: fixedDriver(FAIL),
    });
    expect(outcome.status).toBe("blocked");
  });

  it("malformed shell output exhausts repair retries ⇒ treated as fail ⇒ blocked", async () => {
    fx = await judgeFixture();
    const badScreen = withCallCount(fixedDriver({ nonsense: true }));
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: badScreen.driver,
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome.status).toBe("blocked");
    expect(badScreen.count).toBeGreaterThan(1); // retried, but bounded
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    const screenRow = rows.find((r) => r.gate === "g3_screen");
    expect(screenRow?.verdict).toBe("fail");
    expect(JSON.stringify(screenRow?.evidence)).toMatch(/irrecoverable/);
  });

  it("I1 structural proof: the pipeline can never bypass the transition fn's queue gate", async () => {
    fx = await judgeFixture();
    await fx.handle.repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    // Attempting to queue directly (skipping the judge harness entirely) still throws.
    await expect(
      fx.handle.repos.drafts.transition(fx.ctx, fx.draft.id, "queued"),
    ).rejects.toThrow(InvariantViolationError);
  });

  it("body-edit invalidation: an operator edit re-judges before the queue reopens", async () => {
    fx = await judgeFixture();
    const first = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(first.status).toBe("queued");

    const { draft: edited } = await fx.handle.repos.approvals.record(fx.ctx, {
      draftId: fx.draft.id,
      actor: "operator",
      action: "edit",
      editedBody: "We shipped a thing today — now with more detail.",
    });
    expect(edited.status).toBe("judging");

    // The old passing g3_final row is bound to the OLD body hash — direct queue stays shut.
    await expect(
      fx.handle.repos.drafts.transition(fx.ctx, edited.id, "queued"),
    ).rejects.toThrow(InvariantViolationError);

    const second = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: edited.id,
      chunks: [],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(second.status).toBe("queued");
  });

  it("per-tenant isolation: the denylist is pulled from THIS tenant's active brand profile, never hard-coded", async () => {
    const blocked = await judgeFixture({
      denylist: ["guaranteed returns"],
      body: "guaranteed returns, always.",
      tenantSlug: "tenant-a",
    });
    const clear = await judgeFixture({
      denylist: ["a completely different term"],
      body: "guaranteed returns, always.",
      tenantSlug: "tenant-b",
    });
    try {
      const outcomeA = await runJudgePipeline(blocked.handle.repos, {
        ctx: blocked.ctx,
        draftId: blocked.draft.id,
        chunks: [],
        screenDriver: fixedDriver(PASS),
        finalDriver: fixedDriver(PASS),
      });
      expect(outcomeA.status).toBe("blocked");

      const outcomeB = await runJudgePipeline(clear.handle.repos, {
        ctx: clear.ctx,
        draftId: clear.draft.id,
        chunks: [],
        screenDriver: fixedDriver(PASS),
        finalDriver: fixedDriver(PASS),
      });
      expect(outcomeB.status).toBe("queued");
    } finally {
      await blocked.close();
      await clear.close();
    }
  });
});
