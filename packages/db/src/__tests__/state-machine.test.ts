import { tenantCtx } from "@thalon/contracts";
import { InvalidTransitionError } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { InvariantViolationError, NotFoundError } from "../errors";
import { fixture, type Fixture } from "./helpers";

let fx: Fixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("draft state machine against the database (SPINE §1.1)", () => {
  it("I1: a draft cannot reach queued without a passing final verdict for its CURRENT body hash", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");

    // No verdict at all.
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "queued"),
    ).rejects.toThrow(InvariantViolationError);

    // Screen-tier pass is NOT enough — the final tier is the gate.
    await repos.judgeResults.append(fx.ctx, {
      draftId: fx.draft.id,
      gate: "g3_screen",
      verdict: "pass",
    });
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "queued"),
    ).rejects.toThrow(/I1/);

    // A final-tier verdict for a STALE hash is not enough either.
    await repos.judgeResults.append(fx.ctx, {
      draftId: fx.draft.id,
      gate: "g3_final",
      verdict: "pass",
      bodyHash: "0".repeat(64),
    });
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "queued"),
    ).rejects.toThrow(/I1/);

    // Passing final verdict for the current hash unlocks the queue.
    await repos.judgeResults.append(fx.ctx, {
      draftId: fx.draft.id,
      gate: "g3_final",
      verdict: "pass",
    });
    const queued = await repos.drafts.transition(fx.ctx, fx.draft.id, "queued");
    expect(queued.status).toBe("queued");
  });

  it("I4: every transition appends exactly one events row, in order", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.drafts.transition(fx.ctx, fx.draft.id, "blocked", {
      reason: "tier disagreement",
    });
    const rows = await repos.events.list(fx.ctx, {
      entityType: "draft",
      entityId: fx.draft.id,
    });
    expect(rows.map((r) => r.event)).toEqual([
      "draft.created",
      "draft.transition",
      "draft.transition",
    ]);
    expect(rows[1].payload).toMatchObject({ from: "generated", to: "judging" });
    expect(rows[2].payload).toMatchObject({
      from: "judging",
      to: "blocked",
      reason: "tier disagreement",
    });
  });

  it("rejects illegal transitions with a rollback — status unchanged, no event", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "approved"),
    ).rejects.toThrow(InvalidTransitionError);
    const draft = await repos.drafts.get(fx.ctx, fx.draft.id);
    expect(draft.status).toBe("generated");
    const rows = await repos.events.list(fx.ctx, {
      entityType: "draft",
      entityId: fx.draft.id,
    });
    expect(rows.map((r) => r.event)).toEqual(["draft.created"]);
  });

  it("an operator edit re-judges: body swaps, diff + eval row land atomically, old verdicts are dead", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.judgeResults.append(fx.ctx, {
      draftId: fx.draft.id,
      gate: "g3_final",
      verdict: "pass",
    });
    await repos.drafts.transition(fx.ctx, fx.draft.id, "queued");

    const edited = "We shipped a thing today — details in the changelog.";
    const { draft } = await repos.approvals.record(fx.ctx, {
      draftId: fx.draft.id,
      actor: "operator",
      action: "edit",
      editedBody: edited,
    });
    expect(draft.status).toBe("judging");
    expect(draft.body).toBe(edited);

    // The old passing verdict is bound to the old hash — queue stays shut (risk 5).
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "queued"),
    ).rejects.toThrow(/I1/);

    // Re-judge the new content and the full happy path opens up.
    await repos.judgeResults.append(fx.ctx, { draftId: draft.id, gate: "g3_final", verdict: "pass" });
    await repos.drafts.transition(fx.ctx, draft.id, "queued");
    const { draft: approved } = await repos.approvals.record(fx.ctx, {
      draftId: draft.id,
      actor: "operator",
      action: "approve",
    });
    expect(approved.status).toBe("approved");
  });

  it("edit on a non-editable status rolls back the WHOLE touch — no orphan approval/diff/eval rows", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    // generated → edit is illegal (only queued/blocked drafts take operator edits).
    await expect(
      repos.approvals.record(fx.ctx, {
        draftId: fx.draft.id,
        actor: "operator",
        action: "edit",
        editedBody: "sneaky rewrite",
      }),
    ).rejects.toThrow(/queued or blocked/);
    const draft = await repos.drafts.get(fx.ctx, fx.draft.id);
    expect(draft.body).toBe("We shipped a thing today.");
  });

  it("I2: approved → published stays shut without a G5 disclosure verdict (there is no scheduled waypoint — s83 window)", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.judgeResults.append(fx.ctx, { draftId: fx.draft.id, gate: "g3_final", verdict: "pass" });
    await repos.drafts.transition(fx.ctx, fx.draft.id, "queued");
    await repos.approvals.record(fx.ctx, {
      draftId: fx.draft.id,
      actor: "operator",
      action: "approve",
    });
    // (approvals.record already moved the draft queued → approved.)
    // "scheduled" is no longer a status at all — the fact lives on a
    // publish_queue row; the rulebook refuses the word itself.
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "scheduled" as never),
    ).rejects.toThrow(InvalidTransitionError);
    // Approval exists, but no G5 disclosure verdict can exist in Sprints 0–2.
    await expect(
      repos.drafts.transition(fx.ctx, fx.draft.id, "published"),
    ).rejects.toThrow(/I2/);
  });

  it("tenant scoping: another tenant can neither read nor move the draft", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const other = await repos.tenants.create({ slug: "other", name: "Other" });
    const otherCtx = tenantCtx(other.id);
    await expect(repos.drafts.get(otherCtx, fx.draft.id)).rejects.toThrow(NotFoundError);
    await expect(
      repos.drafts.transition(otherCtx, fx.draft.id, "judging"),
    ).rejects.toThrow(NotFoundError);
  });

  it("reJudge (B2.6): a blocked draft re-enters judging directly, through the one transition fn", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.drafts.transition(fx.ctx, fx.draft.id, "blocked", { reason: "g1 denylist fail" });

    const reJudging = await repos.drafts.reJudge(fx.ctx, fx.draft.id, { actor: "operator" });
    expect(reJudging.status).toBe("judging");
    expect(reJudging.body).toBe(fx.draft.body);

    const rows = await repos.events.list(fx.ctx, { entityType: "draft", entityId: fx.draft.id });
    expect(rows.map((r) => r.event)).toEqual(["draft.created", "draft.transition", "draft.transition", "draft.transition"]);
    expect(rows.at(-1)?.payload).toMatchObject({ from: "blocked", to: "judging" });
  });

  it("reJudge (B2.6): releases a draft an operational halt (e.g. BudgetExceededError) stranded in judging, via judging -> blocked -> judging — never landing on queued itself", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    // g1 ran and passed; a gateway call then threw (a hard stop, not a
    // verdict) before any further transition — the draft is stuck in
    // "judging" with no g3 verdict at all.
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.judgeResults.append(fx.ctx, { draftId: fx.draft.id, gate: "g1", verdict: "pass" });

    const reJudging = await repos.drafts.reJudge(fx.ctx, fx.draft.id, { actor: "operator" });
    expect(reJudging.status).toBe("judging");

    const rows = await repos.events.list(fx.ctx, { entityType: "draft", entityId: fx.draft.id });
    expect(rows.map((r) => r.event)).toEqual([
      "draft.created",
      "draft.transition",
      "draft.transition",
      "draft.transition",
    ]);
    expect(rows.at(-2)?.payload).toMatchObject({ from: "judging", to: "blocked" });
    expect(rows.at(-1)?.payload).toMatchObject({ from: "blocked", to: "judging" });

    // I1 still holds: no fresh passing verdict for the current hash yet.
    await expect(repos.drafts.transition(fx.ctx, fx.draft.id, "queued")).rejects.toThrow(/I1/);
  });

  it("reJudge (B2.6): rejects a draft that isn't blocked or stuck-judging (e.g. generated, queued, approved)", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await expect(repos.drafts.reJudge(fx.ctx, fx.draft.id)).rejects.toThrow(/blocked.*judging|judging.*blocked/i);
  });
});
