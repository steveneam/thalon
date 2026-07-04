import { BudgetExceededError } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { approveDraft, editDraft, reJudgeDraft, rejectDraft } from "../actions";
import { fixedJudgeDriver, JUDGE_FAIL, JUDGE_PASS, seedDraft, type Seeded } from "./test-helpers";

let seeded: Seeded | undefined;
afterEach(async () => {
  await seeded?.close();
  seeded = undefined;
});

/** Route logic asserted directly against real (PGlite) repos — the B0.4 test pattern — since route.ts files are thin wiring over these functions. */
describe("approve-queue actions", () => {
  it("approve moves a queued, gate-passing draft to approved", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await handle.repos.drafts.transition(ctx, draft.id, "queued");

    const { approval, draft: approved } = await approveDraft(handle.repos, ctx, draft.id, "operator");
    expect(approval.action).toBe("approve");
    expect(approved.status).toBe("approved");
  });

  it("reject moves a queued draft to rejected", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await handle.repos.drafts.transition(ctx, draft.id, "queued");

    const { approval, draft: rejected } = await rejectDraft(handle.repos, ctx, draft.id, "operator");
    expect(approval.action).toBe("reject");
    expect(rejected.status).toBe("rejected");
  });

  it("edit-save captures edit_diffs + eval_cases atomically AND runs the judge lane synchronously, reaching the fully-judged outcome (queued)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await handle.repos.drafts.transition(ctx, draft.id, "queued");

    const edited = "We shipped a thing today — now with more detail.";
    const { approval, draft: judged } = await editDraft(handle.repos, ctx, draft.id, edited, "operator", {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_PASS),
    });

    expect(approval.action).toBe("edit");
    expect(judged.body).toBe(edited);
    // Not just "judging" (the pre-B2.6-fix behavior) — the judge lane actually ran in this same request.
    expect(judged.status).toBe("queued");

    const cases = await handle.repos.evalCases.list(ctx, { origin: "edit_diff" });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: "draft_edit", origin: "edit_diff", expected: { body: edited } });

    const verdicts = await handle.repos.judgeResults.listForDraft(ctx, draft.id);
    expect(
      verdicts
        .filter((v) => v.bodyHash === judged.bodyHash)
        .map((v) => v.gate)
        .sort(),
    ).toEqual(["g1", "g3_final", "g3_screen"]);
  });

  it("rejects an edit on a draft the judge has never seen (generated)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await expect(editDraft(handle.repos, ctx, draft.id, "sneaky rewrite", "operator")).rejects.toThrow(
      /queued or blocked/,
    );
  });

  it("reJudge from blocked runs the judge lane synchronously and reaches queued when both tiers pass", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.drafts.transition(ctx, draft.id, "blocked", { reason: "g1 denylist fail" });

    const { draft: judged } = await reJudgeDraft(handle.repos, ctx, draft.id, "operator", {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_PASS),
    });
    expect(judged.status).toBe("queued");
    expect(judged.body).toBe(draft.body); // unmodified — no edit_diffs/eval_cases row for this action

    const cases = await handle.repos.evalCases.list(ctx, { origin: "edit_diff" });
    expect(cases).toHaveLength(0);
  });

  it("reJudge from blocked lands back on blocked when the final tier fails (a real verdict, retried and reproduced)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.drafts.transition(ctx, draft.id, "blocked", { reason: "g1 denylist fail" });

    const { draft: judged } = await reJudgeDraft(handle.repos, ctx, draft.id, "operator", {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_FAIL),
    });
    expect(judged.status).toBe("blocked");
  });

  it("reJudge from judging (the operational-halt stuck-recovery path) runs the judge lane and reaches queued", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    // Simulates a PRIOR operational halt: g1 ran and passed, then a gateway
    // call threw before any further transition — the draft was stuck in
    // "judging" with no g3 verdict at all until this re-judge.
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g1", verdict: "pass" });

    const { draft: judged } = await reJudgeDraft(handle.repos, ctx, draft.id, "operator", {
      screenDriver: fixedJudgeDriver(JUDGE_PASS),
      finalDriver: fixedJudgeDriver(JUDGE_PASS),
    });
    expect(judged.status).toBe("queued");

    // The one writer of drafts.status recorded EVERY hop (judging -> blocked
    // -> judging -> queued) — never a silent, unaudited reset.
    const events = await handle.repos.events.list(ctx, { entityType: "draft", entityId: draft.id });
    expect(events.map((e) => e.event)).toEqual([
      "draft.created",
      "draft.transition",
      "draft.transition",
      "draft.transition",
      "draft.transition",
    ]);
    expect(events.at(-3)?.payload).toMatchObject({ from: "judging", to: "blocked" });
    expect(events.at(-2)?.payload).toMatchObject({ from: "blocked", to: "judging" });
    expect(events.at(-1)?.payload).toMatchObject({ from: "judging", to: "queued" });
  });

  it("a budget halt during re-judge surfaces LOUDLY and the draft honestly stays judging (never silently downgraded)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.drafts.transition(ctx, draft.id, "blocked", { reason: "g1 denylist fail" });

    // capTokens: 0 forces the REAL withGatewayGuard budget check to reject
    // before the driver is ever called — the same operational-halt path
    // proprietary/judge's own pipeline tests use (never a scripted throw).
    await expect(
      reJudgeDraft(handle.repos, ctx, draft.id, "operator", {
        screenDriver: fixedJudgeDriver(JUDGE_PASS),
        finalDriver: fixedJudgeDriver(JUDGE_PASS),
        capTokens: 0,
      }),
    ).rejects.toThrow(BudgetExceededError);

    const stuck = await handle.repos.drafts.get(ctx, draft.id);
    expect(stuck.status).toBe("judging");
  });

  it("a budget halt during edit-save surfaces LOUDLY and the draft honestly stays judging", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await handle.repos.drafts.transition(ctx, draft.id, "queued");

    await expect(
      editDraft(handle.repos, ctx, draft.id, "an edit that never gets judged", "operator", {
        screenDriver: fixedJudgeDriver(JUDGE_PASS),
        finalDriver: fixedJudgeDriver(JUDGE_PASS),
        capTokens: 0,
      }),
    ).rejects.toThrow(BudgetExceededError);

    const stuck = await handle.repos.drafts.get(ctx, draft.id);
    expect(stuck.status).toBe("judging");
    expect(stuck.body).toBe("an edit that never gets judged"); // the edit itself DID commit — only judging failed
  });

  it("reJudge rejects a draft that isn't blocked or stuck-judging", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await expect(reJudgeDraft(handle.repos, ctx, draft.id, "operator")).rejects.toThrow(
      /blocked.*judging|judging.*blocked/i,
    );
  });

  it("a second, double-fired reJudge after the first already reached queued surfaces a clean error, not a crash", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.drafts.transition(ctx, draft.id, "blocked", { reason: "g1 denylist fail" });

    const deps = { screenDriver: fixedJudgeDriver(JUDGE_PASS), finalDriver: fixedJudgeDriver(JUDGE_PASS) };
    const first = await reJudgeDraft(handle.repos, ctx, draft.id, "operator", deps);
    expect(first.draft.status).toBe("queued");

    // The operator's second click — already "in flight" when the first
    // completed — finds the draft past blocked/judging: a clean, existing
    // error, never a crash.
    await expect(reJudgeDraft(handle.repos, ctx, draft.id, "operator", deps)).rejects.toThrow(
      /blocked.*judging|judging.*blocked/i,
    );
  });
});
