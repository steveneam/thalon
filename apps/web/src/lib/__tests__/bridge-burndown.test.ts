import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The bridge burn-down ratchet (wave 1 of the exact-mock rebuild, DOCTRINE
 * 0 consequence (a)): the globals.css legacy-token bridge exists ONLY for
 * not-yet-rebuilt surfaces and burns to zero. This scan counts every
 * legacy semantic-token Tailwind usage (bg-card, text-muted-foreground,
 * border-border, …) in workspace .tsx files — the classes only the bridge
 * keeps rendering. The map pins TODAY's count per file (the s73 seed —
 * the rebuilt shell + dashboard already sit at ZERO) and only ratchets
 * DOWN, exactly like the mono ratchet beside it:
 *  - A count above its pin (or a new file appearing) fails: rebuilt or new
 *    surfaces speak the mock sheets' ported classes, never bridged tokens.
 *  - A count below its pin fails too — lower the pin in the SAME change,
 *    so the seed stays honest as each surface's rebuild deletes its old
 *    implementation. The bridge block in globals.css is deleted when this
 *    map is empty.
 * Landing/brand files are out of scope: the landing keeps its own register.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_ROOT = path.resolve(dirname, "../..");

const LEGACY_TOKEN_RE =
  /\b(?:bg|text|border|ring|divide|fill|stroke|outline|decoration|shadow|from|to|via)-(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|input|ring|signal|sidebar|border)(?:-[a-z0-9/]+)*\b/g;

/** file → pinned bridged-token usage count (the s73 seed). */
const PINNED: ReadonlyMap<string, number> = new Map([
  ["app/app/sites/page.tsx", 5],
  ["components/approve/approve-panel.tsx", 36],
  ["components/approve/approve-queue.tsx", 11],
  ["components/approve/format-detail.tsx", 25],
  ["components/approve/judge-verdicts.tsx", 11],
  ["components/approve/queue-list.tsx", 16],
  ["components/board/leads-board.tsx", 22],
  ["components/calendar/agenda-list.tsx", 9],
  ["components/calendar/calendar-surface.tsx", 25],
  ["components/calendar/day-panel.tsx", 9],
  ["components/calendar/month-grid.tsx", 12],
  ["components/calendar/slot-chip.tsx", 12],
  ["components/calendar/week-grid.tsx", 22],
  // components/create/* left the map at s74 — the surface was rebuilt from
  // Create.dc.html and the loader beside it re-trued to the sheet's chrome
  // in the same change; both sit at ZERO bridged tokens.
  // Intel's own rows burned to zero at the s74 exact-mock rebuild, and
  // Search's followed the same session: the mock draws that TAB but no
  // panel, so Search was DESIGNED in the sheets' language (founder s74)
  // rather than ported — horizon-card.tsx and demo-banner.tsx were folded
  // into it and deleted. heat-grade below still serves other surfaces.
  ["components/intel/heat-grade.tsx", 1],
  ["components/leads/lead-card.tsx", 13],
  ["components/leads/leads-surface.tsx", 13],
  ["components/leads/weights-provenance.tsx", 7],
  // library/ burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  ["components/profiles/profile-editor.tsx", 13],
  // runs/ burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  ["components/settings/integrations-panel.tsx", 30],
  ["components/settings/settings-panel.tsx", 7],
  ["components/sites/site-dossier.tsx", 19],
  ["components/sites/sites-gallery.tsx", 21],
  ["components/staged/candidate-picker.tsx", 7],
  ["components/staged/capture-log.tsx", 3],
  ["components/staged/direction-editor.tsx", 25],
  ["components/staged/stage-preview.tsx", 14],
  ["components/staged/stage-rail.tsx", 7],
  ["components/staged/staged-flow.tsx", 12],
  ["components/staged/storyboard-cards.tsx", 32],
  ["components/ui/badge.tsx", 28],
  ["components/ui/button.tsx", 36],
  ["components/ui/card.tsx", 4],
  ["components/ui/skeleton.tsx", 1],
  ["components/videos/assist-panel.tsx", 20],
  ["components/videos/cut-editor.tsx", 33],
  ["components/videos/frame-composer.tsx", 12],
  ["components/videos/music-lane.tsx", 5],
  ["components/videos/num-field.tsx", 6],
  ["components/videos/project-browser.tsx", 35],
  ["components/videos/track-view.tsx", 30],
  ["components/videos/video-projects.tsx", 8],
  ["components/videos/videos-subnav.tsx", 6],
  ["components/workspace/action-toast.tsx", 8],
  ["components/workspace/bulk-bar.tsx", 2],
  ["components/workspace/command-palette.tsx", 13],
  ["components/workspace/error-notice.tsx", 1],
]);

const SCAN_ROOTS = ["app/app", "components"];
const SKIP_DIRS = new Set(["landing", "brand", "__tests__"]);

function scan(dir: string, found: Map<string, number>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) scan(p, found);
      continue;
    }
    if (!p.endsWith(".tsx")) continue;
    const n = (readFileSync(p, "utf8").match(LEGACY_TOKEN_RE) ?? []).length;
    if (n > 0) found.set(path.relative(SRC_ROOT, p).split(path.sep).join("/"), n);
  }
}

describe("bridge burn-down ratchet (DOCTRINE 0 — the bridge burns to zero)", () => {
  const found = new Map<string, number>();
  for (const root of SCAN_ROOTS) scan(path.join(SRC_ROOT, root), found);

  it("no workspace file gains bridged legacy-token classes beyond its pin", () => {
    const regressions: string[] = [];
    for (const [file, n] of [...found.entries()].sort()) {
      const pinned = PINNED.get(file) ?? 0;
      if (n > pinned) regressions.push(`${file}: ${n} > pinned ${pinned}`);
    }
    expect(
      regressions,
      "new bridged-token usage — rebuilt/new surfaces speak the mock sheets' ported classes (src/app/app/workspace.css), never legacy tokens",
    ).toEqual([]);
  });

  it("the pin ratchets DOWN with every surface rebuild (update it in the same change)", () => {
    const stale: string[] = [];
    for (const [file, pinned] of [...PINNED.entries()].sort()) {
      const n = found.get(file) ?? 0;
      if (n < pinned) stale.push(`${file}: now ${n}, pinned ${pinned} — lower the pin`);
    }
    expect(stale, "surface burned down — lower its pin so the seed stays honest").toEqual([]);
  });
});
