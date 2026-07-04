import { describe, expect, it } from "vitest";
import {
  assertPathAllowed,
  isPathAllowed,
  parseRobotsTxt,
  RobotsDisallowedError,
} from "../robots";

describe("parseRobotsTxt + isPathAllowed (B2.5 stage 1, pure core)", () => {
  it("allows everything when there is no robots.txt at all", () => {
    const rules = parseRobotsTxt("");
    expect(isPathAllowed(rules, "ThalonDemoBot", "/anything")).toBe(true);
  });

  it("respects a Disallow for the wildcard user-agent", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /admin"].join("\n"));
    expect(isPathAllowed(rules, "ThalonDemoBot", "/admin/settings")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/blog")).toBe(true);
  });

  it("prefers a specific user-agent group over the wildcard group", () => {
    const rules = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /",
        "",
        "User-agent: ThalonDemoBot",
        "Disallow: /admin",
      ].join("\n"),
    );
    // The specific group has no blanket Disallow: / — only /admin is blocked.
    expect(isPathAllowed(rules, "ThalonDemoBot", "/blog")).toBe(true);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/admin/x")).toBe(false);
    // A DIFFERENT user-agent still falls back to the wildcard group's blanket block.
    expect(isPathAllowed(rules, "SomeOtherBot", "/blog")).toBe(false);
  });

  it("the longest matching path prefix wins, regardless of directive order", () => {
    const rules = parseRobotsTxt(
      ["User-agent: *", "Disallow: /docs", "Allow: /docs/public"].join("\n"),
    );
    expect(isPathAllowed(rules, "ThalonDemoBot", "/docs/private")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/docs/public/page")).toBe(true);
  });

  it("an empty Disallow value is the standard no-op (allow everything)", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow:"].join("\n"));
    expect(isPathAllowed(rules, "ThalonDemoBot", "/anything")).toBe(true);
  });

  it("ignores unknown directives (Sitemap, Crawl-delay) and comments", () => {
    const rules = parseRobotsTxt(
      [
        "# a comment",
        "User-agent: *",
        "Crawl-delay: 10",
        "Disallow: /private",
        "Sitemap: https://example.test/sitemap.xml",
      ].join("\n"),
    );
    expect(isPathAllowed(rules, "ThalonDemoBot", "/private/page")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/public")).toBe(true);
  });

  it("two consecutive User-agent lines with no rules between them share the same group", () => {
    const rules = parseRobotsTxt(
      ["User-agent: ThalonDemoBot", "User-agent: OtherBot", "Disallow: /shared"].join("\n"),
    );
    expect(isPathAllowed(rules, "ThalonDemoBot", "/shared/x")).toBe(false);
    expect(isPathAllowed(rules, "OtherBot", "/shared/x")).toBe(false);
  });

  it("is deterministic: identical input always parses to an equal structure", () => {
    const text = ["User-agent: *", "Disallow: /a", "Allow: /a/b"].join("\n");
    expect(parseRobotsTxt(text)).toEqual(parseRobotsTxt(text));
  });

  it("merges rules from ALL groups matching one specific user-agent, even non-adjacent ones", () => {
    // ThalonDemoBot's rules are split across two groups with an unrelated
    // agent's group in between — both Disallows must still apply.
    const rules = parseRobotsTxt(
      [
        "User-agent: ThalonDemoBot",
        "Disallow: /admin",
        "",
        "User-agent: SomeOtherBot",
        "Disallow: /other",
        "",
        "User-agent: ThalonDemoBot",
        "Disallow: /blog",
      ].join("\n"),
    );
    expect(isPathAllowed(rules, "ThalonDemoBot", "/admin/settings")).toBe(false);
    // Before the fix, only the FIRST matching group's rules were honored —
    // this second group's Disallow was silently ignored (fail-open).
    expect(isPathAllowed(rules, "ThalonDemoBot", "/blog/post-1")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/docs")).toBe(true);
    // SomeOtherBot's own rule never leaks onto ThalonDemoBot.
    expect(isPathAllowed(rules, "ThalonDemoBot", "/other")).toBe(true);
    expect(isPathAllowed(rules, "SomeOtherBot", "/other")).toBe(false);
  });

  it("merges rules from ALL wildcard groups when no specific-agent group exists", () => {
    const rules = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /admin",
        "",
        "User-agent: SomeOtherBot",
        "Disallow: /other",
        "",
        "User-agent: *",
        "Disallow: /blog",
      ].join("\n"),
    );
    expect(isPathAllowed(rules, "ThalonDemoBot", "/admin/settings")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/blog/post-1")).toBe(false);
    expect(isPathAllowed(rules, "ThalonDemoBot", "/docs")).toBe(true);
  });
});

describe("assertPathAllowed (CHARTER B2.5 safety invariant: refuse loudly, never silently skip)", () => {
  it("throws RobotsDisallowedError, naming the url and user-agent, for a disallowed path", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /blog"].join("\n"));
    expect(() =>
      assertPathAllowed(rules, "ThalonDemoBot", "/blog/post-1", "https://example.test/blog/post-1"),
    ).toThrow(RobotsDisallowedError);
    try {
      assertPathAllowed(rules, "ThalonDemoBot", "/blog", "https://example.test/blog");
      expect.fail("expected assertPathAllowed to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RobotsDisallowedError);
      expect((err as RobotsDisallowedError).url).toBe("https://example.test/blog");
      expect((err as RobotsDisallowedError).userAgent).toBe("ThalonDemoBot");
    }
  });

  it("does not throw for an allowed path", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /blog"].join("\n"));
    expect(() =>
      assertPathAllowed(rules, "ThalonDemoBot", "/docs", "https://example.test/docs"),
    ).not.toThrow();
  });
});
