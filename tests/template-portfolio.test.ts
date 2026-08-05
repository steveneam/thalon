import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { frameFileNames } from "@thalon/engine";

/**
 * Template-portfolio ratchets (2026-07-14, session 33 — the scaffolding
 * decision made executable; contract: proprietary/templates/README.md).
 * Every site under sites/ must be structurally complete, self-contained
 * (no external hosts — the no-vendor-URL invariant), asset-manifested
 * against pinned originals, and honest on its /guide page (fictional
 * business + AI-generated imagery disclosed). These run for zero sites
 * (the scaffolding may land before the first site) and for all ~25.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sitesDir = path.join(repoRoot, "proprietary", "templates", "sites");

/**
 * s63: the pre-plan-mandatory loop (meta-prompt §How-to step 3) legitimately
 * creates a site dir holding ONLY its PREPLAN.md before any build exists.
 * Such dirs are the recognized pre-plan stage and are exempt from the
 * built-site checks — but ONLY in that exact shape; a dir with any other
 * content and no index.html is still a structural failure (asserted below).
 */
function isPreplanStage(dir: string): boolean {
  return (
    !existsSync(path.join(dir, "index.html")) &&
    readdirSync(dir).every((entry) => entry === "PREPLAN.md")
  );
}

function siteSlugs(): string[] {
  if (!existsSync(sitesDir)) return [];
  return readdirSync(sitesDir).filter(
    (d) =>
      statSync(path.join(sitesDir, d)).isDirectory() && !isPreplanStage(path.join(sitesDir, d)),
  );
}

/** src/href/srcset/url() targets that leave the site's own directory. */
const EXTERNAL_REF = /(?:src|href|srcset)\s*=\s*["'](?:https?:)?\/\/|url\(\s*["']?(?:https?:)?\/\//i;

function htmlFiles(slug: string): string[] {
  const dir = path.join(sitesDir, slug);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(html|css|js)$/i.test(entry)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

describe("template portfolio", () => {
  const slugs = siteSlugs();

  it("a dir without a built site is EXACTLY the pre-plan stage (PREPLAN.md alone) — anything else is structural garbage", () => {
    if (!existsSync(sitesDir)) return;
    for (const d of readdirSync(sitesDir)) {
      const dir = path.join(sitesDir, d);
      if (!statSync(dir).isDirectory()) continue;
      if (existsSync(path.join(dir, "index.html"))) continue; // built site — checked below
      expect(
        readdirSync(dir),
        `${d}: no index.html, so this dir must hold ONLY PREPLAN.md (the s63 pre-plan stage)`,
      ).toEqual(["PREPLAN.md"]);
    }
  });

  it("every site has the contract structure (site.json, index, guide, manifest)", () => {
    for (const slug of slugs) {
      const dir = path.join(sitesDir, slug);
      for (const required of ["site.json", "index.html", path.join("guide", "index.html")]) {
        expect(existsSync(path.join(dir, required)), `${slug}/${required} missing`).toBe(true);
      }
      const site = JSON.parse(readFileSync(path.join(dir, "site.json"), "utf8")) as {
        slug?: string;
        name?: string;
        vertical?: string;
        axes?: { primary?: string; secondary?: string };
      };
      expect(site.slug, `${slug}: site.json slug must equal dir name`).toBe(slug);
      expect(site.name, `${slug}: site.json needs name`).toBeTruthy();
      expect(site.vertical, `${slug}: site.json needs vertical`).toBeTruthy();
      expect(site.axes?.primary, `${slug}: site.json needs axes.primary`).toBeTruthy();
    }
  });

  it("sites are self-contained — no external src/href/srcset/url() hosts", () => {
    for (const slug of slugs) {
      for (const file of htmlFiles(slug)) {
        const text = readFileSync(file, "utf8");
        expect(
          EXTERNAL_REF.test(text),
          `${path.relative(repoRoot, file)} references an external host`,
        ).toBe(false);
      }
    }
  });

  it("img elements with size attributes have height:auto in the site's CSS (s55 stretch lesson)", () => {
    // A width/height-attributed <img> whose CSS constrains only max-width renders
    // at the literal height attribute when narrowed — vertically stretched. Caught
    // by founder review on wagtail s55; every site with attributed imgs must carry
    // height:auto (or size every img via explicit object-fit rules).
    for (const slug of slugs) {
      const index = readFileSync(path.join(sitesDir, slug, "index.html"), "utf8");
      if (!/<img[^>]+width="\d+"[^>]+height="\d+"/.test(index)) continue;
      // "the site's CSS" includes split-out stylesheets (loopwell is the
      // portfolio's first css/-dir site — s58 taste pass moved its rule there)
      const cssDir = path.join(sitesDir, slug, "css");
      const css = existsSync(cssDir)
        ? readdirSync(cssDir)
            .filter((f) => f.endsWith(".css"))
            .map((f) => readFileSync(path.join(cssDir, f), "utf8"))
            .join("\n")
        : "";
      const styles = index + "\n" + css;
      // The rule must sit in a selector that TARGETS img — a height:auto on
      // any other element (⑬'s chartbox svg, s60) satisfied the old loose
      // fallback while the images still stretched. Founder-caught twice now;
      // the regex is the ratchet, keep it img-scoped. The sanctioned
      // alternative stays: an img-scoped object-fit rule (loopwell's
      // absolute cover closing image) cannot stretch either.
      const imgScopedHeightAuto = /\bimg\b[^{}]*{[^}]*height\s*:\s*auto/.test(styles);
      const imgScopedObjectFit = /\bimg\b[^{}]*{[^}]*object-fit\s*:/.test(styles);
      expect(
        imgScopedHeightAuto || imgScopedObjectFit,
        `${slug} has width/height-attributed <img> but no img-scoped height:auto (or object-fit) rule in index.html or css/ — narrowed images will stretch`,
      ).toBe(true);
    }
  });

  it("every asset file is manifested with a 64-hex pinned hash, and vice versa", () => {
    for (const slug of slugs) {
      const assetsDir = path.join(sitesDir, slug, "assets");
      if (!existsSync(assetsDir)) continue;
      const manifest = JSON.parse(
        readFileSync(path.join(assetsDir, "manifest.json"), "utf8"),
      ) as Array<{
        file: string;
        pinnedHash: string;
        width: number;
        height: number;
        frames?: number;
      }>;
      // A frame-sequence entry stands for all N of its files at once, so the
      // bijection is checked against the EXPANDED names. Expansion goes
      // through the same helper the exporter uses, so a manifest entry and
      // the files on disk cannot drift apart on naming.
      const expand = (e: { file: string; frames?: number }): string[] =>
        e.frames === undefined ? [e.file] : frameFileNames(e.file, e.frames);
      const manifested = new Set(manifest.flatMap(expand));
      for (const entry of manifest) {
        expect(entry.pinnedHash, `${slug}: ${entry.file} pinnedHash malformed`).toMatch(
          /^[0-9a-f]{64}$/,
        );
        for (const file of expand(entry)) {
          expect(
            existsSync(path.join(assetsDir, file)),
            `${slug}: manifested file ${file} missing — run export-template-assets`,
          ).toBe(true);
        }
      }
      for (const file of readdirSync(assetsDir)) {
        if (file === "manifest.json") continue;
        expect(manifested.has(file), `${slug}: assets/${file} has no manifest entry`).toBe(true);
      }
    }
  });

  it("the /guide page discloses the fictional business and AI-generated imagery", () => {
    for (const slug of slugs) {
      const guide = readFileSync(path.join(sitesDir, slug, "guide", "index.html"), "utf8");
      expect(/fictional/i.test(guide), `${slug}/guide must say the business is fictional`).toBe(
        true,
      );
      expect(/AI[- ]generated/i.test(guide), `${slug}/guide must disclose AI imagery`).toBe(true);
    }
  });

  /**
   * A site whose instrument is drawn from an inert JSON block has TWO copies of
   * the same numbers: the static markup a no-JS reader gets, and the block the
   * runtime interpolates from. `/guide` claims the page works without
   * JavaScript, so the static copy is a load-bearing claim and not a fallback —
   * and "every claim the /guide makes is a claim that has to be TESTED, not
   * intended" (㉑ s105). This is the drift alarm for that pair.
   */
  it("a site's static instrument markup agrees with its inert data block", () => {
    for (const slug of slugs) {
      const html = readFileSync(path.join(sitesDir, slug, "index.html"), "utf8");
      const block = /<script type="application\/json" id="([\w-]+)">([\s\S]*?)<\/script>/.exec(html);
      if (!block) continue; // not every site drives an instrument from JSON

      const data = JSON.parse(block[2]) as {
        compounds?: { id: string; peak: number }[];
        hours?: { at: string; shares: Record<string, number> }[];
        frames?: number;
      };
      if (!data.compounds || !data.hours) continue;

      for (const hour of data.hours) {
        const sum = Object.values(hour.shares).reduce((a, b) => a + b, 0);
        expect(
          Math.abs(sum - 100) < 0.05,
          `${slug}: shares at ${hour.at} sum to ${sum}, not 100 — the instrument would be reporting a total it cannot justify`,
        ).toBe(true);
        for (const c of data.compounds) {
          expect(
            typeof hour.shares[c.id],
            `${slug}: ${c.id} has no share at ${hour.at}`,
          ).toBe("number");
        }
      }

      // The static rows must print the values the page opens on, which is the
      // peak hour each compound records.
      for (const c of data.compounds) {
        const row = new RegExp(
          `data-row="${c.id}"[\\s\\S]*?<span class="vl">([\\d.]+)</span>`,
        ).exec(html);
        expect(row, `${slug}: no static row for ${c.id}`).not.toBeNull();
        expect(
          Math.abs(Number(row![1]) - c.peak) < 0.05,
          `${slug}: static row ${c.id} prints ${row![1]} but the data block says ${c.peak}`,
        ).toBe(true);
      }

      if (typeof data.frames === "number") {
        const imgs = html.match(/<img[^>]*src="assets\/[\w-]*?\d\d\.webp"/g) ?? [];
        expect(
          imgs.length,
          `${slug}: data block declares ${data.frames} frames but the markup carries ${imgs.length}`,
        ).toBe(data.frames);
        const lit = html.match(/<img class="on"/g) ?? [];
        expect(
          lit.length,
          `${slug}: exactly one frame must carry .on in the static markup, found ${lit.length} — with none the no-JS stage is blank, with more than one the stacked frames composite and the scrub is dead`,
        ).toBe(1);
      }
    }
  });

  it("the factory method docs stay OUT of sites/ (the docroot leak boundary)", () => {
    for (const slug of slugs) {
      for (const file of htmlFiles(slug)) {
        const text = readFileSync(file, "utf8");
        expect(
          /meta-prompt|iteration-pass-checklist/i.test(text),
          `${path.relative(repoRoot, file)} references internal method docs`,
        ).toBe(false);
      }
    }
    expect(existsSync(path.join(sitesDir, "meta-prompt.md"))).toBe(false);
    expect(existsSync(path.join(sitesDir, "README.md"))).toBe(false);
  });
});
