import { describe, expect, it } from "vitest";
import { cadenceConfigSchema, routingTableSchema } from "../brand-profile";
import {
  assertLeadTransition,
  canLeadTransition,
  icpSchema,
  InvalidLeadTransitionError,
  leadInputSchema,
  leadRankerWeightOverridesSchema,
  leadRankerWeightsSchema,
  leadScoreRecordSchema,
  leadWeightMultipliersSchema,
  leadWeightStateRecordSchema,
  normalizeLeadEmail,
} from "../leads";

describe("lead intake shape (B-crm.1)", () => {
  it("normalization is the ONE identity: case/whitespace variants collapse; storage keeps the supplied casing", () => {
    expect(normalizeLeadEmail("  Jane.Doe@ACME.com ")).toBe("jane.doe@acme.com");
    const parsed = leadInputSchema.parse({ source: "csv", email: " Jane.Doe@Acme.com " });
    expect(parsed.email).toBe("Jane.Doe@Acme.com"); // trimmed, casing preserved
    expect(parsed.meta).toEqual({});
  });

  it("email is required and must be an address; provenance must be a sanctioned source", () => {
    expect(leadInputSchema.safeParse({ source: "csv", email: "not-an-email" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ source: "csv" }).success).toBe(false);
    // No scraped/purchased provenance exists in the vocabulary — structural.
    expect(leadInputSchema.safeParse({ source: "scraped", email: "a@b.co" }).success).toBe(false);
  });

  it("status rulebook: new→scored, new/scored→dismissed; dismissed is terminal until B-crm.4", () => {
    expect(canLeadTransition("new", "scored")).toBe(true);
    expect(canLeadTransition("new", "dismissed")).toBe(true);
    expect(canLeadTransition("scored", "dismissed")).toBe(true);
    expect(canLeadTransition("scored", "new")).toBe(false);
    expect(canLeadTransition("dismissed", "new")).toBe(false);
    expect(() => assertLeadTransition("dismissed", "scored")).toThrow(InvalidLeadTransitionError);
  });
});

describe("ICP block + scorer weights (B-crm.2)", () => {
  it("weights default every signal to 1 and reject negatives; zero is legal config", () => {
    expect(leadRankerWeightsSchema.parse({})).toEqual({
      relevance: 1,
      fit: 1,
      completeness: 1,
      recency: 1,
    });
    expect(leadRankerWeightsSchema.safeParse({ fit: -1 }).success).toBe(false);
    expect(leadRankerWeightsSchema.parse({ recency: 0 }).recency).toBe(0);
  });

  it("overrides do NOT fill defaults — unset signals defer to the code defaults (the zod-4 .partial() trap)", () => {
    expect(leadRankerWeightOverridesSchema.parse({ relevance: 2 })).toEqual({ relevance: 2 });
  });

  it("an ICP needs a non-empty description — it is the relevance-embedding anchor", () => {
    const icp = icpSchema.parse({ description: "Owner-operated local service businesses" });
    expect(icp.verticals).toEqual([]);
    expect(icp.dealbreakers).toEqual([]);
    expect(icpSchema.safeParse({ description: "" }).success).toBe(false);
    expect(icpSchema.safeParse({}).success).toBe(false);
  });

  it("companySize bounds must be coherent positive ints", () => {
    expect(icpSchema.parse({ description: "x", companySize: { min: 1, max: 20 } }).companySize).toEqual(
      { min: 1, max: 20 },
    );
    expect(icpSchema.safeParse({ description: "x", companySize: { min: 20, max: 1 } }).success).toBe(
      false,
    );
    expect(icpSchema.safeParse({ description: "x", companySize: { min: 0 } }).success).toBe(false);
  });

  it("score records: score in [0,1], profile hash required, reasons readable strings", () => {
    const record = leadScoreRecordSchema.parse({ score: 0.7, profileHash: "abc" });
    expect(record.reasons).toEqual([]);
    expect(record.signals).toEqual({});
    expect(leadScoreRecordSchema.safeParse({ score: 1.01, profileHash: "abc" }).success).toBe(false);
    expect(leadScoreRecordSchema.safeParse({ score: -0.1, profileHash: "abc" }).success).toBe(false);
    expect(leadScoreRecordSchema.safeParse({ score: 0.5, profileHash: "" }).success).toBe(false);
  });
});

describe("learn-loop shapes (B-crm.5)", () => {
  const NEUTRAL = { relevance: 1, fit: 1, completeness: 1, recency: 1 };

  it("multipliers cover all four signals and must be positive — zeroing or inverting a signal is weights config, never the learn loop's call", () => {
    expect(leadWeightMultipliersSchema.parse({ ...NEUTRAL, fit: 2, recency: 0.5 })).toEqual({
      relevance: 1,
      fit: 2,
      completeness: 1,
      recency: 0.5,
    });
    expect(leadWeightMultipliersSchema.safeParse({ ...NEUTRAL, fit: 0 }).success).toBe(false);
    expect(leadWeightMultipliersSchema.safeParse({ ...NEUTRAL, recency: -0.5 }).success).toBe(false);
    expect(leadWeightMultipliersSchema.safeParse({ relevance: 1, fit: 1 }).success).toBe(false);
  });

  it("a weight-state record needs both hashes — profile binding and structural idempotence", () => {
    const record = leadWeightStateRecordSchema.parse({
      multipliers: NEUTRAL,
      profileHash: "hash-a",
      evidenceHash: "evidence-1",
    });
    expect(record.reasons).toEqual([]);
    expect(record.evidence).toEqual({});
    expect(
      leadWeightStateRecordSchema.safeParse({
        multipliers: NEUTRAL,
        profileHash: "",
        evidenceHash: "evidence-1",
      }).success,
    ).toBe(false);
    expect(
      leadWeightStateRecordSchema.safeParse({ multipliers: NEUTRAL, profileHash: "hash-a" })
        .success,
    ).toBe(false);
  });
});

describe("cadence + routing config (B7.a/e)", () => {
  it("cadence rules are per-platform positive ints; an empty rule is legal (no constraint)", () => {
    expect(cadenceConfigSchema.parse({ linkedin: { maxPerDay: 1, maxPerWeek: 5 } })).toEqual({
      linkedin: { maxPerDay: 1, maxPerWeek: 5 },
    });
    expect(cadenceConfigSchema.parse({ x: {} })).toEqual({ x: {} });
    expect(cadenceConfigSchema.safeParse({ x: { maxPerDay: 0 } }).success).toBe(false);
    expect(cadenceConfigSchema.safeParse({ x: { minGapMinutes: 1.5 } }).success).toBe(false);
  });

  it("routing maps bucket names to non-empty platform names", () => {
    expect(routingTableSchema.parse({ "product-updates": ["linkedin", "x"] })).toEqual({
      "product-updates": ["linkedin", "x"],
    });
    expect(routingTableSchema.safeParse({ bucket: [""] }).success).toBe(false);
  });
});
