import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { VideoSourceRef } from "@thalon/contracts";
import { readEnv } from "@thalon/platform";
import { buildFfmpegArgs, type EdlPlan } from "./plan";

const run = promisify(execFile);

/**
 * B-ve.3 (ADR 0010): execute a compiled EDL plan — the replay-test recipe
 * (film-replay.test.ts) productized as the engine's render door. Plates are
 * built IN ORDER inside `plateDir` (they share the `_t.png` scratch file),
 * then one ffmpeg invocation assembles the cut. Local + deterministic, zero
 * vendor credits by construction (the A17 invariant: no vendor-metered call
 * can be EXPRESSED on an edit path — this function only ever spawns the two
 * local binaries).
 */

export interface ExecutePlanOptions {
  /** Resolve a project-relative source ref to an absolute path — the caller owns the media root. */
  resolve: (ref: VideoSourceRef) => string;
  /** Absolute output file (`cuts/<name>-v<n>.mp4` under the media root by convention). */
  output: string;
  /** Scratch dir for caption plates + the shared `_t.png` — the caller creates and cleans it. */
  plateDir: string;
  /** Binary overrides; default resolution: THALON_FFMPEG/THALON_MAGICK → ~/.local/bin → bare PATH name. */
  ffmpeg?: string;
  magick?: string;
  /** Per-invocation bound; the film masters render in minutes (replay: ~7.5 min for both). */
  timeoutMs?: number;
}

/** Same resolution order the replay test uses (env via readEnv — the platform seam is the one sanctioned door to the process environment), falling through to PATH so non-record boxes still work. */
export function defaultBinary(name: "ffmpeg" | "magick" | "ffprobe"): string {
  const env = readEnv();
  const override =
    name === "ffmpeg"
      ? env.THALON_FFMPEG
      : name === "ffprobe"
        ? env.THALON_FFPROBE
        : env.THALON_MAGICK;
  if (override) return override;
  const local = join(homedir(), ".local", "bin", name);
  return existsSync(local) ? local : name;
}

/** stderr carried whole — the operator reads the actual ffmpeg/magick refusal, not a euphemism. */
export class EdlExecuteError extends Error {
  constructor(
    public readonly stage: "plate" | "ffmpeg",
    public readonly command: string,
    cause: unknown,
  ) {
    const stderr =
      cause && typeof cause === "object" && "stderr" in cause
        ? String((cause as { stderr: unknown }).stderr).trim()
        : "";
    super(
      `edl execute: ${stage} step failed (${command})${stderr ? `: ${stderr}` : ""}`,
      { cause },
    );
    this.name = "EdlExecuteError";
  }
}

export interface ExecutePlanResult {
  output: string;
  /** The exact ffmpeg argv run (attribution/debugging — a render is replayable by construction). */
  ffmpegArgs: string[];
  platesBuilt: number;
}

export async function executePlan(
  plan: EdlPlan,
  opts: ExecutePlanOptions,
): Promise<ExecutePlanResult> {
  const ffmpeg = opts.ffmpeg ?? defaultBinary("ffmpeg");
  const magick = opts.magick ?? defaultBinary("magick");
  const timeout = opts.timeoutMs ?? 1_800_000;

  for (const plate of plan.plates) {
    for (const command of plate.commands) {
      try {
        await run(magick, command, { cwd: opts.plateDir, timeout });
      } catch (err) {
        throw new EdlExecuteError("plate", `${magick} → ${plate.file}`, err);
      }
    }
  }

  const ffmpegArgs = buildFfmpegArgs(plan, opts.resolve, opts.plateDir, opts.output);
  try {
    await run(ffmpeg, ffmpegArgs, { timeout, maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    throw new EdlExecuteError("ffmpeg", ffmpeg, err);
  }

  return { output: opts.output, ffmpegArgs, platesBuilt: plan.plates.length };
}
