import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A REFUSED CONTROL MUST NOT LOOK ARMED (s79 verify round, T1 3/3) — pinned as a
 * stylesheet assertion because it is a pure CSS fix and jsdom computes no
 * styles, so no render test can see it.
 *
 * Measured on /app/transcription before the fix: the disabled Ingest button
 * computed `opacity: 1` and `cursor: pointer` — pixel- and feel-identical to an
 * armed one. Nothing upstream dims it: `.btn` (workspace.css:132) sets
 * `cursor: pointer` with no `:disabled` companion, Astryx's reset declares
 * `:where(:disabled) { cursor: default }` at zero specificity, and Tailwind's
 * preflight sets `opacity: 1` on `button` explicitly.
 *
 * The verify round corrected the finding twice, and both corrections live here:
 * no surface in the repo had a `.btn:disabled` rule (the "sibling precedent"
 * was invented — the five that exist are bespoke controls), so this is a
 * SHELL-WIDE gap whose real home is the lead-owned workspace.css; and a dim
 * must never make RUNNING look like NOT-READY, which is why the busy controls
 * flip their label and carry `aria-busy` (pinned in the render tests beside
 * this one).
 */
const dirname = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(path.resolve(dirname, "../transcription.css"), "utf8");

describe("transcription.css (s79 — T1)", () => {
  it("a disabled control is dimmed and refuses the cursor", () => {
    expect(CSS).toMatch(/\.transcription-surface \.btn:disabled\s*\{[^}]*cursor:\s*not-allowed/);
    expect(CSS).toMatch(/\.transcription-surface \.btn:disabled\s*\{[^}]*opacity:/);
  });

  it("…and does not answer the cursor with a hover state", () => {
    // Each variant restates its RESTING values: `inherit` would take the
    // parent's background, not the button's own.
    for (const variant of ["btn-primary", "btn-ghost", "btn-quiet", "btn-danger"]) {
      expect(CSS).toMatch(
        new RegExp(`\\.transcription-surface \\.${variant}:disabled:hover\\s*\\{`),
      );
    }
  });

  it("the view knobs are the workspace's one picker grammar, scoped here", () => {
    // Approve's `.sel-ctl` atomics, restated because workspace.css is lead-owned
    // (the same call lane 1 made on leads/board/runs).
    expect(CSS).toMatch(/\.transcription-surface \.sel-ctl\s*\{/);
    expect(CSS).toMatch(/\.transcription-surface \.sel-native\s*\{/);
    expect(CSS).toMatch(/\.transcription-surface \.find-input\s*\{/);
  });

  it("every rule is scoped under the surface root (mock-sheets README rule 6)", () => {
    const selectors = (CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/([^{}]+)\{/g) ?? [])
      .map((s) => s.replace("{", "").trim())
      .filter((s) => s !== "" && !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        expect(part.trim()).toMatch(/^\.transcription-surface\b/);
      }
    }
  });
});
