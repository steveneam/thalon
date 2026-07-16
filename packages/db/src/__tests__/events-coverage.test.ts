import { afterEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../hash";
import { fixture, type Fixture } from "./helpers";

/**
 * B4.4 events-coverage ratchet (CHARTER A10): every state-changing repo
 * write appends its events row IN THE SAME TRANSACTION (invariant I4 — the
 * append-only audit spine is how the operator reconstructs what happened).
 * Each case below exercises one write path and pins its event name; a write
 * fn added without an emission must be added here with one, or explicitly
 * listed under the exemptions at the bottom.
 *
 * The engine's post-approval artifact stages (render/deploy/capture) are
 * covered structurally: their ONLY write is `drafts.updateMeta`, pinned
 * here as `draft.meta_updated`. Trend ingest emissions land with B4.3's
 * repos (intel lane) and extend this same pattern; the Sprint-6 window's
 * repos (monitored areas · search targets/snapshots · waitlist) pin their
 * emissions the same way in sprint6-repos.test.ts, the Sprint-7 window's
 * (leads · lead scores) in sprint7-repos.test.ts, and the B-ve.1 window's
 * (video projects · takes · cuts) in b-ve1-repos.test.ts.
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function eventNames(f: Fixture): Promise<string[]> {
  const rows = await f.handle.repos.events.list(f.ctx, { limit: 500 });
  return rows.map((row) => row.event);
}

describe("events coverage (B4.4 ratchet)", () => {
  it("fixture setup itself emits the creation spine: brand_profile.created, source.ingested*, fanout_run.created, draft.created", async () => {
    fx = await fixture();
    const names = await eventNames(fx);
    expect(names).toContain("brand_profile.created");
    expect(names).toContain("fanout_run.created");
    expect(names).toContain("draft.created");
  });

  it("sourceChunks.ingest emits source.ingested", async () => {
    fx = await fixture();
    await fx.handle.repos.sourceChunks.ingest(fx.ctx, {
      kind: "prompt",
      contentHash: sha256Hex("coverage brief"),
      chunks: [{ seq: 0, text: "One chunk.", tokenCount: 2, contentHash: sha256Hex("cov-0") }],
    });
    expect(await eventNames(fx)).toContain("source.ingested");
  });

  it("drafts.transition emits draft.transition", async () => {
    fx = await fixture();
    await fx.handle.repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    const rows = await fx.handle.repos.events.list(fx.ctx, {
      entityType: "draft",
      entityId: fx.draft.id,
    });
    expect(rows.map((r) => r.event)).toContain("draft.transition");
  });

  it("drafts.updateMeta emits draft.meta_updated with the patched keys — the artifact stages' audit trail", async () => {
    fx = await fixture();
    const draft = await fx.handle.repos.drafts.get(fx.ctx, fx.draft.id);
    await fx.handle.repos.drafts.updateMeta(fx.ctx, draft.id, draft.updatedAt, {
      renderStatus: "rendered",
      renderRef: "renders/pillar/x/manifest.json",
    });
    const rows = await fx.handle.repos.events.list(fx.ctx, {
      entityType: "draft",
      entityId: draft.id,
    });
    const metaEvents = rows.filter((r) => r.event === "draft.meta_updated");
    expect(metaEvents).toHaveLength(1);
    expect((metaEvents[0].payload as { keys: string[] }).keys.sort()).toEqual([
      "renderRef",
      "renderStatus",
    ]);
  });

  it("drafts.reJudge emits its transitions (composes the one status writer, never a side door)", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    const before = (await repos.events.list(fx.ctx, { entityType: "draft", entityId: fx.draft.id }))
      .length;
    await repos.drafts.reJudge(fx.ctx, fx.draft.id);
    const after = await repos.events.list(fx.ctx, { entityType: "draft", entityId: fx.draft.id });
    // judging -> blocked -> judging: two audited transitions.
    expect(after.length).toBe(before + 2);
    expect(after.slice(-2).every((r) => r.event === "draft.transition")).toBe(true);
  });

  it("fanoutRuns.recordLastError emits fanout_run.last_error_recorded, clearing emits _cleared", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const [run] = await repos.fanoutRuns.list(fx.ctx);
    await repos.fanoutRuns.recordLastError(fx.ctx, run.id, "boom");
    await repos.fanoutRuns.recordLastError(fx.ctx, run.id, null);
    const rows = await repos.events.list(fx.ctx, {
      entityType: "fanout_run",
      entityId: run.id,
    });
    const names = rows.map((r) => r.event);
    expect(names).toContain("fanout_run.last_error_recorded");
    expect(names).toContain("fanout_run.last_error_cleared");
    const recorded = rows.find((r) => r.event === "fanout_run.last_error_recorded");
    expect((recorded?.payload as { message: string }).message).toBe("boom");
  });

  it("usage-ledger budget breach emits budget.exceeded", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.usageLedger.record(fx.ctx, {
      model: "test/model",
      tokensIn: 10,
      tokensOut: 10,
    });
    await expect(
      repos.usageLedger.assertWithinBudget(fx.ctx, { capTokens: 1 }),
    ).rejects.toThrow();
    expect(await eventNames(fx)).toContain("budget.exceeded");
  });

  /**
   * Exemptions — writes that deliberately do NOT emit an events row, each
   * with its reason. Adding a write fn to the repos without either an
   * emission (tested above) or an entry here is the drift this ratchet
   * exists to catch in review.
   *
   * - judgeResults.append: a verdict IS the audit record (append-only,
   *   body-hash-bound); a second row would double-write the same fact.
   * - approvals: the approve/reject action lands as `draft.transition`
   *   (with approvalId in the payload) through the one status writer.
   * - sources.create (bare): only reachable from tests and as the anchor
   *   half of sourceChunks.ingest, which emits `source.ingested`.
   * - caches (llm/retrieval): content-addressed caches are not tenant
   *   state — replaying a cache hit changes nothing auditable.
   * - sourceMetrics.append / eval cases: append-only measurement rows,
   *   themselves the record.
   */
  it("documents the exemption list (executable placeholder so the list is read in review)", () => {
    expect(true).toBe(true);
  });
});
