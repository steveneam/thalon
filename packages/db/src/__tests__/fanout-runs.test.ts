import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../errors";
import { fixture, type Fixture } from "./helpers";

/**
 * B4.5 residue: `fanout_runs.last_error` — the operator-triage record of the
 * LAST irrecoverable failure on a run. One writer (recordLastError), set with
 * a verbatim message, cleared with null, tenant-scoped like every repo read.
 *
 * s63: `fanout_runs.status` — the lifecycle word finally got its ONE writer
 * (setStatus). No transition graph on purpose: status is operator telemetry,
 * never a control-flow input (the W-audit found rows stuck at "pending" with
 * judged drafts because no writer existed at all).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("fanoutRuns.recordLastError (B4.5)", () => {
  it("sets the verbatim message, then clears it with null", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    expect(run.lastError).toBeNull();

    const failed = await repos.fanoutRuns.recordLastError(
      fx.ctx,
      run.id,
      "generation was irrecoverable after 3 attempt(s): shell exploded",
    );
    expect(failed.lastError).toBe(
      "generation was irrecoverable after 3 attempt(s): shell exploded",
    );

    const cleared = await repos.fanoutRuns.recordLastError(fx.ctx, run.id, null);
    expect(cleared.lastError).toBeNull();
    expect((await repos.fanoutRuns.get(fx.ctx, run.id))?.lastError).toBeNull();
  });

  it("is tenant-scoped: another tenant's ctx gets NotFoundError, the row stays untouched", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    const other = await repos.tenants.create({ slug: "other", name: "Other" });
    await expect(
      repos.fanoutRuns.recordLastError(tenantCtx(other.id), run.id, "cross-tenant write"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await repos.fanoutRuns.get(fx.ctx, run.id))?.lastError).toBeNull();
  });
});

describe("fanoutRuns.setStatus (s63)", () => {
  it("walks the lifecycle words and audits each change with {from, to}", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    expect(run.status).toBe("pending");

    const running = await repos.fanoutRuns.setStatus(fx.ctx, run.id, "running");
    expect(running.status).toBe("running");
    const complete = await repos.fanoutRuns.setStatus(fx.ctx, run.id, "complete");
    expect(complete.status).toBe("complete");

    const events = await repos.events.list(fx.ctx, { limit: 500 });
    const changes = events
      .filter((e) => e.event === "fanout_run.status_changed" && e.entityId === run.id)
      .map((e) => e.payload);
    expect(changes).toContainEqual({ from: "pending", to: "running" });
    expect(changes).toContainEqual({ from: "running", to: "complete" });
  });

  it("is an idempotent no-op on the same status: no write, no event spam", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    await repos.fanoutRuns.setStatus(fx.ctx, run.id, "running");
    const before = (await repos.events.list(fx.ctx, { limit: 500 })).filter(
      (e) => e.event === "fanout_run.status_changed",
    ).length;
    const again = await repos.fanoutRuns.setStatus(fx.ctx, run.id, "running");
    expect(again.status).toBe("running");
    const after = (await repos.events.list(fx.ctx, { limit: 500 })).filter(
      (e) => e.event === "fanout_run.status_changed",
    ).length;
    expect(after).toBe(before);
  });

  it("rejects a word outside FANOUT_RUN_STATUSES (runtime guard for JS callers)", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    await expect(
      repos.fanoutRuns.setStatus(fx.ctx, run.id, "done" as never),
    ).rejects.toThrow(/unknown fanout_run status "done"/);
  });

  it("is tenant-scoped: another tenant's ctx gets NotFoundError, the row stays untouched", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    const other = await repos.tenants.create({ slug: "other-2", name: "Other 2" });
    await expect(
      repos.fanoutRuns.setStatus(tenantCtx(other.id), run.id, "complete"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await repos.fanoutRuns.get(fx.ctx, run.id))?.status).toBe("pending");
  });
});
