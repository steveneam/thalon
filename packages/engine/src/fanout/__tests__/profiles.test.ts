import { PLATFORM_CAPABILITIES, SOCIAL_PLATFORMS } from "@thalon/contracts";
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

/**
 * s82 window (W1) ratchet — the one invariant tying the two per-platform
 * character numbers together. They are different things on purpose:
 *
 *   - the shipped profile's `charLimit` is an AUTHORING BUDGET, a style
 *     opinion fed to generation (Facebook's is 5000 against a platform that
 *     accepts 63,206 — the gap IS the opinion);
 *   - `PLATFORM_CAPABILITIES[p].text.maxChars` is the platform's CEILING,
 *     what the API will actually accept.
 *
 * A budget may sit anywhere below the ceiling. Above it, generation would
 * quietly start producing posts the platform bounces — a defect that would
 * surface as a mysterious API failure at publish time, long after the edit
 * that caused it. This test is the reason that cannot happen: it fails on the
 * profile bump, in the change that made it.
 */
describe("authoring budget vs capability ceiling (s82 W1 ratchet)", () => {
  it("no shipped profile's charLimit exceeds its platform's hard ceiling", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const loaded = loadPlatformProfile(platform);
      if (!loaded?.profile.charLimit) continue; // no shipped default for this platform
      expect(
        loaded.profile.charLimit,
        `the shipped ${platform} authoring budget (${loaded.profile.charLimit}) exceeds what the platform accepts (${PLATFORM_CAPABILITIES[platform].text.maxChars}) — generation would produce posts the API bounces`,
      ).toBeLessThanOrEqual(PLATFORM_CAPABILITIES[platform].text.maxChars);
    }
  });

  it("covers the platforms that actually ship a profile — a silent skip would prove nothing", () => {
    const covered = SOCIAL_PLATFORMS.filter((p) => loadPlatformProfile(p)?.profile.charLimit);
    expect(covered).toEqual(expect.arrayContaining(["linkedin", "x", "facebook"]));
  });
});
