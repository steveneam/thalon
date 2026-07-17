import { edlSchema, type Edl, type EdlClip } from "@thalon/contracts";

/**
 * B-ve.5 (ADR 0010): derive an aspect variant EDL from a parent cut — the
 * own-engine recut invariant (never vendor reframe) as a pure transform.
 * The derived EDL keeps the parent's timeline verbatim (clip order, in
 * points, durations, transitions, grades, music lane, caption text and
 * timing) and swaps ONLY the framing: output canvas, a seeded per-clip crop
 * window, and proportionally re-seeded caption centers.
 *
 * The seed is honest, not clever: every clip gets the LARGEST CENTERED
 * window of its measured source at the target aspect — a deterministic
 * starting frame, never an estimated pan (pan targets are measured by the
 * operator on real frames, s45 lesson; the editor's crop handles are the
 * measuring tool). Caption centers map proportionally and are expected to
 * be re-placed per beat (the 9:16 master moved b2 to mid-frame).
 */

export interface SourceDimensions {
  width: number;
  height: number;
}

/** Measured dimensions per project-relative source ref — probed, never assumed. */
export type SourceDimsByRef = Record<string, SourceDimensions>;

export class DeriveEdlError extends Error {
  constructor(message: string) {
    super(`derive edl: ${message}`);
    this.name = "DeriveEdlError";
  }
}

/** Largest centered window of `source` at `target`'s aspect, even-sized (yuv420p-safe). */
export function centeredCropFor(
  source: SourceDimensions,
  target: { width: number; height: number },
): { width: number; height: number; x: number; y: number } {
  if (source.width <= 0 || source.height <= 0) {
    throw new DeriveEdlError(`source dimensions must be positive (got ${source.width}x${source.height})`);
  }
  const targetRatio = target.width / target.height;
  let width: number;
  let height: number;
  if (source.width / source.height > targetRatio) {
    // Source is wider than the target: full height, windowed width.
    height = source.height;
    width = Math.min(source.width, Math.round(source.height * targetRatio));
  } else {
    // Source is taller (or equal): full width, windowed height.
    width = source.width;
    height = Math.min(source.height, Math.round(source.width / targetRatio));
  }
  // Even dimensions: crop feeds an x264 yuv420p pipeline.
  width -= width % 2;
  height -= height % 2;
  return {
    width,
    height,
    x: Math.round((source.width - width) / 2),
    y: Math.round((source.height - height) / 2),
  };
}

export interface DeriveEdlOptions {
  /** The derived EDL's name (also the derived cut's name by convention). */
  name: string;
  /** Target canvas (e.g. 1080x1920 for 9:16, 1080x1080 for 1:1). */
  canvas: { width: number; height: number };
  /** Measured dimensions for EVERY source ref on the parent's beat lane. */
  dims: SourceDimsByRef;
}

export function deriveEdl(parent: Edl, opts: DeriveEdlOptions): Edl {
  if (parent.output.video.mode === "copy") {
    throw new DeriveEdlError(
      "a copy-mode cut has no per-beat picture to recompose — derive from its base timeline instead",
    );
  }
  const { canvas, dims } = opts;

  const video: EdlClip[] = parent.video.map((clip) => {
    const source = dims[clip.source.ref];
    if (!source) {
      throw new DeriveEdlError(
        `no measured dimensions for source "${clip.source.ref}" — probe the project media first (measured, never estimated)`,
      );
    }
    return {
      ...clip,
      crop: centeredCropFor(source, canvas),
      scale: {
        width: canvas.width,
        height: canvas.height,
        flags: clip.scale?.flags ?? "lanczos",
      },
    };
  });

  const captions = parent.captions
    ? {
        style: parent.captions.style,
        lines: parent.captions.lines.map((line) => ({
          ...line,
          x: Math.round((line.x * canvas.width) / parent.output.width),
          y: Math.round((line.y * canvas.height) / parent.output.height),
        })),
      }
    : undefined;

  // Parse the result through the contract door — a derived EDL is a first-
  // class EDL, and a transform bug should refuse here, not at render time.
  return edlSchema.parse({
    ...parent,
    name: opts.name,
    output: { ...parent.output, width: canvas.width, height: canvas.height },
    video,
    ...(captions ? { captions } : {}),
  });
}
