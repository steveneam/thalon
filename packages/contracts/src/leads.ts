import { z } from "zod";

/**
 * B-crm.1/2 (amendment A16 / ADR 0008): the leads engine's validated shapes.
 * A lead is an inbound contact captured from an official-API or
 * operator-supplied source ONLY (no scraping, no purchased lists — the
 * acquisition invariant); scoring is deterministic config-weighted math with
 * readable reasons, never a black box. The ICP block that drives scoring
 * lives on the brand profile (brand-profile.ts) as per-tenant runtime
 * config — tenants without one simply have no lead scoring armed.
 */

/** Where a lead entered the funnel — provenance, checked at the schema door. */
export const LEAD_SOURCES = ["waitlist", "csv", "api"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * Deliberately minimal lifecycle (ratified build plan): the
 * contacted/replied state machine arrives with B-crm.4's gated outreach,
 * additively. `dismissed` is terminal for now and is operator signal (the
 * dismissal becomes an eval row), never a delete.
 */
export const LEAD_STATUSES = ["new", "scored", "dismissed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ["scored", "dismissed"],
  scored: ["dismissed"],
  dismissed: [],
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function canLeadTransition(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

export class InvalidLeadTransitionError extends Error {
  constructor(
    public readonly from: LeadStatus,
    public readonly to: LeadStatus,
  ) {
    super(
      `invalid lead transition "${from}" -> "${to}" (allowed from "${from}": ${
        LEAD_TRANSITIONS[from].join(", ") || "none — terminal state"
      })`,
    );
    this.name = "InvalidLeadTransitionError";
  }
}

export function assertLeadTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canLeadTransition(from, to)) throw new InvalidLeadTransitionError(from, to);
}

/**
 * The ONE email normalization for lead identity — the dedupe key is a hash
 * of this (leads.email_hash). Case/whitespace variants of the same address
 * must collapse to one lead; anything cleverer (gmail dots, plus-tags) is
 * deliberately out — those are distinct addresses per RFC and per most CRMs.
 */
export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The validated intake shape — every intake path (waitlist bridge, CSV, api) parses this at the repo write door. */
export const leadInputSchema = z.object({
  source: z.enum(LEAD_SOURCES),
  /** Required — a lead without a reachable address isn't a lead. Stored trimmed as supplied; identity uses normalizeLeadEmail. */
  email: z.string().trim().max(254).pipe(z.email()),
  name: z.string().trim().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  website: z.string().trim().optional(),
  notes: z.string().optional(),
  /** Source-specific extras (waitlist referral context, unmapped CSV columns) — data, open shape. */
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type LeadInput = z.input<typeof leadInputSchema>;
export type ParsedLeadInput = z.infer<typeof leadInputSchema>;

/** Zero is legal ("turn this signal off" is config); negative amplification is not. */
const weight = z.number().min(0);

/**
 * The lead scorer's weights — the trend ranker's EdgeRank shape pointed at
 * revenue (ratified build plan): weight-normalized sum over ARMED signals
 * only, one readable reason per armed signal. Components v1: embedding
 * `relevance` vs icp.description × structured `fit` (verticals/regions/roles,
 * dealbreaker = hard zero) × contact `completeness` × `recency` freshness.
 * Defaults weight every signal equally.
 */
export const leadRankerWeightsSchema = z.object({
  relevance: weight.default(1),
  fit: weight.default(1),
  completeness: weight.default(1),
  recency: weight.default(1),
});
export type LeadRankerWeights = z.infer<typeof leadRankerWeightsSchema>;

/**
 * The per-tenant OVERRIDE shape — deliberately not `leadRankerWeightsSchema.
 * partial()`: a defaulted field still fills on parse (zod 4, test-pinned in
 * intel.test.ts), which would silently pin unset signals to 1 instead of
 * deferring to the code defaults.
 */
export const leadRankerWeightOverridesSchema = z.object({
  relevance: weight.optional(),
  fit: weight.optional(),
  completeness: weight.optional(),
  recency: weight.optional(),
});
export type LeadRankerWeightOverrides = z.infer<typeof leadRankerWeightOverridesSchema>;

const companySizeSchema = z
  .object({
    min: z.number().int().positive().optional(),
    max: z.number().int().positive().optional(),
  })
  .refine((s) => s.min === undefined || s.max === undefined || s.min <= s.max, {
    message: "companySize.min must be <= companySize.max",
  });

/**
 * The tenant's ideal customer profile — per-tenant runtime config on the
 * brand profile (never code). `description` is load-bearing data: it is the
 * embedding anchor the scorer's relevance signal compares every lead
 * against, exactly as a monitored area's description anchors trend
 * relevance. Structured fields drive the deterministic `fit` signal;
 * `dealbreakers` are hard zeros with their own reason.
 */
export const icpSchema = z.object({
  /** Free text: who the tenant sells to and why — the relevance-embedding anchor. */
  description: z.string().min(1),
  verticals: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  companySize: companySizeSchema.optional(),
  /** Hard zeros: a lead matching one scores 0 with the dealbreaker as its reason. */
  dealbreakers: z.array(z.string()).default([]),
  /** Scorer weight overrides — unset signals keep the code defaults (equal weights). */
  weights: leadRankerWeightOverridesSchema.optional(),
});
export type IcpInput = z.input<typeof icpSchema>;
export type Icp = z.infer<typeof icpSchema>;

/**
 * One scoring result as the lead_scores repo validates it at the write
 * door. `profileHash` is the hash of the ICP block that produced the score —
 * re-score on profile drift is detectable, cache-key style; history is
 * append-only (the trend_snapshots convention).
 */
export const leadScoreRecordSchema = z.object({
  /** Weight-normalized [0,1] over armed signals. */
  score: z.number().min(0).max(1),
  /** One readable string per armed signal — the ranker convention, never a black box. */
  reasons: z.array(z.string()).default([]),
  /** Per-component values, kept for weight tuning (the learn loop, B-crm.5). */
  signals: z.record(z.string(), z.number()).default({}),
  profileHash: z.string().min(1),
});
export type LeadScoreRecordInput = z.input<typeof leadScoreRecordSchema>;
export type LeadScoreRecord = z.infer<typeof leadScoreRecordSchema>;
