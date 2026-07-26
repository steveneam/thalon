import { describe, expect, it } from "vitest";
import {
  PREVIEW_BASE,
  contentTypeFor,
  hasExtension,
  previewUrl,
  safePreviewSegments,
  sitePageUrl,
} from "../preview";

/**
 * The preview seam. The rule these pin: NO PREVIEW URL IS EVER ABSOLUTE.
 * An absolute origin is correct on the machine that wrote it and broken on
 * every other one — the s75 founder report — so the surfaces build relative,
 * same-origin URLs and the route resolves the upstream server-side.
 */
describe("site preview URLs", () => {
  it("are same-origin and relative, never an origin the viewer has to share", () => {
    expect(PREVIEW_BASE.startsWith("/")).toBe(true);
    expect(previewUrl("sparkwright/assets/hero.webp")).toBe(
      "/api/sites/preview/sparkwright/assets/hero.webp",
    );
    // A catalog path that already carries a leading slash must not double it.
    expect(previewUrl("/sparkwright/assets/hero.webp")).toBe(
      "/api/sites/preview/sparkwright/assets/hero.webp",
    );
    expect(previewUrl("x.webp")).not.toMatch(/^https?:|127\.0\.0\.1/);
  });

  it("name a page by its document, so the page's own relative links resolve", () => {
    // Next strips a trailing slash before a route handler runs, so `…/guide/`
    // could not carry the directory — `index.html` does.
    expect(sitePageUrl("sparkwright")).toBe("/api/sites/preview/sparkwright/index.html");
    expect(sitePageUrl("sparkwright", "guide")).toBe(
      "/api/sites/preview/sparkwright/guide/index.html",
    );
  });
});

describe("safePreviewSegments (path containment)", () => {
  it("passes an ordinary portfolio path through", () => {
    expect(safePreviewSegments(["sparkwright", "assets", "hero.webp"])).toEqual([
      "sparkwright",
      "assets",
      "hero.webp",
    ]);
  });

  it("refuses anything that could reach outside the portfolio", () => {
    // Next has already percent-decoded, so `%2e%2e` arrives as `..` here.
    expect(safePreviewSegments(["..", "etc", "passwd"])).toBeNull();
    expect(safePreviewSegments(["sparkwright", "..", "..", ".env"])).toBeNull();
    expect(safePreviewSegments(["."])).toBeNull();
    expect(safePreviewSegments(["a/b"])).toBeNull();
    expect(safePreviewSegments(["a\\b"])).toBeNull();
    expect(safePreviewSegments(["hero\0.webp"])).toBeNull();
    expect(safePreviewSegments([""])).toBeNull();
    expect(safePreviewSegments([])).toBeNull();
  });
});

describe("the closed content-type set", () => {
  it("names the kinds the portfolio actually ships", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("hero.webp")).toBe("image/webp");
    expect(contentTypeFor("public-sans.woff2")).toBe("font/woff2");
    expect(contentTypeFor("manifest.json")).toBe("application/json; charset=utf-8");
    expect(contentTypeFor("main.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("HERO.WEBP")).toBe("image/webp");
  });

  it("fails closed on everything else — the route can never be talked wider", () => {
    expect(contentTypeFor("secrets.pem")).toBeNull();
    expect(contentTypeFor("backup.sql")).toBeNull();
    expect(contentTypeFor(".env")).toBeNull();
    expect(contentTypeFor("LICENSE")).toBeNull();
  });

  it("tells a missing extension apart from an unknown one (page vs refusal)", () => {
    expect(hasExtension("guide")).toBe(false);
    expect(hasExtension("sparkwright")).toBe(false);
    expect(hasExtension("hero.webp")).toBe(true);
    expect(hasExtension("secrets.pem")).toBe(true);
  });
});
