import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import {
  detectHorizonOpportunities,
  horizonConfigSchema,
  type HorizonConfigInput,
  type HorizonScore,
  type SearchSnapshotPoint,
} from "./horizon";
import { searchPollRequestSchema, type SearchIntelSource, type SearchPollRequestInput } from "./search-source";

/**
 * B6.8 search-intel orchestration — the demand-side mirror of
 * ../trend/intake.ts, deliberately thinner: search intel WATCHES (append
 * history, run math), it never ingests content — there is no exemplar to
 * store, so polling leaves exactly one kind of residue: `search_snapshots`
 * history rows, append-only and idempotent per capture instant. The
 * flywheel (ADR 0006 decision 3): publish → impressions/position accrue
 * here → `runHorizonScan` flags what the tenant almost ranks for →
 * generation targets it via `search_targets`.
 */

export interface SearchIntakeRequest {
  /** The poll window — runtime data, validated at this boundary. */
  poll: SearchPollRequestInput;
  /** The sweep's "now", ms epoch — the capture clock is an argument, never read in core (SPINE §1). */
  nowMs: number;
}

export interface SearchIntakeDeps {
  /** The SearchIntelSource seam driver (GSC live at B6.7; the fake in tests/dogfood). */
  source: SearchIntelSource;
}

export interface SearchIntakeResult {
  polled: number;
  /** History rows appended this sweep (0 on an exact same-instant replay — the append is idempotent on tenant+source+query+page+capturedAt). */
  snapshotsAppended: number;
}

/** One polling sweep: poll (seam, read-only) → append-only history. */
export async function runSearchIntake(
  ctx: TenantCtx,
  repos: Repos,
  request: SearchIntakeRequest,
  deps: SearchIntakeDeps,
): Promise<SearchIntakeResult> {
  const poll = searchPollRequestSchema.parse(request.poll);
  const rows = await deps.source.poll(poll);
  const capturedAt = new Date(request.nowMs);

  let snapshotsAppended = 0;
  for (const row of rows) {
    const { created } = await repos.searchSnapshots.append(ctx, {
      source: deps.source.name,
      query: row.query,
      page: row.page,
      metrics: row.metrics,
      capturedAt,
    });
    if (created) snapshotsAppended++;
  }
  return { polled: rows.length, snapshotsAppended };
}

export interface HorizonScanResult {
  /** Distinct (query, page) series found in the stored history. */
  series: number;
  /** Every series with its scores + fired rules — full operator transparency, opportunity or not. */
  scored: HorizonScore[];
  /** The subset where all three rules fired — demand the tenant almost ranks for. */
  opportunities: HorizonScore[];
}

/**
 * The read side: a driver's stored history — bounded to the config's
 * `windowDays` behind `nowMs` (the clock is an argument, never read in
 * core) — → deterministic horizon math (./horizon.ts, pure). Thresholds/
 * windows are per-tenant config with defaults; every opportunity carries
 * its reason strings. The bounded read is index-aligned and keeps the scan
 * flat as append-only history grows (B6.7 volume readiness).
 */
export async function runHorizonScan(
  ctx: TenantCtx,
  repos: Repos,
  request: { source: string; nowMs: number; config?: HorizonConfigInput },
): Promise<HorizonScanResult> {
  const config = horizonConfigSchema.parse(request.config ?? {});
  const since = new Date(request.nowMs - config.windowDays * 86_400_000);
  const history = await repos.searchSnapshots.listBySource(ctx, request.source, { since });
  const points: SearchSnapshotPoint[] = history.map((row) => ({
    query: row.query,
    page: row.page,
    capturedAtMs: row.capturedAt.getTime(),
    metrics: row.metrics as Record<string, number>,
  }));
  const scored = detectHorizonOpportunities(points, config);
  return {
    series: scored.length,
    scored,
    opportunities: scored.filter((score) => score.isOpportunity),
  };
}
