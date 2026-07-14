import { afterEach, describe, expect, it } from "vitest";
import {
  CADENCE_GATE,
  cadenceFetchHorizonMs,
  hasCadenceConstraint,
  runCadenceGate,
  type QueueAdmission,
} from "../cadence";
import { runJudgePipeline } from "../pipeline";
import { fixedDriver, withCallCount } from "./fake-drivers";
import { judgeFixture, type JudgeFixture } from "./fixtures";

const PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "shipped", supported: true, chunkRef: "c1" }],
};

const NOW = new Date("2026-07-14T12:00:00Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function admission(agoMs: number, draftId = `d-${agoMs}`): QueueAdmission {
  return { draftId, admittedAt: new Date(NOW.getTime() - agoMs) };
}

describe("runCadenceGate — pure window math (B7.a)", () => {
  it("a rule with no fields set constrains nothing (absence disarms)", () => {
    expect(hasCadenceConstraint({})).toBe(false);
    expect(hasCadenceConstraint({ maxPerDay: 1 })).toBe(true);
    expect(hasCadenceConstraint({ minGapMinutes: 5 })).toBe(true);
  });

  it("maxPerDay: below the limit passes, AT the limit fails (admitting one more would exceed the norm)", () => {
    const rule = { maxPerDay: 2 };
    const below = runCadenceGate({
      platform: "alpha",
      rule,
      admissions: [admission(HOUR_MS)],
      now: NOW,
    });
    expect(below.verdict).toBe("pass");

    const atLimit = runCadenceGate({
      platform: "alpha",
      rule,
      admissions: [admission(HOUR_MS), admission(2 * HOUR_MS)],
      now: NOW,
    });
    expect(atLimit.verdict).toBe("fail");
    expect(atLimit.evidence.claims).toEqual([
      {
        claim: "maxPerDay 2",
        verdict: "fail",
        evidence: "2 live draft(s) admitted to the queue in the last 24h",
      },
    ]);
  });

  it("counting windows are rolling 24h/7d — an admission outside the day window still counts toward the week", () => {
    const rule = { maxPerDay: 1, maxPerWeek: 2 };
    const result = runCadenceGate({
      platform: "alpha",
      rule,
      admissions: [admission(2 * DAY_MS), admission(3 * DAY_MS)],
      now: NOW,
    });
    // Day window is clear; the week window is at its limit.
    expect(result.evidence.claims).toEqual([
      {
        claim: "maxPerDay 1",
        verdict: "pass",
        evidence: "0 live draft(s) admitted to the queue in the last 24h",
      },
      {
        claim: "maxPerWeek 2",
        verdict: "fail",
        evidence: "2 live draft(s) admitted to the queue in the last 7d",
      },
    ]);
    expect(result.verdict).toBe("fail");
  });

  it("window boundary is inclusive: an admission exactly 24h ago still counts", () => {
    const result = runCadenceGate({
      platform: "alpha",
      rule: { maxPerDay: 1 },
      admissions: [admission(DAY_MS)],
      now: NOW,
    });
    expect(result.verdict).toBe("fail");
  });

  it("minGapMinutes: too-recent admission fails, exact gap passes, no prior admission passes", () => {
    const rule = { minGapMinutes: 30 };
    const tooRecent = runCadenceGate({
      platform: "alpha",
      rule,
      admissions: [admission(10 * MINUTE_MS)],
      now: NOW,
    });
    expect(tooRecent.verdict).toBe("fail");
    expect(tooRecent.evidence.claims[0].evidence).toBe(
      'last queue admission for "alpha" was 10 min ago (rule: at least 30 min)',
    );

    const exactGap = runCadenceGate({
      platform: "alpha",
      rule,
      admissions: [admission(30 * MINUTE_MS)],
      now: NOW,
    });
    expect(exactGap.verdict).toBe("pass");

    const empty = runCadenceGate({ platform: "alpha", rule, admissions: [], now: NOW });
    expect(empty.verdict).toBe("pass");
    expect(empty.evidence.claims[0].evidence).toBe(
      "no prior live queue admission for this platform",
    );
  });

  it("every armed constraint is recorded as a claim, pass or fail — the operator sees the whole rule", () => {
    const result = runCadenceGate({
      platform: "alpha",
      rule: { maxPerDay: 5, maxPerWeek: 10, minGapMinutes: 1 },
      admissions: [admission(2 * MINUTE_MS)],
      now: NOW,
    });
    expect(result.verdict).toBe("pass");
    expect(result.evidence.claims.map((c) => c.claim)).toEqual([
      "maxPerDay 5",
      "maxPerWeek 10",
      "minGapMinutes 1",
    ]);
  });

  it("cadenceFetchHorizonMs covers the widest armed window, including a gap rule longer than the counting window", () => {
    expect(cadenceFetchHorizonMs({ maxPerDay: 3 })).toBe(DAY_MS);
    expect(cadenceFetchHorizonMs({ maxPerDay: 3, maxPerWeek: 10 })).toBe(7 * DAY_MS);
    expect(cadenceFetchHorizonMs({ minGapMinutes: 60 })).toBe(HOUR_MS);
    // A 2-week gap rule needs 2 weeks of history even with a daily cap armed.
    expect(cadenceFetchHorizonMs({ maxPerDay: 3, minGapMinutes: 20160 })).toBe(14 * DAY_MS);
  });
});

let fx: JudgeFixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

/** Runs the full pipeline on one draft with always-pass tier drivers, returning the counting drivers. */
async function judgeDraft(fixture: JudgeFixture, draftId: string) {
  const screen = withCallCount(fixedDriver(PASS));
  const final = withCallCount(fixedDriver(PASS));
  const outcome = await runJudgePipeline(fixture.handle.repos, {
    ctx: fixture.ctx,
    draftId,
    chunks: [{ ref: "c1", text: "We shipped a thing today." }],
    screenDriver: screen.driver,
    finalDriver: final.driver,
  });
  return { outcome, screen, final };
}

describe("runJudgePipeline — cadence gate wiring (B7.a)", () => {
  it("maxPerDay reached ⇒ blocked with ZERO model calls; the cadence row carries the readable reason", async () => {
    fx = await judgeFixture({ cadence: { alpha: { maxPerDay: 1 } } });
    const first = await judgeDraft(fx, fx.draft.id);
    expect(first.outcome.status).toBe("queued");

    const second = await fx.addDraft();
    const { outcome, screen, final } = await judgeDraft(fx, second.id);
    expect(outcome.status).toBe("blocked");
    expect(outcome.status === "blocked" && outcome.reason).toBe('cadence limit for "alpha"');
    expect(screen.count).toBe(0);
    expect(final.count).toBe(0);

    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, second.id);
    expect(rows.map((r) => r.gate)).toEqual(["g1", CADENCE_GATE]);
    const cadenceRow = rows.find((r) => r.gate === CADENCE_GATE)!;
    expect(cadenceRow.verdict).toBe("fail");
    expect(cadenceRow.evidence).toEqual({
      claims: [
        {
          claim: "maxPerDay 1",
          verdict: "fail",
          evidence: "1 live draft(s) admitted to the queue in the last 24h",
        },
      ],
    });
  });

  it("a rejected draft frees its slot — the live-band filter is real", async () => {
    fx = await judgeFixture({ cadence: { alpha: { maxPerDay: 1 } } });
    const first = await judgeDraft(fx, fx.draft.id);
    expect(first.outcome.status).toBe("queued");
    await fx.handle.repos.drafts.transition(fx.ctx, fx.draft.id, "rejected");

    const second = await fx.addDraft();
    const { outcome } = await judgeDraft(fx, second.id);
    expect(outcome.status).toBe("queued");
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, second.id);
    expect(rows.find((r) => r.gate === CADENCE_GATE)?.verdict).toBe("pass");
  });

  it("minGapMinutes blocks a back-to-back draft on the same platform", async () => {
    fx = await judgeFixture({ cadence: { alpha: { minGapMinutes: 60 } } });
    await judgeDraft(fx, fx.draft.id);

    const second = await fx.addDraft();
    const { outcome } = await judgeDraft(fx, second.id);
    expect(outcome.status).toBe("blocked");
  });

  it("no rule for the draft's platform ⇒ no cadence row, judging is byte-identical to pre-B7.a", async () => {
    fx = await judgeFixture({ cadence: { beta: { maxPerDay: 1 } } });
    const { outcome } = await judgeDraft(fx, fx.draft.id);
    expect(outcome.status).toBe("queued");
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate).sort()).toEqual(["g1", "g3_final", "g3_screen"]);
  });

  it("a rule with no fields set disarms (empty object is config noise, not a constraint)", async () => {
    fx = await judgeFixture({ cadence: { alpha: {} } });
    const { outcome } = await judgeDraft(fx, fx.draft.id);
    expect(outcome.status).toBe("queued");
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate).sort()).toEqual(["g1", "g3_final", "g3_screen"]);
  });

  it("cadence on one platform never gates another (per-platform rules, per-platform counts)", async () => {
    fx = await judgeFixture({ cadence: { alpha: { maxPerDay: 1 }, beta: { maxPerDay: 1 } } });
    const first = await judgeDraft(fx, fx.draft.id);
    expect(first.outcome.status).toBe("queued");

    // alpha is now at its limit; beta's own count is still zero.
    const betaDraft = await fx.addDraft({ platform: "beta" });
    const { outcome } = await judgeDraft(fx, betaDraft.id);
    expect(outcome.status).toBe("queued");
  });
});
