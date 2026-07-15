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
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getObjectStore } from "@thalon/platform";
import { readPinnedAsset } from "@thalon/engine";
import { BRAND_ASSETS, WORKSPACE_ASSETS } from "../apps/web/src/lib/brand-assets";

const OUT_DIR = path.resolve(__dirname, "../apps/web/public/brand");

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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
