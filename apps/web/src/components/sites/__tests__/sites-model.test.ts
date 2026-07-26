import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { assembleSiteRecord, parseCatalog } from "@/lib/sites/catalog";
import {
  applyFilters,
  cardFacts,
  chipActive,
  facetValues,
  headerPills,
  siteChips,
  toggleChip,
  verdictStatus,
  verticalLabel,
} from "../sites-model";

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

describe("sites catalog + surface model (W-sites s61, re-homed at the exact-mock rebuild)", () => {
  it("assembles every real site with a card image and a verdict, and the model math holds", () => {
    const records = localRecords();
    expect(records.length).toBeGreaterThanOrEqual(15);
    for (const r of records) {
      expect(r.cardImage, `${r.slug} needs a card image`).toBeTruthy();
      expect(r.assets.length, `${r.slug} needs manifest facts`).toBeGreaterThan(0);
      // A missing verdict is never SILENT — it resolves to the honest
      // awaiting chip (a freshly shipped site is loudly awaiting, s62 ⑯).
      expect(["approved", "fix-round", "awaiting"]).toContain(verdictStatus(r));
    }
    // The s61 backfill holds: the verdicted majority carries explicit records.
    expect(records.filter((r) => r.verdict).length).toBeGreaterThanOrEqual(16);
    const facets = facetValues(records);
    expect(facets.verticals.length).toBeGreaterThan(5);
    const filtered = applyFilters(records, { axis: "high-quality-3d" });
    expect(filtered.map((r) => r.slug)).toContain("sparkwright");
    expect(filtered.map((r) => r.slug)).toContain("hartline");
    // The headline pills never hide the total behind a filter.
    expect(headerPills(records, filtered).built).toBe(
      `${filtered.length} of ${records.length} built`,
    );
    expect(headerPills(records, records).built).toBe(`${records.length} built`);
    // Verdicts are DATA — founder calls flip them between commits, so the
    // logic is tested against synthetic records, never a real site's current
    // status (that pin went red the moment ⑭'s fix round was accepted, s62).
    for (const r of records) {
      expect(verdictStatus(r)).toBe(r.verdict?.status ?? "awaiting");
    }
    const unverdicted = { ...records[0], verdict: undefined };
    expect(verdictStatus(unverdicted)).toBe("awaiting");
  });

  it("the chip row is the catalog's OWN vocabulary — verticals by weight, then registers, then waves", () => {
    const records = localRecords();
    const chips = siteChips(records);

    expect(chips.filter((c) => c.kind === "vertical")).toHaveLength(
      facetValues(records).verticals.length,
    );
    // Kinds keep one reading order: what it is, how it looks, when it shipped.
    expect([...new Set(chips.map((c) => c.kind))]).toEqual(["vertical", "axis", "wave"]);
    expect(verticalLabel("trade-electrician")).toBe("Trade · electrician");
    // Every chip filters something — a chip that matched nothing is a dead label.
    for (const chip of chips) {
      expect(applyFilters(records, toggleChip(chip, {})).length).toBeGreaterThan(0);
    }
  });

  it("a chip toggles only its own kind — the other picks survive (the old facet rows' behaviour)", () => {
    const records = localRecords();
    const chips = siteChips(records);
    const vertical = chips.find((c) => c.kind === "vertical")!;
    const axis = chips.find((c) => c.kind === "axis")!;

    const one = toggleChip(vertical, {});
    const two = toggleChip(axis, one);
    expect(two.vertical).toBe(vertical.value);
    expect(two.axis).toBe(axis.value);
    expect(chipActive(vertical, two)).toBe(true);

    const cleared = toggleChip(vertical, two);
    expect(cleared.vertical).toBeUndefined();
    expect(cleared.axis).toBe(axis.value);
  });

  it("cardFacts is the old card's axis pair, straight from the catalog — never a re-derivation", () => {
    expect(
      cardFacts({
        ...localRecords()[0],
        axes: { primary: "editorial-print", secondary: "data-instrument" },
      }),
    ).toEqual(["editorial-print", "data-instrument"]);
    // A record with one axis states one; nothing is invented to fill the row.
    expect(cardFacts({ ...localRecords()[0], axes: { primary: "editorial-print" } })).toEqual([
      "editorial-print",
    ]);
    expect(cardFacts({ ...localRecords()[0], axes: { primary: "" } })).toEqual([]);
  });

  it("the sheet's placeholder rule stays a CHILD selector — it swallowed the record caption once", () => {
    // Found on screen, invisible to every other test: `.site-shot span` is
    // the sheet's rule for the striped placeholder's mono caption, and it
    // also matched the record caption nested inside the shot, rendering the
    // one-liner as 10px mono. The child combinator is what keeps the sheet's
    // declaration exactly as written without it reaching further than the
    // element it was written for.
    const css = readFileSync(
      path.join(fileURLToPath(new URL(".", import.meta.url)), "../sites.css"),
      "utf8",
    );
    expect(css).toContain(".sites-surface .site-shot > span {");
    expect(css).not.toMatch(/\.sites-surface \.site-shot span \{/);
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
