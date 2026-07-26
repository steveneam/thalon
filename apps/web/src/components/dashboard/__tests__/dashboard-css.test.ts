import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A STATUS COLOUR LOST TO THE SHELL'S OWN LINK RULE (s79 verify round, D5 3/3,
 * measured live at 1440×940) — pinned as a stylesheet assertion because it is a
 * pure cascade fix and jsdom computes no cascade, so no render test can see it.
 *
 * `.screen a { color: var(--act) }` (workspace.css:76) has specificity (0,1,1)
 * and beats `.mark-you` (0,1,0). Every waiting mark on the Dashboard is a
 * <Link> — every fact is a door — so all six on /app computed to `--act`
 * exactly, over a `--warn-subtle` fill that survived: an amber pill with
 * accent-blue text, on the one mark kind that means "this waits on YOU".
 *
 * The rule this pins is the general one: an atom promoted to a link keeps its
 * own colour channel. The shell already carries this idiom for `.pill-warn`,
 * `.btn-primary` and `.nav-item`; the `.mark` family was missed, and the better
 * home is workspace.css (it would fix the Calendar's month marks in the same
 * line) — that file is lead-owned, so this is the lane-legal form and the shell
 * promotion is written up in the lane's wrap.
 */
const dirname = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(path.resolve(dirname, "../dashboard.css"), "utf8");

describe("dashboard.css (s79 — D5)", () => {
  it("a linked waiting mark keeps the warn channel, not the accent", () => {
    expect(CSS).toMatch(/\.dashboard-surface a\.mark-you\s*\{[^}]*color:\s*var\(--warn\)/);
  });

  it("the day view's linked chips keep theirs too — same cascade, one grammar over", () => {
    expect(CSS).toMatch(/\.dashboard-surface a\.wd-ev\.wd-you\s*\{[^}]*color:\s*var\(--warn\)/);
    expect(CSS).toMatch(/\.dashboard-surface a\.wd-ev\s*\{[^}]*color:/);
  });

  it("the marks that are not links yet are covered, so the next door needn't rediscover this", () => {
    expect(CSS).toMatch(/\.dashboard-surface a\.mark\s*\{/);
    expect(CSS).toMatch(/\.dashboard-surface a\.mark-plan\s*\{/);
  });

  it("every rule is scoped under the surface root (mock-sheets README rule 6)", () => {
    const selectors = (CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/([^{}]+)\{/g) ?? [])
      .map((s) => s.replace("{", "").trim())
      .filter((s) => s !== "" && !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        expect(part.trim()).toMatch(/^\.dashboard-surface\b/);
      }
    }
  });
});
