import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { runG1Denylist } from "@thalon/judge";
import type { ObjectStore } from "@thalon/platform";
import type { EmbeddingDriver } from "../ingest/shell/embedder";
import { ingestExemplar } from "../exemplar/ingest-exemplar";
import { detectOutliers, outlierConfigSchema, type OutlierConfigInput, type ScoredItem } from "./outliers";
import type { TrendSource } from "./trend-source";
import { watchlistSchema, type WatchlistInput } from "./watchlist";

export interface TrendIntakeRequest {
  /** Per-tenant watchlist — runtime config, validated at this boundary. */
  watchlist: WatchlistInput;
  /** Outlier thresholds + metric-name mapping — runtime config; defaults apply when omitted. */
  outlierConfig?: OutlierConfigInput;
  /** The sweep's "now", ms epoch — the velocity clock is an argument, never read in core (SPINE §1). */
  nowMs: number;
}

export interface TrendIntakeDeps {
  /** The TrendSource seam driver (official APIs in pass 2; the fake in tests). */
  source: TrendSource;
  embedder?: EmbeddingDriver;
  objectStore?: ObjectStore;
  /** Overrides the tenant daily token budget cap (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface TrendIntakeResult {
  polled: number;
  /** B4.3: history rows appended to `trend_snapshots` this sweep (0 on an exact same-instant replay — the append is idempotent on tenant+source+item+capturedAt). */
  snapshotsAppended: number;
  /** Every polled item with its scores + fired rules — full operator transparency, outlier or not. */
  scored: ScoredItem[];
  /** Outliers that auto-ingested as exemplars (PII-stripped inside ingestExemplar). `created: false` = a re-sweep of known content; its fresh metric snapshots were still appended. */
  ingested: Array<{ externalId: string; sourceId: string; created: boolean }>;
  /** Outliers the tenant's G1 denylist blocked from ever entering the exemplar library. */
  screened: Array<{ externalId: string; matchedTerms: string[] }>;
}

/**
 * B3.12 entry point (CHARTER B3.12; skeleton in pass 1 per amendment A9):
 * one polling sweep for one tenant watchlist. Poll (seam) → deterministic
 * outlier scoring (./outliers.ts, pure math) → each outlier auto-ingests as
 * an `exemplar` source through the EXISTING B2.4 path (../exemplar/
 * ingest-exemplar.ts: PII stripped before anything is stored or embedded;
 * engagement counters appended as timestamped `source_metrics` snapshots) —
 * feeding the same top-k retrieval every generation already uses. Two
 * gates before ingest, in order:
 *
 *  1. outlier scoring — non-outliers leave NO residue (no source row, no
 *     metrics): watching is not storing;
 *  2. the tenant's G1 denylist over the item text — denylist-screened
 *     content never enters the exemplar library at all (same pure gate the
 *     judge runs first, same per-tenant data).
 *
 * Re-sweeps are idempotent on content (same stripped text → same source,
 * `created: false`) while every sweep appends FRESH metric snapshots —
 * source_metrics is append-only, so engagement history accrues per item.
 *
 * B4.3 (A10 decision 2): EVERY polled item — outlier or not — additionally
 * appends one `trend_snapshots` history row at the sweep's `nowMs`
 * (idempotent on tenant+source+item+capturedAt; watching accrues history,
 * only outliers become sources). The longitudinal Δ-velocity math over that
 * stored history is ./longitudinal.ts — pure and tested now, wired into
 * live polling sweeps in pass 3.
 */
export async function runTrendIntake(
  ctx: TenantCtx,
  repos: Repos,
  request: TrendIntakeRequest,
  deps: TrendIntakeDeps,
): Promise<TrendIntakeResult> {
  const watchlist = watchlistSchema.parse(request.watchlist);
  const config = outlierConfigSchema.parse(request.outlierConfig ?? {});

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(
      `tenant ${ctx.tenantId} has no active brand profile — the intake's denylist screen reads it; create one first`,
    );
  }
  const denylist = (profile.denylist as string[] | null) ?? [];

  const items = await deps.source.poll(watchlist);
  const scored = detectOutliers(items, config, request.nowMs);

  // B4.3: all watched items accrue timestamped engagement history in the
  // dedicated trend_snapshots table — BEFORE any outlier gate (watching is
  // history; storing a source stays outlier-only).
  const capturedAt = new Date(request.nowMs);
  let snapshotsAppended = 0;
  for (const item of items) {
    const { created } = await repos.trendSnapshots.append(ctx, {
      source: deps.source.name,
      externalId: item.externalId,
      account: item.account,
      publishedAt: new Date(item.publishedAt),
      metrics: item.metrics,
      capturedAt,
    });
    if (created) snapshotsAppended++;
  }

  const ingested: TrendIntakeResult["ingested"] = [];
  const screened: TrendIntakeResult["screened"] = [];

  for (const candidate of scored) {
    if (!candidate.isOutlier) continue;
    const { item } = candidate;
    const g1 = runG1Denylist({ body: item.text, denylist });
    if (g1.verdict === "fail") {
      screened.push({
        externalId: item.externalId,
        matchedTerms: [...new Set(g1.evidence.claims.map((claim) => claim.claim))],
      });
      continue;
    }
    const result = await ingestExemplar(
      ctx,
      repos,
      {
        kind: "exemplar",
        text: item.text,
        uri: item.url,
        meta: {
          trend: {
            source: deps.source.name,
            externalId: item.externalId,
            account: item.account,
            publishedAt: item.publishedAt,
            capturedAtMs: request.nowMs,
            reasons: candidate.reasons,
          },
        },
        metrics: Object.entries(item.metrics).map(([name, value]) => ({ name, value })),
      },
      {
        embedder: deps.embedder,
        objectStore: deps.objectStore,
        capTokens: deps.capTokens,
      },
    );
    ingested.push({
      externalId: item.externalId,
      sourceId: result.sourceId,
      created: result.created,
    });
  }

  return { polled: items.length, snapshotsAppended, scored, ingested, screened };
}
