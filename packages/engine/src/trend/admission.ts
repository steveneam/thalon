import {
  admissionKnobOverridesSchema,
  type AdmissionKnobOverrides,
  type TenantCtx,
} from "@thalon/contracts";
import { BudgetExceededError, sha256Hex, type Repos } from "@thalon/db";
import { runG1Denylist } from "@thalon/judge";
import { z } from "zod";
import type { ObjectStore } from "@thalon/platform";
import type { EmbeddingDriver } from "../ingest/shell/embedder";
import { ingestExemplar } from "../exemplar/ingest-exemplar";
import { stripPii } from "../exemplar/pii-strip";
import type { LongitudinalScore } from "./longitudinal";
import type { RankedCandidate } from "./ranker";
import type { TrendItem } from "./trend-source";

/**
 * B-learn L1 (s68 founder item (a), launched s71): the armed outlier→
 * exemplar ADMISSION loop. The sweeps already capture engagement and score
 * Δ-velocity, but the only ingest gate was the single-sweep account-baseline
 * outlier rule — which almost never arms for query-sourced area feeds (one
 * item per account ⇒ no peers ⇒ no baseline), so the exemplar pool sat at 4
 * entries. This module admits the area-attributed, RANKED candidates the
 * sweep already produced, governed by knobs that are CONFIG-DATA, and writes
 * through the ONE existing ingest door (../exemplar/ingest-exemplar.ts).
 *
 * The knob home (B-learn L0 window, s73): per-area knobs are AREA DATA —
 * `monitoredAreaConfigSchema.admission` (packages/contracts, the window's
 * verbatim adoption of the transitional engine shape) persists on the
 * monitored-area row through the one write door, and the sweep reads each
 * area's overrides from the ROW config. Tenant DEFAULTS still ride the
 * runtime-config channel (`admissionConfig.defaults`, the outlierConfig/
 * rankerConfig pattern; `TREND_ADMISSION_CONFIG` env in the scheduler) —
 * the transitional request-level per-area override map is REMOVED.
 *
 * Why the gates are shaped this way (coverage honesty, s68 finding):
 *
 *  - ABSOLUTE FLOORS fail closed — a metric the platform doesn't report
 *    fails its floor. The default `views` floor therefore admits nothing
 *    from Bluesky area feeds (likes/reposts/replies only), which is the
 *    point: those feeds are news-bot-heavy; an operator opts a Bluesky area
 *    in by setting likes-based floors deliberately.
 *  - The Δ-VELOCITY multiple binds only when the stored account baseline
 *    arms — which it does precisely for high-volume accounts (news bots
 *    give their own baseline peers), so a steady headline firehose is
 *    rejected as the non-outlier it is, while a one-off viral poster with
 *    no history falls through to the floors.
 *  - MIN BODY LENGTH kills bare headlines and title-only entries — the
 *    text an exemplar exists to teach is the hook + body, not a headline.
 */

/** The full knob set — tenant defaults; contracts' `admission` override block mirrors it field-for-field. */
const KNOB_DEFAULTS = {
  enabled: true,
  floors: { views: 10_000 },
  velocityMultiple: 4,
  minBodyLength: 140,
  maxAdmissionsPerDay: 20,
};

export const admissionKnobsSchema = z.object({
  /** Arming is per area; the loop itself ships armed (the mission) with conservative thresholds. */
  enabled: z.boolean().default(KNOB_DEFAULTS.enabled),
  /**
   * Platform-native metric name → absolute floor. EVERY named floor must be
   * met and a missing metric FAILS CLOSED — the conservative reading of
   * "engagement metric names to read" (SPINE §4.1: names are data).
   */
  floors: z.record(z.string(), z.number().nonnegative()).default(KNOB_DEFAULTS.floors),
  /**
   * Stored-history Δ-velocity must be ≥ this multiple of the account's
   * baseline WHEN the baseline arms (≥2 peers with measurable Δs). Stricter
   * than the discovery lens's 3× on purpose: discovery shows the operator a
   * card; admission writes the generation pool.
   */
  velocityMultiple: z.number().positive().default(KNOB_DEFAULTS.velocityMultiple),
  /** Bodies (trimmed) shorter than this never admit — the headline-spam screen. */
  minBodyLength: z.number().int().nonnegative().default(KNOB_DEFAULTS.minBodyLength),
  /**
   * CREATED admissions per area per UTC day — the embedding-budget rail
   * (every admission embeds through the metered ledger). Re-encounters of
   * known content never consume a slot. 0 = watch but never admit.
   */
  maxAdmissionsPerDay: z.number().int().nonnegative().default(KNOB_DEFAULTS.maxAdmissionsPerDay),
});
export type AdmissionKnobsInput = z.input<typeof admissionKnobsSchema>;
export type AdmissionKnobs = z.infer<typeof admissionKnobsSchema>;

/**
 * The per-area OVERRIDE shape lives in contracts now (the L0 window adopted
 * the transitional engine schema verbatim as `monitoredAreaConfigSchema.
 * admission`) — re-exported here so the admission module stays the one
 * import for admission shapes. Deliberately NOT `admissionKnobsSchema.
 * partial()`: a defaulted field still fills on parse, which would silently
 * clobber the tenant default with the schema default (the exact trap
 * contracts' rankerWeightOverridesSchema exists to avoid).
 */
export { admissionKnobOverridesSchema, type AdmissionKnobOverrides };

/**
 * Tenant-wide admission config — DEFAULTS ONLY since the L0 window: per-
 * area overrides are area data (`config.admission` on the monitored-area
 * row), so a leftover request/env `areas` map is rejected LOUD (strict)
 * rather than silently dropped.
 */
export const admissionConfigSchema = z.strictObject({
  /** Tenant-wide knob defaults (Zod 4 `.default` short-circuits the inner parse — the default is the full output shape). */
  defaults: admissionKnobsSchema.default(KNOB_DEFAULTS),
});
export type AdmissionConfigInput = z.input<typeof admissionConfigSchema>;
export type AdmissionConfig = z.infer<typeof admissionConfigSchema>;

/** Two-layer resolution: tenant defaults ← the area ROW's override, field-by-field; an unset override field never clobbers. */
export function resolveAdmissionKnobs(
  defaults: AdmissionKnobs,
  override: AdmissionKnobOverrides | undefined,
): AdmissionKnobs {
  if (!override) return defaults;
  return {
    enabled: override.enabled ?? defaults.enabled,
    floors: override.floors ?? defaults.floors,
    velocityMultiple: override.velocityMultiple ?? defaults.velocityMultiple,
    minBodyLength: override.minBodyLength ?? defaults.minBodyLength,
    maxAdmissionsPerDay: override.maxAdmissionsPerDay ?? defaults.maxAdmissionsPerDay,
  };
}

export interface AdmissionDecision {
  admit: boolean;
  /** One human-readable line per rule consulted — the operator sees WHY (lands in `sources.meta.trend.reasons` on admit). */
  reasons: string[];
  /** The first rule that rejected, when `admit` is false. */
  rejectedBy?: "disabled" | "bodyLength" | "floors" | "velocity";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure per-item admission math — no clock, no db, no driver (SPINE §1).
 * ALL rules must pass (a conservative AND-gate): body length, every named
 * floor, and the Δ-velocity multiple when the stored baseline arms. An
 * unarmed baseline passes the velocity rule by design (see the module
 * header) — the floors carry the decision alone, and the reason line says
 * so honestly.
 */
export function decideAdmission(
  item: TrendItem,
  longitudinal: LongitudinalScore | undefined,
  knobs: AdmissionKnobs,
): AdmissionDecision {
  if (!knobs.enabled) {
    return { admit: false, reasons: ["admission disabled for this area"], rejectedBy: "disabled" };
  }
  const reasons: string[] = [];

  const bodyLength = item.text.trim().length;
  if (bodyLength < knobs.minBodyLength) {
    return {
      admit: false,
      reasons: [`body length ${bodyLength} is under the ${knobs.minBodyLength}-char floor`],
      rejectedBy: "bodyLength",
    };
  }
  reasons.push(`body length ${bodyLength} ≥ ${knobs.minBodyLength}`);

  for (const [name, floor] of Object.entries(knobs.floors)) {
    const value = item.metrics[name];
    if (value === undefined) {
      return {
        admit: false,
        reasons: [`metric "${name}" is not reported by this platform — the ${floor} floor fails closed`],
        rejectedBy: "floors",
      };
    }
    if (value < floor) {
      return {
        admit: false,
        reasons: [`${name} ${value} is under the ${floor} floor`],
        rejectedBy: "floors",
      };
    }
    reasons.push(`${name} ${value} ≥ floor ${floor}`);
  }

  const delta = longitudinal?.deltaVelocity ?? null;
  const baseline = longitudinal?.baselineDeltaVelocity ?? null;
  if (delta !== null && baseline !== null && baseline > 0) {
    if (delta < knobs.velocityMultiple * baseline) {
      return {
        admit: false,
        reasons: [
          `Δ-velocity ${round2(delta)}/h is under ${knobs.velocityMultiple}× the account's stored baseline ${round2(baseline)}/h`,
        ],
        rejectedBy: "velocity",
      };
    }
    reasons.push(
      `Δ-velocity ${round2(delta)}/h is ≥ ${knobs.velocityMultiple}× the account's stored baseline ${round2(baseline)}/h`,
    );
  } else {
    reasons.push("Δ-velocity baseline unarmed (insufficient stored history/peers) — floors carried the decision");
  }

  return { admit: true, reasons };
}

/** The provenance stamp every auto-admitted source carries in `meta.origin`. */
export function admissionOrigin(areaId: string): string {
  return `auto-admission:${areaId}`;
}

export interface AdmissionRefusal {
  areaId: string;
  externalId: string;
  /** The budget rail's message, verbatim — reported, never silent, never fatal to the sweep. */
  reason: string;
}

export interface AreaAdmissionSummary {
  areaId: string;
  areaName: string;
  enabled: boolean;
  /** Candidates attributed to this area this sweep (best-relevance attribution — each item consulted exactly once). */
  considered: number;
  /** NEW sources created through the door this sweep. */
  admitted: number;
  /** Known content re-encountered (content-hash match) — fresh metric snapshots appended, no cap slot, no embed spend. */
  reEncountered: number;
  /** Why-counts for everything turned away — the operator sees the knob to turn. */
  rejected: { bodyLength: number; floors: number; velocity: number; denylist: number; cap: number };
  /** Slots left in this area's UTC-day cap after this sweep — read from the durable trend_admissions ledger (L0), races included. */
  capRemaining: number;
}

export interface AdmissionsResult {
  admitted: Array<{ externalId: string; sourceId: string; areaId: string }>;
  reEncountered: Array<{ externalId: string; sourceId: string; areaId: string }>;
  byArea: AreaAdmissionSummary[];
  /** Budget-rail refusals, verbatim. The loop halts on the first one (the daily budget is tenant-wide — further embeds would refuse too) and retries next sweep. */
  budgetRefusals: AdmissionRefusal[];
}

/** A fresh empty result — what an area-less sweep reports (never a shared constant; callers own their arrays). */
export function emptyAdmissions(): AdmissionsResult {
  return { admitted: [], reEncountered: [], byArea: [], budgetRefusals: [] };
}

export interface RunAdmissionsArgs {
  /** Driver name — provenance on the admitted source's `meta.trend.source`. */
  source: string;
  /** The sweep's "now", ms epoch — clock stays an argument (SPINE §1). */
  nowMs: number;
  /** The tenant's G1 denylist terms — denylisted content never enters the exemplar library. */
  denylist: string[];
  /**
   * Every ACTIVE area this sweep, so areas with zero candidates still report
   * a summary row. `admission` is the area ROW's knob-override block
   * (`config.admission`, the L0 window) — the per-area layer of the
   * two-layer resolution.
   */
  areas: ReadonlyArray<{ id: string; name: string; admission?: AdmissionKnobOverrides }>;
  /** The sweep's ranked feed, score-descending — cap slots go to the best-ranked qualifiers. */
  ranked: readonly RankedCandidate[];
  /** Best-relevance area per item (the intake's existing attribution) — the area whose knobs govern. */
  attribution: ReadonlyMap<string, { areaId: string; areaName: string }>;
  /** Stored-history Δ-velocity per item, from the ranking stage — never re-fetched here. */
  longitudinal: ReadonlyMap<string, LongitudinalScore>;
  /** Items the legacy B3.12 door already ingested or screened this sweep — never double-processed. */
  alreadyProcessed: ReadonlySet<string>;
  config?: AdmissionConfigInput;
}

export interface RunAdmissionsDeps {
  embedder?: EmbeddingDriver;
  objectStore?: ObjectStore;
  capTokens?: number;
}

/**
 * One sweep's admission pass. Candidates are consulted in RANKED order
 * (deterministic, best first — cap slots are scarce), each item exactly
 * once under its best-relevance area's knobs. Per candidate, in order:
 * knobs gate (pure math above) → G1 denylist → content-hash pre-check
 * (the kickoff's belt over the door's own idempotency: known text never
 * takes a cap slot, and "never admit the same text twice" holds by
 * construction) → UTC-day cap → the one ingest door. A re-encounter still
 * rides the door so fresh engagement metrics append (source_metrics is
 * append-only) without spending budget or slots.
 *
 * Budget honesty: a BudgetExceededError from the metered embed is recorded
 * verbatim and HALTS the pass — the cap is tenant-wide-daily, so pressing
 * on would only echo refusals — while the sweep itself continues unharmed.
 * Any other door error propagates (fail loud, the legacy door's contract).
 *
 * Cap honesty (durable since L0): every CREATED admission first claims one
 * slot in the trend_admissions ledger — claims serialize on the unique
 * (tenant, area, day, slot) index, so two sweeps racing one tenant can
 * NEVER overshoot the cap (the s72 in-memory read-then-advance count is
 * gone). Same-content re-claims replay idempotently on (area, day,
 * content_hash): a claim whose ingest failed last sweep returns its
 * existing slot instead of burning another, and a slot claimed for an
 * ingest that never completes stays claimed — undershoot, never overshoot.
 */
export async function runAdmissions(
  ctx: TenantCtx,
  repos: Repos,
  args: RunAdmissionsArgs,
  deps: RunAdmissionsDeps = {},
): Promise<AdmissionsResult> {
  const config = admissionConfigSchema.parse(args.config ?? {});
  const todayCounts = await repos.trendAdmissions.countsForDay(ctx, args.nowMs);

  const summaries = new Map<string, AreaAdmissionSummary>();
  const knobsByArea = new Map<string, AdmissionKnobs>();
  for (const area of args.areas) {
    const knobs = resolveAdmissionKnobs(config.defaults, area.admission);
    knobsByArea.set(area.id, knobs);
    summaries.set(area.id, {
      areaId: area.id,
      areaName: area.name,
      enabled: knobs.enabled,
      considered: 0,
      admitted: 0,
      reEncountered: 0,
      rejected: { bodyLength: 0, floors: 0, velocity: 0, denylist: 0, cap: 0 },
      capRemaining: Math.max(0, knobs.maxAdmissionsPerDay - (todayCounts.get(area.id) ?? 0)),
    });
  }

  const result: AdmissionsResult = {
    admitted: [],
    reEncountered: [],
    byArea: [...summaries.values()],
    budgetRefusals: [],
  };
  const consulted = new Set<string>(args.alreadyProcessed);

  for (const row of args.ranked) {
    const { item } = row;
    if (consulted.has(item.externalId)) continue;
    const attributed = args.attribution.get(item.externalId);
    // Only the best-relevance area's row governs; other area rows for the
    // same item are skipped WITHOUT consuming the item (its governing row
    // may rank later in the feed).
    if (!attributed || attributed.areaId !== row.areaId) continue;
    consulted.add(item.externalId);

    const summary = summaries.get(row.areaId);
    const knobs = knobsByArea.get(row.areaId);
    if (!summary || !knobs) continue; // unreachable: attribution only names active areas
    summary.considered++;
    if (!knobs.enabled) continue;

    const decision = decideAdmission(item, args.longitudinal.get(item.externalId), knobs);
    if (!decision.admit) {
      if (decision.rejectedBy === "bodyLength") summary.rejected.bodyLength++;
      else if (decision.rejectedBy === "floors") summary.rejected.floors++;
      else if (decision.rejectedBy === "velocity") summary.rejected.velocity++;
      continue;
    }

    const g1 = runG1Denylist({ body: item.text, denylist: args.denylist });
    if (g1.verdict === "fail") {
      summary.rejected.denylist++;
      continue;
    }

    // The door hashes the PII-STRIPPED text — the pre-check must match it
    // byte-for-byte or the dedup lies (and the ledger keys on the same hash).
    const contentHash = sha256Hex(stripPii(item.text).text);
    const existing = await repos.sources.getByContentHash(ctx, contentHash);
    if (!existing) {
      // NEW content takes a durable cap slot BEFORE the door; a known
      // source re-encounter never claims (fresh snapshots, no slot).
      const claim = await repos.trendAdmissions.claim(ctx, {
        areaId: row.areaId,
        nowMs: args.nowMs,
        cap: knobs.maxAdmissionsPerDay,
        contentHash,
        source: args.source,
        externalId: item.externalId,
      });
      if (!claim.claimed) {
        summary.rejected.cap++;
        summary.capRemaining = Math.max(0, knobs.maxAdmissionsPerDay - claim.capUsed);
        continue;
      }
      // Slots are monotonic within the day, so the claimed slot IS the
      // committed count at claim time — remaining stays honest under races.
      summary.capRemaining = Math.max(0, knobs.maxAdmissionsPerDay - claim.claim.slot);
    }

    try {
      const ingest = await ingestExemplar(
        ctx,
        repos,
        {
          kind: "exemplar",
          text: item.text,
          uri: item.url,
          meta: {
            origin: admissionOrigin(row.areaId),
            trend: {
              source: args.source,
              externalId: item.externalId,
              account: item.account,
              publishedAt: item.publishedAt,
              capturedAtMs: args.nowMs,
              reasons: decision.reasons,
              areaId: row.areaId,
              areaName: row.areaName,
            },
          },
          metrics: Object.entries(item.metrics).map(([name, value]) => ({ name, value })),
        },
        { embedder: deps.embedder, objectStore: deps.objectStore, capTokens: deps.capTokens },
      );
      if (ingest.created) {
        summary.admitted++;
        result.admitted.push({ externalId: item.externalId, sourceId: ingest.sourceId, areaId: row.areaId });
      } else {
        summary.reEncountered++;
        result.reEncountered.push({ externalId: item.externalId, sourceId: ingest.sourceId, areaId: row.areaId });
      }
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        result.budgetRefusals.push({
          areaId: row.areaId,
          externalId: item.externalId,
          reason: err.message,
        });
        break;
      }
      throw err;
    }
  }

  return result;
}
