import { describe, expect, it } from "vitest";
import { resolveRoutedPlatforms } from "../routing";

const DEFAULTS = ["linkedin", "x"];

describe("resolveRoutedPlatforms (B7.e — pure resolution semantics)", () => {
  it("no bucket ⇒ the caller's platforms, untouched (absence disarms)", () => {
    expect(resolveRoutedPlatforms({ launch: ["bluesky"] }, undefined, DEFAULTS)).toEqual({
      platforms: DEFAULTS,
      routed: false,
    });
  });

  it("no routing config (null or undefined column) ⇒ the caller's platforms", () => {
    expect(resolveRoutedPlatforms(null, "launch", DEFAULTS)).toEqual({
      platforms: DEFAULTS,
      routed: false,
    });
    expect(resolveRoutedPlatforms(undefined, "launch", DEFAULTS)).toEqual({
      platforms: DEFAULTS,
      routed: false,
    });
  });

  it("a routed bucket replaces the defaults", () => {
    expect(resolveRoutedPlatforms({ launch: ["bluesky", "youtube"] }, "launch", DEFAULTS)).toEqual({
      platforms: ["bluesky", "youtube"],
      routed: true,
    });
  });

  it("an unrouted bucket keeps the default behavior", () => {
    expect(resolveRoutedPlatforms({ launch: ["bluesky"] }, "weekly-recap", DEFAULTS)).toEqual({
      platforms: DEFAULTS,
      routed: false,
    });
  });

  it("an EMPTY entry falls back — suppression is not a routing decision", () => {
    expect(resolveRoutedPlatforms({ launch: [] }, "launch", DEFAULTS)).toEqual({
      platforms: DEFAULTS,
      routed: false,
    });
  });

  it("routed platform lists are deduped", () => {
    expect(resolveRoutedPlatforms({ launch: ["x", "x", "bluesky"] }, "launch", DEFAULTS)).toEqual({
      platforms: ["x", "bluesky"],
      routed: true,
    });
  });

  it("malformed routing config fails LOUD (validated at the write door; silent misroutes forbidden)", () => {
    expect(() => resolveRoutedPlatforms({ launch: "not-an-array" }, "launch", DEFAULTS)).toThrow();
    expect(() => resolveRoutedPlatforms({ launch: [""] }, "launch", DEFAULTS)).toThrow();
  });
});
