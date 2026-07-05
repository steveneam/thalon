import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertCompositionSafe,
  hyperframesLinter,
  runCompositionLintGate,
  type CompositionLinter,
} from "./composition-lint";
import { compositionSpecFromPillarManifest, renderCompositionHtml } from "./composition";
import type { PillarRenderArtifacts, PillarRenderRequest, RenderTarget } from "./target";

/**
 * B5.1 (amendment A11): the DEFAULT RenderTarget — Hyperframes, HeyGen's
 * Apache-2.0 HTML→video engine (headless chromium + ffmpeg, both already
 * toolchain), version-pinned pre-1.0 in packages/engine/package.json.
 * Decision record: docs/adr/0004-render-driver-default.md (Remotion is the
 * recorded swap path behind this same seam; the A6 growth gate retires).
 *
 * Pipeline, in order — the lint gates run BEFORE any chromium spend:
 *
 *   manifest → composition spec → deterministic HTML (./composition.ts)
 *     → belt 1: assertCompositionSafe (own forbidden-pattern scan, always)
 *     → belt 2: @hyperframes/lint static analysis (injectable seam)
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
}

export function createHyperframesRenderTarget(deps: HyperframesTargetDeps = {}): RenderTarget {
  return {
    name: "hyperframes",
    async render(request: PillarRenderRequest): Promise<PillarRenderArtifacts> {
      const spec = compositionSpecFromPillarManifest(request.manifest);
      const html = renderCompositionHtml(spec);

      // The gates, in order, BEFORE any chromium/render spend.
      assertCompositionSafe(html);
      await runCompositionLintGate(html, deps.linter ?? hyperframesLinter());

      const producer = await (deps.producer ?? loadProducerModule)();
      const jobDir = await mkdtemp(path.join(deps.workDir ?? tmpdir(), "thalon-hyperframes-"));
      await writeFile(path.join(jobDir, "index.html"), html, "utf8");
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
