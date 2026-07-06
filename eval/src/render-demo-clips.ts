import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { brandProfileConfigSchema, pillarBeatSchema } from "@thalon/contracts";
import {
  derivePillarTimeline,
  getRenderTarget,
  renderSrt,
  type PillarRenderManifest,
  type RenderTarget,
} from "@thalon/engine";
import { loadEnvLocal } from "./env-local";
import { TENANT_ZERO, type DogfoodInput } from "./dogfood";

/**
 * B6.3: the landing page's feature-demo clips are DATA
 * (proprietary/profiles/demo-clips/*.json — hook/beats/cta, exactly the
 * pillar timeline shape) rendered through the SAME pillar pipeline tenants
 * use: derivePillarTimeline → PillarRenderManifest → the env-selected
 * RenderTarget registry (default hyperframes). "This demo was rendered by
 * Thalon" on the landing page is a literal claim — this CLI is what makes
 * it true. Brand styling flows from tenant #0's tracked identity.style
 * (self.v1.json), never from code.
 */
export const demoClipSpecSchema = z.object({
  /** The landing FeatureLoop key this clip backs — also the output basename (<feature>.mp4). */
  feature: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z.array(pillarBeatSchema).min(1).max(8),
  cta: z.string().min(1),
});
export type DemoClipSpec = z.infer<typeof demoClipSpecSchema>;

export const DEMO_CLIPS_DIR = fileURLToPath(
  new URL("../../proprietary/profiles/demo-clips", import.meta.url),
);
/** Where the landing page serves the clips from (apps/web/public — B6.3 phase 2 commits the rendered files). */
export const DEFAULT_OUT_DIR = fileURLToPath(new URL("../../apps/web/public/demos", import.meta.url));

export function loadDemoClipSpecs(dir: string = DEMO_CLIPS_DIR): { file: string; spec: DemoClipSpec }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      spec: demoClipSpecSchema.parse(JSON.parse(readFileSync(path.join(dir, file), "utf8"))),
    }));
}

/**
 * Pure mapping: clip spec + tenant profile → render manifest. beatIndex is
 * array order (the same rule origination's core applies to shell output);
 * brand identity/voice ride in verbatim so deriveBrandStyle picks up the
 * profile's identity.style at composition time and the company name becomes
 * the watermark.
 */
export function buildDemoClipManifest(
  spec: DemoClipSpec,
  input: DogfoodInput = TENANT_ZERO,
): PillarRenderManifest {
  const config = brandProfileConfigSchema.parse(input.brandConfig);
  const timeline = derivePillarTimeline({
    hook: spec.hook,
    beats: spec.beats.map((beat, beatIndex) => ({ ...beat, beatIndex })),
    cta: spec.cta,
  });
  return {
    manifestVersion: "pillar-render.v1",
    // No DB in this path — the slug is the provenance marker, matching the
    // tenant the profile file names.
    tenantId: input.tenantSlug,
    title: spec.title,
    timeline,
    brand: {
      profileId: "self.v1",
      profileVersion: 1,
      identity: config.identity,
      voice: config.voice,
    },
    script: {
      promptVersion: "demo-clip.v1",
      brandProfileVersion: 1,
      platformProfileVersion: "demo-clip.v1",
    },
  };
}

export interface RenderDemoClipsDeps {
  /** Injected for tests; default = the env-selected registry (RENDER_DRIVER, hyperframes default). */
  target?: RenderTarget;
  specsDir?: string;
  outDir?: string;
}

export interface DemoClipOutcome {
  feature: string;
  specFile: string;
  /** Final path under outDir, or null when the target produced no video (the fake target). */
  outPath: string | null;
}

export async function renderDemoClips(deps: RenderDemoClipsDeps = {}): Promise<DemoClipOutcome[]> {
  const target = deps.target ?? getRenderTarget();
  const outDir = deps.outDir ?? DEFAULT_OUT_DIR;
  const outcomes: DemoClipOutcome[] = [];
  for (const { file, spec } of loadDemoClipSpecs(deps.specsDir)) {
    const manifest = buildDemoClipManifest(spec);
    const { videoPath } = await target.render({ manifest, srt: renderSrt(manifest.timeline) });
    if (videoPath === null) {
      outcomes.push({ feature: spec.feature, specFile: file, outPath: null });
      continue;
    }
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${spec.feature}.mp4`);
    copyFileSync(videoPath, outPath);
    outcomes.push({ feature: spec.feature, specFile: file, outPath });
  }
  return outcomes;
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Optional argv: output directory (default apps/web/public/demos).
  const outDir = process.argv[2];
  const outcomes = await renderDemoClips(outDir ? { outDir } : {});
  for (const outcome of outcomes) {
    console.error(
      outcome.outPath
        ? `rendered ${outcome.specFile} -> ${outcome.outPath}`
        : `no video produced for ${outcome.specFile} (target renders no file - fake driver?)`,
    );
  }
  console.log(JSON.stringify(outcomes, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
