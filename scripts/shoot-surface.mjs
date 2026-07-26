#!/usr/bin/env node
/* global document, localStorage */
// The two globals above are NOT used in Node. They appear only inside the
// callbacks handed to page.evaluate / evaluateOnNewDocument / waitForFunction,
// which puppeteer serializes and runs INSIDE THE BROWSER. ESLint lints this
// file as Node and cannot see that boundary, so it is declared here rather
// than switched off.
//
// shoot-surface.mjs — the screenshot-vs-sheet merge gate, as something that RUNS.
//
// Why this exists (AGENTS.md rule 8: executable > documentary). The exact-mock
// rebuild era (plan §5 DOCTRINE 0) gates every surface on "screenshot the built
// route, diff it against its sheet". Three waves and ~20 surfaces were shot by
// hand, re-deriving the viewport, the theme switch and the sheet's own geometry
// each time. This script IS that procedure, so it cannot rot: same viewport for
// both sides, both themes, deterministic filenames, ready to open side by side.
//
// The viewport is NOT hardcoded — it is parsed from the sheets' own
// `theme.css` `.screen` rule (currently 1440x940). If the canvas ever re-sizes
// its screens, the gate follows automatically instead of silently diffing at a
// stale width.
//
// Usage (from the repo root, dev server already up):
//   node scripts/shoot-surface.mjs --route /app/runs --sheet Runs.dc.html
//   node scripts/shoot-surface.mjs --route /app/runs --route /app/approve
//   node scripts/shoot-surface.mjs --route /app/sites --mode light
//
// Flags:
//   --route <path>   workspace route to shoot (repeatable, required)
//   --sheet <file>   sheet in docs/research/mock-sheets to shoot beside it
//                    (repeatable; pairs positionally with --route)
//   --mode           dark | light | both      (default: both)
//   --base           dev origin               (default: http://localhost:3111)
//   --out            output directory         (default: a timestamped scratch dir)
//   --full           full-page capture instead of the sheet-sized screen box

import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isWorktreeRoot, worktreeRefusalMessage } from "./lib/worktree.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHEET_DIR = join(REPO, "docs/research/mock-sheets");

/**
 * A WORKTREE LANE CANNOT SHOOT ITS OWN WORK (ratchet, s78).
 *
 * The reasoning lives with the predicate in `lib/worktree.mjs`; both are
 * pinned by `tests/worktree-screenshot-guard.test.ts`, which spawns THIS
 * script inside a fabricated worktree so removing the call — not just the
 * helper — turns the suite red. The lesson was written into two lane
 * kickoffs as prose and was wrong in both, so prose is not where it lives
 * (AGENTS.md rule 8: executable > documentary).
 *
 * `--i-am-the-lead` is the deliberate override for a lane that has genuinely
 * been given its own dev server on another port.
 */
function refuseInsideWorktree(baseUrl, overridden) {
  if (overridden || !isWorktreeRoot(REPO)) return;
  console.error(worktreeRefusalMessage(baseUrl));
  process.exit(2);
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const routes = [];
const sheets = [];
let mode = "both";
// MUST be `localhost`, not `127.0.0.1`. Next dev blocks cross-origin access to
// `/_next/*` dev resources, and it treats those two as different origins: on
// 127.0.0.1 every client chunk is blocked, React never hydrates, and each
// surface paints its SSR loading state forever ("Reading the runs…" under a
// "No tenant" topbar) while the API still answers 200 to curl. That cost a
// real debugging hour once — the readiness check below is what caught it.
let base = "http://localhost:3111";
let out = null;
let full = false;
let iAmTheLead = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--route") routes.push(argv[++i]);
  else if (a === "--sheet") sheets.push(argv[++i]);
  else if (a === "--mode") mode = argv[++i];
  else if (a === "--base") base = argv[++i];
  else if (a === "--out") out = argv[++i];
  else if (a === "--full") full = true;
  else if (a === "--i-am-the-lead") iAmTheLead = true;
  else {
    console.error(`unknown flag: ${a}`);
    process.exit(2);
  }
}

refuseInsideWorktree(base, iAmTheLead);

if (routes.length === 0) {
  console.error(
    "usage: node scripts/shoot-surface.mjs --route <path> [--sheet <Name.dc.html>] [--mode dark|light|both]",
  );
  process.exit(2);
}
if (!["dark", "light", "both"].includes(mode)) {
  console.error(`--mode must be dark, light or both (got: ${mode})`);
  process.exit(2);
}

const modes = mode === "both" ? ["dark", "light"] : [mode];

// ── the viewport comes from the sheets' own theme.css, never from memory ────
function screenSize() {
  const css = readFileSync(join(SHEET_DIR, "theme.css"), "utf8");
  const rule = css.match(/\.screen\s*\{[^}]*\}/);
  if (!rule) throw new Error("no .screen rule in mock-sheets/theme.css");
  const w = rule[0].match(/width:\s*(\d+)px/);
  const h = rule[0].match(/height:\s*(\d+)px/);
  if (!w || !h) throw new Error(`.screen rule carries no width/height: ${rule[0]}`);
  return { width: Number(w[1]), height: Number(h[1]) };
}

const { width, height } = screenSize();

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = out
  ? resolve(out)
  : join(
      process.env.TMPDIR || "/tmp",
      `thalon-shots-${stamp}`,
    );
mkdirSync(outDir, { recursive: true });

const slug = (s) =>
  s.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "root";

// ── shoot ───────────────────────────────────────────────────────────────────
const puppeteer = (await import("puppeteer")).default;

const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
});

const written = [];
const notReady = [];
let failed = 0;

try {
  for (const m of modes) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    // The workspace reads its mode pre-paint from localStorage; seed it on the
    // origin before the first navigation so there is no flash-then-switch.
    await page.evaluateOnNewDocument((mm) => {
      try {
        localStorage.setItem("thalon-workspace-mode", mm);
      } catch {
        // Storage can be denied; the theme just falls back to the default.
      }
    }, m);

    for (const route of routes) {
      const url = `${base}${route}`;
      try {
        const res = await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 45_000,
        });
        if (!res || !res.ok()) {
          console.error(`  ✗ ${route} [${m}] — HTTP ${res ? res.status() : "no response"}`);
          failed++;
          continue;
        }

        // Readiness, not optimism. Every workspace surface fetches its rows on
        // the client, so `networkidle` alone shoots the LOADING state — the
        // first run of this script captured "Reading the runs…" under a
        // "No tenant" topbar and exited green. The topbar's tenant name is the
        // app's own global data signal (workspace-topbar.tsx: pulse.tenant.name
        // ?? "No tenant"), so it resolving proves the data layer answered.
        let ready = true;
        try {
          await page.waitForFunction(
            () => !document.body.innerText.includes("No tenant"),
            { timeout: 20_000, polling: 250 },
          );
        } catch {
          ready = false;
        }
        // Then let the surface's own fetch land and the paint settle.
        try {
          await page.waitForNetworkIdle({ idleTime: 1_200, timeout: 20_000 });
        } catch {
          ready = false;
        }
        // Fonts last; a half-loaded webface silently changes every metric the
        // diff is looking at.
        await page.evaluate(() => document.fonts.ready);

        const file = join(outDir, `app--${slug(route)}--${m}.png`);
        await page.screenshot({ path: file, fullPage: full });
        written.push(file);
        if (ready) {
          console.log(`  ✓ ${route} [${m}] → ${file}`);
        } else {
          // Never silently accept a loading-state shot as a passing gate.
          notReady.push(`${route} [${m}]`);
          console.log(`  ⚠ ${route} [${m}] → ${file}  (NOT READY — may be a loading state)`);
        }
      } catch (err) {
        console.error(`  ✗ ${route} [${m}] — ${err.message}`);
        failed++;
      }
    }
    await page.close();
  }

  // ── the sheet side, at the identical viewport ─────────────────────────────
  for (const sheet of sheets) {
    const path = join(SHEET_DIR, sheet);
    if (!existsSync(path)) {
      console.error(`  ✗ sheet not found: ${sheet}`);
      failed++;
      continue;
    }
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    try {
      await page.goto(pathToFileURL(path).href, {
        waitUntil: "networkidle2",
        timeout: 45_000,
      });
      await page.evaluate(() => document.fonts.ready);
      // Each sheet is exactly one `.screen` box on a larger canvas — clip to it
      // so the sheet and the app render at the same geometry.
      const el = await page.$(".screen");
      const file = join(outDir, `sheet--${slug(sheet.replace(/\.dc\.html$/, ""))}.png`);
      if (el) await el.screenshot({ path: file });
      else await page.screenshot({ path: file });
      written.push(file);
      console.log(`  ✓ sheet ${sheet} → ${file}`);
    } catch (err) {
      console.error(`  ✗ sheet ${sheet} — ${err.message}`);
      failed++;
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${written.length} shot(s) at ${width}x${height} (from mock-sheets/theme.css) in:`);
console.log(outDir);
if (notReady.length) {
  console.error(
    `\n⚠ ${notReady.length} shot(s) captured BEFORE the surface was ready — do not gate on these:`,
  );
  for (const n of notReady) console.error(`   ${n}`);
}
if (failed) {
  console.error(`\n${failed} capture(s) FAILED — the gate is not green.`);
  process.exit(1);
}
if (notReady.length) process.exit(1);
