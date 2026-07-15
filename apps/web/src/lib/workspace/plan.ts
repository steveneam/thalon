import { cadenceConfigSchema, tenantCtx } from "@thalon/contracts";
import type { Draft, JudgeResult, Repos, Source } from "@thalon/db";
import { judgeReasons } from "@/lib/approve-queue/judge-reasons";
import { readLiveSweep } from "@/lib/intel/live";
import { demoTenantSlug } from "@/lib/tenant";
import type { PipelineAsset, PlanCadenceRule, PlanPayload, PlanSweep } from "./types";

/**
 * The dashboard plan read (§10 items 2–3): sweep pointer + cadence config +
 * the feed-window walk reshaped into per-asset lineage rows. Same bounded
 * N+1 the pulse already does — honest and cheap at dev scale; the repos grow
 * dedicated reads when a real tenant outgrows the window.
 */
const PLAN_RUN_WINDOW = 20;
const PLAN_ASSET_CAP = 40;

const EMPTY_PLAN: PlanPayload = { sweep: null, areas: 0, cadence: [], assets: [] };

function toCadenceRules(raw: unknown): PlanCadenceRule[] {
  if (!raw) return [];
  const parsed = cadenceConfigSchema.safeParse(raw);
  if (!parsed.success) return [];
  return Object.entries(parsed.data)
    .map(([platform, rule]) => ({ platform, ...rule }))
    .filter((r) => r.maxPerDay !== undefined || r.maxPerWeek !== undefined || r.minGapMinutes !== undefined);
}

/** Exported for its unit tests — the lineage derivation is the honesty-critical piece. */
export function toAsset(draft: Draft, judged: JudgeResult[], source: Source | null): PipelineAsset {
  const live = judged.filter((r) => r.bodyHash === draft.bodyHash);
  const latestByGate = new Map<string, JudgeResult>();
  for (const r of live) {
    const prev = latestByGate.get(r.gate);
    if (!prev || r.createdAt.getTime() >= prev.createdAt.getTime()) latestByGate.set(r.gate, r);
  }
  const judgedAt =
    live.length > 0
      ? new Date(Math.max(...live.map((r) => r.createdAt.getTime()))).toISOString()
      : null;

  const decided = draft.status === "approved" || draft.status === "rejected";
  const meta = draft.meta as { deployStatus?: unknown; deployRef?: unknown };
  const deployed = meta.deployStatus === "deployed" && typeof meta.deployRef === "string";

  return {
    draftId: draft.id,
    runId: draft.fanoutRunId,
    platform: draft.platform,
    format: draft.format,
    status: draft.status,
    sourceKind: source?.kind ?? null,
    capturedAt: source ? source.createdAt.toISOString() : null,
    generatedAt: draft.createdAt.toISOString(),
    judgedAt,
    // The transition function is the only status writer and stamps updatedAt,
    // so updatedAt IS the decision instant once a decided status is reached.
    decidedAt: decided || draft.status === "published" ? draft.updatedAt.toISOString() : null,
    publishedAt: deployed || draft.status === "published" ? draft.updatedAt.toISOString() : null,
    gates: [...latestByGate.values()].map((r) => ({ gate: r.gate, verdict: r.verdict })),
    reasons: judgeReasons(judged, draft.bodyHash).map((r) => `${r.gateLabel}: ${r.line}`),
    deployRef: deployed ? (meta.deployRef as string) : null,
  };
}

export async function readPlan(repos: Repos): Promise<PlanPayload> {
  const tenant = await repos.tenants.getBySlug(demoTenantSlug());
  if (!tenant) return EMPTY_PLAN;
  const ctx = tenantCtx(tenant.id);

  const [bundle, areas, profile, runs] = await Promise.all([
    readLiveSweep(tenant.id),
    repos.monitoredAreas.list(ctx, { status: "active" }),
    repos.brandProfiles.getActive(ctx),
    repos.fanoutRuns.list(ctx, { limit: PLAN_RUN_WINDOW }),
  ]);

  const sweep: PlanSweep | null = bundle
    ? {
        lastSweptAt: new Date(bundle.sweptAtMs).toISOString(),
        nextSweepAt: new Date(bundle.nextSweepAtMs).toISOString(),
        intervalMs: bundle.intervalMs,
        source: bundle.source,
      }
    : null;

  const draftsPerRun = await Promise.all(runs.map((run) => repos.drafts.listByRun(ctx, run.id)));
  const drafts = draftsPerRun
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, PLAN_ASSET_CAP);

  const sourceIds = [...new Set(drafts.map((d) => d.sourceId))];
  const [judgedPerDraft, sourceRows] = await Promise.all([
    Promise.all(drafts.map((d) => repos.judgeResults.listForDraft(ctx, d.id))),
    Promise.all(sourceIds.map((id) => repos.sources.get(ctx, id))),
  ]);
  const sourceById = new Map(sourceIds.map((id, i) => [id, sourceRows[i]]));

  return {
    sweep,
    areas: areas.length,
    cadence: toCadenceRules(profile?.cadence),
    assets: drafts.map((d, i) => toAsset(d, judgedPerDraft[i], sourceById.get(d.sourceId) ?? null)),
  };
}
