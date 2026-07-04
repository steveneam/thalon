import { afterEach, describe, expect, it } from "vitest";
import { approveDraft, editDraft, reJudgeDraft, rejectDraft } from "../actions";
import { seedDraft, type Seeded } from "./test-helpers";

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

  it("edit captures edit_diffs + eval_cases in the same transaction and re-judges (I1)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await handle.repos.drafts.transition(ctx, draft.id, "queued");

    const edited = "We shipped a thing today — now with more detail.";
    const { approval, draft: reJudging } = await editDraft(handle.repos, ctx, draft.id, edited, "operator");

    expect(approval.action).toBe("edit");
    expect(reJudging.status).toBe("judging");
    expect(reJudging.body).toBe(edited);

    const cases = await handle.repos.evalCases.list(ctx, { origin: "edit_diff" });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: "draft_edit", origin: "edit_diff", expected: { body: edited } });

    // The old passing verdict is bound to the old hash — the queue stays shut until re-judged.
    await expect(handle.repos.drafts.transition(ctx, draft.id, "queued")).rejects.toThrow(/I1/);
  });

  it("rejects an edit on a draft the judge has never seen (generated)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await expect(editDraft(handle.repos, ctx, draft.id, "sneaky rewrite", "operator")).rejects.toThrow(
      /queued or blocked/,
    );
  });

  it("reJudge retries a verdict-blocked draft unmodified, back to judging", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.drafts.transition(ctx, draft.id, "blocked", { reason: "g1 denylist fail" });

    const { draft: reJudging } = await reJudgeDraft(handle.repos, ctx, draft.id, "operator");
    expect(reJudging.status).toBe("judging");
    expect(reJudging.body).toBe(draft.body); // unmodified — no edit_diffs/eval_cases row for this action

    const cases = await handle.repos.evalCases.list(ctx, { origin: "edit_diff" });
    expect(cases).toHaveLength(0);
  });

  it("reJudge releases a draft an operational halt stranded in judging, without ever landing on queued directly", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    // Simulates a BudgetExceededError mid-pipeline: g1 ran (judging), then the
    // gateway call threw before any further transition — the draft is stuck
    // in "judging" with no g3 verdict at all.
    await handle.repos.drafts.transition(ctx, draft.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g1", verdict: "pass" });

    const { draft: reJudging } = await reJudgeDraft(handle.repos, ctx, draft.id, "operator");
    expect(reJudging.status).toBe("judging");

    // The one writer of drafts.status recorded BOTH hops (judging -> blocked
    // -> judging) — never a silent, unaudited reset.
    const events = await handle.repos.events.list(ctx, { entityType: "draft", entityId: draft.id });
    expect(events.map((e) => e.event)).toEqual([
      "draft.created",
      "draft.transition",
      "draft.transition",
      "draft.transition",
    ]);
    expect(events.at(-2)?.payload).toMatchObject({ from: "judging", to: "blocked" });
    expect(events.at(-1)?.payload).toMatchObject({ from: "blocked", to: "judging" });

    // Still can't queue without a fresh passing verdict for the current hash (I1).
    await expect(handle.repos.drafts.transition(ctx, draft.id, "queued")).rejects.toThrow(/I1/);
  });

  it("reJudge rejects a draft that isn't blocked or stuck-judging", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await expect(reJudgeDraft(handle.repos, ctx, draft.id, "operator")).rejects.toThrow(
      /blocked.*judging|judging.*blocked/i,
    );
  });
});
