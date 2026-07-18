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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getObjectStore } from "@thalon/platform";
import { readPinnedAsset } from "@thalon/engine";

interface ManifestEntry {
  file: string;
  pinnedHash: string;
  width: number;
  height: number;
  quality: number;
  /** Luminance→alpha conversion: white areas of the pinned matte become
   *  opaque, black transparent. For CSS mask-image assets — Safari's
   *  -webkit-mask reads alpha only, never luminance. */
  alpha?: boolean;
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
    const key = `assets/${entry.pinnedHash}/asset.png`;
    const original = await readPinnedAsset(store, key);
    if (!original) {
      throw new Error(`pinned original missing or hash-mismatched for "${entry.file}" (${key})`);
    }
    let out: Buffer;
    if (entry.alpha) {
      const lum = await sharp(original)
        .resize(entry.width, entry.height, { fit: "cover", position: "centre" })
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
        .resize(entry.width, entry.height, { fit: "cover", position: "centre" })
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
