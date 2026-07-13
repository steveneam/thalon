import {
  leadRankerWeightsSchema,
  type Icp,
  type LeadRankerWeightOverrides,
  type LeadRankerWeights,
} from "@thalon/contracts";
import { z } from "zod";
import { cosineSimilarity } from "../trend/ranker";

/**
 * B-crm.2 lead scorer — the trend ranker's EdgeRank shape pointed at revenue
 * (ratified build plan; charter A16: deterministic-with-reasons, never
 * black-box). PURE tested math: the caller supplies embedding vectors and
 * the clock; nothing here touches a db, a driver, or a model — and NOTHING
 * in B-crm.1+2 makes an LLM call (zero gateway spend; embeddings ride the
 * platform embedding tier when the caller arms them).
 *
 * Signal shape mirrors ../trend/ranker.ts exactly: components in [0,1],
 * weight-normalized sum over ARMED signals only (a lead with no embeddable
 * text disarms relevance rather than dragging the score — the standing
 * missing-metric convention), one readable reason per signal. Scoring
 * inputs are INTAKE-PROVIDED fields only in this cut: no fetching, no
 * enrichment (B-crm.3's seam) — which is why companySize stays unarmed
 * (no lead carries a headcount yet) and `fit` matches ICP terms against
 * the lead's own text.
 */

export const leadScorerConfigSchema = z.object({
  /** Code-default weights; the tenant's icp.weights overrides ride per profile. */
  weights: leadRankerWeightsSchema.default({ relevance: 1, fit: 1, completeness: 1, recency: 1 }),
  /** Recency half-life: a lead captured this many days ago scores 0.5 on recency. */
  recencyHalfLifeDays: z.number().positive().default(14),
});
export type LeadScorerConfigInput = z.input<typeof leadScorerConfigSchema>;
export type LeadScorerConfig = z.infer<typeof leadScorerConfigSchema>;

/** Two layers exactly: code default ← tenant ICP override (unset fields keep the default). */
export function resolveLeadWeights(
  defaults: LeadRankerWeights,
  overrides?: LeadRankerWeightOverrides,
): LeadRankerWeights {
  return {
    relevance: overrides?.relevance ?? defaults.relevance,
    fit: overrides?.fit ?? defaults.fit,
    completeness: overrides?.completeness ?? defaults.completeness,
    recency: overrides?.recency ?? defaults.recency,
  };
}

/** The lead fields the scorer reads — a projection of the db row, framework-free. */
export interface ScorableLead {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  notes: string | null;
  /** The lead's problem/need (window-1b) — the strongest relevance text there is. */
  painPoint: string | null;
  /** Capture time (`created_at`), ms epoch — the recency anchor. */
  createdAtMs: number;
}

/** The embedding target: what the lead says about itself. "" = nothing to embed → relevance disarms. */
export function leadEmbeddingText(lead: ScorableLead): string {
  return [lead.company, lead.role, lead.painPoint, lead.notes, lead.website]
    .map((v) => v?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export interface LeadScoreComponents {
  /** Embedding cosine vs icp.description mapped to [0,1]; null = disarmed. */
  relevance: number | null;
  /** Mean of the armed structured-match sub-signals; null when none armed. */
  fit: number | null;
  /** Fraction of contact fields present. Always armed. */
  completeness: number;
  /** Half-life decay from capture time. Always armed. */
  recency: number;
}

export interface LeadScoreBreakdown {
  /** Weight-normalized [0,1] over armed signals; 0 when a dealbreaker matched. */
  score: number;
  components: LeadScoreComponents;
  /** The weights actually applied (code default ← icp override) — operator-visible provenance. */
  weights: LeadRankerWeights;
  /** One line per signal — the operator sees WHY (never a black box). Dealbreaker reason leads. */
  reasons: string[];
  /** The matched dealbreaker term, when one fired. */
  dealbreaker: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * ICP list entries are operator vocabulary and often compound
 * ("food/café/restaurant", "franchise HQ / enterprise chains") — each
 * slash-separated part is its own matchable term.
 */
function icpTerms(entries: readonly string[]): string[] {
  return entries
    .flatMap((entry) => entry.split("/"))
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

/** Case-insensitive containment — deterministic and reason-transparent, the v1 honest fit. */
function matchTerm(haystack: string, terms: readonly string[]): string | null {
  const text = haystack.toLowerCase();
  return terms.find((term) => text.includes(term)) ?? null;
}

const CONTACT_FIELDS = ["name", "company", "role", "website", "notes"] as const;

export interface LeadScoreVectors {
  /** Embedding of leadEmbeddingText(lead); null when unarmed (no text or no embedder). */
  lead: readonly number[] | null;
  /** Embedding of icp.description; null when no embedder is configured. */
  icp: readonly number[] | null;
}

/**
 * Deterministic: same lead, same ICP, same vectors, same clock → same
 * breakdown, byte for byte.
 */
export function scoreLead(
  lead: ScorableLead,
  icp: Icp,
  vectors: LeadScoreVectors,
  configInput: LeadScorerConfigInput = {},
  nowMs: number = 0,
): LeadScoreBreakdown {
  const config = leadScorerConfigSchema.parse(configInput);
  const weights = resolveLeadWeights(config.weights, icp.weights);
  const searchableText = [lead.name, lead.company, lead.role, lead.website, lead.notes, lead.painPoint]
    .map((v) => v?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  // relevance — embedding cosine vs the ICP description, [−1,1] → [0,1].
  const embedText = leadEmbeddingText(lead);
  let relevance: number | null = null;
  let relevanceReason: string;
  if (embedText === "") {
    relevanceReason = "relevance disarmed (no lead text to embed)";
  } else if (vectors.lead === null || vectors.icp === null) {
    relevanceReason = "relevance disarmed (no embedder configured)";
  } else {
    const cosine = cosineSimilarity(vectors.lead, vectors.icp);
    relevance = round4((cosine + 1) / 2);
    relevanceReason = `relevance ${round2(relevance)} to the ICP (embedding cosine ${round2(cosine)})`;
  }

  // fit — structured ICP-term matches over intake-provided fields; each
  // sub-signal arms only when the ICP declares the criterion AND the lead
  // carries something to match against.
  const fitParts: Array<{ signal: number; detail: string }> = [];
  if (icp.roles.length > 0 && lead.role) {
    const hit = matchTerm(lead.role, icpTerms(icp.roles));
    fitParts.push({
      signal: hit ? 1 : 0,
      detail: hit ? `role "${lead.role}" matches "${hit}"` : `role "${lead.role}" matches no ICP role`,
    });
  }
  if (icp.verticals.length > 0 && searchableText) {
    const hit = matchTerm(searchableText, icpTerms(icp.verticals));
    fitParts.push({
      signal: hit ? 1 : 0,
      detail: hit ? `vertical term "${hit}" found` : "no ICP vertical term found",
    });
  }
  if (icp.regions.length > 0 && searchableText) {
    const hit = matchTerm(searchableText, icpTerms(icp.regions));
    fitParts.push({
      signal: hit ? 1 : 0,
      detail: hit ? `region term "${hit}" found` : "no ICP region term found",
    });
  }
  // companySize deliberately unarmed: intake carries no headcount — B-crm.3
  // enrichment arms it without re-shaping this component.
  const fit = fitParts.length > 0 ? round4(mean(fitParts.map((p) => p.signal))) : null;

  // completeness — how much of the contact card is filled in.
  const present = CONTACT_FIELDS.filter((f) => (lead[f] ?? "").trim() !== "");
  const completeness = round4(present.length / CONTACT_FIELDS.length);

  // recency — capture-time half-life decay.
  const ageDays = Math.max(0, (nowMs - lead.createdAtMs) / 86_400_000);
  const recency = round4(2 ** (-ageDays / config.recencyHalfLifeDays));

  const reasons: string[] = [relevanceReason];
  if (fit !== null) {
    reasons.push(`fit ${round2(fit)} (${fitParts.map((p) => p.detail).join("; ")})`);
  }
  reasons.push(
    `completeness ${round2(completeness)} (${present.length}/${CONTACT_FIELDS.length} contact fields present)`,
    `recency ${round2(recency)} (captured ${round2(ageDays)}d ago, half-life ${config.recencyHalfLifeDays}d)`,
  );

  // Dealbreakers are hard zeros with their own leading reason (ratified
  // build plan) — components stay visible so the operator sees what the
  // lead WOULD have scored.
  const dealbreaker = searchableText ? matchTerm(searchableText, icpTerms(icp.dealbreakers)) : null;

  let score = 0;
  if (dealbreaker !== null) {
    reasons.unshift(`dealbreaker "${dealbreaker}" matched — hard zero`);
  } else {
    const armed: Array<[weight: number, signal: number]> = [];
    if (relevance !== null) armed.push([weights.relevance, relevance]);
    if (fit !== null) armed.push([weights.fit, fit]);
    armed.push([weights.completeness, completeness], [weights.recency, recency]);
    const totalWeight = armed.reduce((sum, [w]) => sum + w, 0);
    score =
      totalWeight === 0 ? 0 : round4(armed.reduce((sum, [w, s]) => sum + w * s, 0) / totalWeight);
  }

  return {
    score,
    components: { relevance, fit, completeness, recency },
    weights,
    reasons,
    dealbreaker,
  };
}
