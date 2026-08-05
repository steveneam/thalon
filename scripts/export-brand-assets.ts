/**
 * export-brand-assets.ts — regenerate the landing's derived brand images.
 *
 * Reads each entry of apps/web's BRAND_ASSETS manifest, pulls the pinned
 * original from the object store (content-address verified — a corrupted
 * store fails loud, per B4.6), resizes/re-encodes to the manifest's exact
 * size and quality with sharp, and writes `apps/web/public/brand/<file>`.
 * Deterministic from manifest + store: run it after adding a manifest entry
 * or re-pinning an original. Never hand-edit the outputs.
 *
 * Usage (from repo root): npx tsx scripts/export-brand-assets.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { getObjectStore } from "@thalon/platform";
import { readPinnedAsset } from "@thalon/engine";
import { BRAND_ASSETS, BRAND_SEQUENCES, WORKSPACE_ASSETS } from "../apps/web/src/lib/brand-assets";

const OUT_DIR = path.resolve(__dirname, "../apps/web/public/brand");

/**
 * Derive a scroll-scrubbable frame sequence from a pinned mp4 (s109).
 *
 * Decodes every native frame with ffmpeg (already a Dockerfile.web dependency
 * since the s77 media lane), picks `frames` of them at even spacing, and
 * re-encodes each to webp at the manifest's exact size and quality. Same
 * contract as the images above: deterministic from manifest + store, and the
 * outputs are never hand-edited.
 *
 * The frame COUNT is a measured value, not a taste call — see the note on
 * BRAND_SEQUENCES.weir for the adjacent-frame-difference measurements it came
 * from.
 */
async function exportSequences(store: ReturnType<typeof getObjectStore>) {
  for (const [name, seq] of Object.entries(BRAND_SEQUENCES)) {
    const key = `assets/${seq.pinnedHash}/asset.mp4`;
    const original = await readPinnedAsset(store, key);
    if (!original) {
      throw new Error(`pinned original missing or hash-mismatched for "${name}" (${key})`);
    }

    const work = mkdtempSync(path.join(tmpdir(), `brandseq-${name}-`));
    try {
      const src = path.join(work, "src.mp4");
      writeFileSync(src, original);
      // -vsync 0 keeps every decoded frame, so the index maths below is exact.
      execFileSync("ffmpeg", ["-v", "error", "-i", src, "-vsync", "0", path.join(work, "n%04d.png")]);
      const native = readdirSync(work)
        .filter((f) => f.startsWith("n") && f.endsWith(".png"))
        .sort();
      if (native.length < seq.frames) {
        throw new Error(`"${name}": mp4 decoded ${native.length} frames, need ${seq.frames}`);
      }

      const outDir = path.join(OUT_DIR, path.basename(seq.dir));
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });

      let bytes = 0;
      for (let i = 0; i < seq.frames; i += 1) {
        const pick = Math.round((i * (native.length - 1)) / (seq.frames - 1));
        const out = await sharp(readFileSync(path.join(work, native[pick])))
          .resize(seq.width, seq.height, { fit: "cover", position: "centre" })
          .webp({ quality: seq.quality, effort: 6 })
          .toBuffer();
        writeFileSync(path.join(outDir, `f${String(i).padStart(2, "0")}.webp`), out);
        bytes += out.length;
      }
      console.log(
        `${name}: ${seq.frames} frames ${seq.width}x${seq.height} q${seq.quality} → ${path.relative(process.cwd(), outDir)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

async function main() {
  const store = getObjectStore();
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, asset] of Object.entries({ ...BRAND_ASSETS, ...WORKSPACE_ASSETS })) {
    const ext = asset.ext ?? "png";
    const key = `assets/${asset.pinnedHash}/asset.${ext}`;
    const original = await readPinnedAsset(store, key);
    if (!original) {
      throw new Error(`pinned original missing or hash-mismatched for "${name}" (${key})`);
    }
    // SVG originals rasterize at high density first so the downscale stays crisp.
    const out = await sharp(original, ext === "svg" ? { density: 300 } : {})
      .resize(asset.width, asset.height, { fit: "cover", position: "centre" })
      .webp({ quality: asset.quality, effort: 6 })
      .toBuffer();
    const file = path.join(OUT_DIR, path.basename(asset.src));
    writeFileSync(file, out);
    console.log(
      `${name}: ${asset.width}x${asset.height} q${asset.quality} → ${path.relative(process.cwd(), file)} (${(out.length / 1024).toFixed(0)} KB)`,
    );
  }

  await exportSequences(store);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
