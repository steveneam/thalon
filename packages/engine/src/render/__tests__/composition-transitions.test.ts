import { describe, expect, it } from "vitest";
import { FORBIDDEN_SCRIPT_PATTERNS } from "../composition-lint";
import {
  COMPOSITION_TRANSITIONS,
  DEFAULT_TRANSITION_CYCLE,
  TRANSITION_RECIPES,
  defaultTransition,
} from "../composition-transitions";

const CTX = { outSel: "#scene-host-0", inSel: "#scene-host-1", atSec: "3.4", width: 1920, height: 1080 };

describe("the curated transition table", () => {
  it("is enum-total and every recipe carries its adoption-gate provenance record", () => {
    for (const name of COMPOSITION_TRANSITIONS) {
      const recipe = TRANSITION_RECIPES[name];
      expect(recipe, name).toBeDefined();
      expect(recipe.provenance.verified).toBe("2026-07-07");
      if (recipe.provenance.registryItem !== null) {
        // Catalog-derived recipes cite the registry item and the Apache-2.0 repo check.
        expect(recipe.provenance.license).toBe("Apache-2.0");
        expect(recipe.provenance.source).toContain("heygen-com/hyperframes");
      }
    }
  });

  it("emits only the forbidden-pattern-free tween vocabulary (the belt-1 ratchet holds by construction)", () => {
    for (const name of COMPOSITION_TRANSITIONS) {
      const lines = TRANSITION_RECIPES[name].emit(CTX).join("\n");
      for (const rule of FORBIDDEN_SCRIPT_PATTERNS) {
        expect(rule.pattern.test(lines), `${name} vs ${rule.code}`).toBe(false);
      }
    }
  });

  it("cut is motionless with no tail; every moving recipe anchors at the boundary literal", () => {
    expect(TRANSITION_RECIPES.cut.emit(CTX)).toEqual([]);
    expect(TRANSITION_RECIPES.cut.tailSec).toBe(0);
    for (const name of COMPOSITION_TRANSITIONS.filter((n) => n !== "cut")) {
      const recipe = TRANSITION_RECIPES[name];
      expect(recipe.tailSec).toBeGreaterThan(0);
      expect(recipe.emit(CTX).join("\n")).toContain("3.4");
    }
  });

  it("recipes tolerate a missing outgoing scene (an opening transition tweens only the incoming side)", () => {
    for (const name of COMPOSITION_TRANSITIONS) {
      const lines = TRANSITION_RECIPES[name].emit({ ...CTX, outSel: null }).join("\n");
      expect(lines).not.toContain("#scene-host-0");
    }
  });

  it("push recipes parameterize by the composition dimensions", () => {
    expect(TRANSITION_RECIPES.push.emit(CTX).join("\n")).toContain("{ x: 1920 }");
    expect(TRANSITION_RECIPES["push-up"].emit({ ...CTX, height: 1920 }).join("\n")).toContain("{ y: 1920 }");
  });

  it("defaultTransition cycles deterministically and never transitions the opening scene", () => {
    expect(defaultTransition(0)).toBe("cut");
    expect(defaultTransition(1)).toBe(DEFAULT_TRANSITION_CYCLE[0]);
    expect(defaultTransition(7)).toBe(DEFAULT_TRANSITION_CYCLE[0]);
    expect(DEFAULT_TRANSITION_CYCLE.every((t) => COMPOSITION_TRANSITIONS.includes(t))).toBe(true);
  });
});
