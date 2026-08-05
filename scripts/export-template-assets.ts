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
  /** Luminance→alpha conversion: white areas of the pinned matte become
   *  opaque, black transparent. For CSS mask-image assets — Safari's
   *  -webkit-mask reads alpha only, never luminance. */
  alpha?: boolean;
  /** Cover-crop anchor when the target aspect differs from the original
   *  (sharp position string: "top" | "bottom" | "left" | "right" | …).
   *  Defaults to centre. Lets a derive keep a chosen band of the pinned
   *  original — still fully deterministic from manifest + store. */
  position?: string;
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
  const work = mkdtempSync(path.join(tmpdir(), "thalon-frames-"));
  try {
    const src = path.join(work, "source.mp4");
    writeFileSync(src, video);
    execFileSync("ffmpeg", ["-v", "error", "-i", src, "-vsync", "0", path.join(work, "%05d.png")]);
    const decoded = readdirSync(work)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const picked = evenlySpacedIndices(decoded.length, entry.frames!);
    for (const [i, index] of picked.entries()) {
      const out = await sharp(path.join(work, decoded[index]))
        .resize(entry.width, entry.height, { fit: "cover", position: entry.position ?? "centre" })
        .webp({ quality: entry.quality, effort: 6 })
        .toBuffer();
      writeFileSync(path.join(assetsDir, names[i]), out);
    }
    return names;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
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
    // A video original has no still derive: the page scrubs frames, so an
    // entry pointing at one without `frames` is a manifest bug, not a resize.
    if (ext === "mp4" && entry.frames === undefined) {
      throw new Error(`"${entry.file}" pins an mp4 but declares no frames count`);
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
