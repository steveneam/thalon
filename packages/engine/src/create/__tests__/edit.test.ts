import { tenantCtx, type CreateBriefInput, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import {
  AI_EDIT_ACTOR,
  aiEditDraft,
  applyAiEdit,
  markVariantDiverged,
  type AiEditProposal,
  type ApplyAiEditDeps,
} from "../edit";
import { CREATE_VARIANT_PLAN_KEY, readVariantPlan } from "../plan";
import { createFakeAiEditDriver, type AiEditDriver } from "../shell/ai-edit";

/**
 * B-create.2 follow-through — the R8 AI-edit verb, keyless and networkless:
 * the rewrite driver and both judge drivers are fakes throughout, so the
 * suite runs at zero spend, which is also the lane's shipping posture.
 *
 * THE LOAD-BEARING ASSERTION in this file is that `aiEditDraft` writes
 * NOTHING. The spec's Error Behavior asks that a judge-refused AI edit leave
 * the variant's prior body intact; judging a candidate body is impossible
 * through the shared harness (`runJudgePipeline` reads the PERSISTED body,
 * and verdict rows bind to `body_hash`), so instead of faking that, the
 * propose half never touches the draft at all — on EVERY path, refusal or
 * not. That is a stronger guarantee than the spec's, and `bodyHashUnchanged`
 * below pins it unconditionally rather than only on the refusal branch.
 */

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const JUDGE_PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "grounded", supported: true, chunkRef: "c1" }],
};
const JUDGE_FAIL = {
  verdict: "fail" as const,
  claims: [{ claim: "ungrounded", supported: false }],
};

function judgeDriver(candidate: unknown): JudgeModelDriver {
  return async () => ({ candidate, tokensIn: 1, tokensOut: 1 });
}

function passJudge(): ApplyAiEditDeps {
  return {
    screenDriver: judgeDriver(JUDGE_PASS),
    finalDriver: judgeDriver(JUDGE_PASS),
    capTokens: 1_000_000,
  };
}

const ORIGINAL_BODY = "We shipped usage-based pricing today. It halves the entry cost.";

interface Fx {
  ctx: TenantCtx;
  repos: Repos;
  draft: Draft;
  /** Drives a draft to `queued` the only way the state machine allows: a real judge pass. */
  queue(draft?: Draft): Promise<Draft>;
  createRun(platforms: string[]): Promise<string>;
}

async function fixture(opts: { body?: string; platform?: string } = {}): Promise<Fx> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("edit-source"),
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: [opts.platform ?? "bluesky"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:edit-run`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: opts.platform ?? "bluesky",
    body: opts.body ?? ORIGINAL_BODY,
    generationKey: sha256Hex(`${ctx.tenantId}:edit-draft`),
  });

  const queue = async (target: Draft = draft): Promise<Draft> => {
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: target.id,
      chunks: [{ ref: "c1", text: ORIGINAL_BODY }],
      screenDriver: judgeDriver(JUDGE_PASS),
      finalDriver: judgeDriver(JUDGE_PASS),
      capTokens: 1_000_000,
    });
    if (outcome.status !== "queued") throw new Error(`fixture could not queue: ${outcome.reason}`);
    return outcome.draft;
  };

  const createRun = async (platforms: string[]): Promise<string> => {
    const brief: CreateBriefInput = {
      family: "post",
      mode: "prompt",
      prompt: ORIGINAL_BODY,
      platforms,
    };
    const created = await repos.createRuns.create(ctx, {
      family: "post",
      mode: "prompt",
      brief,
      plan: {
        platforms: platforms.map((platform) => ({ platform, admitted: true })),
        family: {
          [CREATE_VARIANT_PLAN_KEY]: {
            master: { kind: "brief" },
            variants: platforms.map((platform) => ({ platform, diverged: false })),
          },
        },
      },
      generationKey: sha256Hex(`${ctx.tenantId}:create-run`),
    });
    return created.id;
  };

  return { ctx, repos, draft, queue, createRun };
}

/** The assertion this whole file exists for. */
async function bodyHashUnchanged(fx: Fx, before: Draft): Promise<void> {
  const after = await fx.repos.drafts.get(fx.ctx, before.id);
  expect(after.bodyHash).toBe(before.bodyHash);
  expect(after.body).toBe(before.body);
}

/* ------------------------------------------------------------------ */

describe("aiEditDraft — proposes, and writes NOTHING", () => {
  it("returns a proposal bound to the body it was written against", async () => {
    const fx = await fixture();
    const queued = await fx.queue();

    const result = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "cut it to one sentence" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );

    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") return;
    expect(result.proposal.priorBodyHash).toBe(queued.bodyHash);
    expect(result.proposal.priorBody).toBe(queued.body);
    expect(result.proposal.proposedBody).not.toBe(queued.body);
    // The draft itself is untouched — the proposal exists only in the return
    // value until someone applies it.
    await bodyHashUnchanged(fx, queued);
  });

  it("leaves the body hash untouched on EVERY refusal path, not just the judge one", async () => {
    const fx = await fixture();
    const queued = await fx.queue();

    // (a) no instruction.
    const empty = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "   " },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    expect(empty.status).toBe("refused");
    if (empty.status === "refused") expect(empty.reason).toContain("needs an instruction");
    await bodyHashUnchanged(fx, queued);

    // (b) the shell declined — the prompt file's convention is to return the
    // body unchanged when the instruction cannot be carried out honestly.
    const declined = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "refuse this one please" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    expect(declined.status).toBe("refused");
    if (declined.status === "refused") {
      expect(declined.reason).toContain("identical to the current body");
      // R10: the reason names what was asked, so the operator can rephrase.
      expect(declined.reason).toContain("refuse this one please");
    }
    await bodyHashUnchanged(fx, queued);

    // (c) an empty rewrite is never landed as an empty draft.
    const blank: AiEditDriver = async () => ({ body: "   ", tokensIn: 1, tokensOut: 1 });
    const emptyRewrite = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: blank, capTokens: 1_000_000 },
    );
    expect(emptyRewrite.status).toBe("refused");
    if (emptyRewrite.status === "refused") expect(emptyRewrite.reason).toContain("came back empty");
    await bodyHashUnchanged(fx, queued);
  });

  it("refuses a draft the operator edit door would also refuse — before any spend", async () => {
    const fx = await fixture();
    // `generated` is excluded for the same reason approvals.record excludes
    // it: `generated → judging` is legal, so an edit there would touch a
    // draft the judge has never seen.
    let called = 0;
    const counting: AiEditDriver = async (req) => {
      called += 1;
      return createFakeAiEditDriver()(req);
    };
    const result = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: fx.draft.id, instruction: "shorten it" },
      { driver: counting, capTokens: 1_000_000 },
    );
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.reason).toContain("queued or blocked");
    // The status check is BEFORE the shell call: a refusal costs nothing.
    expect(called).toBe(0);
    await bodyHashUnchanged(fx, fx.draft);
  });

  it("meters the rewrite through the one gateway choke point", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const before = await fx.repos.usageLedger.totalForDay(fx.ctx);

    await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "cut it to one sentence" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );

    const after = await fx.repos.usageLedger.totalForDay(fx.ctx);
    // The guard recorded the call: budget asserted before, usage after
    // (SPINE §1; amendment A2). An unmetered shell call is the thing the
    // shell-inventory ratchet exists to make impossible to add quietly.
    expect(after.tokensOut).toBeGreaterThan(before.tokensOut);
  });

  it("hands the platform's HARD ceiling to the shell, and nothing where there is none", async () => {
    const seen: Array<number | undefined> = [];
    const spy: AiEditDriver = async (req) => {
      seen.push(req.maxChars);
      return createFakeAiEditDriver()(req);
    };

    const social = await fixture({ platform: "bluesky" });
    const socialQueued = await social.queue();
    await aiEditDraft(
      social.ctx,
      social.repos,
      { draftId: socialQueued.id, instruction: "shorten" },
      { driver: spy, capTokens: 1_000_000 },
    );
    await handle?.close();
    handle = undefined;

    const web = await fixture({ platform: "web" });
    const webQueued = await web.queue();
    await aiEditDraft(
      web.ctx,
      web.repos,
      { draftId: webQueued.id, instruction: "shorten" },
      { driver: spy, capTokens: 1_000_000 },
    );

    expect(seen[0]).toBeGreaterThan(0);
    // A `web` draft has no social capability row, so it gets no ceiling
    // rather than an invented one (R10: never fabricate a default).
    expect(seen[1]).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */

describe("applyAiEdit — lands through the EXISTING edit door and re-judges", () => {
  it("swaps the body, writes the edit_diffs + eval_cases rows, and re-queues on a judge pass", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "cut it to one sentence" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    const result = await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, passJudge());

    expect(result.status).toBe("queued");
    if (result.status !== "queued") return;
    expect(result.draft.body).toBe(proposed.proposal.proposedBody);
    expect(result.draft.bodyHash).toBe(sha256Hex(proposed.proposal.proposedBody));

    // An AI edit becomes an eval row by the SAME mechanism a hand edit does
    // (rule 6 as a mechanism, not a habit) — because it rides the same door.
    const evals = await fx.repos.evalCases.list(fx.ctx, { origin: "edit_diff" });
    expect(evals).toHaveLength(1);
    expect(evals[0].kind).toBe("draft_edit");
    expect((evals[0].expected as { body: string }).body).toBe(proposed.proposal.proposedBody);
  });

  it("records the edit under an actor that does not read as a human", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");
    await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, passJudge());

    // Read off the I4 events spine — every transition appends exactly one
    // row carrying its actor, so the audit trail says an AI wrote this edit
    // rather than leaving it indistinguishable from an operator's own.
    const events = await fx.repos.events.list(fx.ctx, {
      entityType: "draft",
      entityId: queued.id,
    });
    const editTransition = events.filter(
      (e) => e.event === "draft.transition" && e.actor === AI_EDIT_ACTOR,
    );
    expect(editTransition).toHaveLength(1);
    expect((editTransition[0].payload as { reason?: string }).reason).toBe(
      "approve-with-edit re-judge",
    );
  });

  it("threads the caller's judge drivers through intact and makes no judge call of its own", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    let screenCalls = 0;
    let finalCalls = 0;
    const recording: ApplyAiEditDeps = {
      screenDriver: async (req) => {
        screenCalls += 1;
        return judgeDriver(JUDGE_PASS)(req);
      },
      finalDriver: async (req) => {
        finalCalls += 1;
        return judgeDriver(JUDGE_PASS)(req);
      },
      capTokens: 1_000_000,
    };
    await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, recording);

    // Both tiers ran, and they ran because THIS caller's drivers reached the
    // shared harness — an AI edit that judged itself with drivers of its own
    // would be a second gate nobody configured.
    expect(screenCalls).toBe(1);
    expect(finalCalls).toBe(1);
  });

  it("a judge refusal blocks the draft and returns the reason verbatim", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    const result = await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, {
      screenDriver: judgeDriver(JUDGE_FAIL),
      finalDriver: judgeDriver(JUDGE_FAIL),
      capTokens: 1_000_000,
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.reason).toBe("both g3 tiers failed");
    expect(result.draft.status).toBe("blocked");

    // DOCUMENTED DIVERGENCE FROM THE SPEC, pinned so it cannot drift
    // unnoticed: the spec's Error Behavior says a judge-refused AI edit
    // leaves the variant's prior body. At APPLY it does not — the applied
    // body is on the draft, exactly as a hand edit would leave it, because
    // the harness cannot judge a body that is not the draft's. Safety is
    // unaffected (I1: a blocked draft cannot reach the queue). The closure
    // path is a candidate-judge entry in proprietary/judge — outside this
    // lane's file set. See WRAP-create-shells.md §1b.
    expect(result.draft.body).toBe(proposed.proposal.proposedBody);
  });

  it("refuses a stale proposal instead of clobbering a newer edit — and writes nothing", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    // Someone else edits the draft in the meantime (the second-tab case).
    await fx.repos.approvals.record(fx.ctx, {
      draftId: queued.id,
      actor: "operator",
      action: "edit",
      editedBody: "A hand-written body that must survive.",
    });
    const afterHandEdit = await fx.repos.drafts.get(fx.ctx, queued.id);

    const result = await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, passJudge());
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.reason).toContain("changed since this rewrite");
    await bodyHashUnchanged(fx, afterHandEdit);
  });
});

/* ------------------------------------------------------------------ */

describe("variant provenance (R13)", () => {
  it("markVariantDiverged is pure and touches only the named variant", () => {
    const plan = {
      master: { kind: "brief" as const },
      variants: [
        { platform: "bluesky", diverged: false },
        { platform: "linkedin", diverged: false },
      ],
    };
    const next = markVariantDiverged(plan, "bluesky");
    expect(next.variants).toEqual([
      { platform: "bluesky", diverged: true },
      { platform: "linkedin", diverged: false },
    ]);
    // Pure: the input is untouched.
    expect(plan.variants[0].diverged).toBe(false);
    // A platform that is not a variant of this run adds nothing.
    expect(markVariantDiverged(plan, "threads").variants).toEqual(plan.variants);
  });

  it("an applied AI edit marks its variant diverged on the run's stored plan", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const runId = await fx.createRun(["bluesky", "linkedin"]);
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal, runId }, passJudge());

    const run = await fx.repos.createRuns.get(fx.ctx, runId);
    const variants = readVariantPlan(
      (await import("@thalon/contracts")).createPlanSchema.parse(run?.plan),
    );
    expect(variants?.variants).toEqual([
      { platform: "bluesky", diverged: true },
      { platform: "linkedin", diverged: false },
    ]);
  });

  it("without a run id nothing is marked — the draft→run mapping is not one this module may invent", async () => {
    const fx = await fixture();
    const queued = await fx.queue();
    const runId = await fx.createRun(["bluesky"]);
    const proposed = await aiEditDraft(
      fx.ctx,
      fx.repos,
      { draftId: queued.id, instruction: "shorten" },
      { driver: createFakeAiEditDriver(), capTokens: 1_000_000 },
    );
    if (proposed.status !== "proposed") throw new Error("expected a proposal");

    await applyAiEdit(fx.ctx, fx.repos, { proposal: proposed.proposal }, passJudge());

    const run = await fx.repos.createRuns.get(fx.ctx, runId);
    const variants = readVariantPlan(
      (await import("@thalon/contracts")).createPlanSchema.parse(run?.plan),
    );
    expect(variants?.variants).toEqual([{ platform: "bluesky", diverged: false }]);
  });
});

/* ------------------------------------------------------------------ */

describe("the proposal shape", () => {
  it("carries the prior body so a surface can show the before/after without a second read", () => {
    const proposal: AiEditProposal = {
      draftId: "d1",
      instruction: "shorten",
      priorBody: "before",
      priorBodyHash: sha256Hex("before"),
      proposedBody: "after",
    };
    expect(proposal.priorBodyHash).toBe(sha256Hex(proposal.priorBody));
  });
});
