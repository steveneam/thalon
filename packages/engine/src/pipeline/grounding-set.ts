import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";

/**
 * THE grounding-set resolver — the one owner of the request→grounding merge
 * for every brief-fed entry point (origination, staged video stage 0,
 * webpage). Dedupe + lexicographic sort and existence validation live here,
 * plus the 491089d0 ratchet (s69 root cause): a draft grounds against
 * exactly ONE brief — the current prompt source. Any prompt-kind source in
 * the requested set is a PRIOR brief (the natural re-brief flow carries the
 * old draft's grounding set forward verbatim, old brief included), and the
 * current brief REPLACES it — it never rides beside it. Two near-identical
 * instruction texts in one judged context destabilize the final judge tier
 * (draft 491089d0's twelve-lap record); replacing at this seam makes that
 * state unrepresentable from every caller at once, instead of trusting each
 * caller to pre-filter.
 *
 * The resolved set is what folds into the generation key, the run's
 * provenance params, the prompt assembly, and the draft meta — so a
 * stale-carry re-brief request and a clean one resolve to the SAME run
 * (idempotency by effective inputs), and the replacement itself lands on
 * record via `replacedBriefIds` in the run params, never silently.
 */
export interface ResolvedGroundingSet {
  /** Deduped + sorted non-brief grounding ids — THE set. */
  groundingIds: string[];
  /** Prompt-kind ids the current brief replaced (prior briefs; the brief's own id when echoed back) — deduped + sorted. */
  replacedBriefIds: string[];
}

export async function resolveGroundingSet(
  ctx: TenantCtx,
  repos: Repos,
  requestedIds: string[] | undefined,
): Promise<ResolvedGroundingSet> {
  const groundingIds: string[] = [];
  const replacedBriefIds: string[] = [];
  for (const id of [...new Set(requestedIds ?? [])].sort()) {
    const source = await repos.sources.get(ctx, id);
    if (!source) throw new Error(`grounding source "${id}" not found for this tenant`);
    if (source.kind === "prompt") replacedBriefIds.push(id);
    else groundingIds.push(id);
  }
  return { groundingIds, replacedBriefIds };
}

/** The run-params provenance fragment every caller records: the resolved set plus what the current brief replaced. Empty when neither applies. */
export function groundingRunParams(resolved: ResolvedGroundingSet): Record<string, unknown> {
  return {
    ...(resolved.groundingIds.length > 0 ? { groundingSourceIds: resolved.groundingIds } : {}),
    ...(resolved.replacedBriefIds.length > 0
      ? { replacedBriefSourceIds: resolved.replacedBriefIds }
      : {}),
  };
}
