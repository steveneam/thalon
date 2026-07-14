import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

function siteSlugs(): string[] {
  if (!existsSync(sitesDir)) return [];
  return readdirSync(sitesDir).filter((d) => statSync(path.join(sitesDir, d)).isDirectory());
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

  it("every asset file is manifested with a 64-hex pinned hash, and vice versa", () => {
    for (const slug of slugs) {
      const assetsDir = path.join(sitesDir, slug, "assets");
      if (!existsSync(assetsDir)) continue;
      const manifest = JSON.parse(
        readFileSync(path.join(assetsDir, "manifest.json"), "utf8"),
      ) as Array<{ file: string; pinnedHash: string; width: number; height: number }>;
      const manifested = new Set(manifest.map((m) => m.file));
      for (const entry of manifest) {
        expect(entry.pinnedHash, `${slug}: ${entry.file} pinnedHash malformed`).toMatch(
          /^[0-9a-f]{64}$/,
        );
        expect(
          existsSync(path.join(assetsDir, entry.file)),
          `${slug}: manifested file ${entry.file} missing — run export-template-assets`,
        ).toBe(true);
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
