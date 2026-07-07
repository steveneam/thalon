import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertCompositionProjectSafe,
  hyperframesLinter,
  runCompositionLintGate,
  type CompositionLinter,
} from "./composition-lint";
import {
  compositionSpecFromPillarManifest,
  type CaptionWord,
  type CompositionAudio,
  type CompositionSpec,
} from "./composition";
import { renderCompositionProject } from "./composition-project";
import type { PillarRenderArtifacts, PillarRenderRequest, PillarRenderManifest, RenderTarget } from "./target";

/**
 * B5.1 (amendment A11): the DEFAULT RenderTarget — Hyperframes, HeyGen's
 * Apache-2.0 HTML→video engine (headless chromium + ffmpeg, both already
 * toolchain), version-pinned pre-1.0 in packages/engine/package.json.
 * Decision record: docs/adr/0004-render-driver-default.md (Remotion is the
 * recorded swap path behind this same seam; the A6 growth gate retires).
 *
 * Pipeline, in order — the lint gates run BEFORE any chromium spend:
 *
 *   manifest → composition spec (+ optional audio bundle from the injected
 *   provider) → deterministic multi-file project (./composition-project.ts,
 *   scene-per-beat sub-compositions)
 *     → belt 1: assertCompositionProjectSafe (own forbidden-pattern scan
 *       per file + cross-file src/id checks, always)
 *     → belt 2: @hyperframes/lint static analysis per file (injectable seam)
 *     → @hyperframes/producer createRenderJob/executeRenderJob → MP4
 *
 * Read-only driver contract (B3.10): this target persists NOTHING — it
 * writes only a throwaway per-render work dir under the OS temp root
 * (composition + output MP4) and returns the video path; ../render.ts is
 * the sole writer of durable artifacts, and the render cache keys on the
 * MANIFEST hash, never output bytes — which is also why the Windows
 * screenshot-capture fallback (BeginFrame determinism is Linux/Docker) is
 * harmless here: local dev renders are correct, byte-identity across
 * machines is a production-artifact concern (Docker/Lambda, pass 3+).
 *
 * Failures are LOUD and typed (B4.5 conventions): every throw is a
 * HyperframesRenderError whose `reason` maps the producer's
 * RenderCancelledError taxonomy (user_cancelled | timeout | aborted) plus
 * "engine" for stage failures — the message carries the failed stage and
 * the engine's diagnostic detail so a failed draft's meta records a
 * triageable error, not a shrug.
 */

export const HYPERFRAMES_PRODUCER_PACKAGE = "@hyperframes/producer";
/** Whole-render ceiling; a hang inside chromium/ffmpeg must never wedge the artifact stage. */
export const DEFAULT_RENDER_TIMEOUT_MS = 600_000;

export type HyperframesFailureReason = "user_cancelled" | "timeout" | "aborted" | "engine";

export class HyperframesRenderError extends Error {
  readonly reason: HyperframesFailureReason;
  constructor(message: string, reason: HyperframesFailureReason) {
    super(message);
    this.name = "HyperframesRenderError";
    this.reason = reason;
  }
}

/** The structural slice of @hyperframes/producer's RenderJob this target reads (pinned against dist/index.d.ts at 0.7.33). */
export interface HyperframesRenderJob {
  id: string;
  status: string;
  error?: string;
  failedStage?: string;
  errorDetails?: { message: string };
}

/** The structural slice of the producer module this target calls. `executeRenderJob` returns void — outputs land at `outputPath` and on the mutated job. */
export interface HyperframesProducerModule {
  createRenderJob(config: {
    fps: number;
    quality: "draft" | "standard" | "high";
    format?: "mp4";
    workers?: number;
  }): HyperframesRenderJob;
  executeRenderJob(
    job: HyperframesRenderJob,
    projectDir: string,
    outputPath: string,
    onProgress?: (job: HyperframesRenderJob, message: string) => void,
    abortSignal?: AbortSignal,
  ): Promise<void>;
  RenderCancelledError: abstract new (
    ...args: never[]
  ) => Error & { reason: "user_cancelled" | "timeout" | "aborted" };
}

/** Non-literal specifier: the pinned package resolves only after the lead installs in MAIN; tests inject a fake module and never hit this path. */
function dynamicImport(specifier: string): Promise<unknown> {
  return import(specifier);
}

async function loadProducerModule(): Promise<HyperframesProducerModule> {
  try {
    return (await dynamicImport(HYPERFRAMES_PRODUCER_PACKAGE)) as HyperframesProducerModule;
  } catch (err) {
    throw new HyperframesRenderError(
      `${HYPERFRAMES_PRODUCER_PACKAGE} is not installed — the pinned dep is in packages/engine/package.json; run npm install from the MAIN checkout (never inside a worktree). Cause: ${err instanceof Error ? err.message : String(err)}`,
      "engine",
    );
  }
}

/** One cue's audio artifacts as the injected provider returns them — bytes plus timings; the target owns file naming and writing. */
export interface RenderAudioCue {
  wav: Buffer;
  durationMs: number;
  words: CaptionWord[];
}

/**
 * The audio-tier seam (composition v2): injected CONFIG on this target —
 * the `RenderTarget` interface and every manifest byte stay untouched.
 * Arrays align by cue index (null = silent cue). `bed` is the honest empty
 * seam for audio v2.5's operator-licensed music: the plumbing exists,
 * nothing in-tree ever supplies a file (engaging-clips §6, founder-ratified).
 */
export interface RenderAudioBundle {
  narration: Array<RenderAudioCue | null>;
  sfx?: Array<Buffer | null>;
  bed?: { wav: Buffer; volume: number } | null;
}

export type RenderAudioProvider = (manifest: PillarRenderManifest) => Promise<RenderAudioBundle | null>;

export interface HyperframesTargetDeps {
  /** Encode preset (pinned: draft CRF 28 · standard CRF 18 "visually lossless at 1080p" · high CRF 15). Default "standard". */
  quality?: "draft" | "standard" | "high";
  /** Capture worker count; omitted = the engine's own default. */
  workers?: number;
  timeoutMs?: number;
  /** Parent for the throwaway per-render work dir (default: the OS temp root). */
  workDir?: string;
  /** Injectable module loader (tests: a fake producer; the smoke: the real one). */
  producer?: () => Promise<HyperframesProducerModule>;
  /** Injectable belt-2 linter (default: @hyperframes/lint). */
  linter?: CompositionLinter;
  /** Optional audio bundle per manifest (narration/sfx/bed) — see RenderAudioBundle. */
  audio?: RenderAudioProvider;
}

interface AudioFilePlan {
  spec: CompositionAudio;
  files: Array<{ fileName: string; bytes: Buffer }>;
}

function planAudioFiles(bundle: RenderAudioBundle, spec: CompositionSpec): AudioFilePlan {
  if (bundle.narration.length !== spec.cues.length) {
    throw new HyperframesRenderError(
      `audio bundle carries ${bundle.narration.length} narration entries for ${spec.cues.length} cues — tracks align by cue index`,
      "engine",
    );
  }
  const sfx = bundle.sfx ?? spec.cues.map(() => null);
  if (sfx.length !== spec.cues.length) {
    throw new HyperframesRenderError(
      `audio bundle carries ${sfx.length} sfx entries for ${spec.cues.length} cues — tracks align by cue index`,
      "engine",
    );
  }
  const files: Array<{ fileName: string; bytes: Buffer }> = [];
  const audio: CompositionAudio = {
    narration: bundle.narration.map((cue, i) => {
      if (!cue) return null;
      const fileName = `audio/cue-${i}.wav`;
      files.push({ fileName, bytes: cue.wav });
      return { fileName, durationMs: cue.durationMs, words: cue.words };
    }),
    sfx: sfx.map((bytes, i) => {
      if (!bytes) return null;
      const fileName = `audio/sfx-${i}.wav`;
      files.push({ fileName, bytes });
      return { fileName };
    }),
    bed: (() => {
      if (!bundle.bed) return null;
      const fileName = "audio/bed.wav";
      files.push({ fileName, bytes: bundle.bed.wav });
      return { fileName, volume: bundle.bed.volume };
    })(),
  };
  return { spec: audio, files };
}

export function createHyperframesRenderTarget(deps: HyperframesTargetDeps = {}): RenderTarget {
  return {
    name: "hyperframes",
    async render(request: PillarRenderRequest): Promise<PillarRenderArtifacts> {
      let spec = compositionSpecFromPillarManifest(request.manifest);
      const bundle = deps.audio ? await deps.audio(request.manifest) : null;
      const audioPlan = bundle ? planAudioFiles(bundle, spec) : null;
      if (audioPlan) spec = { ...spec, audio: audioPlan.spec };

      const { files } = renderCompositionProject(spec);

      // The gates, in order, BEFORE any chromium/render spend.
      assertCompositionProjectSafe(files);
      const linter = deps.linter ?? hyperframesLinter();
      for (const html of Object.values(files)) {
        await runCompositionLintGate(html, linter);
      }

      const producer = await (deps.producer ?? loadProducerModule)();
      const jobDir = await mkdtemp(path.join(deps.workDir ?? tmpdir(), "thalon-hyperframes-"));
      for (const [name, html] of Object.entries(files)) {
        const filePath = path.join(jobDir, name);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, html, "utf8");
      }
      for (const { fileName, bytes } of audioPlan?.files ?? []) {
        const filePath = path.join(jobDir, fileName);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, bytes);
      }
      const outputPath = path.join(jobDir, "video.mp4");

      const job = producer.createRenderJob({
        fps: spec.fps,
        quality: deps.quality ?? "standard",
        format: "mp4",
        ...(deps.workers === undefined ? {} : { workers: deps.workers }),
      });

      try {
        await producer.executeRenderJob(
          job,
          jobDir,
          outputPath,
          undefined,
          AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS),
        );
      } catch (err) {
        if (err instanceof producer.RenderCancelledError) {
          throw new HyperframesRenderError(
            `hyperframes render cancelled (${err.reason}) for composition "${spec.title}": ${err.message}`,
            err.reason,
          );
        }
        const detail = [
          job.failedStage ? `stage "${job.failedStage}"` : null,
          job.errorDetails?.message ?? job.error ?? (err instanceof Error ? err.message : String(err)),
        ]
          .filter(Boolean)
          .join(": ");
        throw new HyperframesRenderError(`hyperframes render failed at ${detail}`, "engine");
      }

      return { videoPath: outputPath };
    },
  };
}
