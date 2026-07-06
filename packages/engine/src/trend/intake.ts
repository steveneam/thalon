import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import { runG1Denylist } from "@thalon/judge";
import { getObjectStore, getTracer, modelTiers, readEnv, type ObjectStore } from "@thalon/platform";
import { embedChunks } from "../ingest";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "../ingest/shell/embedder";
import { ingestExemplar } from "../exemplar/ingest-exemplar";
import {
  expandAreas,
  mergeQueries,
  sweepAreaSchema,
  type AreaExpansionConfigInput,
  type AreaQueryExpansion,
  type SweepArea,
  type SweepAreaInput,
} from "./area-expansion";
import { detectLongitudinalOutlier, type SnapshotPoint } from "./longitudinal";
import { detectOutliers, outlierConfigSchema, type OutlierConfig, type OutlierConfigInput, type ScoredItem } from "./outliers";
import { rankCandidates, type RankableCandidate, type RankedCandidate, type RankerConfigInput } from "./ranker";
import type { TrendSource } from "./trend-source";
import { watchlistSchema, type WatchlistInput } from "./watchlist";

export interface TrendIntakeRequest {
  /** Per-tenant watchlist — runtime config, validated at this boundary. */
  watchlist: WatchlistInput;
  /**
   * B6.4: monitored areas driving candidate generation + ranking — rows from
   * `repos.monitoredAreas.list(ctx)` parse directly; paused areas leave no
   * residue. Omitted/empty = the plain accounts+queries sweep, byte-identical
   * to pre-B6.4 behavior (no expansion, no embedding call, no ranking).
   */
  areas?: SweepAreaInput[];
  /** B6.4: tenant-default query ration for area expansion (each area's config.maxQueriesPerSweep overrides). */
  expansionConfig?: AreaExpansionConfigInput;
  /** B6.4: tenant-default ranker weights + freshness half-life (per-area weight overrides ride each area's config). */
  rankerConfig?: RankerConfigInput;
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
  /** B6.4: per-ACTIVE-area expansion records — the queries fed into this sweep's poll plus what the ration cut. Empty when the request carried no active areas. */
  areas: AreaQueryExpansion[];
  /** B6.4: the ranked (item × area) feed, score-descending — EdgeRank-shaped deterministic scores with a reason line per armed signal. Empty when the request carried no active areas. */
  ranked: RankedCandidate[];
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
 * only outliers become sources).
 *
 * B6.4 (A12 / ADR 0005 decision 3) — intel v2's two-stage pipeline, active
 * only when the request carries monitored areas:
 *
 *  - CANDIDATE GENERATION: active areas expand deterministically into
 *    rationed queries (./area-expansion.ts) merged into the watchlist's
 *    queries before the poll; accounts polling stays exactly as today.
 *  - RANKING: every polled item scores against every active area
 *    (./ranker.ts) — relevance (embedding cosine of item text vs the area
 *    description) × engagement ratios (the ./outliers.ts scores) ×
 *    velocity/freshness (single-sweep velocity + the stored-history
 *    Δ-velocity of ./longitudinal.ts, wired here to live sweeps as pass 3
 *    promised). Embeddings ride the EXISTING metered embedChunks choke
 *    point — content-addressed cache, so unchanged area descriptions cost
 *    nothing after their first sweep; no new gateway call-site.
 *  - PROVENANCE: each ingested outlier carries its best-RELEVANCE area as
 *    additive `areaId`/`areaName` keys on the existing `sources.meta.trend`
 *    payload (attribution is "which area does this belong to" — a relevance
 *    question, not a total-score one).
 */
export async function runTrendIntake(
  ctx: TenantCtx,
  repos: Repos,
  request: TrendIntakeRequest,
  deps: TrendIntakeDeps,
): Promise<TrendIntakeResult> {
  const watchlist = watchlistSchema.parse(request.watchlist);
  const config = outlierConfigSchema.parse(request.outlierConfig ?? {});
  const activeAreas = (request.areas ?? [])
    .map((area) => sweepAreaSchema.parse(area))
    .filter((area) => area.status === "active");
  const expansion = expandAreas(activeAreas, request.expansionConfig ?? {});
  const sweepWatchlist =
    expansion.queries.length > 0
      ? { ...watchlist, queries: mergeQueries([...watchlist.queries, ...expansion.queries]) }
      : watchlist;

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(
      `tenant ${ctx.tenantId} has no active brand profile — the intake's denylist screen reads it; create one first`,
    );
  }
  const denylist = (profile.denylist as string[] | null) ?? [];

  const items = await deps.source.poll(sweepWatchlist);
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

  // B6.4 ranking stage — after the snapshot append, so this sweep is the
  // latest stored point and Δ-velocity reads previous-sweep → now.
  let ranked: RankedCandidate[] = [];
  const areaTagByItem = new Map<string, { areaId: string; areaName: string; relevance: number }>();
  if (activeAreas.length > 0 && items.length > 0) {
    ranked = await rankSweep(ctx, repos, { activeAreas, scored, config, request }, deps);
    for (const row of ranked) {
      const current = areaTagByItem.get(row.item.externalId);
      // Best RELEVANCE wins; ties keep the first row in ranked order (which
      // is already deterministic), so attribution is stable across replays.
      if (!current || row.components.relevance > current.relevance) {
        areaTagByItem.set(row.item.externalId, {
          areaId: row.areaId,
          areaName: row.areaName,
          relevance: row.components.relevance,
        });
      }
    }
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
    const areaTag = areaTagByItem.get(item.externalId);
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
            // B6.4: area provenance as ADDITIVE keys on the existing payload
            // (sources.meta stays schema-free; absent when no areas swept).
            ...(areaTag ? { areaId: areaTag.areaId, areaName: areaTag.areaName } : {}),
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

  return {
    polled: items.length,
    snapshotsAppended,
    scored,
    areas: expansion.expansions,
    ranked,
    ingested,
    screened,
  };
}

/**
 * The B6.4 ranking stage: stored-history Δ-velocity per item, one metered
 * embedding call for [area descriptions..., item texts...], then the pure
 * ranker. Longitudinal thresholds derive from the sweep's outlier config —
 * one config source per sweep (views metric name, velocity multiple, peer
 * floor); the snapshot-interval floor keeps its own default.
 */
async function rankSweep(
  ctx: TenantCtx,
  repos: Repos,
  args: {
    activeAreas: SweepArea[];
    scored: ScoredItem[];
    config: OutlierConfig;
    request: TrendIntakeRequest;
  },
  deps: TrendIntakeDeps,
): Promise<RankedCandidate[]> {
  const { activeAreas, scored, config, request } = args;
  const longitudinalConfig = {
    viewsMetric: config.metricNames.views,
    velocityMultiple: config.velocityMultiple,
    minBaselinePeers: config.minBaselinePeers,
  };

  const historyByAccount = new Map<string, SnapshotPoint[]>();
  for (const account of new Set(scored.map((s) => s.item.account))) {
    const rows = await repos.trendSnapshots.listByAccount(ctx, {
      source: deps.source.name,
      account,
    });
    historyByAccount.set(
      account,
      rows.map((row) => ({
        externalId: row.externalId,
        account: row.account,
        capturedAtMs: row.capturedAt.getTime(),
        metrics: row.metrics as Record<string, number>,
      })),
    );
  }

  // One embed call through the EXISTING ingest choke point (budget checked,
  // usage recorded, content-addressed cache — an unchanged area description
  // or re-swept item text is a cache hit, never fresh spend).
  const texts = [...activeAreas.map((a) => a.description), ...scored.map((s) => s.item.text)];
  const chunks = texts.map((text, seq) => ({
    seq,
    text,
    tokenCount: text.split(/\s+/).filter(Boolean).length,
    contentHash: sha256Hex(text),
  }));
  const model = modelTiers().embedding;
  const embedded = await embedChunks(
    ctx,
    repos,
    { chunks, model, capTokens: deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET },
    {
      driver: deps.embedder ?? createGatewayEmbeddingDriver(model),
      tracer: getTracer(),
      objectStore: deps.objectStore ?? getObjectStore(),
    },
  );

  const rankableAreas = activeAreas.map((area, i) => ({
    id: area.id,
    name: area.name,
    weights: area.config.weights,
    vector: embedded[i].embedding,
  }));
  const rankableCandidates: RankableCandidate[] = scored.map((s, i) => {
    const accountPoints = historyByAccount.get(s.item.account) ?? [];
    return {
      scored: s,
      vector: embedded[activeAreas.length + i].embedding,
      longitudinal: detectLongitudinalOutlier(
        accountPoints.filter((p) => p.externalId === s.item.externalId),
        accountPoints,
        longitudinalConfig,
      ),
    };
  });

  return rankCandidates(
    rankableCandidates,
    rankableAreas,
    request.rankerConfig ?? {},
    config,
    request.nowMs,
  );
}
