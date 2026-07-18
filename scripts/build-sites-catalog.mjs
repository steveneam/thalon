#!/usr/bin/env node
/**
 * build-sites-catalog.mjs — assemble the portfolio catalog the workspace
 * Sites surface reads (W-sites, s61). Plain node on purpose: this runs in
 * the templates image's catalog stage (Dockerfile.templates) where neither
 * tsx nor the repo's node_modules exist.
 *
 * The dev-side twin of apps/web/src/lib/sites/catalog.ts's assembler; the
 * drift guard is parseCatalog + the model test — whatever this emits must
 * parse there. Keep the two in step when the record shape changes.
 *
 * Usage: node build-sites-catalog.mjs <sitesDir> <outFile>
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [sitesDir, outFile] = process.argv.slice(2);
if (!sitesDir || !outFile) {
  console.error("usage: node build-sites-catalog.mjs <sitesDir> <outFile>");
  process.exit(2);
}

const records = [];
for (const slug of readdirSync(sitesDir).sort()) {
  const dir = join(sitesDir, slug);
  if (!statSync(dir).isDirectory()) continue;
  let site;
  try {
    site = JSON.parse(readFileSync(join(dir, "site.json"), "utf8"));
  } catch {
    console.error(`skip ${slug}: no readable site.json`);
    continue;
  }
  let manifest = [];
  try {
    manifest = JSON.parse(readFileSync(join(dir, "assets", "manifest.json"), "utf8"));
  } catch {
    /* a site without assets is legal */
  }
  const assets = (Array.isArray(manifest) ? manifest : [])
    .filter((e) => typeof e.file === "string" && typeof e.pinnedHash === "string")
    .map((e) => ({
      file: e.file,
      width: typeof e.width === "number" ? e.width : 0,
      height: typeof e.height === "number" ? e.height : 0,
      hashTail: e.pinnedHash.slice(-8),
    }));
  const cardFile = typeof site.cardImage === "string" ? site.cardImage : assets[0]?.file;
  records.push({
    slug: site.slug,
    name: site.name,
    vertical: site.vertical ?? "",
    oneLiner: site.oneLiner ?? "",
    axes: site.axes ?? { primary: "" },
    axisNote: site.axisNote,
    paletteSeed: site.paletteSeed,
    typeDirection: site.typeDirection,
    motionBudget: site.motionBudget,
    wave: site.wave,
    built: site.built,
    verdict: site.verdict,
    cardImage: cardFile ? `${site.slug}/assets/${cardFile}` : undefined,
    assets,
  });
}

writeFileSync(outFile, JSON.stringify(records, null, 1) + "\n");
console.error(`catalog: ${records.length} sites -> ${outFile}`);
