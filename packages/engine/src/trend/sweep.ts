import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { getObjectStore, objectKey, readEnv, type ObjectStore } from "@thalon/platform";
import { z } from "zod";
import type { EmbeddingDriver } from "../ingest/shell/embedder";
import type { AreaExpansionConfigInput, SweepAreaInput } from "./area-expansion";
import { generateTrendDossiers, type DossierCardInput } from "./dossier";
import { runTrendIntake, type TrendIntakeResult } from "./intake";
import type { OutlierConfigInput } from "./outliers";
import type { RankerConfigInput } from "./ranker";
import type { DossierDriver } from "./shell/dossier";
import { getTrendSource } from "./source-registry";
import type { TrendSource } from "./trend-source";

/**
 * B6.5: ONE scheduled/manual sweep for one tenant — the poller the B6.2
 * route seams waited on. Orchestration only (the math stays in intake/
 * ranker): monitored areas come from the repo, `runTrendIntake` polls the
 * env-selected TrendSource and ranks, and the ranked feed persists as ONE
 * wire-ready bundle at `sweeps/<tenantId>.json` so `/api/intel/trends`
 * swaps its card source to a plain object-store read (the route-seam
 * design: "the poller or a job persists results, the route swaps its card
 * source").
 *
 * `sweeps/` is a MUTABLE POINTER family — latest-sweep-wins, overwritten
 * every run (the sweep archive stays parked, workspace-ux-v2 §2; history
 * for velocity math lives in trend_snapshots, which intake appends
 * regardless). It is protected from the B4.6 orphan sweep because no db
 * row references it by design.
 *
 * Cards are per (item × area) — no areas configured = an empty card list
 * (honest: monitored areas ARE the trends tab), while snapshots/outlier
 * ingest still ran for the base watchlist. `nextSweepAtMs` is advisory
 * arithmetic (sweptAt + interval) — real scheduling infra is B6.7 deploy
 * work (cron); Sweep-now and dev runs call this directly.
 */

export const SWEEP_BUNDLE_VERSION = 1;

/** Where a tenant's latest sweep bundle lives. */
export function sweepBundleKey(tenantId: string): string {
  return objectKey("sweeps", tenantId, "json");
}

const sweepCardSchema = z.object({
  /** `${areaId}:${externalId}` — stable across sweeps for the same pairing. */
  id: z.string().min(1),
  source: z.string().min(1),
  externalId: z.string().min(1),
  url: z.string().optional(),
  /** Platform thumbnail passthrough (Source-Link Rule visual identity) — absent when the driver offers none. */
  thumbnailUrl: z.string().optional(),
  text: z.string(),
  account: z.string(),
  publishedAtMs: z.number(),
  metrics: z.record(z.string(), z.number()),
  areaId: z.string(),
  areaName: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
  isOutlier: z.boolean(),
  shareToView: z.number().nullable(),
  bookmarkToView: z.number().nullable(),
  /** Live title/angle generation is gateway-gated — absent until it arms (never fabricated). */
  dossier: z
    .object({ titles: z.array(z.string()), angles: z.array(z.string()), hook: z.string() })
    .optional(),
});
export type SweepCard = z.infer<typeof sweepCardSchema>;

export const sweepBundleSchema = z.object({
  version: z.literal(SWEEP_BUNDLE_VERSION),
  source: z.string().min(1),
  sweptAtMs: z.number(),
  intervalMs: z.number(),
  nextSweepAtMs: z.number(),
  polled: z.number(),
  snapshotsAppended: z.number(),
  ingested: z.number(),
  screened: z.number(),
  areasSwept: z.number(),
  cards: z.array(sweepCardSchema),
});
export type SweepBundle = z.infer<typeof sweepBundleSchema>;

export interface TrendSweepRequest {
  /** The sweep's "now", ms epoch — the clock is an argument, never read in core (SPINE §1). */
  nowMs: number;
  /** Base watchlist merged with area expansion — accounts to watch, extra standing queries. */
  watchlist?: { accounts?: string[]; queries?: string[] };
  expansionConfig?: AreaExpansionConfigInput;
  rankerConfig?: RankerConfigInput;
  outlierConfig?: OutlierConfigInput;
  /** Advisory cadence for the stamp (default 4h). */
  intervalMs?: number;
  /** Bundle card cap, score-descending (default 30) — the CUT COUNT is reported, never silent. */
  maxCards?: number;
  /**
   * How many top-ranked cards get a generated dossier this sweep (the B6.5
   * half-step). Defaults to `TREND_DOSSIER_CARDS` (env, default 0 =
   * disarmed) — dossiers are gateway spend, so arming is an operator
   * decision, per-sweep spend a config ration. Cards beyond the ration
   * honestly carry no dossier (the wire field stays optional).
   */
  dossierCards?: number;
}

export interface TrendSweepDeps {
  /** Explicit driver override (tests) — defaults to the env-selected registry source. */
  source?: TrendSource;
  embedder?: EmbeddingDriver;
  objectStore?: ObjectStore;
  /** Dossier shell override (tests) — defaults to the real gateway driver when the ration arms. */
  dossierDriver?: DossierDriver;
  capTokens?: number;
}

export interface TrendSweepResult {
  bundle: SweepBundle;
  /** Ranked rows the maxCards cap cut from the bundle (no-silent-caps rule). */
  cardsCut: number;
  /** Per-card dossier failures, verbatim (empty when disarmed) — reported, never silent. */
  dossiersFailed: Array<{ cardId: string; reason: string }>;
  intake: TrendIntakeResult;
}

const DEFAULT_INTERVAL_MS = 4 * 3_600_000;
const DEFAULT_MAX_CARDS = 30;

export async function runTrendSweep(
  ctx: TenantCtx,
  repos: Repos,
  request: TrendSweepRequest,
  deps: TrendSweepDeps = {},
): Promise<TrendSweepResult> {
  const source = deps.source ?? getTrendSource();
  const objectStore = deps.objectStore ?? getObjectStore();
  const intervalMs = request.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxCards = request.maxCards ?? DEFAULT_MAX_CARDS;

  const areas = await repos.monitoredAreas.list(ctx, { status: "active" });
  // Durable watchlists (B4.3 rows) feed the poll at last — every stored list
  // this driver serves, merged with the request's extras (dedup, first wins).
  const stored = await repos.watchlists.listBySource(ctx, source.name);
  const dedup = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  const intake = await runTrendIntake(
    ctx,
    repos,
    {
      watchlist: {
        source: source.name,
        accounts: dedup([
          ...stored.flatMap((w) => (w.accounts as string[] | null) ?? []),
          ...(request.watchlist?.accounts ?? []),
        ]),
        queries: dedup([
          ...stored.flatMap((w) => (w.queries as string[] | null) ?? []),
          ...(request.watchlist?.queries ?? []),
        ]),
      },
      // Repo rows pass the TYPE door as SweepAreaInput (config is a jsonb
      // `unknown` column); sweepAreaSchema re-validates every row at the
      // intake boundary (the B6.4 test-pinned contract).
      areas: areas as SweepAreaInput[],
      expansionConfig: request.expansionConfig,
      rankerConfig: request.rankerConfig,
      outlierConfig: request.outlierConfig,
      nowMs: request.nowMs,
    },
    {
      source,
      embedder: deps.embedder,
      objectStore,
      capTokens: deps.capTokens,
    },
  );

  const scoredByExternalId = new Map(intake.scored.map((s) => [s.item.externalId, s]));
  const rankedDesc = [...intake.ranked].sort((a, b) => b.score - a.score);
  const cards: SweepCard[] = rankedDesc.slice(0, maxCards).map((row) => {
    const scored = scoredByExternalId.get(row.item.externalId);
    return {
      id: `${row.areaId}:${row.item.externalId}`,
      source: source.name,
      externalId: row.item.externalId,
      url: row.item.url,
      thumbnailUrl: row.item.thumbnailUrl,
      text: row.item.text,
      account: row.item.account,
      publishedAtMs: row.item.publishedAt,
      metrics: row.item.metrics,
      areaId: row.areaId,
      areaName: row.areaName,
      score: row.score,
      reasons: row.reasons,
      isOutlier: scored?.isOutlier ?? false,
      shareToView: scored?.shareToView ?? null,
      bookmarkToView: scored?.bookmarkToView ?? null,
    };
  });

  // Dossier ration (B6.5 half-step): generate for the TOP dossierCards
  // cards only — gateway spend is an explicit per-sweep config ration,
  // default disarmed. Failures degrade per card (reported below); a blown
  // tenant budget still propagates as the operational halt it is.
  const dossierCards = request.dossierCards ?? readEnv().TREND_DOSSIER_CARDS;
  let dossiersFailed: TrendSweepResult["dossiersFailed"] = [];
  if (dossierCards > 0 && cards.length > 0) {
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const inputs: DossierCardInput[] = cards.slice(0, dossierCards).map((card) => ({
      cardId: card.id,
      itemText: card.text,
      source: card.source,
      account: card.account,
      areaName: card.areaName,
      areaDescription: areaById.get(card.areaId)?.description ?? card.areaName,
    }));
    const generated = await generateTrendDossiers(ctx, repos, inputs, {
      driver: deps.dossierDriver,
      capTokens: deps.capTokens,
    });
    for (const card of cards) {
      const dossier = generated.dossiers.get(card.id);
      if (dossier) {
        card.dossier = { titles: dossier.titles, angles: dossier.angles, hook: dossier.hook };
      }
    }
    dossiersFailed = generated.failed;
  }

  const bundle: SweepBundle = {
    version: SWEEP_BUNDLE_VERSION,
    source: source.name,
    sweptAtMs: request.nowMs,
    intervalMs,
    nextSweepAtMs: request.nowMs + intervalMs,
    polled: intake.polled,
    snapshotsAppended: intake.snapshotsAppended,
    ingested: intake.ingested.length,
    screened: intake.screened.length,
    areasSwept: areas.length,
    cards,
  };
  await objectStore.put(sweepBundleKey(ctx.tenantId), JSON.stringify(bundle));

  return { bundle, cardsCut: Math.max(0, rankedDesc.length - cards.length), dossiersFailed, intake };
}

/** The route-side read: the tenant's latest bundle, schema-validated, or null before the first sweep. */
export async function readSweepBundle(
  tenantId: string,
  objectStore: ObjectStore = getObjectStore(),
): Promise<SweepBundle | null> {
  const raw = await objectStore.get(sweepBundleKey(tenantId));
  if (!raw) return null;
  return sweepBundleSchema.parse(JSON.parse(raw.toString("utf8")));
}
