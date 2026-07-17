import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceDimensions, SourceDimsByRef } from "./derive";
import { defaultBinary } from "./execute";

const run = promisify(execFile);

/**
 * B-ve.5 (ADR 0010): measure source geometry with ffprobe — the derive
 * seed's dimensions are READ from the actual media, never assumed from a
 * convention ("measured, never estimated" as engine physics). Local +
 * deterministic, zero vendor credits by construction, same binary
 * resolution ladder as the render door (THALON_FFPROBE → ~/.local/bin →
 * PATH).
 */

export class SourceProbeError extends Error {
  constructor(
    public readonly ref: string,
    message: string,
  ) {
    super(`source probe: ${ref}: ${message}`);
    this.name = "SourceProbeError";
  }
}

export interface ProbeOptions {
  /** Resolve a project-relative ref to an absolute path — the caller owns the media root (and its containment wall). */
  resolve: (ref: string) => string;
  ffprobe?: string;
  timeoutMs?: number;
}

/** ffprobe's JSON for the first video stream. */
const isDims = (v: unknown): v is SourceDimensions =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as SourceDimensions).width === "number" &&
  (v as SourceDimensions).width > 0 &&
  typeof (v as SourceDimensions).height === "number" &&
  (v as SourceDimensions).height > 0;

export async function probeSourceDims(
  refs: string[],
  opts: ProbeOptions,
): Promise<SourceDimsByRef> {
  const ffprobe = opts.ffprobe ?? defaultBinary("ffprobe");
  const timeout = opts.timeoutMs ?? 60_000;
  const dims: SourceDimsByRef = {};
  for (const ref of [...new Set(refs)]) {
    const file = opts.resolve(ref);
    let stdout: string;
    try {
      ({ stdout } = await run(
        ffprobe,
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height",
          "-of",
          "json",
          file,
        ],
        { timeout },
      ));
    } catch (err) {
      const stderr =
        err && typeof err === "object" && "stderr" in err
          ? String((err as { stderr: unknown }).stderr).trim()
          : "";
      throw new SourceProbeError(ref, stderr || "ffprobe failed");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new SourceProbeError(ref, "ffprobe returned no JSON");
    }
    const stream = (parsed as { streams?: unknown[] }).streams?.[0];
    if (!isDims(stream)) {
      throw new SourceProbeError(ref, "no video stream with measurable dimensions");
    }
    dims[ref] = { width: stream.width, height: stream.height };
  }
  return dims;
}
