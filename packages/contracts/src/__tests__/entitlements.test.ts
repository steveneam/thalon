import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  ENTITLEMENT_FEATURES,
  entitlementOverrideSchema,
  isEntitled,
  planTierSchema,
  PLAN_TIERS,
  SOCIAL_MAX_POSTS_PER_DAY_CEILING,
  socialCadenceSchema,
  socialPublishConfigSchema,
  SOCIAL_PLATFORMS,
  sweepScheduleConfigSchema,
} from "..";

describe("entitlements contracts (Sprint-8 window)", () => {
  it("pins the founder's s64 defaults: templates + CRM are founder-only or highest tier", () => {
    for (const feature of ENTITLEMENT_FEATURES) {
      expect(DEFAULT_PLAN_ENTITLEMENTS[feature]).toEqual(["internal", "max"]);
    }
    // every defaults entry names only real tiers
    for (const tiers of Object.values(DEFAULT_PLAN_ENTITLEMENTS)) {
      for (const t of tiers) expect(PLAN_TIERS).toContain(t);
    }
  });

  it("isEntitled: tier default decides absent an override; an override always wins", () => {
    expect(isEntitled("internal", "crm")).toBe(true);
    expect(isEntitled("max", "sites_templates")).toBe(true);
    expect(isEntitled("starter", "crm")).toBe(false);
    expect(isEntitled("growth", "sites_templates")).toBe(false);
    // Sprint-8 window 2: social publishing joins the ladder on the same conservative default.
    expect(isEntitled("internal", "social_publishing")).toBe(true);
    expect(isEntitled("max", "social_publishing")).toBe(true);
    expect(isEntitled("growth", "social_publishing")).toBe(false);
    expect(isEntitled("starter", "crm", [{ feature: "crm", enabled: true }])).toBe(true);
    expect(isEntitled("max", "crm", [{ feature: "crm", enabled: false }])).toBe(false);
    // an override for a DIFFERENT feature changes nothing
    expect(isEntitled("starter", "crm", [{ feature: "sites_templates", enabled: true }])).toBe(
      false,
    );
  });

  it("validates at the boundary: unknown tiers and features fail loud", () => {
    expect(() => planTierSchema.parse("enterprise")).toThrow();
    expect(() =>
      entitlementOverrideSchema.parse({ feature: "everything", enabled: true }),
    ).toThrow();
    expect(entitlementOverrideSchema.parse({ feature: "crm", enabled: false })).toEqual({
      feature: "crm",
      enabled: false,
    });
  });
});

describe("social contracts (Sprint-8 window)", () => {
  it("caps per-platform daily posting at the executable ceiling", () => {
    expect(socialCadenceSchema.parse({}).maxPostsPerDay).toBe(1);
    expect(
      socialCadenceSchema.parse({ maxPostsPerDay: SOCIAL_MAX_POSTS_PER_DAY_CEILING })
        .maxPostsPerDay,
    ).toBe(SOCIAL_MAX_POSTS_PER_DAY_CEILING);
    expect(() =>
      socialCadenceSchema.parse({ maxPostsPerDay: SOCIAL_MAX_POSTS_PER_DAY_CEILING + 1 }),
    ).toThrow();
    expect(() => socialCadenceSchema.parse({ maxPostsPerDay: 1.5 })).toThrow();
  });

  it("config block: absent platforms stay absent (unarmed), configured ones validate", () => {
    expect(socialPublishConfigSchema.parse({})).toEqual({});
    const cfg = socialPublishConfigSchema.parse({ linkedin: { maxPostsPerDay: 2 } });
    expect(cfg.linkedin?.maxPostsPerDay).toBe(2);
    expect(cfg.x).toBeUndefined();
    // the config block covers exactly the platform list — additivity guard
    for (const p of SOCIAL_PLATFORMS) {
      expect(Object.keys(socialPublishConfigSchema.shape)).toContain(p);
    }
  });
});

describe("sweep schedule contracts (Sprint-8 window)", () => {
  it("defaults to disabled at the 4-hour stamp cadence; bounds are enforced", () => {
    expect(sweepScheduleConfigSchema.parse({})).toEqual({ enabled: false, cadenceMinutes: 240 });
    expect(() => sweepScheduleConfigSchema.parse({ cadenceMinutes: 14 })).toThrow();
    expect(() => sweepScheduleConfigSchema.parse({ cadenceMinutes: 1441 })).toThrow();
    expect(sweepScheduleConfigSchema.parse({ enabled: true, cadenceMinutes: 15 })).toEqual({
      enabled: true,
      cadenceMinutes: 15,
    });
  });
});
