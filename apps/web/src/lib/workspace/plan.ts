import { cadenceConfigSchema, tenantCtx } from "@thalon/contracts";
import type { Draft, JudgeResult, Repos, Source } from "@thalon/db";
import { judgeReasons } from "@/lib/approve-queue/judge-reasons";
import { readLiveSweep } from "@/lib/intel/live";
import { demoTenantSlug } from "@/lib/tenant";
import type {
  DraftCardMedia,
  PipelineAsset,
  PlanCadenceRule,
  PlannedSlotWire,
  PlanPayload,
  PlanSweep,
} from "./types";

/**
 * The dashboard plan read (§10 items 2–3): sweep pointer + cadence config +
 * the feed-window walk reshaped into per-asset lineage rows. Same bounded
 * N+1 the pulse already does — honest and cheap at dev scale; the repos grow
 * dedicated reads when a real tenant outgrows the window.
 */
const PLAN_RUN_WINDOW = 20;
const PLAN_ASSET_CAP = 40;

const EMPTY_PLAN: PlanPayload = { sweep: null, areas: 0, cadence: [], assets: [], plannedSlots: [] };

/** Excerpt bound — one row's worth of quote, never the whole body. */
const EXCERPT_CHARS = 120;

/** Exported for its unit tests — whitespace-collapsed, bounded, ellipsized. */
export function toExcerpt(body: string): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length <= EXCERPT_CHARS ? collapsed : `${collapsed.slice(0, EXCERPT_CHARS - 1)}…`;
}

function toCadenceRules(raw: unknown): PlanCadenceRule[] {
  if (!raw) return [];
  const parsed = cadenceConfigSchema.safeParse(raw);
  if (!parsed.success) return [];
  return Object.entries(parsed.data)
    .map(([platform, rule]) => ({ platform, ...rule }))
    .filter((r) => r.maxPerDay !== undefined || r.maxPerWeek !== undefined || r.minGapMinutes !== undefined);
}

/**
 * s96 (Schedule S1) — the draft's first attached image off `meta.mediaRefs`,
 * read TOLERANTLY (the `readDraftFitMedia` doctrine: this is a card asking
 * "is there a picture?", not the publish door about to spend a platform
 * call). Only a ref matching the object-key family shape resolves; anything
 * else is null — a text-only card, never a crash and never a guessed image.
 */
/** The two content-addressed image families the workspace media door serves. */
const STORED_MEDIA_REF = /^(?:media|social-media)\/([0-9a-f]{64})\.([a-z0-9]+)$/;

export function draftCardMedia(meta: unknown): DraftCardMedia | null {
  const raw = (meta as { mediaRefs?: unknown } | null | undefined)?.mediaRefs;
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    const ref = (entry as { ref?: unknown } | null)?.ref;
    const contentType = (entry as { contentType?: unknown } | null)?.contentType;
    if (typeof ref !== "string") continue;
    // Only an IMAGE draws as a thumbnail — a video attachment is real media
    // the chip must not pretend to render as a still.
    if (typeof contentType === "string" && !contentType.startsWith("image/")) continue;
    const match = STORED_MEDIA_REF.exec(ref);
    if (match === null) continue;
    const alt = (entry as { altText?: unknown }).altText;
    return { sha256: match[1], ext: match[2], alt: typeof alt === "string" ? alt : null };
  }
  return null;
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
    excerpt: toExcerpt(draft.body),
    media: draftCardMedia(draft.meta),
  };
}

export async function readPlan(repos: Repos): Promise<PlanPayload> {
  const tenant = await repos.tenants.getBySlug(demoTenantSlug());
  if (!tenant) return EMPTY_PLAN;
  const ctx = tenantCtx(tenant.id);

  const now = Date.now();
  const [bundle, areas, profile, runs, slots] = await Promise.all([
    readLiveSweep(tenant.id),
    repos.monitoredAreas.list(ctx, { status: "active" }),
    repos.brandProfiles.getActive(ctx),
    repos.fanoutRuns.list(ctx, { limit: PLAN_RUN_WINDOW }),
    // ±2 weeks around now — the client buckets into its local week view.
    repos.plannedSlots.listRange(ctx, {
      from: new Date(now - 14 * 86_400_000),
      to: new Date(now + 14 * 86_400_000),
    }),
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

  // A slot's platform comes from its draft — usually already in the feed
  // window; the stragglers get one bounded read each (slots are few).
  const draftById = new Map(drafts.map((d) => [d.id, d]));
  const plannedSlots: PlannedSlotWire[] = (
    await Promise.all(
      slots.map(async (slot) => {
        const draft =
          draftById.get(slot.draftId) ??
          (await repos.drafts.get(ctx, slot.draftId).catch(() => null));
        if (!draft) return null;
        return {
          draftId: slot.draftId,
          platform: draft.platform,
          scheduledFor: slot.scheduledFor.toISOString(),
          note: slot.note,
        };
      }),
    )
  ).filter((s): s is PlannedSlotWire => s !== null);

  return {
    sweep,
    areas: areas.length,
    cadence: toCadenceRules(profile?.cadence),
    assets: drafts.map((d, i) => toAsset(d, judgedPerDraft[i], sourceById.get(d.sourceId) ?? null)),
    plannedSlots,
  };
}
