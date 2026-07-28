import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

/**
 * The landing ↔ workspace seam (s84, founder: "create a proper link between
 * them so you and i can navigate between them"). BOTH doors already existed —
 * the site header's "Workspace" link and the rail's brand mark — but the way
 * HOME was a redirect loop in dev, which is indistinguishable from no link.
 *
 * Root cause: Next's `missing` query matcher counts an EMPTY-VALUED key as
 * absent, so the documented `/?landing` escape hatch matched the very rule it
 * was meant to escape and bounced to `/app?landing=`. Driven, not reasoned:
 * `?landing` and `?landing=` both 307'd; `?landing=1` served 200.
 *
 * These pin the contract in both halves so the loop cannot come back.
 */
describe("the dev landing escape hatch", () => {
  it("the root redirect is DEV-ONLY and yields to the landing flag", async () => {
    const rules = await nextConfig.redirects!();
    // Production must never redirect the landing away — the stealth posture
    // and the public site both live at "/".
    const prod = process.env.NODE_ENV;
    expect(prod === "development" ? rules.length : rules.length === 0).toBeTruthy();
    for (const rule of rules) {
      expect(rule.source).toBe("/");
      expect(rule.permanent).toBe(false);
      expect(rule.missing).toEqual([{ type: "query", key: "landing" }]);
    }
  });

  it("the rail's landing href carries a VALUE, not a bare flag — a bare flag re-matches the rule and loops", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../components/workspace/workspace-rail.tsx", import.meta.url),
        "utf8",
      ),
    );
    const href = src.match(/const LANDING_HREF\s*=[^;]+;/)?.[0] ?? "";
    expect(href).toContain('"/"'); // production stays the bare root
    expect(href).toMatch(/\/\?landing=[^"']+/); // dev flag must be VALUED
    expect(href).not.toMatch(/["']\/\?landing["']/); // the bare flag is the bug
  });
});
