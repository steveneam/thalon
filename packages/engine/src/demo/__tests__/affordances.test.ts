import { describe, expect, it } from "vitest";
import { extractAffordances } from "../affordances";

describe("extractAffordances (B2.5 stage 2, pure core)", () => {
  it("extracts a nav link, preferring an id-based selector when present", () => {
    const html = `<a id="docs-link" href="/docs">Docs</a>`;
    expect(extractAffordances(html)).toEqual([
      { kind: "nav_link", selector: "#docs-link", label: "Docs" },
    ]);
  });

  it("falls back to an href-based selector when no id is present", () => {
    const html = `<a href="/blog">Blog</a>`;
    expect(extractAffordances(html)).toEqual([
      { kind: "nav_link", selector: 'a[href="/blog"]', label: "Blog" },
    ]);
  });

  it("skips fragment-only and javascript: links", () => {
    const html = `<a href="#top">Top</a><a href="javascript:void(0)">JS</a>`;
    expect(extractAffordances(html)).toEqual([]);
  });

  it("extracts a form, preferring id then action then a positional fallback", () => {
    const html = [
      `<form id="search-form" action="/search"></form>`,
      `<form action="/subscribe"></form>`,
      `<form></form>`,
    ].join("");
    expect(extractAffordances(html)).toEqual([
      { kind: "form", selector: "#search-form", label: "/search" },
      { kind: "form", selector: 'form[action="/subscribe"]', label: "/subscribe" },
      { kind: "form", selector: "form:nth-of-type(3)", label: "form" },
    ]);
  });

  it("extracts a search input with its placeholder as the label", () => {
    const html = `<input type="search" name="q" placeholder="Search the docs" />`;
    expect(extractAffordances(html)).toEqual([
      { kind: "input", selector: 'input[name="q"]', label: "Search the docs" },
    ]);
  });

  it("excludes hidden, submit, and button inputs", () => {
    const html = [
      `<input type="hidden" name="csrf" value="x" />`,
      `<input type="submit" value="Go" />`,
      `<input type="button" value="Cancel" />`,
    ].join("");
    expect(extractAffordances(html)).toEqual([]);
  });

  it("prefers an id-based selector over name for inputs", () => {
    const html = `<input id="search-box" type="text" name="query" />`;
    expect(extractAffordances(html)).toEqual([
      { kind: "input", selector: "#search-box", label: "query" },
    ]);
  });

  it("is deterministic: identical html always produces identical affordances", () => {
    const html = `<a href="/a">A</a><form action="/b"></form><input type="search" name="q" />`;
    expect(extractAffordances(html)).toEqual(extractAffordances(html));
  });
});
