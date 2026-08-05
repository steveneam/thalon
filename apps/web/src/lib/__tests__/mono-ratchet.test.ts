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
  // s109: BURNED TO ZERO by the landing rebuild — the moment this seed was
  // written for ("Landing files … burn down at wave 4, the landing's own
  // register decision"). The page's mono is now data apparatus only: gate
  // names, verdicts and readout labels inside the instrument, none of it
  // uppercase and none of it section scaffolding.
  ["app/page.tsx", 0],
  // components/board/leads-board.tsx burned to zero at the s76 leads-board
  // wire — the lead pipeline came back as components/leads/leads-board.tsx in
  // the sheet's own type roles (its one DATA label rides the theme's mono
  // style, no uppercase) and the legacy board was deleted in the same change.
  // components/calendar/* burned to zero at the s75 exact-mock rebuild: the
  // rebuilt surface speaks the sheet's type roles and its DATA labels ride the
  // theme's mono style (no uppercase); the old implementation was deleted.
  // approve + create + dashboard + intel pins all burned to zero at their
  // exact-mock rebuilds (DOCTRINE 0, s73–s74): the rebuilt surfaces speak the
  // sheets' own type roles, and their DATA labels ride the theme's mono style
  // (no uppercase). heat-grade's row is GONE as of s76: the lane that wired
  // the leads board flagged that `HeatGrade` had lost its last caller and
  // correctly refused to reach outside its file set, so the lead deleted the
  // component here. Only the pure `heatBand` banding remains, which carries
  // no mono violation — the pin burned to zero exactly as predicted.
  ["components/landing/site-footer.tsx", 1],
  // leads/ burned to zero at the s75 exact-mock rebuild — the ported surface
  // speaks the sheet's own type roles, and its DATA labels ride the theme's
  // mono style (no uppercase).
  // library + runs pins burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  // The whole components/videos/ block left the map at the s76 exact-mock
  // rebuild — the three ported surfaces speak the sheets' own type roles, and
  // their DATA labels ride the theme's mono style (no uppercase).
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
