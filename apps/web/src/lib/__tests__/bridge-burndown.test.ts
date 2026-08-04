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
  // app/app/sites/page.tsx left the map at the s75 exact-mock rebuild — the
  // route now renders the ported surface and holds no styling of its own.
  // components/board/leads-board.tsx left the map at the s76 leads-board
  // wire: the lead pipeline came back as components/leads/leads-board.tsx in
  // the sheet's own column classes, and the legacy board was deleted in the
  // same change (DOCTRINE 0 rule 3). board-surface.tsx beside it — the CONTENT
  // pipeline board, shipped s75 — was never in the map: it sits at ZERO.
  // components/calendar/* left the map entirely at the s75 exact-mock rebuild:
  // the surface was rebuilt from the Calendar sheet (superseded by Schedule,
  // archived s95) and the old implementation
  // (week/month/agenda grids, day panel, slot chip) was deleted in the same
  // change (DOCTRINE 0 rule 3). The rebuild sits at ZERO bridged tokens.
  // components/create/* left the map at s74 — the surface was rebuilt from
  // Create.dc.html and the loader beside it re-trued to the sheet's chrome
  // in the same change; both sit at ZERO bridged tokens.
  // Intel's own rows burned to zero at the s74 exact-mock rebuild, and
  // Search's followed the same session: the mock draws that TAB but no
  // panel, so Search was DESIGNED in the sheets' language (founder s74)
  // rather than ported — horizon-card.tsx and demo-banner.tsx were folded
  // into it and deleted. heat-grade's row burned to zero in s76 when its dead
  // `HeatGrade` component was removed; the file lives on as pure banding
  // (`heatBand`), which bridges nothing.
  // leads/ burned to zero at the s75 exact-mock rebuild (DOCTRINE 0): the
  // surface speaks Leads.dc.html's own classes, and step 2 deleted the old
  // implementation (lead-card.tsx, weights-provenance.tsx) outright.
  // library/ burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  // profiles/ burned to zero at the s75 exact-mock rebuild (DOCTRINE 0): the
  // wizard speaks Profiles.dc.html's own classes and the old editor is gone.
  // runs/ burned to zero at the s74 exact-mock rebuild (DOCTRINE 0).
  // components/settings/integrations-panel.tsx was DELETED at the s75
  // exact-mock rebuild (DOCTRINE 0 rule 3) — the ported surface replaced it.
  // The Settings ROOT below has no sheet of its own in the mock, so it keeps
  // its bridged styling until the founder calls that surface.
  ["components/settings/settings-panel.tsx", 7],
  // components/sites/* burned to zero across two sessions: sites-gallery.tsx
  // was DELETED at the s75 exact-mock rebuild, and site-dossier.tsx at s76 —
  // the mock draws no dossier for a SITE, so it was DESIGNED in the sheets'
  // language out of the dossier the mock DOES draw (Video Dossier.dc.html),
  // the s74 Search-tab precedent. The old implementation went in the same
  // change (DOCTRINE 0 rule 3).
  // The whole components/staged/ block left the map at the s101 exact-mock
  // rebuild — the LAST un-rebuilt surface in the workspace, and the last
  // block of bridged tokens outside the shared ui/ primitives and the two
  // surfaces with no sheet of their own. It was rebuilt from the sheet
  // AUTHORED that session (Staged.dc.html), speaks that sheet's own ported
  // classes via components/staged/staged.css, and sits at ZERO. Two files
  // left entirely: storyboard-cards.tsx was DELETED (DOCTRINE 0 rule 3) —
  // it and the direction editor's near-duplicate scene cards became one
  // scene-index.tsx, because the sheet draws ONE shape for both artifacts.
  ["components/ui/badge.tsx", 28],
  ["components/ui/button.tsx", 36],
  ["components/ui/card.tsx", 4],
  // components/ui/skeleton.tsx left the map at the s87 hygiene audit: the
  // component was orphaned (zero imports repo-wide) and deleted outright.
  // The whole components/videos/ block left the map at the s76 exact-mock
  // rebuild: all three video surfaces were rebuilt from their sheets and the
  // old implementation (list, browser, cut-editor, track-view, assist-panel,
  // music-lane, frame-composer, num-field, videos-subnav) was deleted in the
  // same wave (DOCTRINE 0 rule 3). The rebuild sits at ZERO bridged tokens;
  // every keeper re-entered as a state behind the sheets' own chrome.
  ["components/workspace/action-toast.tsx", 8],
  // bulk-bar.tsx was DELETED in s76: Approve's exact-mock rebuild grew its own
  // bulk band from the sheet's chrome, leaving this shared component with no
  // caller anywhere. Its convention survives where it is actually used.
  ["components/workspace/command-palette.tsx", 13],
  // components/workspace/error-notice.tsx — same s87 audit deletion: orphaned,
  // zero imports, removed rather than rebuilt.
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
