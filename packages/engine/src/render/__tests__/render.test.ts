import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { pillarScriptDraftMetaSchema, type PillarScriptDraftMeta } from "../../origination/schemas";
import { createFakeRenderTarget } from "../fake-target";
import { renderPillar } from "../render";

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

const META: PillarScriptDraftMeta = pillarScriptDraftMetaSchema.parse({
  title: "Docs that demo themselves",
  hook: "What if your docs wrote their own demo?",
  beats: [
    { beatIndex: 0, narration: "Thalon reads your site and drafts the script." },
    { beatIndex: 1, narration: "You approve. It ships.", durationHintMs: 2_000 },
  ],
  cta: "Try the demo tenant today.",
  groundingSourceIds: ["00000000-0000-0000-0000-000000000000"],
  promptVersion: "pillar-script-generate.v1",
  brandProfileVersion: 1,
  platformProfileVersion: "pillar.v1",
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-pillar-render-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

async function pillarDraft(
  ctx: TenantCtx,
  repos: Repos,
  opts: { approve?: boolean } = {},
): Promise<Draft> {
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: { tone: "plainspoken" },
      denylist: [],
      platformProfiles: {},
      identity: { company: "Self", oneLiner: "The demo tenant." },
    },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "abc" });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["video"],
    promptVersion: META.promptVersion,
    model: "test/model",
    generationKey: `${ctx.tenantId}:pillar-run-1`,
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "video",
    body: [META.title, META.hook, ...META.beats.map((b) => b.narration), META.cta].join("\n\n"),
    format: "pillar_script",
    generationKey: `${ctx.tenantId}:pillar-draft-1`,
    meta: { ...META, groundingSourceIds: [source.id] },
  });
  if (!(opts.approve ?? true)) return draft;
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

describe("renderPillar (B3.10 thin render seam, keyless)", () => {
  it("refuses a draft that is not a pillar_script", async () => {
    const { ctx, repos, objectStore } = await setup();
    const profile = await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "x" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["linkedin"],
      promptVersion: "v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:post-run`,
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "linkedin",
      body: "a post",
      format: "post",
      generationKey: `${ctx.tenantId}:post-draft`,
      meta: {},
    });
    await expect(
      renderPillar(ctx, repos, draft.id, createFakeRenderTarget(), { objectStore }),
    ).rejects.toThrow(/renders ONLY "pillar_script" drafts/);
  });

  it("refuses a pillar_script that is not approved", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await pillarDraft(ctx, repos, { approve: false });
    await expect(
      renderPillar(ctx, repos, draft.id, createFakeRenderTarget(), { objectStore }),
    ).rejects.toThrow(/ONLY on an "approved" draft/);
  });

  it("renders end-to-end: content-addressed SRT + manifest artifacts, meta patched, target fed the same timeline", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await pillarDraft(ctx, repos);
    const target = createFakeRenderTarget();

    const result = await renderPillar(ctx, repos, draft.id, target, { objectStore });

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") throw new Error("unreachable");
    expect(result.cached).toBe(false);
    expect(result.renderRef).toMatch(/^renders\/pillar\/[0-9a-f]{64}\/manifest\.json$/);

    // The content-addressing is independently verifiable: the manifest's own
    // bytes hash to the prefix segment.
    const manifestBytes = await objectStore.get(result.renderRef);
    expect(manifestBytes).not.toBeNull();
    expect(result.renderRef).toBe(
      `renders/pillar/${sha256Hex(manifestBytes!.toString("utf8"))}/manifest.json`,
    );
    const manifest = JSON.parse(manifestBytes!.toString("utf8"));
    expect(manifest.manifestVersion).toBe("pillar-render.v1");
    expect(manifest.tenantId).toBe(ctx.tenantId);
    expect(manifest.title).toBe(META.title);
    expect(manifest.brand.identity.company).toBe("Self");
    expect(manifest.timeline.cues.map((c: { kind: string }) => c.kind)).toEqual([
      "hook",
      "beat",
      "beat",
      "cta",
    ]);

    const prefix = result.renderRef.replace(/\/manifest\.json$/, "");
    const srtBytes = await objectStore.get(`${prefix}/captions.srt`);
    expect(srtBytes!.toString("utf8")).toBe(result.srt);
    const artifacts = JSON.parse((await objectStore.get(`${prefix}/artifacts.json`))!.toString("utf8"));
    expect(artifacts).toEqual({ captions: "captions.srt", video: null, target: "fake" });
    expect(await objectStore.list(`${prefix}/`)).toHaveLength(3); // no video.mp4 from the fake

    expect(target.requests).toHaveLength(1);
    expect(target.requests[0].srt).toBe(result.srt);

    const updated = await repos.drafts.get(ctx, draft.id);
    const meta = pillarScriptDraftMetaSchema.parse(updated.meta);
    expect(meta.renderStatus).toBe("rendered");
    expect(meta.renderRef).toBe(result.renderRef);
    // The rest of the pinned meta survives untouched.
    expect(meta.title).toBe(META.title);
    expect(meta.beats).toEqual(META.beats);
  });

  it("serves an identical re-render from the content-addressed cache without invoking the target", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await pillarDraft(ctx, repos);
    const target = createFakeRenderTarget();

    const first = await renderPillar(ctx, repos, draft.id, target, { objectStore });
    expect(first.status).toBe("rendered");
    const second = await renderPillar(ctx, repos, draft.id, target, { objectStore });

    expect(second.status).toBe("rendered");
    if (second.status !== "rendered" || first.status !== "rendered") throw new Error("unreachable");
    expect(second.cached).toBe(true);
    expect(second.renderRef).toBe(first.renderRef);
    expect(target.requests).toHaveLength(1); // the cache short-circuited call #2
  });

  it("lands renderStatus failed (and no cache entry) when the target throws, then recovers on a working re-render", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await pillarDraft(ctx, repos);

    const failed = await renderPillar(ctx, repos, draft.id, createFakeRenderTarget({ failWith: "boom" }), {
      objectStore,
    });
    expect(failed.status).toBe("failed");
    if (failed.status !== "failed") throw new Error("unreachable");
    expect(failed.error).toMatch(/render target "fake" failed: boom/);
    let meta = pillarScriptDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.renderStatus).toBe("failed");
    expect(meta.renderRef).toBeNull();
    expect(await objectStore.list("renders/")).toEqual([]); // a failed render never half-commits the cache

    const recovered = await renderPillar(ctx, repos, draft.id, createFakeRenderTarget(), { objectStore });
    expect(recovered.status).toBe("rendered");
    if (recovered.status !== "rendered") throw new Error("unreachable");
    expect(recovered.cached).toBe(false);
    meta = pillarScriptDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.renderStatus).toBe("rendered");
    expect(meta.renderRef).toBe(recovered.renderRef);
  });
});
