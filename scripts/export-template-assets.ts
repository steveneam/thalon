/**
 * export-template-assets.ts — regenerate a template site's derived images.
 *
 * Template twin of export-brand-assets.ts: reads the site's
 * assets/manifest.json, pulls each pinned original from the object store
 * (content-address verified — a corrupted store fails loud, per B4.6),
 * resizes/re-encodes to the manifest's exact size and quality with sharp,
 * and writes `proprietary/templates/sites/<slug>/assets/<file>`.
 * Deterministic from manifest + store; never hand-edit the outputs.
 *
 * Usage (from repo root): npx tsx scripts/export-template-assets.ts <slug>
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { getObjectStore } from "@thalon/platform";
import {
  evenlySpacedIndices,
  frameFileNames,
  pinnedAssetKey,
  readPinnedAsset,
} from "@thalon/engine";

interface ManifestEntry {
  file: string;
  pinnedHash: string;
  width: number;
  height: number;
  quality: number;
  /** Extension of the PINNED ORIGINAL in the object store. Defaults to "png".
   *  A video original ("mp4") is never emitted as-is — it must carry `frames`,
   *  because the page scrubs a frame sequence, never the mp4 itself. */
  ext?: string;
  /** Frame-sequence derive: extract exactly this many evenly-spaced stills
   *  from a pinned video and encode each to webp. `file` is then a printf
   *  pattern carrying one `%0Nd` (e.g. "season-1-%03d.webp"), and the entry
   *  stands for all N files at once.
   *
   *  Why frames and not the mp4: scrubbing an h264 file by setting
   *  `video.currentTime` seeks to keyframes and janks. A frame sequence
   *  decodes without seek cost and scrubs deterministically (s105 finding).
   *  The mp4 stays the pinned original; the frames are the derive. */
  frames?: number;
  /** Single-still derive from a pinned VIDEO: emit `file` as this one
   *  zero-based source frame instead of a sequence. The s110 finding made
   *  structural — Seedance does not start on the still it was handed (its
   *  first frame sat MAD 7.36 off the anchor keyframe), so a page's hero
   *  still is not the keyframe that directed the take, it is frame 0 OF the
   *  take. Saying that in the manifest keeps the two impossible to confuse,
   *  and lets the hero ship at hero resolution while the scrubbed sequence
   *  ships at sequence resolution. */
  frame?: number;
  /** Luminance→alpha conversion: white areas of the pinned matte become
   *  opaque, black transparent. For CSS mask-image assets — Safari's
   *  -webkit-mask reads alpha only, never luminance. */
  alpha?: boolean;
  /** Cover-crop anchor when the target aspect differs from the original
   *  (sharp position string: "top" | "bottom" | "left" | "right" | …).
   *  Defaults to centre. Lets a derive keep a chosen band of the pinned
   *  original — still fully deterministic from manifest + store. */
  position?: string;
  /** Per-frame grade flatten (Morningside/site E, s111). Levels every frame
   *  of the sequence onto ONE reference exposure by measuring a genuinely
   *  static patch of the frame and applying the per-channel offset that puts
   *  that patch on `target`. Native-resolution coordinates — it runs before
   *  the resize, in the space the patch was measured in.
   *
   *  Why the page needs it: s110 measured a two-segment chain and found that
   *  end-frame-to-start-frame chaining buys exact GEOMETRY (offset dx=0,
   *  dy=0) but not exact GRADE — segment 2 came back ~5 RGB units darker. It
   *  recorded the fix as a mean/std match onto the seam frame. Measured per
   *  frame at s111, that fix is aimed at an accident of the one pair it was
   *  derived from: the tonal shift is NOT a constant re-grade, it is a
   *  settling TRANSIENT at the head of every take. On a static patch S2 opens
   *  5 units dark, recovers by native frame ~16 and then sits on a stable
   *  plateau; S1 does the same over ~86 frames. A constant match onto the
   *  seam frame therefore fixes the seam and over-brightens everything after
   *  it — measured, it drifts S2's LAST frame (the payoff shot) +5.8/+3.1/+3.4
   *  off the reference grade. Flattening per frame instead holds it to
   *  -0.2/+0.1/+0.4, fixes the seam identically (6.93 -> 4.41), and removes
   *  S1's own warm-up ramp — which matters because the hero still IS that
   *  take's frame 0, and uncorrected it is the darkest frame of its own take.
   *
   *  Deterministic from (pinned bytes, patch, target): the target is a
   *  measured constant written down here, exactly like width/height. */
  gradeFlatten?: {
    /** Static measurement window in the ORIGINAL's pixels: [left, top, w, h]. */
    patch: [number, number, number, number];
    /** The reference grade that patch is levelled onto: [r, g, b]. */
    target: [number, number, number];
  };
}

/**
 * Levels one decoded frame onto `target` by measuring `patch` and applying the
 * per-channel offset that moves the patch's mean there. An additive offset,
 * not a mean/std match: the measurement showed the standard deviations already
 * agree to within 0.2 across both takes (45.8/39.9/35.2 vs 45.8/39.7/35.3), so
 * the difference is pure exposure and a gain term would only invent contrast
 * change where there is none.
 */
async function flattenGrade(
  png: string,
  { patch, target }: NonNullable<ManifestEntry["gradeFlatten"]>,
): Promise<sharp.Sharp> {
  const [left, top, width, height] = patch;
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { channels, width: w } = info;
  const mean = [0, 0, 0];
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const i = (y * w + x) * channels;
      for (let c = 0; c < 3; c++) mean[c] += data[i + c];
    }
  }
  const n = width * height;
  const offset = target.map((t, c) => t - mean[c] / n);
  for (let i = 0; i < data.length; i += channels) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255, Math.round(data[i + c] + offset[c])));
    }
  }
  return sharp(data, { raw: { width: w, height: info.height, channels } });
}

/**
 * Emits a frame sequence from a pinned video: every source frame is decoded
 * once, `entry.frames` of them are sampled evenly (endpoints always kept),
 * and each is resized and encoded to webp under the entry's name pattern.
 *
 * Decoding the whole clip and then sampling — rather than asking ffmpeg for
 * an fps — keeps the output a pure function of (pinned bytes, frames, size,
 * quality), which is what makes the derive reproducible from manifest + store.
 */
async function emitFrames(assetsDir: string, entry: ManifestEntry, video: Buffer): Promise<string[]> {
  const names = frameFileNames(entry.file, entry.frames!);
  await withDecodedFrames(video, async (decoded) => {
    const picked = evenlySpacedIndices(decoded.length, entry.frames!);
    for (const [i, index] of picked.entries()) {
      writeFileSync(path.join(assetsDir, names[i]), await encodeFrame(decoded[index], entry));
    }
  });
  return names;
}

/** Emits ONE named source frame of a pinned video as a still (see `frame`). */
async function emitStillFromVideo(
  assetsDir: string,
  entry: ManifestEntry,
  video: Buffer,
): Promise<string> {
  const file = path.join(assetsDir, entry.file);
  await withDecodedFrames(video, async (decoded) => {
    if (entry.frame! < 0 || entry.frame! >= decoded.length) {
      throw new Error(
        `"${entry.file}" asks for frame ${entry.frame} but the pinned take has ${decoded.length}`,
      );
    }
    writeFileSync(file, await encodeFrame(decoded[entry.frame!], entry));
  });
  return file;
}

/** Decodes every frame of a pinned clip to PNG in a temp dir, hands the sorted
 *  paths to `use`, and cleans up. Decoding the whole clip and then sampling —
 *  rather than asking ffmpeg for an fps — keeps the output a pure function of
 *  (pinned bytes, size, quality), which is what makes the derive reproducible
 *  from manifest + store. */
async function withDecodedFrames(video: Buffer, use: (frames: string[]) => Promise<void>) {
  const work = mkdtempSync(path.join(tmpdir(), "thalon-frames-"));
  try {
    const src = path.join(work, "source.mp4");
    writeFileSync(src, video);
    execFileSync("ffmpeg", ["-v", "error", "-i", src, "-vsync", "0", path.join(work, "%05d.png")]);
    await use(
      readdirSync(work)
        .filter((f) => f.endsWith(".png"))
        .sort()
        .map((f) => path.join(work, f)),
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Grade-flatten (if asked), resize and webp-encode one decoded frame. */
async function encodeFrame(frame: string, entry: ManifestEntry): Promise<Buffer> {
  const src = entry.gradeFlatten ? await flattenGrade(frame, entry.gradeFlatten) : sharp(frame);
  return src
    .resize(entry.width, entry.height, { fit: "cover", position: entry.position ?? "centre" })
    .webp({ quality: entry.quality, effort: 6 })
    .toBuffer();
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: npx tsx scripts/export-template-assets.ts <slug>");
    process.exit(2);
  }
  const siteDir = path.resolve(__dirname, "../proprietary/templates/sites", slug);
  const manifestPath = path.join(siteDir, "assets", "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`no manifest at ${manifestPath}`);
    process.exit(2);
  }
  const entries = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestEntry[];

  const store = getObjectStore();
  for (const entry of entries) {
    const ext = entry.ext ?? "png";
    const key = pinnedAssetKey(entry.pinnedHash, ext);
    const original = await readPinnedAsset(store, key);
    if (!original) {
      throw new Error(`pinned original missing or hash-mismatched for "${entry.file}" (${key})`);
    }
    // A video original is never resized as-is — it is either scrubbed as a
    // sequence (`frames`) or sampled at one named frame (`frame`). An entry
    // pointing at one with neither is a manifest bug, not a resize.
    if (ext === "mp4" && entry.frames === undefined && entry.frame === undefined) {
      throw new Error(`"${entry.file}" pins an mp4 but declares neither frames nor frame`);
    }
    if (entry.frames !== undefined && entry.frame !== undefined) {
      throw new Error(`"${entry.file}" declares both frames and frame — pick one`);
    }
    if (entry.frame !== undefined) {
      const file = await emitStillFromVideo(path.join(siteDir, "assets"), entry, original);
      console.log(
        `${entry.file}: source frame ${entry.frame} ${entry.width}x${entry.height} q${entry.quality} → ${path.relative(process.cwd(), file)}`,
      );
      continue;
    }
    if (entry.frames !== undefined) {
      const names = await emitFrames(path.join(siteDir, "assets"), entry, original);
      console.log(
        `${entry.file}: ${names.length} frames ${entry.width}x${entry.height} q${entry.quality} → ${names[0]} … ${names[names.length - 1]}`,
      );
      continue;
    }
    let out: Buffer;
    if (entry.alpha) {
      const lum = await sharp(original)
        .resize(entry.width, entry.height, { fit: "cover", position: entry.position ?? "centre" })
        .greyscale()
        .blur(0.6)
        .toColourspace("b-w")
        .toBuffer();
      out = await sharp({
        create: { width: entry.width, height: entry.height, channels: 3, background: "#fff" },
      })
        .joinChannel(lum)
        .webp({ quality: entry.quality, effort: 6 })
        .toBuffer();
    } else {
      out = await sharp(original)
        .resize(entry.width, entry.height, { fit: "cover", position: entry.position ?? "centre" })
        .webp({ quality: entry.quality, effort: 6 })
        .toBuffer();
    }
    const file = path.join(siteDir, "assets", entry.file);
    writeFileSync(file, out);
    console.log(
      `${entry.file}: ${entry.width}x${entry.height} q${entry.quality} → ${path.relative(process.cwd(), file)} (${(out.length / 1024).toFixed(0)} KB)`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
