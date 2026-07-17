import { leadWeightMultipliersSchema, type LeadWeightMultipliers } from "@thalon/contracts";
import { z } from "zod";

/**
 * B-crm.5 learn loop — the missing consumer of lead_triage eval rows
 * (research doc §5 rec 1: Beta-posterior per-signal learning + Wilson lower
 * bound; the approved no-new-data shape). PURE tested math, zero LLM calls,
 * zero clock reads: triage verdicts in, per-signal weight multipliers with
 * self-writing reasons out. Deterministic byte for byte.
 *
 * Evidence source decision: each verdict's evidence is parsed from the eval
 * row's OWN reason strings — exactly what the operator saw when they pinned
 * or dismissed, never a later re-score. The parser is pinned to the
 * scorer's formats by a round-trip test (scoreLead → reasons → parse);
 * format drift breaks that test, not production silently.
 *
 * Attribution decisions (each pinned by a test):
 * - Last verdict per lead wins; a final `unpinned` is a RETRACTION (the
 *   operator took the endorsement back) and contributes nothing.
 * - Dealbreaker verdicts feed per-term rule stats only: a hard zero was
 *   never produced by the weighted sum, so it cannot credit or blame the
 *   components. Non-dealbreaker verdicts feed component learning.
 * - profile_hash drift: component evidence counts across ALL profile
 *   hashes (a pin means the same thing about relevance/fit/completeness/
 *   recency whatever the ICP terms were); per-term dealbreaker stats bind
 *   to the CURRENT hash (terms belong to a specific ICP).
 */

export const leadLearnConfigSchema = z.object({
  /** Beta prior — pseudo-pins. α=β=1 is the uniform prior. */
  priorAlpha: z.number().positive().default(1),
  /** Beta prior — pseudo-dismissals. */
  priorBeta: z.number().positive().default(1),
  /** A signal "endorsed" a lead when its component was ≥ this at verdict time. */
  endorseThreshold: z.number().min(0).max(1).default(0.5),
  /** Wilson interval z (1.96 = 95% — Miller's constant). */
  confidenceZ: z.number().positive().default(1.96),
  /** A learned multiplier never leaves [floor, ceiling] — the loop nudges, config rules. */
  multiplierFloor: z.number().positive().default(0.5),
  multiplierCeiling: z.number().positive().default(2),
});
export type LeadLearnConfigInput = z.input<typeof leadLearnConfigSchema>;
export type LeadLearnConfig = z.infer<typeof leadLearnConfigSchema>;

/** The lead_triage eval-row payload as the triage door writes it (apps/web triageLeads → evalCases.recordLeadTriage). */
export const leadTriageEvalPayloadSchema = z.object({
  input: z.object({
    leadId: z.string().min(1),
    score: z.number().nullable().optional(),
    reasons: z.array(z.string()).default([]),
    profileHash: z.string().nullable().optional(),
  }),
  expected: z.object({
    operatorAction: z.enum(["dismissed", "pinned", "unpinned"]),
  }),
});
export type LeadTriageEvalPayload = z.infer<typeof leadTriageEvalPayloadSchema>;

/** One triage verdict as the core consumes it — the runner's projection of an eval row. */
export interface LeadTriageVerdict {
  leadId: string;
  /** The eval row's own reason strings — the evidence the operator saw. */
  reasons: readonly string[];
  /** Hash of the ICP the lead was scored under at verdict time. */
  profileHash: string | null;
  action: "dismissed" | "pinned" | "unpinned";
  /** Eval-row capture time, ms epoch — last-verdict-per-lead needs the order. */
  recordedAtMs: number;
}

/** The component values a verdict's reasons encode; null = disarmed/absent. */
export interface ParsedScoreReasons {
  dealbreaker: string | null;
  relevance: number | null;
  fit: number | null;
  completeness: number | null;
  recency: number | null;
}

const SIGNALS = ["relevance", "fit", "completeness", "recency"] as const;
type SignalName = (typeof SIGNALS)[number];

const REASON_PATTERNS: Record<SignalName, RegExp> = {
  relevance: /^relevance (\d+(?:\.\d+)?) to the ICP \(/,
  fit: /^fit (\d+(?:\.\d+)?) \(/,
  completeness: /^completeness (\d+(?:\.\d+)?) \(/,
  recency: /^recency (\d+(?:\.\d+)?) \(/,
};
const DEALBREAKER_PATTERN = /^dealbreaker "(.+)" matched — hard zero$/;

/**
 * Recover the component values from a score's verbatim reason strings.
 * Returns null when the reasons carry no readable score (an unscored lead's
 * empty triage row, or a future format this parser predates) — the caller
 * counts those honestly instead of guessing. Values carry the reasons'
 * display precision (round2), which is exact enough to threshold on.
 */
export function parseLeadScoreReasons(reasons: readonly string[]): ParsedScoreReasons | null {
  const parsed: ParsedScoreReasons = {
    dealbreaker: null,
    relevance: null,
    fit: null,
    completeness: null,
    recency: null,
  };
  for (const reason of reasons) {
    const dealbreaker = DEALBREAKER_PATTERN.exec(reason);
    if (dealbreaker) parsed.dealbreaker = dealbreaker[1];
    for (const signal of SIGNALS) {
      const hit = REASON_PATTERNS[signal].exec(reason);
      if (hit) parsed[signal] = Number(hit[1]);
    }
  }
  // completeness + recency are always armed on every real score — a row
  // carrying neither has no readable scoring evidence at all.
  if (parsed.completeness === null || parsed.recency === null) return null;
  return parsed;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Closed-form Beta posterior mean: (α + successes) / (α + β + n). */
export function betaPosteriorMean(
  successes: number,
  failures: number,
  priorAlpha: number,
  priorBeta: number,
): number {
  return (priorAlpha + successes) / (priorAlpha + priorBeta + successes + failures);
}

/**
 * Wilson score interval on a binary rate (Miller, "How Not To Sort By
 * Average Rating"). n=0 returns the vacuous [0, 1] — no information, so the
 * gates below can never justify a move from it.
 */
export function wilsonInterval(
  positives: number,
  n: number,
  confidenceZ: number,
): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const p = positives / n;
  const z2 = confidenceZ ** 2;
  const denominator = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = confidenceZ * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator),
  };
}

export interface SignalEvidence {
  /** Final verdicts where this signal endorsed the lead (armed and ≥ threshold). */
  endorsed: number;
  pinned: number;
  /** Beta-posterior pin rate among endorsed verdicts. */
  posterior: number;
  /** Wilson 95% interval on the raw endorsed pin rate — the small-sample honesty. */
  wilsonLow: number;
  wilsonHigh: number;
  multiplier: number;
}

export interface DealbreakerEvidence {
  /** Final verdicts under the current profile where this term fired. */
  verdicts: number;
  /** Dismissals = the operator confirming the term. */
  confirmed: number;
  /** Pins = the operator overriding the hard zero — evidence the term is wrong. */
  overridden: number;
  /** Beta-posterior confirm rate. */
  posterior: number;
  wilsonLow: number;
}

/** A type alias (not an interface) so it satisfies the write door's open evidence record structurally. */
export type LeadWeightLearningEvidence = {
  /** Verdict rows seen / rows carrying no readable scoring evidence. */
  rows: number;
  unreadable: number;
  /** Final per-lead verdicts after the last-verdict-wins fold. */
  verdicts: number;
  /** Leads whose final verdict was `unpinned` — retractions, contribute nothing. */
  retracted: number;
  /** Final verdicts actually produced by the weighted sum (no dealbreaker). */
  componentVerdicts: number;
  base: { n: number; pinned: number; posterior: number };
  signals: Record<SignalName, SignalEvidence>;
  dealbreakers: Record<string, DealbreakerEvidence>;
  /** Distinct profile hashes the component evidence spans — provenance. */
  profileHashes: string[];
};

export interface LeadWeightLearning {
  multipliers: LeadWeightMultipliers;
  /** One readable line per signal (and per dealbreaker term) — WHY each weight moved or held. */
  reasons: string[];
  evidence: LeadWeightLearningEvidence;
}

interface FinalVerdict {
  parsed: ParsedScoreReasons;
  profileHash: string | null;
  pinned: boolean;
}

/**
 * Deterministic: same verdicts, same current profile, same config → same
 * learning, byte for byte. `currentProfileHash` scopes only the per-term
 * dealbreaker stats — component learning spans every hash on record.
 */
export function learnLeadWeights(
  rows: readonly LeadTriageVerdict[],
  currentProfileHash: string,
  configInput: LeadLearnConfigInput = {},
): LeadWeightLearning {
  const config = leadLearnConfigSchema.parse(configInput);

  // Fold to one FINAL verdict per lead (stable sort: time, then input order).
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.recordedAtMs - b.row.recordedAtMs || a.index - b.index)
    .map(({ row }) => row);
  const lastByLead = new Map<string, LeadTriageVerdict>();
  for (const row of ordered) lastByLead.set(row.leadId, row);

  let unreadable = 0;
  let retracted = 0;
  const finals: FinalVerdict[] = [];
  for (const row of lastByLead.values()) {
    if (row.action === "unpinned") {
      retracted++;
      continue;
    }
    const parsed = parseLeadScoreReasons(row.reasons);
    if (!parsed) {
      unreadable++;
      continue;
    }
    finals.push({ parsed, profileHash: row.profileHash, pinned: row.action === "pinned" });
  }

  // Partition: dealbreaker verdicts are rule evidence; the rest is component evidence.
  const componentEvidence = finals.filter((v) => v.parsed.dealbreaker === null);
  const baseN = componentEvidence.length;
  const basePinned = componentEvidence.filter((v) => v.pinned).length;
  const baseRaw = baseN > 0 ? basePinned / baseN : 0;
  const basePosterior = betaPosteriorMean(
    basePinned,
    baseN - basePinned,
    config.priorAlpha,
    config.priorBeta,
  );

  const pinnedTotal = finals.filter((v) => v.pinned).length;
  const reasons: string[] = [
    `learned from ${finals.length} triage verdicts (${pinnedTotal} pinned / ${finals.length - pinnedTotal} dismissed; ${retracted} retracted, ${unreadable} unreadable) — base pin rate ${round2(baseRaw)} over ${baseN} component-scored verdicts`,
  ];

  const multipliers = { relevance: 1, fit: 1, completeness: 1, recency: 1 };
  const signalEvidence = {} as Record<SignalName, SignalEvidence>;
  for (const signal of SIGNALS) {
    const endorsed = componentEvidence.filter(
      (v) => v.parsed[signal] !== null && (v.parsed[signal] as number) >= config.endorseThreshold,
    );
    const n = endorsed.length;
    const pinned = endorsed.filter((v) => v.pinned).length;
    const posterior = betaPosteriorMean(pinned, n - pinned, config.priorAlpha, config.priorBeta);
    const { low, high } = wilsonInterval(pinned, n, config.confidenceZ);

    let multiplier = 1;
    if (n === 0) {
      reasons.push(
        `${signal} ×1 (held) — no triaged lead had this signal ≥ ${config.endorseThreshold}`,
      );
    } else {
      const lift = posterior / basePosterior;
      if (lift > 1 && low > baseRaw) {
        multiplier = Math.min(config.multiplierCeiling, Math.max(config.multiplierFloor, round4(lift)));
        reasons.push(
          `${signal} ×${round2(multiplier)} — endorsed ${n} triaged leads, ${pinned} pinned (posterior pin rate ${round2(posterior)} vs base ${round2(basePosterior)}; Wilson low ${round2(low)} clears base rate ${round2(baseRaw)})`,
        );
      } else if (lift < 1 && high < baseRaw) {
        multiplier = Math.min(config.multiplierCeiling, Math.max(config.multiplierFloor, round4(lift)));
        reasons.push(
          `${signal} ×${round2(multiplier)} — endorsed ${n} triaged leads, ${pinned} pinned (posterior pin rate ${round2(posterior)} vs base ${round2(basePosterior)}; Wilson high ${round2(high)} falls below base rate ${round2(baseRaw)})`,
        );
      } else {
        reasons.push(
          `${signal} ×1 (held) — endorsed ${n} triaged leads, ${pinned} pinned (Wilson interval [${round2(low)}, ${round2(high)}] straddles the base pin rate ${round2(baseRaw)} — not conclusive)`,
        );
      }
    }
    multipliers[signal] = multiplier;
    signalEvidence[signal] = {
      endorsed: n,
      pinned,
      posterior: round4(posterior),
      wilsonLow: round4(low),
      wilsonHigh: round4(high),
      multiplier,
    };
  }

  // Per-term dealbreaker stats — terms belong to THIS ICP, so only verdicts
  // rendered under the current profile hash count. Report-only: the hard
  // zero stays config's call, the loop just shows how the operator ruled.
  const dealbreakers: Record<string, DealbreakerEvidence> = {};
  const ruleVerdicts = finals.filter(
    (v) => v.parsed.dealbreaker !== null && v.profileHash === currentProfileHash,
  );
  const terms = [...new Set(ruleVerdicts.map((v) => v.parsed.dealbreaker as string))].sort();
  for (const term of terms) {
    const hits = ruleVerdicts.filter((v) => v.parsed.dealbreaker === term);
    const confirmed = hits.filter((v) => !v.pinned).length;
    const overridden = hits.length - confirmed;
    const posterior = betaPosteriorMean(
      confirmed,
      overridden,
      config.priorAlpha,
      config.priorBeta,
    );
    const { low } = wilsonInterval(confirmed, hits.length, config.confidenceZ);
    dealbreakers[term] = {
      verdicts: hits.length,
      confirmed,
      overridden,
      posterior: round4(posterior),
      wilsonLow: round4(low),
    };
    reasons.push(
      `dealbreaker "${term}" — ${hits.length} verdict${hits.length === 1 ? "" : "s"} under this profile: ${confirmed} dismissed, ${overridden} pinned (smoothed confirm rate ${round2(posterior)}; Wilson low ${round2(low)})`,
    );
  }

  return {
    multipliers: leadWeightMultipliersSchema.parse(multipliers),
    reasons,
    evidence: {
      rows: rows.length,
      unreadable,
      verdicts: finals.length,
      retracted,
      componentVerdicts: baseN,
      base: { n: baseN, pinned: basePinned, posterior: round4(basePosterior) },
      signals: signalEvidence,
      dealbreakers,
      profileHashes: [
        ...new Set(componentEvidence.map((v) => v.profileHash ?? "(none)")),
      ].sort(),
    },
  };
}
