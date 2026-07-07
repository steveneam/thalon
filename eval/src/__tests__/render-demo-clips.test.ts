import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFakeNarrationDriver, createFakeRenderTarget, type NarrationArtifact } from "@thalon/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDemoClipManifest,
  DEMO_CLIPS_DIR,
  demoClipSpecSchema,
  demoClipTexts,
  deriveNarratedTimeline,
  loadDemoClipSpecs,
  NARRATION_PAD_MS,
  renderDemoClips,
} from "../render-demo-clips";

let tmp: string | undefined;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("demo clips as data (B6.3)", () => {
  it("every shipped demo-clip spec validates, and the three landing features are covered", () => {
    // The landing FeatureLoop seam keys on exactly these three features
    // (apps/web/src/lib/landing/copy.ts) — a missing or misnamed spec would
    // leave a popout with no clip to swap in at phase 2.
    const specs = loadDemoClipSpecs();
    const features = specs.map(({ spec }) => spec.feature);
    expect(new Set(features).size).toBe(features.length);
    expect(features).toEqual(expect.arrayContaining(["create", "everywhere", "intel"]));
    for (const { file, spec } of specs) {
      expect(() => demoClipSpecSchema.parse(spec), file).not.toThrow();
    }
  });

  it("builds a deterministic manifest wearing tenant #0's tracked brand style", () => {
    const [{ spec }] = loadDemoClipSpecs();
    const first = buildDemoClipManifest(spec);
    const second = buildDemoClipManifest(spec);
    // Same spec in, same bytes out — the render cache keys on these bytes.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.manifestVersion).toBe("pillar-render.v1");
    expect(first.tenantId).toBe("self");
    // Brand styling is DATA from self.v1.json (identity.style), the B5.1
    // composition seam — deriveBrandStyle reads exactly this at render time.
    const style = first.brand.identity.style as Record<string, string>;
    expect(style.accentColor).toMatch(/^#[0-9a-f]{6}$/);
    // Timeline is contiguous from 0: cue N's end IS cue N+1's start.
    let cursor = 0;
    for (const cue of first.timeline.cues) {
      expect(cue.startMs).toBe(cursor);
      cursor = cue.endMs;
    }
    expect(first.timeline.totalDurationMs).toBe(cursor);
  });

  it("renders every spec through the injected target and reports null outPath when no video is produced", async () => {
    const target = createFakeRenderTarget();
    const outcomes = await renderDemoClips({ target });
    expect(outcomes).toHaveLength(readdirSync(DEMO_CLIPS_DIR).filter((f) => f.endsWith(".json")).length);
    expect(target.requests).toHaveLength(outcomes.length);
    for (const outcome of outcomes) {
      expect(outcome.outPath).toBeNull();
    }
    // Each request carried the SRT derived from its own timeline (the caption
    // track is born from the judged/authored lines, never ASR'd).
    for (const request of target.requests) {
      expect(request.srt.startsWith("1\n00:00:00,000 --> ")).toBe(true);
    }
  });

  it("copies the produced video to <outDir>/<feature>.mp4", async () => {
    tmp = mkdtempSync(path.join(tmpdir(), "thalon-demo-clips-"));
    const fakeVideo = path.join(tmp, "render-output.mp4");
    writeFileSync(fakeVideo, "not-really-an-mp4");
    const outDir = path.join(tmp, "out");
    const outcomes = await renderDemoClips({
      target: { name: "stub", render: async () => ({ videoPath: fakeVideo }) },
      outDir,
    });
    for (const outcome of outcomes) {
      expect(outcome.outPath).toBe(path.join(outDir, `${outcome.feature}.mp4`));
      expect(readFileSync(outcome.outPath!, "utf8")).toBe("not-really-an-mp4");
    }
  });
});

describe("composition v2 direction fields (wave 3.5)", () => {
  it("the shipped specs carry per-beat motion/transition and the manifest cues wear them (data over defaults)", () => {
    const specs = loadDemoClipSpecs();
    for (const { file, spec } of specs) {
      const manifest = buildDemoClipManifest(spec);
      spec.beats.forEach((beat, beatIndex) => {
        const cue = manifest.timeline.cues.find((c) => c.kind === "beat" && c.beatIndex === beatIndex)!;
        expect(cue.motion, `${file} beat ${beatIndex}`).toBe(beat.motion);
        expect(cue.transition, `${file} beat ${beatIndex}`).toBe(beat.transition);
        expect(cue.sfx, `${file} beat ${beatIndex}`).toBe(beat.sfx);
      });
      // Hook/CTA stay undecorated (deterministic defaults fill at composition time).
      expect(manifest.timeline.cues[0].motion).toBeUndefined();
    }
  });

  it("an undirected spec builds a manifest byte-identical to the pre-v2 shape (pinned-hash safety)", () => {
    const spec = demoClipSpecSchema.parse({
      feature: "plain",
      title: "Plain",
      hook: "A hook.",
      beats: [{ narration: "A beat.", durationHintMs: 2000 }],
      cta: "A cta.",
    });
    const manifest = buildDemoClipManifest(spec);
    for (const cue of manifest.timeline.cues) {
      expect("motion" in cue).toBe(false);
      expect("transition" in cue).toBe(false);
      expect("sfx" in cue).toBe(false);
    }
  });

  it("rejects out-of-enum direction values", () => {
    expect(() =>
      demoClipSpecSchema.parse({
        feature: "bad",
        title: "Bad",
        hook: "h",
        beats: [{ narration: "n", transition: "star-wipe" }],
        cta: "c",
      }),
    ).toThrow();
  });
});

describe("narrated demo clips (the audio tier's first consumer)", () => {
  it("deriveNarratedTimeline: measured audio + breath pad drives EVERY cue duration, hook and cta included", async () => {
    const [{ spec }] = loadDemoClipSpecs();
    const driver = createFakeNarrationDriver({ msPerChar: 40 });
    const narrations: NarrationArtifact[] = [];
    for (const text of demoClipTexts(spec)) narrations.push(await driver.synthesize({ text, voice: "af_heart" }));
    const timeline = deriveNarratedTimeline(spec, narrations);
    expect(timeline.cues).toHaveLength(narrations.length);
    let cursor = 0;
    timeline.cues.forEach((cue, i) => {
      expect(cue.startMs).toBe(cursor);
      expect(cue.endMs - cue.startMs).toBe(narrations[i].durationMs + NARRATION_PAD_MS);
      cursor = cue.endMs;
    });
    expect(timeline.cues[0].kind).toBe("hook");
    expect(timeline.cues[timeline.cues.length - 1].kind).toBe("cta");
    expect(timeline.totalDurationMs).toBe(cursor);
    // Mismatched artifact count is loud, never a silent misalignment.
    expect(() => deriveNarratedTimeline(spec, narrations.slice(1))).toThrow(/narration artifacts/);
  });

  it("renderDemoClips with a narration driver reports narrated outcomes and honest sfx skips (no pack dir)", async () => {
    const target = createFakeRenderTarget();
    const outcomes = await renderDemoClips({ target, narration: createFakeNarrationDriver() });
    for (const outcome of outcomes) {
      expect(outcome.narrated).toBe(true);
      expect(outcome.alignment).toBe("estimated");
    }
    // The shipped specs request sfx accents; without SFX_PACK_DIR they skip by name.
    const skipped = outcomes.flatMap((o) => o.sfxSkipped);
    expect(skipped).toEqual(expect.arrayContaining(["whoosh", "pop"]));
    // Silent path stays silent and says so.
    const silent = await renderDemoClips({ target: createFakeRenderTarget() });
    for (const outcome of silent) {
      expect(outcome.narrated).toBe(false);
      expect(outcome.alignment).toBeNull();
      expect(outcome.sfxSkipped).toEqual([]);
    }
  });

  it("resolves sfx accents from an operator pack dir when the files exist", async () => {
    tmp = mkdtempSync(path.join(tmpdir(), "thalon-sfx-"));
    writeFileSync(path.join(tmp, "whoosh.wav"), "WHOOSH");
    writeFileSync(path.join(tmp, "pop.wav"), "POP");
    const target = createFakeRenderTarget();
    const outcomes = await renderDemoClips({
      target,
      narration: createFakeNarrationDriver(),
      sfxPackDir: tmp,
    });
    expect(outcomes.flatMap((o) => o.sfxSkipped)).toEqual([]);
  });
});
