import { describe, expect, it } from "vitest";
import { brandProfileConfigSchema, cadenceConfigSchema, routingTableSchema } from "../brand-profile";
import { DRAFT_FORMAT_REGISTRY } from "../format-registry";
import {
  assertLeadTransition,
  canLeadTransition,
  consentProvenanceSchema,
  icpSchema,
  InvalidLeadTransitionError,
  leadInputSchema,
  leadRankerWeightOverridesSchema,
  leadRankerWeightsSchema,
  leadScoreRecordSchema,
  leadWeightMultipliersSchema,
  leadWeightStateRecordSchema,
  normalizeLeadEmail,
  outreachSendRecordSchema,
  outreachSequenceSchema,
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

  it("status rulebook: new→scored, new/scored→dismissed; dismissed terminal (base lifecycle)", () => {
    expect(canLeadTransition("new", "scored")).toBe(true);
    expect(canLeadTransition("new", "dismissed")).toBe(true);
    expect(canLeadTransition("scored", "dismissed")).toBe(true);
    expect(canLeadTransition("scored", "new")).toBe(false);
    expect(canLeadTransition("dismissed", "new")).toBe(false);
    expect(() => assertLeadTransition("dismissed", "scored")).toThrow(InvalidLeadTransitionError);
  });

  it("B-crm.4 (s54 window): scored→contacted; unsubscribed is the TERMINAL one-way door from any live state", () => {
    expect(canLeadTransition("scored", "contacted")).toBe(true);
    expect(canLeadTransition("new", "contacted")).toBe(false); // never contact an unscored lead
    expect(canLeadTransition("contacted", "dismissed")).toBe(true);
    expect(canLeadTransition("contacted", "scored")).toBe(false);
    for (const from of ["new", "scored", "contacted"] as const) {
      expect(canLeadTransition(from, "unsubscribed")).toBe(true);
    }
    for (const to of ["new", "scored", "contacted", "dismissed"] as const) {
      expect(canLeadTransition("unsubscribed", to)).toBe(false);
    }
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

describe("consent basis (B-crm.4 s54 window — AU Spam Act invariant 1)", () => {
  it("intake may carry a known basis; omission never grants one (no default fills)", () => {
    const carried = leadInputSchema.parse({
      source: "waitlist",
      email: "a@example.com",
      consentBasis: "express",
      consentProvenance: { note: "waitlist signup" },
    });
    expect(carried.consentBasis).toBe("express");
    const omitted = leadInputSchema.parse({ source: "csv", email: "b@example.com" });
    expect(omitted.consentBasis).toBeUndefined(); // the column default (`none`) decides
    expect(
      leadInputSchema.safeParse({ source: "csv", email: "c@example.com", consentBasis: "assumed" })
        .success,
    ).toBe(false);
  });

  it("provenance is evidence prose — optional fields, but never empty strings", () => {
    expect(consentProvenanceSchema.parse({})).toEqual({});
    expect(consentProvenanceSchema.safeParse({ sourceUrl: "  " }).success).toBe(false);
  });
});

describe("send record + sequence config (B-crm.4 s54 window)", () => {
  it("a send record is a provider-accepted send with its audit snapshots — nothing optional but meta", () => {
    const record = outreachSendRecordSchema.parse({
      leadId: "lead-1",
      draftId: "draft-1",
      provider: "resend",
      providerMessageId: "re_123",
      recipientEmail: "sam@example.com",
      bodyHash: "abc",
      touchIndex: 0,
    });
    expect(record.meta).toEqual({});
    expect(
      outreachSendRecordSchema.safeParse({
        leadId: "lead-1",
        draftId: "draft-1",
        provider: "sendgrid", // not a sanctioned provider
        providerMessageId: "x",
        recipientEmail: "sam@example.com",
        bodyHash: "abc",
        touchIndex: 0,
      }).success,
    ).toBe(false);
  });

  it("sequence defaults: D0/D3/D10/D17, cap 50, Wednesday-weighted weekdays with weekends off", () => {
    const seq = outreachSequenceSchema.parse({});
    expect(seq.touchOffsetsDays).toEqual([0, 3, 10, 17]);
    expect(seq.dailyBatchCap).toBe(50);
    expect(seq.sendDayWeights).toEqual({ mon: 1, tue: 1, wed: 1.5, thu: 1, fri: 1, sat: 0, sun: 0 });
  });

  it("the ceilings are executable: cap never above 50, touches strictly increasing and ≤7", () => {
    expect(outreachSequenceSchema.safeParse({ dailyBatchCap: 51 }).success).toBe(false);
    expect(outreachSequenceSchema.parse({ dailyBatchCap: 10 }).dailyBatchCap).toBe(10); // lower is legal
    expect(outreachSequenceSchema.safeParse({ touchOffsetsDays: [0, 3, 3] }).success).toBe(false);
    expect(
      outreachSequenceSchema.safeParse({ touchOffsetsDays: [0, 1, 2, 3, 4, 5, 6, 7] }).success,
    ).toBe(false);
  });

  it("the brand profile's outreach block is optional and additive — a pre-window config parses byte-identical", () => {
    const preWindow = brandProfileConfigSchema.parse({});
    expect("outreach" in preWindow && preWindow.outreach !== undefined).toBe(false);
    const armed = brandProfileConfigSchema.parse({ outreach: {} });
    expect(armed.outreach?.touchOffsetsDays).toEqual([0, 3, 10, 17]);
  });

  it("exactly outreach_email carries the sendable capability", () => {
    const sendable = Object.values(DRAFT_FORMAT_REGISTRY)
      .filter((spec) => spec.capabilities.sendable)
      .map((spec) => spec.format);
    expect(sendable).toEqual(["outreach_email"]);
  });
});
