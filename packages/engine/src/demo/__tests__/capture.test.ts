import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import { ConcurrentUpdateError, openTestDb, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { driveDemoCapture } from "../capture";
import type { DemoDriver } from "../driver";
import { demoPlanDraftMetaSchema, type DemoPlanDraftMeta } from "../schemas";
import { createFakeDemoDriver } from "../fake-driver";

/** A fake driver whose `finish()` throws — simulates the real Playwright driver's unguarded page/context/browser `.close()` calls rejecting during teardown. */
function createThrowingFinishDriver(failTargets: readonly string[] = []): DemoDriver {
  const base = createFakeDemoDriver({ failTargets });
  return {
    ...base,
    finish: async () => {
      throw new Error("simulated teardown failure (e.g. browser.close() rejected)");
    },
  };
}

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

const META: DemoPlanDraftMeta = demoPlanDraftMetaSchema.parse({
  steps: [
    { stepIndex: 0, action: "goto", target: "https://example.test/", value: "", narration: "Open the homepage." },
    { stepIndex: 1, action: "click", target: "#docs-link", value: "", narration: "Click into the docs." },
  ],
  crawlSourceId: "00000000-0000-0000-0000-000000000000",
  pageUrls: ["https://example.test/", "https://example.test/docs"],
  captureStatus: "planned",
  captureRef: null,
  promptVersion: "storyboard-generate.v1",
  brandProfileVersion: 1,
  platformProfileVersion: "demo.v1",
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-demo-capture-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

/** Builds a demo_plan draft and drives it all the way to `approved` (generated -> judging -> queued -> approved), so ./capture.ts's "approved only" gate is satisfied. */
async function approvedDraft(ctx: TenantCtx, repos: Repos): Promise<Draft> {
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "site_crawl", contentHash: "abc" });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["web"],
    promptVersion: "storyboard-generate.v1",
    model: "test/model",
    generationKey: `${ctx.tenantId}:demo-run-1`,
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "web",
    body: META.steps.map((s) => s.narration).join("\n\n"),
    format: "demo_plan",
    generationKey: `${ctx.tenantId}:demo-draft-1`,
    meta: META,
  });
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

describe("driveDemoCapture (B2.5 stage 4, keyless + browser-free)", () => {
  it("refuses to drive a draft that is not approved", async () => {
    const { ctx, repos, objectStore } = await setup();
    const profile = await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    const source = await repos.sources.create(ctx, { kind: "site_crawl", contentHash: "abc" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["web"],
      promptVersion: "storyboard-generate.v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:demo-run-x`,
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "web",
      body: "x",
      format: "demo_plan",
      generationKey: `${ctx.tenantId}:demo-draft-x`,
      meta: META,
    });
    await expect(
      driveDemoCapture(ctx, repos, draft.id, createFakeDemoDriver(), { objectStore }),
    ).rejects.toThrow(/demo capture drives ONLY an "approved" draft/);
  });

  it("succeeds end-to-end: captures every step, writes a content-addressed bundle, and records captureRef", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedDraft(ctx, repos);

    const result = await driveDemoCapture(ctx, repos, draft.id, createFakeDemoDriver(), { objectStore });

    expect(result.status).toBe("captured");
    if (result.status !== "captured") throw new Error("unreachable");
    expect(result.captureRef).toMatch(/^demo-captures\/[0-9a-f]{64}\.json$/);

    const stored = await objectStore.get(result.captureRef);
    expect(stored).not.toBeNull();
    const bundle = JSON.parse(stored!.toString("utf8"));
    expect(bundle.eventTrace).toHaveLength(2);
    expect(bundle.eventTrace.every((e: { outcome: string }) => e.outcome === "ok")).toBe(true);
    expect(bundle.cursorTrack).toHaveLength(2);
    expect(bundle.video).toBeNull();

    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = updated.meta as DemoPlanDraftMeta;
    expect(meta.captureStatus).toBe("captured");
    expect(meta.captureRef).toBe(result.captureRef);
    // The rest of the pinned meta survives untouched.
    expect(meta.crawlSourceId).toBe(META.crawlSourceId);
    expect(meta.steps).toEqual(META.steps);
  });

  it("fails loudly at the first step failure: no captureRef, captureStatus failed, later steps never run", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedDraft(ctx, repos);

    const driver = createFakeDemoDriver({ failTargets: ["https://example.test/"] });
    const runStepCalls: string[] = [];
    const spyDriver = {
      ...driver,
      runStep: async (step: Parameters<typeof driver.runStep>[0]) => {
        runStepCalls.push(step.target);
        return driver.runStep(step);
      },
    };

    const result = await driveDemoCapture(ctx, repos, draft.id, spyDriver, { objectStore });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.failedStepIndex).toBe(0);
    expect(result.error).toMatch(/configured to fail/);
    // Only the first (failing) step ran — the drive stops immediately.
    expect(runStepCalls).toEqual(["https://example.test/"]);

    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = updated.meta as DemoPlanDraftMeta;
    expect(meta.captureStatus).toBe("failed");
    expect(meta.captureRef).toBeNull();

    // Nothing was ever written to the object store for this failed capture.
    const keys = await objectStore.list("demo-captures/");
    expect(keys).toEqual([]);
  });

  it("persists the failed meta even when the driver's teardown throws after the step failure", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedDraft(ctx, repos);
    const driver = createThrowingFinishDriver(["https://example.test/"]);

    const result = await driveDemoCapture(ctx, repos, draft.id, driver, { objectStore });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    // Both failures are surfaced — the teardown error is never swallowed.
    expect(result.error).toMatch(/configured to fail/);
    expect(result.error).toMatch(/driver teardown failed/);
    expect(result.error).toMatch(/simulated teardown failure/);

    // The critical assertion: a throwing finish() must NOT prevent the
    // "failed" meta write, or a prior successful capture's captureStatus/
    // captureRef would durably survive as a lie about this drive.
    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = updated.meta as DemoPlanDraftMeta;
    expect(meta.captureStatus).toBe("failed");
    expect(meta.captureRef).toBeNull();
  });

  it("throws (rather than silently overwriting) when finish() fails after a PRIOR capture already succeeded", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedDraft(ctx, repos);

    // Drive #1 succeeds: captureStatus "captured" + a real captureRef persists.
    const first = await driveDemoCapture(ctx, repos, draft.id, createFakeDemoDriver(), { objectStore });
    expect(first.status).toBe("captured");
    if (first.status !== "captured") throw new Error("unreachable");

    // Drive #2 (operator re-drive) fails a step AND its teardown throws.
    const second = await driveDemoCapture(
      ctx,
      repos,
      draft.id,
      createThrowingFinishDriver(["https://example.test/"]),
      { objectStore },
    );
    expect(second.status).toBe("failed");

    // The draft must now truthfully reflect drive #2's outcome, not durably
    // keep drive #1's stale "captured"/refA.
    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = updated.meta as DemoPlanDraftMeta;
    expect(meta.captureStatus).toBe("failed");
    expect(meta.captureRef).toBeNull();
  });

  it("detects a concurrent write and throws instead of clobbering an already-persisted capture", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedDraft(ctx, repos);
    // The snapshot a concurrent caller would have read BEFORE any drive's
    // write landed (double-click / client retry — nothing serializes drives).
    const staleUpdatedAt = draft.updatedAt;

    const result = await driveDemoCapture(ctx, repos, draft.id, createFakeDemoDriver(), { objectStore });
    expect(result.status).toBe("captured");
    if (result.status !== "captured") throw new Error("unreachable");

    // A second write built from that same stale snapshot must be rejected,
    // never silently clobber the first drive's already-persisted result.
    await expect(
      repos.drafts.updateMeta(ctx, draft.id, staleUpdatedAt, {
        ...META,
        captureStatus: "failed",
        captureRef: null,
      }),
    ).rejects.toThrow(ConcurrentUpdateError);

    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = updated.meta as DemoPlanDraftMeta;
    expect(meta.captureStatus).toBe("captured");
    expect(meta.captureRef).toBe(result.captureRef);
  });
});
