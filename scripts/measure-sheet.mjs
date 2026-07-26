#!/usr/bin/env node
/* global document, getComputedStyle */
// The globals above are NOT used in Node. They appear only inside callbacks
// handed to page.evaluate, which puppeteer serializes and runs INSIDE THE
// BROWSER. ESLint lints this file as Node and cannot see that boundary, so
// they are declared rather than switched off (the convention shoot-surface.mjs
// and surface-driver.mjs already use).
//
// measure-sheet.mjs — THE RENDER GATE, AS A NUMBER.
//
// Why this exists (s80). The exact-mock rebuild gates every surface on
// "screenshot the built route, diff it against its sheet", and
// `shoot-surface.mjs` makes that procedure runnable — but it produces two
// IMAGES. Two images require a human to decide whether they match, which is
// exactly the judgement that goes soft when the same person has been staring
// at a surface all session. The video editor's gate against `Videos.dc.html`
// was recorded as "does not match — unquantified" for two sessions running.
//
// A drift you cannot state is a drift nobody can be held to. This script
// measures the sheet and the built route at the SAME viewport (parsed from the
// sheets' own theme.css, never hardcoded) and prints:
//
//   - MISSING: a class the sheet draws and the app renders nowhere. This is the
//     fidelity gap that matters most — it is a piece of the design that was
//     never built, and no pixel diff names it.
//   - DRIFT:   a class both draw, with the measured delta in x/y/w/h.
//   - EXTRA:   a class the app draws and the sheet does not (usually an honest
//              app adaptation; listed so it is a decision, not an accident).
//
// It compares the FIRST element of each class, which is a deliberate bound: it
// answers "is this band in the right place at the right size", not "are all
// nine caption plates identical". State the bound, don't chase the number.
//
// Usage (from the repo root, dev server already up):
//   node scripts/measure-sheet.mjs --route /app/videos/<id>/edit --sheet Videos.dc.html
//   node scripts/measure-sheet.mjs --route /app/runs --sheet Runs.dc.html --mode light
//
// Flags:
//   --route <path>   built route to measure (required)
//   --sheet <file>   sheet in docs/research/mock-sheets (required)
//   --mode           dark | light            (default: dark)
//   --base           dev origin              (default: http://localhost:3111)
//   --tolerance <n>  px a band may move before it is reported (default: 2)

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_BASE, goto, launch, openPage, screenSize } from "./lib/surface-driver.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHEET_DIR = join(REPO, "docs/research/mock-sheets");

/**
 * Chrome the sheet cannot have an opinion about: the workspace shell is the
 * app's own frame, and every sheet draws its own static copy of the rail and
 * topbar. Comparing those measures the fixture, not the surface.
 */
const SHELL = new Set([
  "screen", "rail", "rail-name", "nav-ico", "nav-count", "nav-sep", "main",
  "topbar", "crumb", "kbd", "avatar", "content",
]);

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 || i + 1 >= argv.length ? fallback : argv[i + 1];
};

const route = flag("--route");
const sheetName = flag("--sheet");
const mode = flag("--mode", "dark");
const base = flag("--base", DEFAULT_BASE);
const tolerance = Number(flag("--tolerance", "2"));

if (!route || !sheetName) {
  console.error(
    "usage: node scripts/measure-sheet.mjs --route <path> --sheet <file.dc.html> [--mode dark|light] [--tolerance px]",
  );
  process.exit(2);
}

const sheetPath = join(SHEET_DIR, sheetName);
if (!existsSync(sheetPath)) {
  console.error(`no such sheet: ${sheetPath}`);
  process.exit(2);
}

/**
 * First element of every class INSIDE `.content`, measured.
 *
 * Scoped to the content region on purpose. Measuring the whole document
 * compares the first `.btn` in the app — the rail's theme toggle — against the
 * first `.btn` in the sheet, which is the topbar's Create button, and prints a
 * 937px "drift" that is really two different controls. Every sheet draws its
 * own static copy of the rail and topbar; comparing those measures the fixture,
 * not the surface. `classList` rather than `className` because SVG elements
 * carry an SVGAnimatedString there, which stringifies to "[object …]" and
 * splits into two junk class names.
 */
async function measureClasses(page, shell) {
  return page.evaluate((shellList) => {
    const skip = new Set(shellList);
    const seen = new Map();
    const root = document.querySelector(".content") || document.body;
    for (const el of Array.from(root.querySelectorAll("[class]"))) {
      const classes = Array.from(el.classList);
      for (const c of classes) {
        if (skip.has(c) || seen.has(c)) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 && r.height === 0) continue;
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        seen.set(c, {
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
        });
      }
    }
    return Object.fromEntries(seen);
  }, [...shell]);
}

const { width, height } = screenSize();
const puppeteer = (await import("puppeteer")).default;
const browser = await launch(puppeteer);

try {
  const sheetPage = await openPage(browser, { mode });
  await sheetPage.goto(pathToFileURL(sheetPath).href, { waitUntil: "networkidle2", timeout: 45_000 });
  await sheetPage.evaluate(() => document.fonts.ready);
  const sheet = await measureClasses(sheetPage, SHELL);

  const appPage = await openPage(browser, { mode });
  await goto(appPage, base, route);
  const app = await measureClasses(appPage, SHELL);

  const missing = [];
  const drift = [];
  for (const [cls, s] of Object.entries(sheet)) {
    const a = app[cls];
    if (!a) {
      missing.push(cls);
      continue;
    }
    const d = { dx: a.x - s.x, dy: a.y - s.y, dw: a.w - s.w, dh: a.h - s.h };
    const worst = Math.max(...Object.values(d).map(Math.abs));
    if (worst > tolerance) drift.push({ cls, s, a, ...d, worst });
  }
  const extra = Object.keys(app).filter((c) => !sheet[c]);
  drift.sort((x, y) => y.worst - x.worst);

  console.log(`\n=== RENDER GATE  ${route}  vs  ${sheetName}  (${mode}, ${width}×${height}, ±${tolerance}px) ===\n`);

  console.log(`MISSING — drawn by the sheet, rendered nowhere in the app RIGHT NOW (${missing.length}):`);
  console.log(missing.length ? missing.map((c) => `  .${c}`).join("\n") : "  none");
  console.log(
    "  (state-gated classes land here too — a proposal row needs a pending proposal,\n" +
      "   a take tile needs a selected beat. Absent-because-unbuilt and absent-because-\n" +
      "   this-state are different facts; this gate cannot tell them apart, so check each.)",
  );

  console.log(`\nDRIFT — drawn by both, beyond ±${tolerance}px (${drift.length} of ${Object.keys(sheet).length - missing.length} shared):`);
  if (!drift.length) console.log("  none");
  for (const d of drift) {
    console.log(
      `  .${d.cls.padEnd(16)} sheet ${d.s.w}×${d.s.h}@${d.s.x},${d.s.y}` +
        `   app ${d.a.w}×${d.a.h}@${d.a.x},${d.a.y}` +
        `   Δ x${d.dx >= 0 ? "+" : ""}${d.dx} y${d.dy >= 0 ? "+" : ""}${d.dy} w${d.dw >= 0 ? "+" : ""}${d.dw} h${d.dh >= 0 ? "+" : ""}${d.dh}`,
    );
  }

  console.log(`\nEXTRA — drawn by the app, not by the sheet (${extra.length}):`);
  console.log(extra.length ? extra.map((c) => `  .${c}`).join("\n") : "  none");

  const shared = Object.keys(sheet).length - missing.length;
  console.log(
    `\n── ${Object.keys(sheet).length} sheet classes: ${missing.length} missing · ` +
      `${drift.length} drifted · ${shared - drift.length} within ±${tolerance}px · ${extra.length} app-only\n`,
  );
} finally {
  await browser.close();
}
