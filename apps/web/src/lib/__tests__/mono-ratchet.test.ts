import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The mono-allowlist ratchet (wave-0 kickoff step 6) — the executable form
 * of overhaul disease #1 (ui-overhaul-plan §3.1): uppercase tracked mono is
 * a DATA label, never section scaffolding, and Geist Mono's legal habitat
 * is the data-label allowlist (timestamps, ids in detail views, judge codes
 * in tooltips — the mock's type spec).
 *
 * Mechanics: every `u-eyebrow` use and every same-line `font-mono` +
 * `uppercase` pairing in a .tsx file counts as one violation. The map below
 * pins TODAY's count per file — the wave-0 seed, expected and unfixed.
 * The pin only ratchets DOWN:
 *  - A count above its pin (or a new file appearing) fails: new mono
 *    scaffolding is a defect — express hierarchy structurally instead.
 *  - A count below its pin fails too: lower the pin in the SAME change, so
 *    the seed stays honest as wave-1+ surface rebuilds burn it down.
 *  - A rebuilt surface that keeps a legitimate DATA label moves that usage
 *    off `u-eyebrow`/uppercase-mono onto the theme's data-label style
 *    (mono 11.5, no uppercase) — which this scan deliberately ignores.
 * Landing files (app/page, /brand, landing components) are in the seed as
 * well; they burn down at wave 4, the landing's own register decision.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_ROOT = path.resolve(dirname, "../..");

/** file → pinned violation count (u-eyebrow uses + uppercase-mono lines). */
const PINNED: ReadonlyMap<string, number> = new Map([
  ["app/blog/[slug]/page.tsx", 2],
  ["app/blog/page.tsx", 3],
  ["app/brand/page.tsx", 3],
  ["app/page.tsx", 5],
  ["components/board/leads-board.tsx", 5],
  // calendar-surface.tsx burned to zero at its step-1 exact-mock rebuild; the
  // sub-components below are the old implementation, deleted at step 2.
  ["components/calendar/agenda-list.tsx", 2],
  ["components/calendar/day-panel.tsx", 2],
  ["components/calendar/month-grid.tsx", 3],
  ["components/calendar/slot-chip.tsx", 1],
  ["components/calendar/week-grid.tsx", 4],
  // approve + create + dashboard + intel pins all burned to zero at their
  // exact-mock rebuilds (DOCTRINE 0, s73–s74): the rebuilt surfaces speak the
  // sheets' own type roles, and their DATA labels ride the theme's mono style
  // (no uppercase). heat-grade below still serves leads/board/library until
  // each of those rebuilds.
  ["components/intel/heat-grade.tsx", 1],
  ["components/landing/feature-showcase.tsx", 3],
  ["components/landing/hero-vignette.tsx", 4],
  ["components/landing/site-footer.tsx", 1],
  ["components/leads/lead-card.tsx", 1],
  ["components/leads/leads-surface.tsx", 2],
  ["components/leads/weights-provenance.tsx", 1],
  // library + runs pins burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  ["components/videos/cut-editor.tsx", 2],
  ["components/videos/frame-composer.tsx", 1],
  ["components/videos/project-browser.tsx", 4],
  ["components/videos/track-view.tsx", 1],
  ["components/videos/video-projects.tsx", 1],
  ["components/workspace/command-palette.tsx", 2],
]);

function countViolations(text: string): number {
  const eyebrow = (text.match(/u-eyebrow/g) ?? []).length;
  const upperMono = text
    .split("\n")
    .filter((line) => line.includes("font-mono") && line.includes("uppercase")).length;
  return eyebrow + upperMono;
}

function scan(dir: string, found: Map<string, number>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") scan(p, found);
      continue;
    }
    if (!p.endsWith(".tsx")) continue;
    const n = countViolations(readFileSync(p, "utf8"));
    if (n > 0) found.set(path.relative(SRC_ROOT, p).split(path.sep).join("/"), n);
  }
}

describe("mono-allowlist ratchet (disease #1, wave-0 seed)", () => {
  const found = new Map<string, number>();
  scan(SRC_ROOT, found);

  it("no file gains u-eyebrow / uppercase-mono scaffolding beyond its pin", () => {
    const regressions: string[] = [];
    for (const [file, n] of [...found.entries()].sort()) {
      const pinned = PINNED.get(file) ?? 0;
      if (n > pinned) regressions.push(`${file}: ${n} > pinned ${pinned}`);
    }
    expect(
      regressions,
      "new uppercase-mono scaffolding — express hierarchy structurally, or (for a true DATA label) use the theme's mono data style instead",
    ).toEqual([]);
  });

  it("the pin ratchets DOWN with every burn-down (update it in the same change)", () => {
    const stale: string[] = [];
    for (const [file, pinned] of [...PINNED.entries()].sort()) {
      const n = found.get(file) ?? 0;
      if (n < pinned) stale.push(`${file}: now ${n}, pinned ${pinned} — lower the pin`);
    }
    expect(stale, "surface burned down — lower its pin so the seed stays honest").toEqual([]);
  });
});
