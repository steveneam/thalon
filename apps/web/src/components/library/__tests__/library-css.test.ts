import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pinned as stylesheet assertions because these are pure CSS facts and jsdom
 * computes no styles, so no render test can see them. Carried whole from the
 * transcription-surface era at the s94 §5.3 re-homing: the rules moved under
 * `.library-surface` with the surface's name, nothing loosened.
 */
const dirname = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(path.resolve(dirname, "../library.css"), "utf8");
/**
 * A REFUSED CONTROL MUST NOT LOOK ARMED (s79 verify round, T1 3/3) — and s102
 * PROMOTED it out of this file. s79 found the defect here, wrote the shell
 * promotion up for the lead, and scoped the rule to `.library-surface`
 * meanwhile; four surfaces then copied that block and the s100 Intel gate
 * found the same defect on a fifth. **The ratchet follows the rule**: it now
 * asserts the shell, so it protects every surface — including the four nobody
 * has passed yet, which a `.library-surface` assertion never could.
 */
const SHELL_CSS = readFileSync(path.resolve(dirname, "../../../app/app/workspace.css"), "utf8");

describe("library.css (s79 T1 + the s94 §5.3 re-homing)", () => {
  it("a disabled control is dimmed and refuses the cursor — shell-wide", () => {
    expect(SHELL_CSS).toMatch(/\.btn:disabled[^{]*\{[^}]*cursor:\s*not-allowed/);
    expect(SHELL_CSS).toMatch(/\.btn:disabled[^{]*\{[^}]*opacity:/);
  });

  it("…and `aria-disabled` wears the same dress, or the s81 grammar cannot read", () => {
    // The repo prefers an inert control that STAYS focusable and states its
    // reason over a hard `disabled` (staged s101: 26 of 41 controls were hard-
    // disabled on a live run). That only works if the two look alike.
    expect(SHELL_CSS).toMatch(/\.btn\[aria-disabled="true"\][^{]*\{[^}]*opacity:/);
  });

  it("…and does not answer the cursor with a hover state", () => {
    // Each variant restates its RESTING values: `inherit` would take the
    // parent's background, not the button's own.
    for (const variant of ["btn-primary", "btn-ghost", "btn-quiet", "btn-danger"]) {
      expect(SHELL_CSS).toMatch(new RegExp(`\\.${variant}:disabled:hover`));
    }
  });

  it("the local copy is GONE — one rule, not a fifth paste of it", () => {
    expect(CSS).not.toMatch(/\.library-surface \.btn:disabled\s*\{/);
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
