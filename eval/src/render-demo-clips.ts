import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  DIRECTION_MOTIONS,
  MEDIA_AUDIO_EXTS,
  brandProfileConfigSchema,
  pillarBeatSchema,
  type MediaAudioExt,
} from "@thalon/contracts";
import {
  COMPOSITION_TRANSITIONS,
  DEFAULT_TTS_VOICE,
  applyCueDirection,
  createHyperframesRenderTarget,
  createKokoroNarrationDriver,
  derivePillarTimeline,
  getRenderTarget,
  renderSrt,
  withNarrationCache,
  type CueDirectives,
  type NarrationArtifact,
  type NarrationDriver,
  type PillarRenderManifest,
  type PillarTimeline,
  type RenderAudioBed,
  type RenderAudioBundle,
  type RenderTarget,
} from "@thalon/engine";
import { loadEnvLocal } from "./env-local";
import { TENANT_ZERO, type DogfoodInput } from "./dogfood";

/**
 * B6.3 → composition v2 (wave 3.5): the landing page's feature-demo clips
 * are DATA (proprietary/profiles/demo-clips/*.json — hook/beats/cta, the
 * pillar timeline shape plus the v2 per-beat DIRECTION fields
 * motion/transition/sfx) rendered through the SAME pillar pipeline tenants
 * use. "This demo was rendered by Thalon" on the landing page is a literal
 * claim — this CLI is what makes it true. Brand styling flows from tenant
 * #0's tracked identity.style (self.v1.json), never from code.
 *
 * Narration (the audio tier's first consumer): Kokoro TTS through the
 * engine's NarrationDriver seam, ON by default because the stack is
 * keyless-local ($0) — `DEMO_NARRATION=off` opts out, and a missing local
 * runtime refuses loudly with its remedy. When narration is on, each
 * beat's duration comes from the MEASURED audio length (+ a breath pad) —
 * the research doc's "narration timestamps as the source of truth for beat
 * durations" — and the content-addressed cache makes the render pass free
 * after the timing pass. SFX accents resolve from an OPERATOR pack outside
 * the repo (`SFX_PACK_DIR`); a missing pack skips the accent honestly,
 * never fails the render. The music bed is an OPERATOR input and stays one:
 * `bed` points at a licensed track on the box, and nothing in-tree ever
 * supplies it (engaging-clips §6, founder-ratified) — `main()` never sets it.
 */

export const demoClipBeatSchema = pillarBeatSchema.extend({
  motion: z.enum(DIRECTION_MOTIONS).optional(),
  transition: z.enum(COMPOSITION_TRANSITIONS).optional(),
  /** Operator SFX-pack accent id (resolved from SFX_PACK_DIR at render time; packs never live in-tree). */
  sfx: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .optional(),
});

export const demoClipSpecSchema = z.object({
  /** The landing FeatureLoop key this clip backs — also the output basename (<feature>.mp4). */
  feature: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z.array(demoClipBeatSchema).min(1).max(8),
  cta: z.string().min(1),
  /** Kokoro voice id (see `hyperframes tts --list`); default af_heart. */
  voice: z
    .string()
    .regex(/^[a-z]{2}_[a-z]+$/)
    .optional(),
});
export type DemoClipSpec = z.infer<typeof demoClipSpecSchema>;

export const DEMO_CLIPS_DIR = fileURLToPath(
  new URL("../../proprietary/profiles/demo-clips", import.meta.url),
);
/** Gitignored delivery point for the lead's merge train (the FeatureLoop swap into apps/web is a LEAD commit, never this CLI's). */
export const DEFAULT_OUT_DIR = fileURLToPath(new URL("../../.context/renders", import.meta.url));
export const DEFAULT_TTS_CACHE_DIR = fileURLToPath(new URL("../../.context/tts-cache", import.meta.url));

/** Breath pad appended to each measured narration when audio drives the beat durations. */
export const NARRATION_PAD_MS = 250;

/** Local software-capture (screenshot fallback, no GPU) can run minutes per clip under load — a demo re-cut is a deliberate long job, so the ceiling is generous while still hang-protected. */
export const DEMO_RENDER_TIMEOUT_MS = 1_800_000;

export function loadDemoClipSpecs(dir: string = DEMO_CLIPS_DIR): { file: string; spec: DemoClipSpec }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      spec: demoClipSpecSchema.parse(JSON.parse(readFileSync(path.join(dir, file), "utf8"))),
    }));
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** The clip's narratable lines in cue order: hook, beats (array order IS beatIndex), cta. */
export function demoClipTexts(spec: DemoClipSpec): string[] {
  return [spec.hook, ...spec.beats.map((b) => b.narration), spec.cta].map(normalize);
}

function demoClipDirectives(spec: DemoClipSpec): CueDirectives {
  const beats: NonNullable<CueDirectives["beats"]> = {};
  spec.beats.forEach((beat, beatIndex) => {
    if (beat.motion || beat.transition || beat.sfx) {
      beats[beatIndex] = {
        ...(beat.motion ? { motion: beat.motion } : {}),
        ...(beat.transition ? { transition: beat.transition } : {}),
        ...(beat.sfx ? { sfx: beat.sfx } : {}),
      };
    }
  });
  return { beats };
}

/**
 * Narrated timeline: contiguous hook/beat/cta cues whose durations are the
 * MEASURED audio lengths + the breath pad — real speech replaces the
 * chars×60ms estimate for every cue, not just beats. Silent path: the
 * standard derivePillarTimeline (authored durationHintMs / derived).
 */
export function deriveNarratedTimeline(spec: DemoClipSpec, narrations: NarrationArtifact[]): PillarTimeline {
  const texts = demoClipTexts(spec);
  if (narrations.length !== texts.length) {
    throw new Error(`narrated timeline needs ${texts.length} narration artifacts, got ${narrations.length}`);
  }
  const cues: PillarTimeline["cues"] = [];
  let cursorMs = 0;
  texts.forEach((text, i) => {
    const kind = i === 0 ? "hook" : i === texts.length - 1 ? "cta" : "beat";
    const beat = kind === "beat" ? spec.beats[i - 1] : null;
    const durationMs = narrations[i].durationMs + NARRATION_PAD_MS;
    cues.push({
      kind,
      beatIndex: kind === "beat" ? i - 1 : null,
      text,
      onScreenText: beat?.onScreenText ?? null,
      visualHint: beat?.visualHint ?? null,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
  });
  return { cues, totalDurationMs: cursorMs };
}

/**
 * Pure mapping: clip spec (+ optional narrations) + tenant profile → render
 * manifest. beatIndex is array order (the same rule origination's core
 * applies to shell output); brand identity/voice ride in verbatim so
 * deriveBrandStyle picks up the profile's identity.style at composition
 * time and the company name becomes the watermark. The v2 direction fields
 * decorate the derived timeline through the one applyCueDirection door —
 * an undirected spec stays byte-identical to its B6.3 manifest.
 */
export function buildDemoClipManifest(
  spec: DemoClipSpec,
  input: DogfoodInput = TENANT_ZERO,
  narrations: NarrationArtifact[] | null = null,
): PillarRenderManifest {
  const config = brandProfileConfigSchema.parse(input.brandConfig);
  const timeline = narrations
    ? deriveNarratedTimeline(spec, narrations)
    : derivePillarTimeline({
        hook: spec.hook,
        // Explicit picks: the v2 direction fields decorate AFTER derivation,
        // never through it (the derive stays byte-stable for pinned paths).
        beats: spec.beats.map((beat, beatIndex) => ({
          narration: beat.narration,
          ...(beat.onScreenText !== undefined ? { onScreenText: beat.onScreenText } : {}),
          ...(beat.visualHint !== undefined ? { visualHint: beat.visualHint } : {}),
          ...(beat.durationHintMs !== undefined ? { durationHintMs: beat.durationHintMs } : {}),
          beatIndex,
        })),
        cta: spec.cta,
      });
  return {
    manifestVersion: "pillar-render.v1",
    // No DB in this path — the slug is the provenance marker, matching the
    // tenant the profile file names.
    tenantId: input.tenantSlug,
    title: spec.title,
    timeline: applyCueDirection(timeline, demoClipDirectives(spec)),
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
  /** Injected for tests; default = the env-selected registry (RENDER_DRIVER), or a narration-armed hyperframes target when narration is on. */
  target?: RenderTarget;
  specsDir?: string;
  outDir?: string;
  /** Narration driver; omitted/null = silent clips. main() resolves the CLI default (cached Kokoro unless DEMO_NARRATION=off); tests inject a fake driver. */
  narration?: NarrationDriver | null;
  /** Operator SFX pack dir (SFX_PACK_DIR); null/missing files skip accents honestly. */
  sfxPackDir?: string | null;
  /** The audio-v2.5 bed seam: operator-licensed track + volume. Never set by main() — nothing in-tree supplies music. */
  bed?: { file: string; volume: number } | null;
}

export interface DemoClipOutcome {
  feature: string;
  specFile: string;
  /** Final path under outDir, or null when the target produced no video (the fake target). */
  outPath: string | null;
  narrated: boolean;
  /** Word-timing provenance when narrated ("whisper" | "estimated"); null for silent clips. */
  alignment: string | null;
  /** Requested-but-unresolved SFX accent ids (no pack dir / missing file) — recorded, never fatal. */
  sfxSkipped: string[];
}

async function resolveSfx(
  manifest: PillarRenderManifest,
  packDir: string | null | undefined,
): Promise<{ buffers: Array<Buffer | null>; skipped: string[] }> {
  const buffers: Array<Buffer | null> = [];
  const skipped: string[] = [];
  for (const cue of manifest.timeline.cues) {
    if (!cue.sfx) {
      buffers.push(null);
      continue;
    }
    if (!packDir) {
      buffers.push(null);
      skipped.push(cue.sfx);
      continue;
    }
    try {
      buffers.push(await readFile(path.join(packDir, `${cue.sfx}.wav`)));
    } catch {
      buffers.push(null);
      skipped.push(cue.sfx);
    }
  }
  return { buffers, skipped };
}

/**
 * The operator's bed file → render-ready bytes. The CONTAINER IS THEIRS: the
 * target names the file from this extension and writes the bytes verbatim, so
 * a licensed master is never re-encoded to satisfy a naming rule (B-audio.1).
 * An extension the contract does not know refuses here, loudly, rather than
 * inside chromium.
 */
async function readOperatorBed(bed: { file: string; volume: number }): Promise<RenderAudioBed> {
  const ext = path.extname(bed.file).slice(1).toLowerCase();
  if (!(MEDIA_AUDIO_EXTS as readonly string[]).includes(ext)) {
    throw new Error(
      `music bed "${bed.file}" is not an audio container the contract knows (${MEDIA_AUDIO_EXTS.join(", ")})`,
    );
  }
  return { bytes: await readFile(bed.file), ext: ext as MediaAudioExt, volume: bed.volume };
}

export async function renderDemoClips(deps: RenderDemoClipsDeps = {}): Promise<DemoClipOutcome[]> {
  const outDir = deps.outDir ?? DEFAULT_OUT_DIR;
  const driver = deps.narration ?? null;
  const outcomes: DemoClipOutcome[] = [];

  for (const { file, spec } of loadDemoClipSpecs(deps.specsDir)) {
    const voice = spec.voice ?? DEFAULT_TTS_VOICE;
    let narrations: NarrationArtifact[] | null = null;
    if (driver) {
      narrations = [];
      for (const text of demoClipTexts(spec)) {
        narrations.push(await driver.synthesize({ text, voice }));
      }
    }
    const manifest = buildDemoClipManifest(spec, TENANT_ZERO, narrations);
    // The audio path (and with it sfx resolution) arms only when narration is on — silent clips send no audio at all.
    const sfx = narrations
      ? await resolveSfx(manifest, deps.sfxPackDir)
      : { buffers: [] as Array<Buffer | null>, skipped: [] as string[] };

    const audioBundle: RenderAudioBundle | null = narrations
      ? {
          narration: narrations.map((a) => ({ wav: a.wav, durationMs: a.durationMs, words: a.words })),
          sfx: sfx.buffers,
          bed: deps.bed ? await readOperatorBed(deps.bed) : null,
        }
      : null;

    const target =
      deps.target ??
      (audioBundle
        ? createHyperframesRenderTarget({ audio: async () => audioBundle, timeoutMs: DEMO_RENDER_TIMEOUT_MS })
        : getRenderTarget());

    const { videoPath } = await target.render({ manifest, srt: renderSrt(manifest.timeline) });
    const outcome: DemoClipOutcome = {
      feature: spec.feature,
      specFile: file,
      outPath: null,
      narrated: narrations !== null,
      alignment: narrations?.[0]?.alignment ?? null,
      sfxSkipped: sfx.skipped,
    };
    if (videoPath !== null) {
      mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${spec.feature}.mp4`);
      copyFileSync(videoPath, outPath);
      outcome.outPath = outPath;
    }
    outcomes.push(outcome);
  }
  return outcomes;
}

/** The CLI default: content-address-cached Kokoro ($0, keyless-local). DEMO_NARRATION=off → silent clips; a missing local runtime refuses loudly naming its remedy. */
function defaultNarrationDriver(): NarrationDriver | null {
  const mode = (process.env.DEMO_NARRATION ?? "kokoro").trim().toLowerCase();
  if (mode === "off") return null;
  if (mode !== "kokoro") {
    throw new Error(`unknown DEMO_NARRATION "${mode}" — "kokoro" (default) or "off"`);
  }
  return withNarrationCache(createKokoroNarrationDriver(), process.env.DEMO_TTS_CACHE ?? DEFAULT_TTS_CACHE_DIR);
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Optional argv: output directory (default .context/renders — gitignored; the lead train copies onward).
  const outDir = process.argv[2];
  const outcomes = await renderDemoClips({
    ...(outDir ? { outDir } : {}),
    narration: defaultNarrationDriver(),
    sfxPackDir: process.env.SFX_PACK_DIR ?? null,
  });
  for (const outcome of outcomes) {
    console.error(
      outcome.outPath
        ? `rendered ${outcome.specFile} -> ${outcome.outPath}${outcome.narrated ? ` (narrated, ${outcome.alignment} alignment)` : " (silent)"}${outcome.sfxSkipped.length > 0 ? ` [sfx skipped: ${outcome.sfxSkipped.join(", ")}]` : ""}`
        : `no video produced for ${outcome.specFile} (target renders no file - fake driver?)`,
    );
  }
  console.log(JSON.stringify(outcomes, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
