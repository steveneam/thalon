import { describe, expect, it } from "vitest";
import { loadPlatformProfile } from "../profiles";

describe("loadPlatformProfile (shipped niche/platform profile data, SPINE §2.2)", () => {
  it("loads the shipped LinkedIn profile", () => {
    const loaded = loadPlatformProfile("linkedin");
    expect(loaded).not.toBeNull();
    expect(loaded?.profileVersion).toBe("linkedin.v1");
    expect(loaded?.profile.charLimit).toBeGreaterThan(0);
    expect(loaded?.profile.tone).toBeTruthy();
  });

  it("loads the shipped X profile", () => {
    const loaded = loadPlatformProfile("x");
    expect(loaded).not.toBeNull();
    expect(loaded?.profileVersion).toBe("x.v1");
    expect(loaded?.profile.charLimit).toBe(280);
  });

  it("returns null for a platform with no shipped default", () => {
    expect(loadPlatformProfile("no-such-platform")).toBeNull();
  });
});
