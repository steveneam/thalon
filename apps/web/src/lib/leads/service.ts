import { icpSchema, leadWeightMultipliersSchema, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Repos } from "@thalon/db";
import {
  importLeadsCsv,
  runLeadScoring,
  runLeadWeightLearning,
  syncWaitlistLeads,
  type CsvImportReport,
  type LeadScoringDeps,
  type LeadScoringResult,
  type LeadWeightLearningResult,
  type WaitlistSyncResult,
} from "@thalon/engine";
import { toLeadCard } from "./serialize";
import type { LeadsPayload, LearnedWeightsInfo } from "./types";

/**
 * Leads service layer (the sweep-runner pattern, SPINE §80): routes stay
 * thin — authorize → call here → serialize. Deps injectable so tests stay
 * keyless; production defaults ride the engine's metered choke points.
 * The clock enters HERE (Date.now()), never in core.
 */

export async function readLeadsPayload(ctx: TenantCtx, repos: Repos): Promise<LeadsPayload> {
  const leads = await repos.leads.list(ctx);
  const cards = await Promise.all(
    leads.map(async (lead) => toLeadCard(lead, await repos.leadScores.latestByLead(ctx, lead.id))),
  );
  const profile = await repos.brandProfiles.getActive(ctx);
  const icp = profile?.icp ? icpSchema.parse(profile.icp) : null;
  const currentProfileHash = icp ? sha256Hex(stableStringify(icp)) : null;
  return {
    leads: cards,
    scoringArmed: icp !== null,
    currentProfileHash,
    learnedWeights: await readLearnedWeights(ctx, repos, currentProfileHash),
    counts: {
      new: cards.filter((c) => c.status === "new").length,
      scored: cards.filter((c) => c.status === "scored").length,
      dismissed: cards.filter((c) => c.status === "dismissed").length,
    },
  };
}

/**
 * The provenance join (B-crm.5 back half): the newest learned state for the
 * CURRENT ICP — exactly what the scoring job would apply on its next run.
 * A drifted profile finds nothing; when older learning exists we say so
 * (staleForProfile) instead of silently reporting "base weights".
 */
async function readLearnedWeights(
  ctx: TenantCtx,
  repos: Repos,
  currentProfileHash: string | null,
): Promise<LearnedWeightsInfo> {
  if (!currentProfileHash) return { state: null, staleForProfile: false };
  const state = await repos.leadWeightStates.latestForProfile(ctx, currentProfileHash);
  if (!state) {
    const history = await repos.leadWeightStates.list(ctx, { limit: 1 });
    return { state: null, staleForProfile: history.length > 0 };
  }
  // Evidence is an open jsonb record at the write door; read the two counts defensively.
  const evidence = (state.evidence ?? {}) as Record<string, unknown>;
  return {
    state: {
      id: state.id,
      computedAt: state.computedAt.toISOString(),
      rows: typeof evidence.rows === "number" ? evidence.rows : 0,
      verdicts: typeof evidence.verdicts === "number" ? evidence.verdicts : 0,
      // Validated again at the read seam even though the write door parsed it (the scoring-job convention).
      multipliers: leadWeightMultipliersSchema.parse(state.multipliers),
    },
    staleForProfile: false,
  };
}

/** Import, then score what arrived (when armed) — the CSV → ranked-queue promise in one call. */
export async function importCsvAndScore(
  ctx: TenantCtx,
  repos: Repos,
  csv: string,
  deps: LeadScoringDeps = {},
): Promise<{ report: CsvImportReport; scoring: LeadScoringResult }> {
  const report = await importLeadsCsv(ctx, repos, { csv });
  const scoring = await runLeadScoring(ctx, repos, { nowMs: Date.now() }, deps);
  return { report, scoring };
}

/** Bridge the waitlist, then score what arrived (when armed). */
export async function syncWaitlistAndScore(
  ctx: TenantCtx,
  repos: Repos,
  deps: LeadScoringDeps = {},
): Promise<{ sync: WaitlistSyncResult; scoring: LeadScoringResult }> {
  const sync = await syncWaitlistLeads(ctx, repos);
  const scoring = await runLeadScoring(ctx, repos, { nowMs: Date.now() }, deps);
  return { sync, scoring };
}

export async function scoreNow(
  ctx: TenantCtx,
  repos: Repos,
  deps: LeadScoringDeps = {},
): Promise<LeadScoringResult> {
  return runLeadScoring(ctx, repos, { nowMs: Date.now() }, deps);
}

/**
 * B-crm.5's trigger: run the learn loop over the tenant's triage verdicts.
 * Zero LLM calls, deterministic, idempotent — a replay over unchanged
 * evidence appends nothing and reports `created: false`. Learning never
 * scores: the new state applies on the NEXT scoring pass, never here.
 */
export async function learnNow(ctx: TenantCtx, repos: Repos): Promise<LeadWeightLearningResult> {
  return runLeadWeightLearning(ctx, repos, { nowMs: Date.now() });
}

/**
 * Dismiss/pin/unpin — single or bulk through ONE door (FRONTEND §0: extend
 * the batch pattern, never reinvent per surface). Every action lands as a
 * lead_triage eval row (rule 6: operator signal on the ranking, captured
 * with the scoring context the tuner needs — no raw contact fields). A
 * failing id never aborts the rest of the batch.
 */
export async function triageLeads(
  ctx: TenantCtx,
  repos: Repos,
  action: "dismiss" | "pin" | "unpin",
  ids: string[],
): Promise<{ done: number; failed: Array<{ id: string; error: string }> }> {
  let done = 0;
  const failed: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    try {
      const latest = await repos.leadScores.latestByLead(ctx, id);
      if (action === "dismiss") await repos.leads.setStatus(ctx, id, "dismissed");
      else await repos.leads.setPinned(ctx, id, action === "pin");
      await repos.evalCases.recordLeadTriage(ctx, {
        kind: "lead_rank",
        input: {
          leadId: id,
          score: latest?.score ?? null,
          reasons: (latest?.reasons as string[] | undefined) ?? [],
          profileHash: latest?.profileHash ?? null,
        },
        action: action === "dismiss" ? "dismissed" : action === "pin" ? "pinned" : "unpinned",
        sourceRef: `lead:${id}`,
      });
      done++;
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : "unknown error" });
    }
  }
  return { done, failed };
}
