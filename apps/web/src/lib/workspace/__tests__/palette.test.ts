import { describe, expect, it } from "vitest";
import { buildPaletteItems, filterPalette, routeForPrompt } from "@/lib/workspace/palette";

describe("palette", () => {
  it("covers every nav surface plus the cross-surface actions", () => {
    const items = buildPaletteItems();
    const labels = items.map((i) => i.label);
    for (const surface of ["Home", "Intel", "Create", "Approve", "Profiles", "Runs", "Settings"]) {
      expect(labels).toContain(surface);
    }
    expect(items.some((i) => i.group === "actions")).toBe(true);
  });

  it("ranks label prefix above substring above keyword matches", () => {
    const items = buildPaletteItems();
    const results = filterPalette(items, "in");
    expect(results[0].label).toBe("Intel"); // prefix beats "Settings" (keyword) etc.
    // Keyword-only match still findable: "seo" hits the keyword tiers.
    const seo = filterPalette(items, "seo");
    expect(seo.some((i) => i.label === "Intel" || i.label === "Add a keyword target")).toBe(true);
    // No match → empty, never a wrong guess.
    expect(filterPalette(items, "zzzz")).toHaveLength(0);
  });
});

describe("routeForPrompt (omnibox family heuristic)", () => {
  it("routes video-ish prompts to the video family", () => {
    expect(routeForPrompt("a launch video for the engine")).toContain("family=video");
  });
  it("routes page-ish prompts to the page family", () => {
    expect(routeForPrompt("an SEO landing page")).toContain("family=page");
  });
  it("defaults to post and carries the prompt urlencoded", () => {
    const href = routeForPrompt("announce the approve gate");
    expect(href).toContain("family=post");
    expect(href).toContain(encodeURIComponent("announce the approve gate"));
  });
  it("routes an empty prompt to bare create", () => {
    expect(routeForPrompt("  ")).toBe("/app/create");
  });
});
