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
