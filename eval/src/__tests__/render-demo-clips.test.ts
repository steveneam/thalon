import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFakeRenderTarget } from "@thalon/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDemoClipManifest,
  DEMO_CLIPS_DIR,
  demoClipSpecSchema,
  loadDemoClipSpecs,
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
