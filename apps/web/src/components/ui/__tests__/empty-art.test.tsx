// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyArt } from "../empty-art";
import { WORKSPACE_ASSETS } from "@/lib/brand-assets";

/**
 * §W decorative contract (B7.2 step 3): empty-state art never carries
 * semantics — the copy stays the tutorial. If any of these fail, the art has
 * started doing an accessibility or interaction job it must not do.
 */
describe("EmptyArt", () => {
  it("is strictly decorative: aria-hidden, empty alt, no pointer target", () => {
    const { container } = render(<EmptyArt asset="emptyRuns" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("");
    expect(img!.getAttribute("aria-hidden")).toBe("true");
    expect(img!.className).toContain("pointer-events-none");
  });

  it("declares intrinsic dimensions from the manifest (CLS-safe)", () => {
    const { container } = render(<EmptyArt asset="emptyApprove" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe(String(WORKSPACE_ASSETS.emptyApprove.width));
    expect(img.getAttribute("height")).toBe(String(WORKSPACE_ASSETS.emptyApprove.height));
    expect(img.getAttribute("src")).toBe(WORKSPACE_ASSETS.emptyApprove.src);
  });

  it("every workspace asset is a derived /brand/ webp from a pinned svg original", () => {
    for (const [name, asset] of Object.entries(WORKSPACE_ASSETS)) {
      expect(asset.src, name).toMatch(/^\/brand\/[a-z0-9-]+\.webp$/);
      expect(asset.ext, name).toBe("svg");
      expect(asset.pinnedHash, name).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.width, name).toBeGreaterThan(0);
      expect(asset.height, name).toBeGreaterThan(0);
    }
  });
});
