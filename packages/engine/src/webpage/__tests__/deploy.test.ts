import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { deployWebPage } from "../deploy";
import { createFakeDeployTarget } from "../fake-deploy-target";
import { webPageDraftMetaSchema } from "../schemas";

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

const HTML = '<html lang="en"><head><title>Acme</title></head><body><h1>Ship faster</h1></body></html>';

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-webpage-deploy-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

async function webPageDraft(
  ctx: TenantCtx,
  repos: Repos,
  objectStore: LocalObjectStore,
  opts: { approve?: boolean; skipArtifact?: boolean } = {},
): Promise<Draft> {
  const htmlRef = `web-pages/${sha256Hex(HTML)}.html`;
  if (!opts.skipArtifact) await objectStore.put(htmlRef, HTML);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "abc" });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["web"],
    promptVersion: "web-page-generate.v1",
    model: "test/model",
    generationKey: `${ctx.tenantId}:web-run-1`,
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "web",
    body: "Acme\nShip faster",
    format: "web_page",
    generationKey: `${ctx.tenantId}:web-draft-1`,
    meta: webPageDraftMetaSchema.parse({
      title: "Acme",
      description: "Acme landing page",
      htmlRef,
      groundingSourceIds: [source.id],
      promptVersion: "web-page-generate.v1",
      brandProfileVersion: profile.version,
      platformProfileVersion: "web.v1",
    }),
  });
  if (!(opts.approve ?? true)) return draft;
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

describe("deployWebPage (B3.15 thin ship seam, keyless)", () => {
  it("refuses a web_page that is not approved", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await webPageDraft(ctx, repos, objectStore, { approve: false });
    await expect(
      deployWebPage(ctx, repos, draft.id, createFakeDeployTarget(), { objectStore }),
    ).rejects.toThrow(/ONLY on an "approved" draft/);
  });

  it("deploys the exact judged artifact bytes and records deployStatus/deployRef", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await webPageDraft(ctx, repos, objectStore);
    const target = createFakeDeployTarget();

    const result = await deployWebPage(ctx, repos, draft.id, target, { objectStore });

    expect(result.status).toBe("deployed");
    if (result.status !== "deployed") throw new Error("unreachable");
    expect(result.url).toBe(`preview://web-pages/${sha256Hex(HTML)}.html`);
    // What shipped IS what was judged: the target received the stored bytes.
    expect(target.requests).toHaveLength(1);
    expect(target.requests[0].html).toBe(HTML);
    expect(target.requests[0].tenantId).toBe(ctx.tenantId);

    const meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.deployStatus).toBe("deployed");
    expect(meta.deployRef).toBe(result.url);
    expect(meta.title).toBe("Acme"); // the rest of the pinned meta survives untouched
  });

  it("lands deployStatus failed when the target throws, then recovers on a working re-deploy", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await webPageDraft(ctx, repos, objectStore);

    const failed = await deployWebPage(ctx, repos, draft.id, createFakeDeployTarget({ failWith: "boom" }), {
      objectStore,
    });
    expect(failed.status).toBe("failed");
    if (failed.status !== "failed") throw new Error("unreachable");
    expect(failed.error).toMatch(/deploy target "fake" failed: boom/);
    let meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.deployStatus).toBe("failed");
    expect(meta.deployRef).toBeNull();

    const recovered = await deployWebPage(ctx, repos, draft.id, createFakeDeployTarget(), { objectStore });
    expect(recovered.status).toBe("deployed");
    meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.deployStatus).toBe("deployed");
  });

  it("throws (never records a failed deploy) when the content-addressed artifact is missing — an invariant break, not a target failure", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await webPageDraft(ctx, repos, objectStore, { skipArtifact: true });
    await expect(
      deployWebPage(ctx, repos, draft.id, createFakeDeployTarget(), { objectStore }),
    ).rejects.toThrow(/missing from the object store/);
    const meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.deployStatus).toBe("drafted"); // untouched
  });
});
