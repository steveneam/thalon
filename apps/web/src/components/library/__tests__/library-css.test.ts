import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A REFUSED CONTROL MUST NOT LOOK ARMED (s79 verify round, T1 3/3) — pinned as a
 * stylesheet assertion because it is a pure CSS fix and jsdom computes no
 * styles, so no render test can see it. Carried whole from the
 * transcription-surface era at the s94 §5.3 re-homing: the rules moved under
 * `.library-surface` with the surface's name, nothing loosened.
 */
const dirname = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(path.resolve(dirname, "../library.css"), "utf8");

describe("library.css (s79 T1 + the s94 §5.3 re-homing)", () => {
  it("a disabled control is dimmed and refuses the cursor", () => {
    expect(CSS).toMatch(/\.library-surface \.btn:disabled\s*\{[^}]*cursor:\s*not-allowed/);
    expect(CSS).toMatch(/\.library-surface \.btn:disabled\s*\{[^}]*opacity:/);
  });

  it("…and does not answer the cursor with a hover state", () => {
    // Each variant restates its RESTING values: `inherit` would take the
    // parent's background, not the button's own.
    for (const variant of ["btn-primary", "btn-ghost", "btn-quiet", "btn-danger"]) {
      expect(CSS).toMatch(
        new RegExp(`\\.library-surface \\.${variant}:disabled:hover\\s*\\{`),
      );
    }
  });

  it("the view knobs are the workspace's one picker grammar, scoped here", () => {
    expect(CSS).toMatch(/\.library-surface \.sel-ctl\s*\{/);
    expect(CSS).toMatch(/\.library-surface \.sel-native\s*\{/);
    expect(CSS).toMatch(/\.library-surface \.find-input\s*\{/);
  });

  it("the W2 kind lens wears the sheet's own qtab rules, as buttons", () => {
    expect(CSS).toMatch(/\.library-surface \.qtabs\s*\{/);
    expect(CSS).toMatch(/\.library-surface \.qtab\.on\s*\{[^}]*inset 0 -2px 0 var\(--act\)/);
    // The sheet's qtabs are spans; real tabs are BUTTONS (keyboard + AT).
    expect(CSS).toMatch(/\.library-surface \.qtab\s*\{[^}]*cursor:\s*pointer/);
  });

  it("every rule is scoped under the surface root (mock-sheets README rule 6)", () => {
    const selectors = (CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/([^{}]+)\{/g) ?? [])
      .map((s) => s.replace("{", "").trim())
      .filter((s) => s !== "" && !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        expect(part.trim()).toMatch(/^\.library-surface\b/);
      }
    }
  });
});
