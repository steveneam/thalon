import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FINAL_JUDGE_GATE, tenantCtx, type TenantCtx } from "@thalon/contracts";
import {
  ArtifactMissingError,
  InvalidStateError,
  IrrecoverableGenerationError,
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type Repos,
} from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { runOrigination } from "../origination/origination";
import { createFakePillarScriptDriver } from "../origination/shell/generator";
import { createFakeRenderTarget } from "../render/fake-target";
import { renderPillar } from "../render/render";
import { deployWebPage } from "../webpage/deploy";
import { createFakeDeployTarget } from "../webpage/fake-deploy-target";

/**
 * B4.5 error-taxonomy ratchet: the shared error classes surface where the
 * conventions say they must — InvalidStateError from stage gates (a
 * sequencing bug, not a stage failure), ArtifactMissingError from a broken
 * content-address invariant (never recorded as a stage failure), and
 * IrrecoverableGenerationError from an exhausted repair loop (carrying
 * attempts + the verbatim lastError for operator triage).
 */

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

async function db(): Promise<{ ctx: TenantCtx; repos: Repos; profile: { id: string; version: number } }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return { ctx, repos, profile };
}

async function approve(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

describe("error taxonomy (B4.5 ratchet)", () => {
  it("stage gates throw InvalidStateError (wrong format / not approved)", async () => {
    const { ctx, repos, profile } = await db();
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-taxonomy-"));
    const objectStore = new LocalObjectStore(storeRoot);
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "tx" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["video"],
      promptVersion: "v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:tax-run`,
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "linkedin",
      body: "a post",
      format: "post",
      generationKey: `${ctx.tenantId}:tax-draft`,
      meta: {},
    });
    // Wrong format for the render stage.
    await expect(
      renderPillar(ctx, repos, draft.id, createFakeRenderTarget(), { objectStore }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("a missing content-addressed artifact throws ArtifactMissingError carrying the ref (never a recorded stage failure)", async () => {
    const { ctx, repos, profile } = await db();
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-taxonomy-"));
    const objectStore = new LocalObjectStore(storeRoot); // deliberately empty
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "tx2" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["web"],
      promptVersion: "v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:tax-web-run`,
    });
    // A well-formed content-addressed key that was simply never written —
    // B4.6's verified read passes it through as `null` (a malformed ref
    // would instead fail key parsing, a different loud error).
    const htmlRef = `web-pages/${sha256Hex("never written")}.html`;
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "web",
      body: "visible text",
      format: "web_page",
      generationKey: `${ctx.tenantId}:tax-web-draft`,
      meta: {
        title: "T",
        description: "D",
        htmlRef,
        groundingSourceIds: [source.id],
        promptVersion: "v1",
        brandProfileVersion: profile.version,
        platformProfileVersion: "web.v1",
      },
    });
    const approved = await approve(ctx, repos, draft);
    const rejection = await deployWebPage(ctx, repos, approved.id, createFakeDeployTarget(), {
      objectStore,
    }).catch((err) => err);
    expect(rejection).toBeInstanceOf(ArtifactMissingError);
    expect((rejection as ArtifactMissingError).ref).toBe(htmlRef);
    // The invariant break was NOT recorded as a stage failure.
    const after = await repos.drafts.get(ctx, approved.id);
    expect((after.meta as { deployStatus?: string }).deployStatus).not.toBe("failed");
  });

  it("an exhausted repair loop throws IrrecoverableGenerationError with attempts + verbatim lastError", async () => {
    const { ctx, repos } = await db();
    const { source } = await repos.sourceChunks.ingest(ctx, {
      kind: "prompt",
      contentHash: sha256Hex("tax brief"),
      chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("tax-0") }],
    });
    const alwaysThrows = async () => {
      throw new Error("shell exploded");
    };
    const rejection = await runOrigination(
      ctx,
      repos,
      { promptSourceId: source.id },
      { driver: alwaysThrows, capTokens: 1_000_000 },
    ).catch((err) => err);
    expect(rejection).toBeInstanceOf(IrrecoverableGenerationError);
    expect((rejection as IrrecoverableGenerationError).attempts).toBe(3);
    expect((rejection as IrrecoverableGenerationError).lastError).toBe("shell exploded");
    expect((rejection as Error).message).toMatch(/irrecoverable after 3 attempt\(s\): shell exploded/);

    // B4.5 residue: the run row keeps the thrown message verbatim for
    // operator triage (the throw alone dies with the process).
    const [run] = await repos.fanoutRuns.list(ctx);
    expect(run.lastError).toBe((rejection as Error).message);
  });

  it("a successful backfill on the same run clears last_error", async () => {
    const { ctx, repos } = await db();
    const { source } = await repos.sourceChunks.ingest(ctx, {
      kind: "prompt",
      contentHash: sha256Hex("tax brief 2"),
      chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("tax2-0") }],
    });
    const request = { promptSourceId: source.id };
    const alwaysThrows = async () => {
      throw new Error("shell exploded");
    };
    await runOrigination(ctx, repos, request, {
      driver: alwaysThrows,
      capTokens: 1_000_000,
    }).catch(() => undefined);
    const [failedRun] = await repos.fanoutRuns.list(ctx);
    expect(failedRun.lastError).toMatch(/shell exploded/);

    // Same key material -> the backfill path reuses the failed run.
    const result = await runOrigination(ctx, repos, request, {
      driver: createFakePillarScriptDriver(),
      capTokens: 1_000_000,
    });
    expect(result.runId).toBe(failedRun.id);
    expect(result.created).toBe(false);
    expect(result.draft.status).toBe("generated");
    expect((await repos.fanoutRuns.get(ctx, failedRun.id))?.lastError).toBeNull();
  });
});
