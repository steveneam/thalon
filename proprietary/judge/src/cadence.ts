import type { CadenceRule, JudgeEvidence, Verdict } from "@thalon/contracts";

/**
 * B7.a cadence gate — pure, deterministic, zero model calls, exactly the G1
 * doctrine (SPINE §1: deterministic rules are pure functions, never
 * delegated to a model). Enforces per-platform posting-frequency norms from
 * `brand_profiles.cadence` (contracts `cadenceConfigSchema` — always tenant
 * DATA, never hard-coded). Named descriptively like `seo_aeo` and
 * `exemplar_overlap`, not `g2_*`/`g4_*` — those SPINE slots stay reserved
 * for claims-match and platform-ToS policy.
 *
 * "Posting frequency" pre-publish (no publish path is wired this sprint)
 * means QUEUE ADMISSIONS: how many drafts for this platform entered the
 * queued/approved band inside the rolling window, counting only drafts
 * still live (blocked/rejected drafts free their slot). The caller supplies
 * those admissions from the I4 events audit spine
 * (`repos.drafts.listQueueAdmissions`); this function is just the math, so
 * it tests without a db and never drifts from what evidence claims say.
 */

export const CADENCE_GATE = "cadence";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_MS = 7 * DAY_MS;

/** One draft's latest admission into the queued/approved band (still live). */
export interface QueueAdmission {
  draftId: string;
  admittedAt: Date;
}

export interface RunCadenceInput {
  platform: string;
  /** This platform's rule from the tenant's cadence config. */
  rule: CadenceRule;
  /** Live queue admissions for this platform, at least `cadenceFetchHorizonMs` back. */
  admissions: readonly QueueAdmission[];
  now: Date;
}

export interface CadenceResult {
  verdict: Verdict;
  evidence: JudgeEvidence;
}

/** A rule with no fields set constrains nothing — the pipeline skips the gate entirely (absence disarms, the standing convention). */
export function hasCadenceConstraint(rule: CadenceRule): boolean {
  return (
    rule.maxPerDay !== undefined ||
    rule.maxPerWeek !== undefined ||
    rule.minGapMinutes !== undefined
  );
}

/**
 * How far back the caller must fetch admissions for `runCadenceGate` to see
 * everything it needs: the widest armed counting window, or the gap window
 * when `minGapMinutes` exceeds it (a 2-week gap rule needs 2 weeks of
 * history even with no weekly cap armed).
 */
export function cadenceFetchHorizonMs(rule: CadenceRule): number {
  const countWindow =
    rule.maxPerWeek !== undefined ? WEEK_MS : rule.maxPerDay !== undefined ? DAY_MS : 0;
  return Math.max(countWindow, (rule.minGapMinutes ?? 0) * MINUTE_MS);
}

/**
 * Window semantics (exact, so behavior never drifts silently):
 *  - Counting windows are ROLLING: an admission counts when
 *    `admittedAt >= now - window` (boundary inclusive). `maxPerDay` = last
 *    24h, `maxPerWeek` = last 7×24h — never calendar days.
 *  - A count AT the limit fails the new draft: admitting it would exceed
 *    the norm (`maxPerDay: 3` with 3 live admissions in-window ⇒ fail).
 *  - `minGapMinutes` measures from the MOST RECENT live admission; a gap
 *    exactly equal to the rule passes. No prior admission always passes.
 *  - Every armed constraint is recorded as one claim, pass or fail — the
 *    operator sees the whole rule evaluated, not just the breach.
 */
export function runCadenceGate(input: RunCadenceInput): CadenceResult {
  const { rule, admissions, now } = input;
  const claims: JudgeEvidence["claims"] = [];

  if (rule.maxPerDay !== undefined) {
    claims.push(
      countClaim("maxPerDay", rule.maxPerDay, countSince(admissions, now.getTime() - DAY_MS), "24h"),
    );
  }
  if (rule.maxPerWeek !== undefined) {
    claims.push(
      countClaim("maxPerWeek", rule.maxPerWeek, countSince(admissions, now.getTime() - WEEK_MS), "7d"),
    );
  }
  if (rule.minGapMinutes !== undefined) {
    const latest = latestAdmission(admissions);
    if (latest === null) {
      claims.push({
        claim: `minGapMinutes ${rule.minGapMinutes}`,
        verdict: "pass",
        evidence: "no prior live queue admission for this platform",
      });
    } else {
      const gapMinutes = (now.getTime() - latest.getTime()) / MINUTE_MS;
      claims.push({
        claim: `minGapMinutes ${rule.minGapMinutes}`,
        verdict: gapMinutes < rule.minGapMinutes ? "fail" : "pass",
        evidence: `last queue admission for "${input.platform}" was ${formatMinutes(gapMinutes)} min ago (rule: at least ${rule.minGapMinutes} min)`,
      });
    }
  }

  return {
    verdict: claims.some((c) => c.verdict === "fail") ? "fail" : "pass",
    evidence: { claims },
  };
}

function countSince(admissions: readonly QueueAdmission[], sinceMs: number): number {
  return admissions.filter((a) => a.admittedAt.getTime() >= sinceMs).length;
}

function latestAdmission(admissions: readonly QueueAdmission[]): Date | null {
  let latest: Date | null = null;
  for (const a of admissions) {
    if (latest === null || a.admittedAt.getTime() > latest.getTime()) latest = a.admittedAt;
  }
  return latest;
}

function countClaim(
  field: "maxPerDay" | "maxPerWeek",
  max: number,
  count: number,
  windowLabel: string,
): JudgeEvidence["claims"][number] {
  return {
    claim: `${field} ${max}`,
    verdict: count >= max ? "fail" : "pass",
    evidence: `${count} live draft(s) admitted to the queue in the last ${windowLabel}`,
  };
}

function formatMinutes(minutes: number): string {
  return String(Math.round(minutes * 10) / 10);
}
