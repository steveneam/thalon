import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SELECTED_ROW } from "../selected-row";

const componentsDir = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../components",
);

/**
 * The list surfaces that render a selected/current row. A new list surface
 * that gains selection joins this list and imports the constant — that IS
 * the recipe (s40 consistency slice; DESIGN.md §5 "The Selected-Row Recipe").
 * EXACT-MOCK REBUILDS leave this list (s73, DOCTRINE 0): a rebuilt surface
 * marks selection with the mock sheets' own `.row.sel` class (ported in
 * src/app/app/workspace.css) — one recipe there too. When the last legacy
 * surface rebuilds, this ratchet retires with the bridge.
 */
const SELECTION_SURFACES: string[] = [
  // approve left this list at its exact-mock rebuild — its rows mark
  // selection with the sheet's own `.row.sel` (DOCTRINE 0).
  // board/leads-board.tsx left it at the s76 leads-board wire: the lead
  // pipeline came back as components/leads/leads-board.tsx, whose cards wear
  // the sheet's own `.row.sel` accent (components/leads/leads.css), and the
  // legacy board was deleted in the same change.
  // leads/ left this list at its s75 exact-mock rebuild — the rebuilt rows
  // mark selection with the sheet's own `.row.sel` (DOCTRINE 0).
  // sites left it in the same wave — the ported grid marks the keyboard
  // grammar's pick with the sheet's own `.row.sel` accent worn by a card
  // (components/sites/sites.css), not the legacy recipe.
];

describe("the ONE selected-row recipe (s40 ratchet)", () => {
  it("pins the recipe to the action channel (Two-Channel: blue = you act, incl. selection)", () => {
    expect(SELECTED_ROW).toBe("border-primary/40 bg-primary/5");
  });

  it("holds no surface any more — a new entry here would be a rebuild going backwards", () => {
    // The list is EMPTY as of s76 and must stay that way: every rebuilt
    // surface marks selection with the sheets' `.row.sel`, so a name
    // reappearing here means a surface reached for the legacy recipe instead.
    // The constant itself is NOT dead — components/videos/{video-projects,
    // project-browser}.tsx still import it and were never on this list; this
    // ratchet retires with the bridge when the Videos rebuild lands.
    expect(SELECTION_SURFACES).toEqual([]);
  });

  it("every selection surface imports SELECTED_ROW instead of restating classes", () => {
    for (const surface of SELECTION_SURFACES) {
      const source = readFileSync(path.join(componentsDir, surface), "utf8");
      expect(source, `${surface} must use the shared SELECTED_ROW recipe`).toContain(
        "SELECTED_ROW",
      );
      expect(
        source,
        `${surface} must not restate the recipe literally — import SELECTED_ROW`,
      ).not.toContain("border-primary/40 bg-primary/5");
    }
  });
});
