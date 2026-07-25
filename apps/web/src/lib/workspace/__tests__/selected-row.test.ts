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
const SELECTION_SURFACES = [
  "approve/queue-list.tsx",
  "board/leads-board.tsx",
  "library/library-surface.tsx",
  "leads/lead-card.tsx",
  "sites/sites-gallery.tsx",
];

describe("the ONE selected-row recipe (s40 ratchet)", () => {
  it("pins the recipe to the action channel (Two-Channel: blue = you act, incl. selection)", () => {
    expect(SELECTED_ROW).toBe("border-primary/40 bg-primary/5");
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
