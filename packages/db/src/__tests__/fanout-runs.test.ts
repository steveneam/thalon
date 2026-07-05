import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../errors";
import { fixture, type Fixture } from "./helpers";

/**
 * B4.5 residue: `fanout_runs.last_error` — the operator-triage record of the
 * LAST irrecoverable failure on a run. One writer (recordLastError), set with
 * a verbatim message, cleared with null, tenant-scoped like every repo read.
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
