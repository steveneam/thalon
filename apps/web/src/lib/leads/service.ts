import { icpSchema, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Repos } from "@thalon/db";
import {
  importLeadsCsv,
  runLeadScoring,
  syncWaitlistLeads,
  type CsvImportReport,
  type LeadScoringDeps,
  type LeadScoringResult,
  type WaitlistSyncResult,
} from "@thalon/engine";
import { toLeadCard } from "./serialize";
import type { LeadsPayload } from "./types";

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
  return {
    leads: cards,
    scoringArmed: icp !== null,
    currentProfileHash: icp ? sha256Hex(stableStringify(icp)) : null,
    counts: {
      new: cards.filter((c) => c.status === "new").length,
      scored: cards.filter((c) => c.status === "scored").length,
      dismissed: cards.filter((c) => c.status === "dismissed").length,
    },
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
