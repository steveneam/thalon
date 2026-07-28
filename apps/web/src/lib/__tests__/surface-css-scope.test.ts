import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SURFACE-CSS SCOPE RATCHET (mock-sheets README rule 6 — the cross-lane
 * contract, raised by the intel lane at the s74 merge gate and proved by a
 * sweep of the sheets).
 *
 * The mock sheets deliberately REUSE class names across surfaces with
 * DIFFERENT values — `.prompt-box` is one rule in Create and another in
 * Sites; `.split` differs Approve↔Leads; `.reason` differs Intel↔Leads;
 * `.today` differs Calendar↔Dashboard; `.on` differs across four sheets;
 * and some sheets OVERRIDE a shared workspace.css class outright (Approve
 * nudges `.thumb-sm`). Porting those helmets into unscoped stylesheets
 * makes each rebuilt surface silently restyle its neighbours as soon as
 * both are imported — a defect that shows up as "the other surface looks
 * subtly wrong", long after the change that caused it.
 *
 * So: every rule in a per-surface stylesheet is scoped under that surface's
 * root class (`.create-surface`, `.intel-surface`, …), applied beside
 * `.content` on the surface's root element. Shared classes belong in
 * app/app/workspace.css — the shell contract — and only the lead edits it.
 *
 * This is the executable form of the rule, so it cannot rot in prose.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const COMPONENTS = path.resolve(dirname, "../../components");

/** `.foo-surface`, optionally followed by more selector. */
const SCOPED = /^\.[a-z][\w-]*-surface\b/;

/**
 * SHARED COMPONENT stylesheets — a second, equally strict category (B-media.0,
 * s77).
 *
 * `<SourceThumb>` is deliberately NOT a surface: it is one component that four
 * surfaces render, which is the entire point of consolidating three
 * copy-pasted `<img>` blocks. Surface-scoping its rules is therefore
 * impossible (it has no single surface root), and dumping them into
 * workspace.css would push component internals into the shell contract.
 *
 * So this category carries its own guarantee, and it is not a weaker one:
 * every selector in the file must carry the component's OWN unique namespace
 * prefix. Where surface scoping prevents collisions by fencing a surface, this
 * prevents them by owning a name nothing else uses — checked, not assumed.
 *
 * The map is explicit on purpose: adding a shared component stylesheet is one
 * reviewable line here, never an escape hatch that silently widens.
 */
const SHARED_COMPONENT_SHEETS: Record<string, string> = {
  "media/source-thumb.css": "src-thumb",
  // s82 W2: the audition seam — one component, two surfaces (the editor's
  // takes strip and the inspector's bed picker), so it has no single surface
  // root to scope under and takes the namespace guarantee instead.
  "media/take-audition.css": "take-audition",
};

function surfaceStylesheets(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(COMPONENTS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(COMPONENTS, entry.name);
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".css")) out.push(path.join(dir, file));
    }
  }
  return out.sort();
}

/** Selectors that introduce a rule block, with comments and @keyframes removed. */
function selectorsOf(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // @keyframes step selectors (`from`, `to`, `40%`) are not scopeable.
  const withoutKeyframes = withoutComments.replace(
    /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
    "",
  );
  const selectors: string[] = [];
  for (const match of withoutKeyframes.matchAll(/([^{}]+)\{/g)) {
    const raw = match[1].trim();
    if (raw === "" || raw.startsWith("@")) continue; // @media/@supports preamble
    for (const part of raw.split(",")) {
      const sel = part.trim();
      if (sel !== "") selectors.push(sel);
    }
  }
  return selectors;
}

describe("surface-css scope ratchet (mock-sheets README rule 6)", () => {
  const sheets = surfaceStylesheets();

  it("finds the per-surface stylesheets to police", () => {
    // A guard on the guard: if the rebuild moves these files, this test must
    // fail loudly rather than silently policing an empty set.
    expect(sheets.length).toBeGreaterThan(0);
  });

  it("every declared shared-component stylesheet exists and owns a unique namespace", () => {
    // A guard on the guard: a renamed or deleted shared sheet must fail here
    // rather than quietly leaving its category unpoliced.
    const found = sheets.map((f) => path.relative(COMPONENTS, f).split(path.sep).join("/"));
    for (const rel of Object.keys(SHARED_COMPONENT_SHEETS)) expect(found).toContain(rel);
  });

  it("every rule in a shared-component stylesheet carries that component's namespace", () => {
    const unnamespaced: string[] = [];
    for (const [rel, prefix] of Object.entries(SHARED_COMPONENT_SHEETS)) {
      const css = readFileSync(path.join(COMPONENTS, rel), "utf8");
      for (const sel of selectorsOf(css)) {
        if (!sel.includes(`.${prefix}`)) unnamespaced.push(`${rel}: ${sel}`);
      }
    }
    expect(
      unnamespaced,
      "a shared-component stylesheet rule that does not carry the component's own namespace — it can collide with any surface. Prefix the class, or move a genuinely shared class to app/app/workspace.css.",
    ).toEqual([]);
  });

  it("every rule in a per-surface stylesheet is scoped under its surface root class", () => {
    const unscoped: string[] = [];
    for (const file of sheets) {
      const rel = path.relative(COMPONENTS, file).split(path.sep).join("/");
      // Shared component sheets are policed by namespace above, not by surface.
      if (rel in SHARED_COMPONENT_SHEETS) continue;
      for (const sel of selectorsOf(readFileSync(file, "utf8"))) {
        if (!SCOPED.test(sel)) unscoped.push(`${rel}: ${sel}`);
      }
    }
    expect(
      unscoped,
      "unscoped rule in a per-surface stylesheet — the mock sheets reuse class names with different values across surfaces, so this silently restyles a neighbouring surface. Scope it under the surface's root class (e.g. `.create-surface .prompt-box`), or move a genuinely shared class to app/app/workspace.css.",
    ).toEqual([]);
  });
});
