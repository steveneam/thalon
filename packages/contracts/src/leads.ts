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
 * Lifecycle (B-crm.1 base + B-crm.4's outreach states, s54 window —
 * additive, as the ratified build plan promised). `dismissed` is operator
 * signal (the dismissal becomes an eval row), never a delete. `contacted`
 * is set by the send door on a recorded send. `unsubscribed` is the
 * do-not-contact TERMINAL state — INVARIANT class, the same one-way-door
 * grade as tenancy: the cadence engine and the send door both refuse to
 * cross it, and no transition ever leaves it. It is reachable from any
 * live state because a do-not-contact request can arrive through any
 * channel, contacted or not.
 */
export const LEAD_STATUSES = ["new", "scored", "contacted", "dismissed", "unsubscribed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ["scored", "dismissed", "unsubscribed"],
  scored: ["contacted", "dismissed", "unsubscribed"],
  contacted: ["dismissed", "unsubscribed"],
  dismissed: [],
  unsubscribed: [],
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

/**
 * AU Spam Act consent basis (B-crm.4 s54 window, §Session-53 invariant 1):
 * a per-lead FIELD, not a vibe. The send door REFUSES `none`.
 * `inferred-published` requires a conspicuously-published work address and
 * a role-relevant message — the provenance records which.
 */
export const CONSENT_BASES = ["express", "inferred-published", "none"] as const;
export type ConsentBasis = (typeof CONSENT_BASES)[number];

export function isConsentBasis(value: string): value is ConsentBasis {
  return (CONSENT_BASES as readonly string[]).includes(value);
}

/**
 * Where the consent claim comes from — audit evidence, stored beside the
 * basis. For `inferred-published`, `sourceUrl` is where the work address is
 * conspicuously published (the lead's `sourceUrl` chip is the natural
 * home); for `express`, `note` records how the consent arrived (e.g.
 * "waitlist signup 2026-07-14"). Open-ended fields are deliberate: this is
 * evidence prose for a human auditor, not machine config.
 */
export const consentProvenanceSchema = z.object({
  sourceUrl: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});
export type ConsentProvenance = z.infer<typeof consentProvenanceSchema>;

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
  /**
   * The lead's problem/need in the operator's (or their own) words — the
   * thing outreach can ADDRESS (founder direction 2026-07-13, window-1b).
   * First-class rather than meta because it anchors both the relevance
   * embedding and B-crm.4's tailored outreach drafts.
   */
  painPoint: z.string().optional(),
  /** Source-specific extras (waitlist referral context, unmapped CSV columns) — data, open shape. */
  meta: z.record(z.string(), z.unknown()).default({}),
  /**
   * B-crm.4 (s54 window): intake paths that KNOW the consent basis carry it
   * in (waitlist signup = express). Unset defers to the column default
   * (`none`) — a lead never gains sendable consent by omission.
   */
  consentBasis: z.enum(CONSENT_BASES).optional(),
  consentProvenance: consentProvenanceSchema.optional(),
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

/** A learned multiplier is a positive scale on a resolved weight — 1 is neutral; ≤0 would erase or invert a signal, which is config's job (weights), never the learn loop's. */
const multiplier = z.number().positive().finite();

/**
 * B-crm.5: the learn loop's per-signal weight multipliers — applied ON TOP
 * of the resolved weights (code default ← icp override), so an operator's
 * explicit weight config is scaled, never replaced. All four signals are
 * always present (1 = the loop had nothing conclusive to say).
 */
export const leadWeightMultipliersSchema = z.object({
  relevance: multiplier,
  fit: multiplier,
  completeness: multiplier,
  recency: multiplier,
});
export type LeadWeightMultipliers = z.infer<typeof leadWeightMultipliersSchema>;

/**
 * One learn-loop pass as the lead_weight_states repo validates it at the
 * write door (the leadScoreRecordSchema pattern). `profileHash` is the ICP
 * hash the loop ran against — application binds to it, so profile drift
 * disarms a learned state until the loop re-runs. `evidenceHash` is the
 * structural idempotence key: replaying the loop over the same verdicts
 * appends nothing.
 */
export const leadWeightStateRecordSchema = z.object({
  multipliers: leadWeightMultipliersSchema,
  /** One readable line per signal (and per dealbreaker term) — WHY each weight moved or held. */
  reasons: z.array(z.string()).default([]),
  /** The counts/posteriors/Wilson bounds behind the reasons — the audit trail's numbers. */
  evidence: z.record(z.string(), z.unknown()).default({}),
  profileHash: z.string().min(1),
  evidenceHash: z.string().min(1),
});
export type LeadWeightStateRecordInput = z.input<typeof leadWeightStateRecordSchema>;
export type LeadWeightStateRecord = z.infer<typeof leadWeightStateRecordSchema>;

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

/**
 * B-crm.4 (s54 window): who may carry a send. One provider today (the s28
 * decision); the array is the one source of truth for the schema check
 * constraint, the intel.ts `inList` convention.
 */
export const OUTREACH_SEND_PROVIDERS = ["resend"] as const;
export type OutreachSendProvider = (typeof OUTREACH_SEND_PROVIDERS)[number];

/**
 * One recorded send as the outreach_sends repo validates it at the write
 * door. A row EXISTS only for a provider-accepted send (`providerMessageId`
 * is required) — failures live in events/op errors, never here, so the
 * ≤cap/day count and the double-send unique key both count real sends
 * only. `recipientEmail` and `bodyHash` are audit snapshots of what
 * actually left, taken AT the send (the draft may later be superseded;
 * this row never changes). `touchIndex` is which cadence touch this was
 * (0-based); cadence state is DERIVED from this ledger + config — there is
 * deliberately no mutable cadence-state table to drift from it.
 */
export const outreachSendRecordSchema = z.object({
  leadId: z.string().min(1),
  draftId: z.string().min(1),
  provider: z.enum(OUTREACH_SEND_PROVIDERS),
  providerMessageId: z.string().min(1),
  recipientEmail: z.string().trim().max(254).pipe(z.email()),
  bodyHash: z.string().min(1),
  touchIndex: z.number().int().min(0),
  /** Provider extras (batch tags, idempotency echoes) — data, open shape. */
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type OutreachSendRecordInput = z.input<typeof outreachSendRecordSchema>;
export type OutreachSendRecord = z.infer<typeof outreachSendRecordSchema>;

const dayWeight = z.number().min(0);

/**
 * B-crm.4 cadence design (§Session-53): per-weekday send-day weighting,
 * Wednesday-weighted by default (survey signal), weekends off. Weights are
 * relative preference for SCHEDULING, not gates — 0 means "never propose
 * this day". All seven days always resolve (defaults fill), so scheduling
 * math never branches on absence.
 */
export const sendDayWeightsSchema = z.object({
  mon: dayWeight.default(1),
  tue: dayWeight.default(1),
  wed: dayWeight.default(1.5),
  thu: dayWeight.default(1),
  fri: dayWeight.default(1),
  sat: dayWeight.default(0),
  sun: dayWeight.default(0),
});
export type SendDayWeights = z.infer<typeof sendDayWeightsSchema>;

/**
 * The outreach sequence block (B-crm.4 s54 window) — per-tenant runtime
 * config on the brand profile (brand-profile.ts `outreach`, absence
 * disarms). Distinct from B7.a's `cadence` block on purpose: that one is
 * posting-frequency norms the judge enforces; this one is the SEQUENCE
 * design the send scheduler reads.
 *
 * - `touchOffsetsDays`: day offsets from sequence start, strictly
 *   increasing, D0/D3/D10/D17 defaults (first follow-up peaks ~8.4% reply;
 *   sequences beat single sends ~2.5x — the s52 survey). Max 7 touches:
 *   over-touching is a deliverability/spam hazard, ceiling executable.
 * - `dailyBatchCap`: ≤50/day (deliverability + the small-batch signal).
 *   The 50 CEILING is schema-enforced — an operator can lower it, never
 *   raise it past the bucket's invariant.
 * - Every touch is its own judged draft — nothing here bypasses the gate.
 */
export const outreachSequenceSchema = z.object({
  touchOffsetsDays: z
    .array(z.number().int().min(0))
    .min(1)
    .max(7)
    .default([0, 3, 10, 17])
    .refine((offsets) => offsets.every((d, i) => i === 0 || d > offsets[i - 1]), {
      message: "touchOffsetsDays must be strictly increasing",
    }),
  dailyBatchCap: z.number().int().positive().max(50).default(50),
  // prefault (not default): {} runs THROUGH the schema so the per-day
  // defaults stay the one source of truth (default() would demand a full
  // duplicate object here).
  sendDayWeights: sendDayWeightsSchema.prefault({}),
});
export type OutreachSequenceInput = z.input<typeof outreachSequenceSchema>;
export type OutreachSequence = z.infer<typeof outreachSequenceSchema>;
