#!/usr/bin/env node
// drive-surface.mjs — DO THE SURFACE'S JOB, don't read its code.
//
// The s78 lesson, as something that runs (AGENTS.md rule 8). The founder found
// a whole missing capability in ten minutes of clicking after 59 agents and a
// 189-finding audit missed it, because every agent READ the code. `fe-check`
// still reads code; this is its missing interaction step.
//
// Two modes, and the first one is how the second gets authored honestly:
//
//   --inventory <route>   list every interactive control the surface OFFERS
//   --jobs <surface>      run that surface's job set and print the JOBS TABLE
//
// The jobs table is the artifact worth having: job × {works, dead-door,
// no-affordance}. A pass/fail gate cannot say "no affordance", which is exactly
// the column the calendar hid in.
//
// Usage (from the repo root, dev server up, MAIN checkout only):
//   node scripts/drive-surface.mjs --inventory /app/dashboard
//   node scripts/drive-surface.mjs --jobs dashboard --jobs sites
//   node scripts/drive-surface.mjs --jobs all --mode light

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isWorktreeRoot, worktreeRefusalMessage } from "./lib/worktree.mjs";
import { DEFAULT_BASE, goto, inventory, launch, openPage } from "./lib/surface-driver.mjs";
import { JOBS, surfaces } from "./lib/surface-jobs.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const invRoutes = [];
const wanted = [];
let base = DEFAULT_BASE;
let mode = "dark";
let iAmTheLead = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--inventory") invRoutes.push(argv[++i]);
  else if (a === "--jobs") wanted.push(argv[++i]);
  else if (a === "--base") base = argv[++i];
  else if (a === "--mode") mode = argv[++i];
  else if (a === "--i-am-the-lead") iAmTheLead = true;
  else {
    console.error(`unknown flag: ${a}`);
    process.exit(2);
  }
}

/**
 * A LANE CANNOT DRIVE ITS OWN WORK either — same reasoning as the screenshot
 * gate (lib/worktree.mjs). The dev server this points at is served from the
 * MAIN checkout, so a lane driving it exercises code that is not its own and
 * reads the result as its branch passing: a false pass on a gate.
 */
if (!iAmTheLead && isWorktreeRoot(REPO)) {
  console.error(worktreeRefusalMessage(base));
  process.exit(2);
}

if (invRoutes.length === 0 && wanted.length === 0) {
  console.error(
    "usage: node scripts/drive-surface.mjs [--inventory <route>] [--jobs <surface>|all] [--mode dark|light]\n" +
      `surfaces: ${surfaces().join(" · ")}`,
  );
  process.exit(2);
}

const names = wanted.includes("all") ? surfaces() : wanted;
for (const n of names) {
  if (!JOBS[n]) {
    console.error(`unknown surface: ${n}\nsurfaces: ${surfaces().join(" · ")}`);
    process.exit(2);
  }
}

const puppeteer = (await import("puppeteer")).default;
const browser = await launch(puppeteer);
let broken = 0;

try {
  for (const route of invRoutes) {
    const page = await openPage(browser, { mode });
    await goto(page, base, route);
    const items = await inventory(page);
    console.log(`\n=== INVENTORY ${route} (${items.length} controls) ===`);
    for (const it of items) {
      const flags = [it.disabled ? "disabled" : "", it.shown ? "" : "hidden"].filter(Boolean).join(",");
      console.log(
        `  ${it.tag}${it.role ? `[${it.role}]` : ""} ${JSON.stringify(it.name)}` +
          `${it.href ? ` → ${it.href}` : ""}${flags ? `  (${flags})` : ""}` +
          `  ${it.rect.w}×${it.rect.h} @${it.rect.x},${it.rect.y}`,
      );
    }
    await page.close();
  }

  for (const name of names) {
    const spec = JOBS[name];
    const rows = [];
    console.log(`\n=== JOBS ${name} (${spec.route}) ===`);
    for (const job of spec.jobs) {
      const page = await openPage(browser, { mode });
      let verdict = "works";
      let note = "";
      try {
        await goto(page, base, spec.route);
        const out = await job.run(page, { base });
        if (typeof out === "string") note = out;
      } catch (err) {
        // A job's own three-valued verdict, or an honest harness failure —
        // never silently a pass.
        verdict = err && err.verdict ? err.verdict : "error";
        note = (err && err.message ? err.message : String(err)).split("\n")[0].slice(0, 160);
        if (verdict === "error") broken++;
      }
      rows.push({ job: job.name, verdict, note });
      await page.close();
    }
    const mark = { works: "✓", "dead-door": "✗ DEAD DOOR", "no-affordance": "— NO AFFORDANCE", error: "! HARNESS" };
    for (const r of rows) {
      console.log(`  ${mark[r.verdict]}  ${r.job}${r.note ? `\n        ${r.note}` : ""}`);
    }
    const tally = rows.reduce((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] || 0) + 1 }), {});
    console.log(
      `  ── ${rows.length} jobs: ` +
        Object.entries(tally)
          .map(([k, v]) => `${v} ${k}`)
          .join(" · "),
    );
  }
} finally {
  await browser.close();
}

// A harness error is not a finding about the product — surface it loudly rather
// than letting a broken drive read as a clean surface.
if (broken > 0) {
  console.error(`\n${broken} job(s) failed inside the HARNESS, not the product — fix the driver before trusting this table.`);
  process.exit(1);
}
