import type { VideoSourceRef } from "@thalon/contracts";

/**
 * B-ve.1 (ADR 0010): the compiled build plan an EDL deterministically
 * lowers to — caption plates (magick argv lists) + one ffmpeg invocation.
 * The plan is pure DATA: refs stay project-relative and plate files stay
 * plan-relative until `buildFfmpegArgs`/`platePath` resolve them, so the
 * golden tests can pin the whole plan as text with no machine paths in it.
 */

/** One caption plate: the magick argv lists that draw it (text → glow/backing → flatten). */
export interface PlateSpec {
  /** Plan-relative output file, e.g. "c1.png". */
  file: string;
  /**
   * argv lists (WITHOUT the magick binary itself). "_t.png" is the shared
   * scratch file, overwritten per plate — plates must be built in order.
   */
  commands: string[][];
}

/** One ffmpeg input, in exact recipe order (beat sources → plates → overlay stills → audio). */
export interface PlanInput {
  /** Project-relative media ref … */
  source?: VideoSourceRef;
  /** … or a generated plate file (plan-relative). */
  plate?: string;
  /** Loop a still: emitted as `-loop 1 -t <holdFor>` before `-i`. */
  holdFor?: string;
}

export interface EdlPlan {
  plates: PlateSpec[];
  inputs: PlanInput[];
  /** The -filter_complex graph ("" = none — a bare single-clip cut). */
  filter: string;
  /** -map values, video first (a filter label like "[vout]" or a stream spec like "19:a"). */
  maps: string[];
  /** Audio codec args (["-c:a","copy"] | ["-c:a","aac"] | []). */
  audioArgs: string[];
  /** Video codec args (-c:v/-crf/-preset/-pix_fmt). */
  videoArgs: string[];
  /** Output frame rate (-r); absent for copy output mode — frame-rate forcing and stream copy don't mix. */
  fps?: string;
  /** Output duration (-t). */
  duration: string;
}

/**
 * Lower a plan to the ffmpeg argv (without the binary), resolving each
 * project-relative ref via `resolve` and each plate via `plateDir`. The
 * caller owns path resolution — the plan itself never sees a filesystem.
 */
export function buildFfmpegArgs(
  plan: EdlPlan,
  resolve: (ref: VideoSourceRef) => string,
  plateDir: string,
  output: string,
): string[] {
  const args: string[] = ["-v", "error", "-y"];
  for (const input of plan.inputs) {
    if (input.holdFor !== undefined) args.push("-loop", "1", "-t", input.holdFor);
    if (input.plate !== undefined) args.push("-i", `${plateDir}/${input.plate}`);
    else if (input.source !== undefined) args.push("-i", resolve(input.source));
  }
  if (plan.filter !== "") args.push("-filter_complex", plan.filter);
  for (const map of plan.maps) args.push("-map", map);
  args.push(...plan.audioArgs, ...plan.videoArgs);
  if (plan.fps !== undefined) args.push("-r", plan.fps);
  args.push("-t", plan.duration, output);
  return args;
}
