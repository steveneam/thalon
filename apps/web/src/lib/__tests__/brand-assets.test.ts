import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ASSETS } from "@/lib/brand-assets";

/**
 * B7.2 pins: every manifest entry's derived file must exist in public/brand
 * (the export script is the only writer), and every entry must carry the
 * provenance link back to its pinned original. Structural pins — the visual
 * judgment lives in the iteration passes, not here.
 */
describe("brand-assets manifest (B7.2)", () => {
  const publicDir = path.resolve(__dirname, "../../../public");

  it.each(Object.entries(BRAND_ASSETS))("%s: derived file exists and is linked to a pin", (_name, asset) => {
    expect(existsSync(path.join(publicDir, asset.src))).toBe(true);
    expect(asset.pinnedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
  });
});
