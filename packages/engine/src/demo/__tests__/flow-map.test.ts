import { describe, expect, it } from "vitest";
import { deriveFlowMap, flowMapPageUrls, flowMapSelectors } from "../flow-map";

describe("deriveFlowMap (B2.5 stage 2, pure core)", () => {
  const pages = [
    {
      url: "https://example.test/",
      html: `<a id="docs-link" href="/docs">Docs</a><input type="search" name="q" placeholder="Search" />`,
    },
    {
      url: "https://example.test/docs",
      html: `<a href="/docs/page2">Page 2</a><a href="/">Home</a>`,
    },
  ];

  it("derives per-page links and affordances", () => {
    const flowMap = deriveFlowMap(pages);
    expect(flowMap.pages).toHaveLength(2);
    expect(flowMap.pages[0]).toEqual({
      url: "https://example.test/",
      links: ["https://example.test/docs"],
      affordances: [
        { kind: "nav_link", selector: "#docs-link", label: "Docs" },
        { kind: "input", selector: 'input[name="q"]', label: "Search" },
      ],
    });
    expect(flowMap.pages[1].links).toEqual([
      "https://example.test/docs/page2",
      "https://example.test/",
    ]);
  });

  it("is deterministic: identical pages always produce an equal flow map", () => {
    expect(deriveFlowMap(pages)).toEqual(deriveFlowMap(pages));
  });

  it("flowMapPageUrls returns every page's URL", () => {
    expect(flowMapPageUrls(deriveFlowMap(pages))).toEqual([
      "https://example.test/",
      "https://example.test/docs",
    ]);
  });

  it("flowMapSelectors returns every affordance selector across every page, de-duplicated", () => {
    // pages[1]'s own <a> tags are nav_link affordances too — re-adding
    // pages[0]'s html as a third page contributes no NEW selectors (dedup).
    const dupPages = [...pages, { url: "https://example.test/docs2", html: pages[0].html }];
    const selectors = flowMapSelectors(deriveFlowMap(dupPages));
    expect(selectors).toEqual([
      "#docs-link",
      'input[name="q"]',
      'a[href="/docs/page2"]',
      'a[href="/"]',
    ]);
  });
});
