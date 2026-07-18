import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { assembleSiteRecord, parseCatalog } from "@/lib/sites/catalog";
import { applyFilters, countLine, facetValues, verdictStatus } from "../model";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../../..");
const sitesDir = path.join(repoRoot, "proprietary", "templates", "sites");

function localRecords() {
  return readdirSync(sitesDir)
    .map((slug) => {
      try {
        const site = JSON.parse(readFileSync(path.join(sitesDir, slug, "site.json"), "utf8"));
        const manifest = JSON.parse(
          readFileSync(path.join(sitesDir, slug, "assets", "manifest.json"), "utf8"),
        );
        return assembleSiteRecord(site, manifest);
      } catch {
        return null;
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

describe("sites catalog + gallery model (W-sites, s61)", () => {
  it("assembles every real site with a card image and a verdict, and the model math holds", () => {
    const records = localRecords();
    expect(records.length).toBeGreaterThanOrEqual(15);
    for (const r of records) {
      expect(r.cardImage, `${r.slug} needs a card image`).toBeTruthy();
      expect(r.assets.length, `${r.slug} needs manifest facts`).toBeGreaterThan(0);
      // The backfill covered the whole portfolio: no site is silently unverdicted.
      expect(r.verdict, `${r.slug} carries no verdict field`).toBeTruthy();
    }
    const facets = facetValues(records);
    expect(facets.verticals.length).toBeGreaterThan(5);
    const filtered = applyFilters(records, { axis: "high-quality-3d" });
    expect(filtered.map((r) => r.slug)).toContain("sparkwright");
    expect(filtered.map((r) => r.slug)).toContain("hartline");
    expect(countLine(records, filtered)).toMatch(/shown · \d+ sites · \d+ approved/);
    // Verdicts are DATA — founder calls flip them between commits, so the
    // logic is tested against synthetic records, never a real site's current
    // status (that pin went red the moment ⑭'s fix round was accepted, s62).
    for (const r of records) {
      expect(verdictStatus(r)).toBe(r.verdict?.status ?? "awaiting");
    }
    const unverdicted = { ...records[0], verdict: undefined };
    expect(verdictStatus(unverdicted)).toBe("awaiting");
  });

  it("the image-side assembler (build-sites-catalog.mjs) emits a catalog the workspace parser accepts — the drift guard", () => {
    const out = path.join(tmpdir(), `catalog-drift-${process.pid}.json`);
    execFileSync("node", [path.join(repoRoot, "scripts", "build-sites-catalog.mjs"), sitesDir, out]);
    const parsed = parseCatalog(JSON.parse(readFileSync(out, "utf8")));
    expect(parsed.length).toBeGreaterThanOrEqual(15);
    const spark = parsed.find((r) => r.slug === "sparkwright");
    expect(spark?.cardImage).toBe("sparkwright/assets/hero-dusk.webp");
    expect(spark?.assets[0]?.hashTail).toMatch(/^[0-9a-f]{8}$/);
  });
});
