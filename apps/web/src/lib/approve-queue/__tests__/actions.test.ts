import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FINAL_JUDGE_GATE, webPageDraftMetaSchema } from "@thalon/contracts";
import { BudgetExceededError, sha256Hex } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { approveDraft, editDraft, publishApprovedPage, reJudgeDraft, rejectDraft } from "../actions";
import { fixedJudgeDriver, JUDGE_FAIL, JUDGE_PASS, seedDraft, type Seeded } from "./test-helpers";

let seeded: Seeded | undefined;
let storeRoot: string | undefined;
afterEach(async () => {
  await seeded?.close();
  seeded = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
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

  it("publish puts an approved web_page draft through the own-site door: deploy meta flips, posts bundle upserts, draft STAYS approved", async () => {
    seeded = await seedDraft();
    const { handle, ctx, run, draft } = seeded;
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-web-publish-"));
    const objectStore = new LocalObjectStore(storeRoot);

    // Rebuild the seeded draft as an approved web_page draft with its
    // artifact in the store (the engine publish tests' shape, web-side).
    const html =
      '<html lang="en"><head><title>Judged pipelines</title></head><body><h1>Judged pipelines</h1></body></html>';
    const htmlRef = `web-pages/${sha256Hex(html)}.html`;
    await objectStore.put(htmlRef, html);
    const page = await handle.repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: draft.sourceId,
      platform: "web",
      body: "Judged pipelines",
      format: "web_page",
      generationKey: sha256Hex(`${ctx.tenantId}:publish-page`),
      meta: webPageDraftMetaSchema.parse({
        title: "Judged pipelines",
        description: "Why judged pipelines beat unguarded generation.",
        htmlRef,
        groundingSourceIds: [draft.sourceId],
        promptVersion: "web-page-generate.v1",
        brandProfileVersion: 1,
        platformProfileVersion: "web.v1",
      }),
    });
    await handle.repos.drafts.transition(ctx, page.id, "judging");
    await handle.repos.judgeResults.append(ctx, { draftId: page.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
    await handle.repos.drafts.transition(ctx, page.id, "queued");
    await handle.repos.drafts.transition(ctx, page.id, "approved");

    const result = await publishApprovedPage(handle.repos, ctx, page.id, 1_751_900_000_000, ["thalon"], {
      objectStore,
    });
    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("unreachable");
    expect(result.slug).toBe("judged-pipelines");
    expect(result.url).toBe("/blog/judged-pipelines");
    expect(result.bundle.posts).toHaveLength(1);
    expect(result.bundle.posts[0]).toMatchObject({ slug: "judged-pipelines", tags: ["thalon"] });

    const after = await handle.repos.drafts.get(ctx, page.id);
    expect(after.status).toBe("approved"); // republishable by design — deploy truth lives in meta
    const meta = webPageDraftMetaSchema.parse(after.meta);
    expect(meta.deployStatus).toBe("deployed");
    expect(meta.deployRef).toBe("/blog/judged-pipelines");
  });

  it("publish refuses a non-web_page draft loudly (the engine's format gate surfaces through the action)", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-web-publish-"));
    await expect(
      publishApprovedPage(handle.repos, ctx, draft.id, 1_751_900_000_000, undefined, {
        objectStore: new LocalObjectStore(storeRoot),
      }),
    ).rejects.toThrow(/web_page/);
  });
});
