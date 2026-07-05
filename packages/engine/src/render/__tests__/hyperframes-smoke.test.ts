import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createHyperframesRenderTarget } from "../hyperframes-target";
import { derivePillarTimeline, renderSrt } from "../srt";
import type { PillarRenderManifest } from "../target";

/**
 * The OPTIONAL $0 local render smoke (CHARTER B5.1) — the real pipeline end
 * to end: deterministic composition → real @hyperframes/lint gate → real
 * @hyperframes/producer (headless chromium + ffmpeg) → MP4 on disk. Gated
 * OFF by default and NEVER set in CI (mirrors RUN_BROWSER_TESTS): run it as
 *
 *   RUN_RENDER_SMOKE=1 npx vitest run src/render/__tests__/hyperframes-smoke.test.ts
 *
 * from packages/engine on a machine where `npm run doctor` reports the
 * render seam live-ready. On Windows the engine falls back to screenshot
 * capture — correct output, not byte-identical across machines; harmless
 * because the render cache keys on the manifest hash (ADR-0004).
 */
const RUN_RENDER_SMOKE = process.env.RUN_RENDER_SMOKE === "1";

const workDirs: string[] = [];
afterAll(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!RUN_RENDER_SMOKE)("hyperframes real render smoke ($0, local-only, not CI)", () => {
  it(
    "renders the demo-tenant pillar composition to a playable MP4",
    { timeout: 300_000 },
    async () => {
      const timeline = derivePillarTimeline({
        hook: "What if your docs wrote their own demo?",
        beats: [
          { beatIndex: 0, narration: "Thalon reads your site and drafts the script." },
          { beatIndex: 1, narration: "You approve. It ships.", durationHintMs: 2_000, onScreenText: "Approve → ship" },
        ],
        cta: "Try the demo tenant today.",
      });
      const manifest: PillarRenderManifest = {
        manifestVersion: "pillar-render.v1",
        tenantId: "tenant-demo",
        title: "Docs that demo themselves",
        timeline,
        brand: { profileId: "profile-demo", profileVersion: 1, identity: { company: "Self" }, voice: {} },
        script: {
          promptVersion: "pillar-script-generate.v1",
          brandProfileVersion: 1,
          platformProfileVersion: "pillar.v1",
        },
      };
      const workDir = mkdtempSync(path.join(tmpdir(), "thalon-render-smoke-"));
      workDirs.push(workDir);

      // The REAL target: default producer loader + default @hyperframes/lint
      // belt — quality "draft" keeps the smoke light (stage-preview preset).
      const target = createHyperframesRenderTarget({ quality: "draft", workers: 1, workDir });
      const { videoPath } = await target.render({ manifest, srt: renderSrt(timeline) });

      expect(videoPath).not.toBeNull();
      expect(existsSync(videoPath!)).toBe(true);
      expect(statSync(videoPath!).size).toBeGreaterThan(10_000);
    },
  );
});
