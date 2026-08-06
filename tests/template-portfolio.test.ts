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

    }
  });

  /**
   * The plotted-instrument drift alarm (Marl & Cane, s112).
   *
   * The sibling test above pins the small-hours SHAPE (compounds + hours). A
   * site whose instrument is a PLOTTED CURVE has the same two copies of one
   * truth and the same way of rotting: an SVG `points` list hand-written into
   * the markup, and the inert JSON block the runtime interpolates from.
   * Because the polyline is just a string of numbers, a reading edited in the
   * data block leaves the drawn line exactly where it was, and the page then
   * shows a curve that disagrees with its own table while every other test
   * here passes.
   *
   * So the geometry is RECOMPUTED from the data and compared, using the plot
   * rectangle the data block itself declares. That makes the static SVG a
   * derived artifact in fact and not merely by intention — which is what
   * "static-first is an honesty gate" (㉑ s105) actually requires, since
   * /guide claims in writing that the chart is drawn from these numbers.
   */
  it("a plotted instrument's static polylines are recomputable from its data block", () => {
    for (const slug of slugs) {
      const html = readFileSync(path.join(sitesDir, slug, "index.html"), "utf8");
      const block = /<script type="application\/json" id="[\w-]+">([\s\S]*?)<\/script>/.exec(html);
      if (!block) continue;

      const data = JSON.parse(block[1]) as {
        plot?: { left: number; right: number; top: number; bottom: number;
                 [series: string]: number | [number, number] };
        readings?: Array<Record<string, string | number>>;
      };
      if (!data.plot || !data.readings) continue; // not a plotted instrument

      const { left, right, top, bottom } = data.plot;
      const n = data.readings.length;
      expect(n, `${slug}: a plotted instrument needs at least two readings`).toBeGreaterThan(1);

      for (const [series, scale] of Object.entries(data.plot)) {
        if (!Array.isArray(scale)) continue; // left/right/top/bottom, not a series
        const [lo, hi] = scale;
        const expected = data.readings
          .map((r, i) => {
            const v = Number(r[series]);
            expect(
              Number.isFinite(v),
              `${slug}: reading ${i} has no numeric "${series}" but the plot declares that scale`,
            ).toBe(true);
            const x = left + ((right - left) * i) / (n - 1);
            const y = bottom - ((bottom - top) * (v - lo)) / (hi - lo);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");

        const drawn = new RegExp(
          `class="l-${series}"[^>]*\\bpoints="([^"]+)"`,
        ).exec(html);
        expect(
          drawn,
          `${slug}: the data block declares a "${series}" scale but no polyline carries class "l-${series}"`,
        ).not.toBeNull();
        expect(
          drawn![1].trim(),
          `${slug}: the drawn "${series}" curve does not match the one its own data block computes — the chart and the table are telling the reader different things`,
        ).toBe(expected);
      }

      // Every reading must also be printed in the static table, so the no-JS
      // reader gets the same numbers the curve was drawn from.
      for (const r of data.readings) {
        expect(
          html.includes(`<td>${r.at}</td>`),
          `${slug}: reading "${r.at}" is in the data block but not in the static table`,
        ).toBe(true);
      }
    }
  });

  /**
   * The static frame-stack contract (s107, GENERALISED s108).
   *
   * A scrubbed sequence ships its frames absolutely stacked, and the runtime
   * lights exactly one. Get that wrong and the page still looks perfect in
   * every screenshot: ㉒'s scrub was dead for a whole session because the
   * markup's initial frame stayed lit and — being last in document order —
   * painted over every frame the scroll chose. Types, lint, 3,400 tests and
   * the console were all silent. Only COUNTING the lit frames found it.
   *
   * s107 wrote that check against the site that found it, keyed off an inert
   * JSON data block — so it covered exactly one site, and ⑳'s frame stack
   * would have shipped uncovered. This version keys off the MANIFEST, which
   * every site has, so every present and future frame sequence is covered by
   * construction. ("A ratchet applied to three assets out of four is not
   * applied" — meta-prompt, ㉑ s106.)
   *
   * Scope: sites that ship the stack STATICALLY, which is what makes the
   * no-JS claim real. ㉑ builds its frames at runtime and ships a single
   * `.still` fallback instead — a different technique with its own no-JS
   * story, so it is skipped rather than forced into this shape.
   */
  it("a statically-stacked frame sequence carries every frame and lights exactly one", () => {
    for (const slug of slugs) {
      const siteDir = path.join(sitesDir, slug);
      const manifestPath = path.join(siteDir, "assets", "manifest.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{
        file: string;
        frames?: number;
      }>;
      const html = readFileSync(path.join(siteDir, "index.html"), "utf8");

      for (const entry of manifest) {
        if (entry.frames === undefined) continue;
        const names = frameFileNames(entry.file, entry.frames);
        const present = names.filter((n) => html.includes(`src="assets/${n}"`));
        if (present.length === 0) continue; // runtime-built stage (㉑), not a static stack

        expect(
          present.length,
          `${slug}: ${entry.file} declares ${entry.frames} frames but the markup carries ${present.length} — a gap in the stack is a frame the scroll can select and never show`,
        ).toBe(entry.frames);

        // Exactly one lit, counted over THIS sequence's own frames, so a page
        // carrying two sequences cannot pass by lighting two of one and none
        // of the other.
        const lit = names.filter((n) =>
          new RegExp(`<img class="on" src="assets/${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(html),
        );
        expect(
          lit.length,
          `${slug}: ${entry.file} must have exactly one frame carrying .on in the static markup, found ${lit.length} — with none the no-JS stage is blank, with more than one the stacked frames composite and the scrub is dead while every screenshot still looks correct`,
        ).toBe(1);
      }
    }
  });

  /**
   * The scroll-anchor contract (Morningside, s111).
   *
   * A scrubbed sequence driven by chapter anchors interpolates the frame
   * index between them and CLAMPS outside them, so the anchor list decides
   * which frames a reader can ever reach. Two ways that silently rots:
   *
   *  - the first anchor is not 0, or the last is not the final frame — then
   *    the head or tail of the sequence is clamped out of reach and the page
   *    ships bytes nobody can see. s108 found the aim half of this by sweeping
   *    a browser ("a count proves a scrub is ALIVE, it does not prove it is
   *    AIMED"); the endpoints half is decidable from the markup alone.
   *  - a `--span` drifts from the anchor delta it is supposed to equal. Span
   *    is what buys each chapter its scroll length, so a stale one makes the
   *    motion race through the beat it was meant to pace — measured on this
   *    build at 17 px/frame through the beat the whole page exists for, a
   *    wheel notch skipping five or six frames at a time.
   *
   * Both are invisible to every other test here: the markup is well-formed,
   * exactly one frame is lit, and every asset is manifested.
   */
  it("scroll anchors span the whole sequence and each --span matches its anchor delta", () => {
    for (const slug of slugs) {
      const siteDir = path.join(sitesDir, slug);
      const html = readFileSync(path.join(siteDir, "index.html"), "utf8");
      const tags = html.match(/<[a-z][^>]*\bdata-frame="\d+"[^>]*>/gi) ?? [];
      if (tags.length === 0) continue; // not an anchor-driven site

      const anchors = tags.map((tag) => ({
        frame: Number(/\bdata-frame="(\d+)"/.exec(tag)![1]),
        span: /--span:\s*(\d+)/.exec(tag) ? Number(/--span:\s*(\d+)/.exec(tag)![1]) : undefined,
      }));

      const manifestPath = path.join(siteDir, "assets", "manifest.json");
      const manifest = existsSync(manifestPath)
        ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{ frames?: number }>)
        : [];
      const total = manifest.reduce((n, e) => n + (e.frames ?? 0), 0);

      expect(anchors.length, `${slug}: an anchor-driven scrub needs at least two anchors`).
        toBeGreaterThan(1);
      expect(
        anchors[0].frame,
        `${slug}: the first scroll anchor must be frame 0 — anything above it is clamped unreachable`,
      ).toBe(0);
      expect(
        anchors[anchors.length - 1].frame,
        `${slug}: the last scroll anchor must be frame ${total - 1} (the manifest declares ${total} frames) — anything beyond it is clamped unreachable`,
      ).toBe(total - 1);

      for (let i = 1; i < anchors.length; i++) {
        expect(
          anchors[i].frame,
          `${slug}: anchor ${i} (frame ${anchors[i].frame}) does not advance on anchor ${i - 1} (frame ${anchors[i - 1].frame}) — the clock would run backwards or stall`,
        ).toBeGreaterThan(anchors[i - 1].frame);
        if (anchors[i].span === undefined) continue;
        expect(
          anchors[i].span,
          `${slug}: anchor ${i} declares --span:${anchors[i].span} but drives ${anchors[i].frame - anchors[i - 1].frame} frames — the span buys the scroll length that paces those frames, so a stale one races the motion through its own beat`,
        ).toBe(anchors[i].frame - anchors[i - 1].frame);
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
