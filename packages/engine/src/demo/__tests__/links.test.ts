import { describe, expect, it } from "vitest";
import { extractLinks } from "../links";

describe("extractLinks (B2.5, pure core)", () => {
  const PAGE_URL = "https://example.test/docs";

  it("resolves relative hrefs against the page URL", () => {
    const html = `<a href="/blog">Blog</a><a href="page2">Page 2</a>`;
    expect(extractLinks(html, PAGE_URL)).toEqual([
      "https://example.test/blog",
      "https://example.test/page2",
    ]);
  });

  it("keeps only same-origin links", () => {
    const html = `<a href="/docs/x">Same origin</a><a href="https://external.test/y">External</a>`;
    expect(extractLinks(html, PAGE_URL)).toEqual(["https://example.test/docs/x"]);
  });

  it("drops fragment-only, mailto, javascript, and tel links", () => {
    const html = [
      `<a href="#section">Jump</a>`,
      `<a href="mailto:a@example.test">Email</a>`,
      `<a href="javascript:void(0)">JS</a>`,
      `<a href="tel:+1234567890">Call</a>`,
    ].join("");
    expect(extractLinks(html, PAGE_URL)).toEqual([]);
  });

  it("strips the fragment from an otherwise-valid link and de-duplicates", () => {
    const html = `<a href="/docs/page#a">A</a><a href="/docs/page#b">B</a><a href="/docs/page">C</a>`;
    expect(extractLinks(html, PAGE_URL)).toEqual(["https://example.test/docs/page"]);
  });

  it("is deterministic and preserves document order", () => {
    const html = `<a href="/c">C</a><a href="/a">A</a><a href="/b">B</a>`;
    const first = extractLinks(html, PAGE_URL);
    const second = extractLinks(html, PAGE_URL);
    expect(second).toEqual(first);
    expect(first).toEqual([
      "https://example.test/c",
      "https://example.test/a",
      "https://example.test/b",
    ]);
  });

  it("ignores an unparseable absolute href instead of throwing", () => {
    // An absolute "http:"-scheme URL with a malformed (unterminated IPv6)
    // host is fatal even with a base — unlike a merely-odd relative path,
    // which resolves fine against pageUrl.
    const html = `<a href="http://[::1">Bad</a><a href="/ok">Ok</a>`;
    expect(extractLinks(html, PAGE_URL)).toEqual(["https://example.test/ok"]);
  });
});
