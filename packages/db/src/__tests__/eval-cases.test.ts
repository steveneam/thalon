import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDb, type DbHandle } from "../client";

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe("evalCases.recordIntelDismiss (B6.7 — the intel-triage learning door)", () => {
  it("writes an intel_dismiss row with ground-truth expected, audited in the same transaction", async () => {
    handle = await openTestDb();
    const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);

    const row = await handle.repos.evalCases.recordIntelDismiss(ctx, {
      kind: "trend_dismiss",
      input: { source: "bluesky", externalId: "at://x", areaName: "AI video tooling", score: 41.5, reasons: ["velocity 3.1x"], text: "…", url: null },
      sourceRef: "card-1",
    });
    // The migration took: the check constraint accepts the new origin.
    expect(row.origin).toBe("intel_dismiss");
    expect(row.kind).toBe("trend_dismiss");
    // Ground truth only — never an invented semantic label like relevant:false.
    expect(row.expected).toEqual({ operatorAction: "dismissed" });

    const listed = await handle.repos.evalCases.list(ctx, { origin: "intel_dismiss" });
    expect(listed).toHaveLength(1);

    const events = await handle.repos.events.list(ctx, { entityType: "eval_case" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "eval_case.recorded",
      payload: { kind: "trend_dismiss", origin: "intel_dismiss", sourceRef: "card-1" },
    });
  });
});

describe("evalCases.recordCutDiffReview (B-ve.4 — the editor's proposal learning door)", () => {
  it("writes a cut_diff_review row with the required reason, audited in the same transaction", async () => {
    handle = await openTestDb();
    const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);

    const diff = {
      summary: "move line 1",
      ops: [{ op: "caption-move", line: 1, x: 640, y: 610, why: "clears the wing" }],
    };
    const row = await handle.repos.evalCases.recordCutDiffReview(ctx, {
      kind: "edl_diff_proposal",
      input: { cutId: "cut-1", ask: "clear the caption", diff },
      reason: "the line already clears the wing — the move is unnecessary",
      sourceRef: "cut-1",
    });
    // The migration took: the check constraint accepts the new origin.
    expect(row.origin).toBe("cut_diff_review");
    // Ground truth + the learning material, nothing invented.
    expect(row.expected).toEqual({
      operatorAction: "rejected",
      reason: "the line already clears the wing — the move is unnecessary",
    });

    const events = await handle.repos.events.list(ctx, { entityType: "eval_case" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "eval_case.recorded",
      payload: { kind: "edl_diff_proposal", origin: "cut_diff_review", sourceRef: "cut-1" },
    });
  });

  it("refuses a rejection without a reason (the learning material)", async () => {
    handle = await openTestDb();
    const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);
    await expect(
      handle.repos.evalCases.recordCutDiffReview(ctx, {
        kind: "edl_diff_proposal",
        input: {},
        reason: "   ",
      }),
    ).rejects.toThrow(/must carry its reason/);
  });
});
