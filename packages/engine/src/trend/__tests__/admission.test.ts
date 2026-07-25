import { describe, expect, it } from "vitest";
import {
  admissionConfigSchema,
  admissionOrigin,
  decideAdmission,
  resolveAdmissionKnobs,
} from "../admission";
import type { LongitudinalScore } from "../longitudinal";
import type { TrendItem } from "../trend-source";

/** A body comfortably over the default 140-char floor. */
const LONG_BODY =
  "A worked hook pattern with a full body: the promise, the proof, the pivot, and the payoff — written out at enough length that a bare headline could never pass for it.";

function item(overrides: Partial<TrendItem> = {}): TrendItem {
  return {
    externalId: "x1",
    text: LONG_BODY,
    account: "alpha",
    publishedAt: 1_750_000_000_000,
    metrics: { views: 50_000 },
    ...overrides,
  };
}

function delta(deltaVelocity: number | null, baselineDeltaVelocity: number | null): LongitudinalScore {
  return { deltaVelocity, baselineDeltaVelocity, reasons: [], isOutlier: false };
}

const DEFAULTS = admissionConfigSchema.parse({}).defaults;

describe("admission config (B-learn L1 knobs as data)", () => {
  it("parses {} to the conservative armed defaults — tenant defaults only since the L0 window", () => {
    expect(admissionConfigSchema.parse({})).toEqual({
      defaults: {
        enabled: true,
        floors: { views: 10_000 },
        velocityMultiple: 4,
        minBodyLength: 140,
        maxAdmissionsPerDay: 20,
      },
    });
  });

  it("resolves the area ROW's override field-by-field — an unset field keeps the tenant default", () => {
    const { defaults } = admissionConfigSchema.parse({ defaults: { floors: { likes: 500 } } });
    expect(resolveAdmissionKnobs(defaults, { maxAdmissionsPerDay: 3 })).toEqual({
      enabled: true,
      floors: { likes: 500 }, // tenant default kept
      velocityMultiple: 4,
      minBodyLength: 140,
      maxAdmissionsPerDay: 3, // area override applied
    });
    // An area with no admission block resolves to the tenant defaults verbatim.
    expect(resolveAdmissionKnobs(defaults, undefined)).toEqual(defaults);
  });

  it("rejects malformed knobs loud (negative floor, zero multiple)", () => {
    expect(admissionConfigSchema.safeParse({ defaults: { floors: { views: -1 } } }).success).toBe(false);
    expect(admissionConfigSchema.safeParse({ defaults: { velocityMultiple: 0 } }).success).toBe(false);
  });

  it("rejects the removed request-level areas map LOUD — per-area knobs are area data now, never silently dropped", () => {
    expect(
      admissionConfigSchema.safeParse({ areas: { "area-1": { maxAdmissionsPerDay: 3 } } }).success,
    ).toBe(false);
  });
});

describe("decideAdmission (pure — no clock, no db)", () => {
  it("admits on floors alone when the Δ-velocity baseline is unarmed, and says so", () => {
    const decision = decideAdmission(item(), undefined, DEFAULTS);
    expect(decision.admit).toBe(true);
    expect(decision.reasons).toEqual([
      expect.stringContaining("body length"),
      "views 50000 ≥ floor 10000",
      expect.stringContaining("baseline unarmed"),
    ]);
  });

  it("rejects a bare headline on body length before anything else", () => {
    const decision = decideAdmission(
      item({ text: "Breaking: markets move on a rumor", metrics: { views: 900_000 } }),
      undefined,
      DEFAULTS,
    );
    expect(decision).toMatchObject({ admit: false, rejectedBy: "bodyLength" });
  });

  it("fails CLOSED when a floor metric is not reported — the Bluesky area-feed default", () => {
    const decision = decideAdmission(
      item({ metrics: { likes: 5_000, reposts: 900 } }), // no "views" counter on this platform
      undefined,
      DEFAULTS,
    );
    expect(decision).toMatchObject({ admit: false, rejectedBy: "floors" });
    expect(decision.reasons[0]).toContain('metric "views" is not reported');
  });

  it("rejects under-floor metrics, naming the number and the knob", () => {
    const decision = decideAdmission(item({ metrics: { views: 2_000 } }), undefined, DEFAULTS);
    expect(decision).toMatchObject({ admit: false, rejectedBy: "floors" });
    expect(decision.reasons[0]).toBe("views 2000 is under the 10000 floor");
  });

  it("an ARMED baseline binds the velocity multiple — the steady news-bot firehose is rejected", () => {
    // The bot's own volume arms its baseline; uniform velocity is no outlier.
    const rejected = decideAdmission(item(), delta(5_000, 5_000), DEFAULTS);
    expect(rejected).toMatchObject({ admit: false, rejectedBy: "velocity" });

    const admitted = decideAdmission(item(), delta(20_000, 5_000), DEFAULTS);
    expect(admitted.admit).toBe(true);
    expect(admitted.reasons).toContain(
      "Δ-velocity 20000/h is ≥ 4× the account's stored baseline 5000/h",
    );
  });

  it("a measurable Δ with an UNARMED baseline falls through to the floors (one-off viral poster)", () => {
    const decision = decideAdmission(item(), delta(20_000, null), DEFAULTS);
    expect(decision.admit).toBe(true);
    expect(decision.reasons.some((r) => r.includes("baseline unarmed"))).toBe(true);
  });

  it("a disabled area admits nothing", () => {
    const decision = decideAdmission(item(), undefined, { ...DEFAULTS, enabled: false });
    expect(decision).toMatchObject({ admit: false, rejectedBy: "disabled" });
  });

  it("every named floor must pass, not just the first", () => {
    const knobs = { ...DEFAULTS, floors: { views: 10_000, likes: 1_000 } };
    const decision = decideAdmission(item({ metrics: { views: 50_000, likes: 10 } }), undefined, knobs);
    expect(decision).toMatchObject({ admit: false, rejectedBy: "floors" });
  });
});

describe("admissionOrigin", () => {
  it("stamps the area id — the daily-cap count and provenance key", () => {
    expect(admissionOrigin("11111111-1111-1111-1111-111111111111")).toBe(
      "auto-admission:11111111-1111-1111-1111-111111111111",
    );
  });
});
