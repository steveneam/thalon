import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { pillarScriptDraftMetaSchema, type PillarScriptDraftMeta } from "../../origination/schemas";
import { compositionSpecFromPillarManifest } from "../composition";
import { renderCompositionProject } from "../composition-project";
import { CompositionLintError, type CompositionLinter } from "../composition-lint";
import { createFakeNarrationDriver } from "../narration";
import {
  HyperframesRenderError,
  createHyperframesRenderTarget,
  type HyperframesProducerModule,
  type HyperframesRenderJob,
  type RenderAudioBundle,
} from "../hyperframes-target";
import { renderPillar } from "../render";
import { derivePillarTimeline, renderSrt } from "../srt";
import type { PillarRenderManifest, PillarRenderRequest } from "../target";

const cleanupDirs: string[] = [];
let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const dir of cleanupDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(tag: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `thalon-hf-${tag}-`));
  cleanupDirs.push(dir);
  return dir;
}

const passLinter: CompositionLinter = async () => ({ ok: true, errorCount: 0, findings: [] });

class FakeRenderCancelledError extends Error {
  constructor(
    message: string,
    readonly reason: "user_cancelled" | "timeout" | "aborted",
  ) {
    super(message);
    this.name = "RenderCancelledError";
  }
}

interface FakeProducer {
  mod: HyperframesProducerModule;
  createCalls: Array<Record<string, unknown>>;
  executeCalls: Array<{ job: HyperframesRenderJob; projectDir: string; outputPath: string; signal: AbortSignal | undefined }>;
}

function fakeProducer(
  execute?: (job: HyperframesRenderJob, projectDir: string, outputPath: string) => Promise<void>,
): FakeProducer {
  const createCalls: Array<Record<string, unknown>> = [];
  const executeCalls: FakeProducer["executeCalls"] = [];
  const mod: HyperframesProducerModule = {
    createRenderJob(config) {
      createCalls.push({ ...config });
      return { id: "job-1", status: "queued" };
    },
    async executeRenderJob(job, projectDir, outputPath, _onProgress, abortSignal) {
      executeCalls.push({ job, projectDir, outputPath, signal: abortSignal });
      if (execute) return execute(job, projectDir, outputPath);
      await writeFile(outputPath, "FAKE-MP4-BYTES");
    },
    RenderCancelledError: FakeRenderCancelledError,
  };
  return { mod, createCalls, executeCalls };
}

function pillarRequest(): PillarRenderRequest {
  const timeline = derivePillarTimeline({
    hook: "What if your docs wrote their own demo?",
    beats: [{ beatIndex: 0, narration: "Thalon reads your site and drafts the script." }],
    cta: "Try the demo tenant today.",
  });
  const manifest: PillarRenderManifest = {
    manifestVersion: "pillar-render.v1",
    tenantId: "tenant-1",
    title: "Docs that demo themselves",
    timeline,
    brand: { profileId: "profile-1", profileVersion: 1, identity: { company: "Self" }, voice: {} },
    script: { promptVersion: "pillar-script-generate.v1", brandProfileVersion: 1, platformProfileVersion: "pillar.v1" },
  };
  return { manifest, srt: renderSrt(timeline) };
}

describe("createHyperframesRenderTarget (browser-free: fake producer module behind the seam)", () => {
  it("renders: deterministic composition written to the work dir, compile-time fps + standard quality + mp4 baked into the job, video path returned", async () => {
    const producer = fakeProducer();
    const workDir = tempDir("happy");
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir,
    });
    const request = pillarRequest();

    const { videoPath } = await target.render(request);

    expect(target.name).toBe("hyperframes");
    expect(videoPath).not.toBeNull();
    expect(path.dirname(videoPath!).startsWith(workDir)).toBe(true);
    expect((await readFile(videoPath!)).toString("utf8")).toBe("FAKE-MP4-BYTES");

    expect(producer.createCalls).toEqual([{ fps: 30, quality: "standard", format: "mp4" }]);
    expect(producer.executeCalls).toHaveLength(1);
    const call = producer.executeCalls[0];
    expect(call.outputPath).toBe(videoPath);
    expect(call.signal).toBeInstanceOf(AbortSignal);
    // The whole deterministic multi-file project lands in the work dir, byte-equal to the emitter's output.
    const project = renderCompositionProject(compositionSpecFromPillarManifest(request.manifest));
    for (const [name, html] of Object.entries(project.files)) {
      expect(await readFile(path.join(call.projectDir, name), "utf8")).toBe(html);
    }
  });

  it("writes the audio bundle's files and bakes narration timings into the composition (the RenderTarget seam itself stays untouched)", async () => {
    const producer = fakeProducer();
    const request = pillarRequest();
    const narrationDriver = createFakeNarrationDriver();
    const bundleForManifest = async (): Promise<RenderAudioBundle> => {
      const cues = request.manifest.timeline.cues;
      const narration = [];
      for (const cue of cues) {
        const artifact = await narrationDriver.synthesize({ text: cue.text, voice: "af_heart" });
        narration.push({ wav: artifact.wav, durationMs: artifact.durationMs, words: artifact.words });
      }
      return { narration, sfx: cues.map((_, i) => (i === 1 ? Buffer.from("SFX") : null)) };
    };
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir: tempDir("audio"),
      audio: bundleForManifest,
    });
    await target.render(request);

    const projectDir = producer.executeCalls[0].projectDir;
    const root = await readFile(path.join(projectDir, "index.html"), "utf8");
    expect(root).toContain(`<audio id="narration-0" src="audio/cue-0.wav"`);
    expect(root).toContain(`<audio id="sfx-1" src="audio/sfx-1.wav"`);
    expect(root).not.toContain("music-bed"); // the bed seam stays honestly empty
    expect((await readFile(path.join(projectDir, "audio", "sfx-1.wav"))).toString("utf8")).toBe("SFX");
    const wav0 = await readFile(path.join(projectDir, "audio", "cue-0.wav"));
    expect(wav0.toString("ascii", 0, 4)).toBe("RIFF");
    // Real word timings reached the karaoke layer of the scene file.
    const scene0 = await readFile(path.join(projectDir, "compositions", "scene-0.html"), "utf8");
    expect(scene0).toContain(`class="cw"`);
  });

  it("refuses a misaligned audio bundle before any producer spend", async () => {
    let producerLoaded = false;
    const target = createHyperframesRenderTarget({
      producer: async () => {
        producerLoaded = true;
        return fakeProducer().mod;
      },
      linter: passLinter,
      workDir: tempDir("misaligned"),
      audio: async () => ({ narration: [null] }),
    });
    await expect(target.render(pillarRequest())).rejects.toThrow(/narration entries for 3 cues/);
    expect(producerLoaded).toBe(false);
  });

  it("threads quality + workers overrides into the render job", async () => {
    const producer = fakeProducer();
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir: tempDir("opts"),
      quality: "draft",
      workers: 2,
    });
    await target.render(pillarRequest());
    expect(producer.createCalls).toEqual([{ fps: 30, quality: "draft", format: "mp4", workers: 2 }]);
  });

  it("a lint-gate error stops the render BEFORE any producer/chromium spend", async () => {
    const failLinter: CompositionLinter = async () => ({
      ok: false,
      errorCount: 1,
      findings: [{ code: "clip_missing_duration", severity: "error", message: "boom" }],
    });
    let producerLoaded = false;
    const target = createHyperframesRenderTarget({
      producer: async () => {
        producerLoaded = true;
        return fakeProducer().mod;
      },
      linter: failLinter,
      workDir: tempDir("lint"),
    });

    await expect(target.render(pillarRequest())).rejects.toBeInstanceOf(CompositionLintError);
    expect(producerLoaded).toBe(false);
  });

  it("maps RenderCancelledError onto the loud-failure taxonomy with its reason", async () => {
    const producer = fakeProducer(async () => {
      throw new FakeRenderCancelledError("render exceeded the whole-render ceiling", "timeout");
    });
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir: tempDir("cancel"),
    });

    let thrown: unknown;
    try {
      await target.render(pillarRequest());
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(HyperframesRenderError);
    expect((thrown as HyperframesRenderError).reason).toBe("timeout");
    expect((thrown as HyperframesRenderError).message).toMatch(/cancelled \(timeout\)/);
  });

  it("an engine stage failure surfaces the failed stage + diagnostic detail (triageable lastError, not a shrug)", async () => {
    const producer = fakeProducer(async (job) => {
      job.failedStage = "capture";
      job.errorDetails = { message: "browser tab crashed" };
      throw new Error("stage error");
    });
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir: tempDir("stage"),
    });

    let thrown: unknown;
    try {
      await target.render(pillarRequest());
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(HyperframesRenderError);
    expect((thrown as HyperframesRenderError).reason).toBe("engine");
    expect((thrown as HyperframesRenderError).message).toMatch(/stage "capture": browser tab crashed/);
  });

  it("the cleanup handle releases the job dir (video included) and is idempotent", async () => {
    const producer = fakeProducer();
    const workDir = tempDir("cleanup");
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir,
    });

    const { videoPath, cleanup } = await target.render(pillarRequest());

    // The mp4 lives inside the job dir — it survives until the caller says so.
    expect(existsSync(videoPath!)).toBe(true);
    await cleanup!();
    expect(existsSync(path.dirname(videoPath!))).toBe(false);
    await cleanup!(); // second call is a no-op, not an error
    expect(readdirSync(workDir)).toEqual([]);
  });

  it("a producer failure releases the job dir before the error surfaces (no temp leak on the path with no handle)", async () => {
    const producer = fakeProducer(async () => {
      throw new Error("chromium died");
    });
    const workDir = tempDir("leak");
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir,
    });

    await expect(target.render(pillarRequest())).rejects.toThrow(HyperframesRenderError);
    expect(readdirSync(workDir)).toEqual([]);
  });
});

describe("renderPillar × hyperframes target (the B3.10 seam end-to-end, keyless)", () => {
  async function approvedPillarDraft(): Promise<{ ctx: TenantCtx; repos: Repos; draft: Draft; store: LocalObjectStore }> {
    handle = await openTestDb();
    const { repos } = handle;
    const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);
    const store = new LocalObjectStore(tempDir("store"));
    const profile = await repos.brandProfiles.create(ctx, {
      config: {
        voice: {},
        denylist: [],
        platformProfiles: {},
        identity: { company: "Self", style: { accentColor: "#f2aa4c" } },
      },
      activate: true,
    });
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: "abc" });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["video"],
      promptVersion: "pillar-script-generate.v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:hf-run`,
    });
    const meta: PillarScriptDraftMeta = pillarScriptDraftMetaSchema.parse({
      title: "Docs that demo themselves",
      hook: "What if your docs wrote their own demo?",
      beats: [{ beatIndex: 0, narration: "Thalon reads your site and drafts the script." }],
      cta: "Try the demo tenant today.",
      groundingSourceIds: [source.id],
      promptVersion: "pillar-script-generate.v1",
      brandProfileVersion: profile.version,
      platformProfileVersion: "pillar.v1",
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "video",
      body: [meta.title, meta.hook, "Thalon reads your site and drafts the script.", meta.cta].join("\n\n"),
      format: "pillar_script",
      generationKey: `${ctx.tenantId}:hf-draft`,
      meta,
    });
    await repos.drafts.transition(ctx, draft.id, "judging");
    await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
    await repos.drafts.transition(ctx, draft.id, "queued");
    const approved = await repos.drafts.transition(ctx, draft.id, "approved");
    return { ctx, repos, draft: approved, store };
  }

  it("stores video.mp4 under the PINNED renders/pillar/<sha256>/ prefix — new artifact, unchanged key scheme", async () => {
    const { ctx, repos, draft, store } = await approvedPillarDraft();
    // Snapshot the project files AT RENDER TIME: renderPillar releases the
    // job dir after persisting, so the dir no longer exists by assert time.
    const written: Record<string, string> = {};
    const producer = fakeProducer(async (_job, projectDir, outputPath) => {
      written["index.html"] = await readFile(path.join(projectDir, "index.html"), "utf8");
      written["scene-0"] = await readFile(path.join(projectDir, "compositions", "scene-0.html"), "utf8");
      await writeFile(outputPath, "FAKE-MP4-BYTES");
    });
    const workDir = tempDir("e2e");
    const target = createHyperframesRenderTarget({
      producer: async () => producer.mod,
      linter: passLinter,
      workDir,
    });

    const result = await renderPillar(ctx, repos, draft.id, target, { objectStore: store });

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") throw new Error("unreachable");
    expect(result.renderRef).toMatch(/^renders\/pillar\/[0-9a-f]{64}\/manifest\.json$/);
    const prefix = result.renderRef.replace(/\/manifest\.json$/, "");
    expect((await store.get(`${prefix}/video.mp4`))!.toString("utf8")).toBe("FAKE-MP4-BYTES");
    const artifacts = JSON.parse((await store.get(`${prefix}/artifacts.json`))!.toString("utf8"));
    expect(artifacts).toEqual({ captions: "captions.srt", video: "video.mp4", target: "hyperframes" });

    // The composition the engine rendered came from EXACTLY the cached manifest bytes.
    const manifest = JSON.parse((await store.get(result.renderRef))!.toString("utf8")) as PillarRenderManifest;
    const project = renderCompositionProject(compositionSpecFromPillarManifest(manifest));
    expect(written["index.html"]).toBe(project.files["index.html"]);
    // Brand styling from the ACTIVE profile, as data — the accent reaches the scene layer.
    expect(written["scene-0"]).toContain("#f2aa4c");
    // And the work dir is released once the bytes are in the object store —
    // renders never accumulate temp dirs (B6.7 exit item).
    expect(readdirSync(workDir)).toEqual([]);

    const meta = pillarScriptDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.renderStatus).toBe("rendered");
    expect(meta.renderRef).toBe(result.renderRef);
  });

  it("a gate failure lands renderStatus failed with the loud lint message in the result (no cache entry, no video)", async () => {
    const { ctx, repos, draft, store } = await approvedPillarDraft();
    const failLinter: CompositionLinter = async () => ({
      ok: false,
      errorCount: 1,
      findings: [{ code: "contrast_low", severity: "error", message: "text unreadable on background" }],
    });
    const target = createHyperframesRenderTarget({
      producer: async () => fakeProducer().mod,
      linter: failLinter,
      workDir: tempDir("e2e-fail"),
    });

    const result = await renderPillar(ctx, repos, draft.id, target, { objectStore: store });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error).toMatch(/hyperframes.*lint gate.*contrast_low/);
    expect(await store.list("renders/")).toEqual([]);
    const meta = pillarScriptDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.renderStatus).toBe("failed");
    expect(meta.renderRef).toBeNull();
  });
});
