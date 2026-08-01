import { BudgetExceededError } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { judgeCandidate } from "../candidate";
import { DISCOVERABILITY_GATE } from "../discoverability";
import { runJudgePipeline } from "../pipeline";
import type { JudgeModelDriver, JudgeModelRequest } from "../shell/driver";
import { FAKE_TOKENS_IN, FAKE_TOKENS_OUT, fixedDriver, withCallCount } from "./fake-drivers";
import { judgeFixture, type JudgeFixture } from "./fixtures";

const PASS = { verdict: "pass" as const, claims: [{ claim: "shipped", supported: true, chunkRef: "c1" }] };
const FAIL = { verdict: "fail" as const, claims: [{ claim: "shipped", supported: false }] };

let fx: JudgeFixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

function capturing(captured: JudgeModelRequest[], output: unknown = PASS): JudgeModelDriver {
  const inner = fixedDriver(output);
  return async (req) => {
    captured.push(req);
    return inner(req);
  };
}

/** The whole point of the entry: nothing about the draft's record moved. */
async function nothingWritten(fixture: JudgeFixture): Promise<void> {
  const rows = await fixture.handle.repos.judgeResults.listForDraft(fixture.ctx, fixture.draft.id);
  expect(rows).toEqual([]);
  const after = await fixture.handle.repos.drafts.get(fixture.ctx, fixture.draft.id);
  expect(after.status).toBe(fixture.draft.status);
  expect(after.body).toBe(fixture.draft.body);
  expect(after.bodyHash).toBe(fixture.draft.bodyHash);
}

describe("judgeCandidate — the same ladder, persisted nowhere (s89)", () => {
  it("judges the CANDIDATE body, not the persisted one: a denylisted draft body with a clean candidate passes", async () => {
    fx = await judgeFixture({
      denylist: ["guaranteed returns"],
      body: "guaranteed returns on day one.",
    });
    const outcome = await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "We shipped a thing today.",
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome.verdict).toBe("pass");
    expect(outcome.ofRecord).toBe(false);
    await nothingWritten(fx);
  });

  it("…and a denylisted CANDIDATE fails g1 with zero model calls, while the clean draft stays untouched", async () => {
    fx = await judgeFixture({ denylist: ["guaranteed returns"] });
    const screen = withCallCount(fixedDriver(PASS));
    const final = withCallCount(fixedDriver(PASS));
    const outcome = await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "guaranteed returns, always.",
      chunks: [],
      screenDriver: screen.driver,
      finalDriver: final.driver,
    });
    expect(outcome.verdict).toBe("fail");
    expect(outcome.verdict === "fail" && outcome.reason).toBe("g1 denylist fail");
    expect(screen.count).toBe(0);
    expect(final.count).toBe(0);
    // The refused rung is in the RETURN VALUE for triage — and nowhere else.
    expect(outcome.gates.map((g) => g.gate)).toEqual(["g1"]);
    await nothingWritten(fx);
  });

  it("a full pass/pass run appends no judge_results row and makes no transition — the verdict is not of record", async () => {
    fx = await judgeFixture();
    const outcome = await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "We shipped a different thing today.",
      chunks: [{ ref: "c1", text: "We shipped a different thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome).toMatchObject({ ofRecord: false, verdict: "pass" });
    expect(outcome.gates.map((g) => g.gate).sort()).toEqual(["g1", "g3_final", "g3_screen"]);
    await nothingWritten(fx);
  });

  it("grounding parity: the candidate's tier requests carry the SAME chunks the pipeline sends — identity append included — around the candidate's body", async () => {
    fx = await judgeFixture({
      identity: { company: "Fernwood Outfitters", facts: ["Family-run shop."] },
    });
    const candidateSeen: JudgeModelRequest[] = [];
    const candidateBody = "A rewritten body under judgment.";
    await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: capturing(candidateSeen),
      finalDriver: capturing(candidateSeen),
    });

    const pipelineSeen: JudgeModelRequest[] = [];
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: capturing(pipelineSeen),
      finalDriver: capturing(pipelineSeen),
    });

    expect(candidateSeen).toHaveLength(2);
    expect(pipelineSeen).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      // Same evidence, byte for byte — through the same assembly, not a re-derivation.
      expect(candidateSeen[i].chunks).toEqual(pipelineSeen[i].chunks);
      // Different subject: the candidate path judges the candidate's body,
      // the pipeline judges the persisted one.
      expect(candidateSeen[i].body).toBe(candidateBody);
      expect(pipelineSeen[i].body).toBe(fx.draft.body);
    }
    expect(candidateSeen[0].chunks.map((c) => c.ref)).toEqual(["c1", "profile:v1:identity"]);
  });

  it("fails with the pipeline's reasons VERBATIM (tier disagreement and both-fail)", async () => {
    fx = await judgeFixture();
    const base = {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "Another body.",
      chunks: [] as { ref: string; text: string }[],
    };
    const disagree = await judgeCandidate(fx.handle.repos, {
      ...base,
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(FAIL),
    });
    expect(disagree.verdict === "fail" && disagree.reason).toBe(
      "g3 tier disagreement (screen=pass, final=fail)",
    );
    const bothFail = await judgeCandidate(fx.handle.repos, {
      ...base,
      screenDriver: fixedDriver(FAIL),
      finalDriver: fixedDriver(FAIL),
    });
    expect(bothFail.verdict === "fail" && bothFail.reason).toBe("both g3 tiers failed");
    await nothingWritten(fx);
  });

  it("meters both tier calls through the usage ledger — advisory spend is still spend (A2)", async () => {
    fx = await judgeFixture();
    await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "Another body.",
      chunks: [],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    const totals = await fx.handle.repos.usageLedger.totalForDay(fx.ctx);
    expect(totals.tokensIn).toBe(2 * FAKE_TOKENS_IN);
    expect(totals.tokensOut).toBe(2 * FAKE_TOKENS_OUT);
  });

  it("budget hard-stop: an exhausted tenant cap halts loudly before any model call — a candidate judge is no budget bypass", async () => {
    fx = await judgeFixture();
    const screen = withCallCount(fixedDriver(PASS));
    const final = withCallCount(fixedDriver(PASS));
    await expect(
      judgeCandidate(fx.handle.repos, {
        ctx: fx.ctx,
        draft: fx.draft,
        candidateBody: "Another body.",
        chunks: [],
        screenDriver: screen.driver,
        finalDriver: final.driver,
        capTokens: 0,
      }),
    ).rejects.toThrow(BudgetExceededError);
    expect(screen.count).toBe(0);
    expect(final.count).toBe(0);
    await nothingWritten(fx);
  });

  it("the cadence gate applies to a candidate exactly as it would at landing — same rule, same admissions", async () => {
    fx = await judgeFixture({ cadence: { alpha: { maxPerDay: 1 } } });
    // Fill the day's slot the only way the state machine allows: a real judge pass.
    const first = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(first.status).toBe("queued");

    const second = await fx.addDraft();
    const screen = withCallCount(fixedDriver(PASS));
    const final = withCallCount(fixedDriver(PASS));
    const outcome = await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: second,
      candidateBody: "A rewrite of the second draft.",
      chunks: [],
      screenDriver: screen.driver,
      finalDriver: final.driver,
    });
    expect(outcome.verdict).toBe("fail");
    expect(outcome.verdict === "fail" && outcome.reason).toBe('cadence limit for "alpha"');
    expect(screen.count).toBe(0);
    expect(final.count).toBe(0);
    // Advisory: the second draft gained no rows and no transition from this.
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, second.id);
    expect(rows).toEqual([]);
  });

  it("advisory lenses stay advisory: a discoverability miss on the candidate rides in `gates`, decides nothing, lands nowhere", async () => {
    fx = await judgeFixture({ meta: { targetTerms: ["AI"] } });
    const outcome = await judgeCandidate(fx.handle.repos, {
      ctx: fx.ctx,
      draft: fx.draft,
      candidateBody: "We shipped a thing today.", // never says "AI"
      chunks: [],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    expect(outcome.verdict).toBe("pass"); // I1-style discipline: g3_final-only
    const disc = outcome.gates.find((g) => g.gate === DISCOVERABILITY_GATE);
    expect(disc?.verdict).toBe("fail");
    await nothingWritten(fx);
  });
});
