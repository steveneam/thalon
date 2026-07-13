import { icpSchema, type Icp, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type LeadRow, type Repos } from "@thalon/db";
import { getObjectStore, getTracer, modelTiers, readEnv, type ObjectStore } from "@thalon/platform";
import { embedChunks } from "../ingest";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "../ingest/shell/embedder";
import {
  leadEmbeddingText,
  scoreLead,
  type LeadScoreBreakdown,
  type LeadScorerConfigInput,
  type ScorableLead,
} from "./scorer";

/**
 * B-crm.2 scoring job — deterministic, idempotent, zero LLM calls. Scores
 * every NEW lead and re-scores SCORED leads whose latest score was produced
 * by a different ICP (profile drift is detectable because lead_scores rows
 * carry the hash of the ICP that produced them). Replaying the same run
 * (same clock, same profile) appends nothing — the lead_scores structural
 * key does the work. Dismissed leads are never scored: dismissal is
 * operator signal, the job respects it.
 */

export interface LeadScoringRequest {
  /** The job's clock, ms epoch — deterministic, never read in core (SPINE §1). */
  nowMs: number;
  config?: LeadScorerConfigInput;
}

export interface LeadScoringDeps {
  /** Injectable for keyless tests; production defaults to the metered gateway driver. */
  embedder?: EmbeddingDriver;
  objectStore?: ObjectStore;
  capTokens?: number;
}

export interface LeadScoringResult {
  /** false = no active profile or no ICP block — lead scoring is not armed for this tenant. */
  armed: boolean;
  reason?: string;
  /** Leads considered this run (new + profile-drifted). */
  candidates: number;
  /** Score rows actually appended (0 on an exact replay). */
  scored: number;
  /** Of which were re-scores after ICP drift. */
  rescored: number;
  /** Hash of the ICP block this run scored against (provenance for callers). */
  profileHash: string | null;
}

/** The one place a lead row becomes the scorer's projection. */
function toScorable(lead: LeadRow): ScorableLead {
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    role: lead.role,
    website: lead.website,
    notes: lead.notes,
    painPoint: lead.painPoint,
    createdAtMs: lead.createdAt.getTime(),
  };
}

export async function runLeadScoring(
  ctx: TenantCtx,
  repos: Repos,
  request: LeadScoringRequest,
  deps: LeadScoringDeps = {},
): Promise<LeadScoringResult> {
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile?.icp) {
    return {
      armed: false,
      reason: profile
        ? "the active profile has no ICP block — lead scoring is not armed"
        : "no active brand profile",
      candidates: 0,
      scored: 0,
      rescored: 0,
      profileHash: null,
    };
  }
  const icp: Icp = icpSchema.parse(profile.icp);
  const profileHash = sha256Hex(stableStringify(icp));
  const scoredAt = new Date(request.nowMs);

  // Candidates: every NEW lead, plus SCORED leads whose latest score came
  // from a different ICP (or is missing — a healed half-state).
  const fresh = await repos.leads.list(ctx, { status: "new" });
  const drifted: LeadRow[] = [];
  for (const lead of await repos.leads.list(ctx, { status: "scored" })) {
    const latest = await repos.leadScores.latestByLead(ctx, lead.id);
    if (!latest || latest.profileHash !== profileHash) drifted.push(lead);
  }
  const candidates = [...fresh, ...drifted];

  // One embed batch — ICP description + every lead WITH text — through the
  // EXISTING ingest choke point (budget checked, usage recorded, content-
  // addressed cache: an unchanged ICP or lead text is a cache hit, never
  // fresh spend). Empty strings never enter the batch (the 8a2bbba
  // live-sweep lesson: one empty item is a provider-level rejection of the
  // whole call) — those leads score with relevance disarmed instead.
  const vectorsByLead = new Map<string, readonly number[]>();
  let icpVector: readonly number[] | null = null;
  const embeddable = candidates
    .map((lead) => ({ lead, text: leadEmbeddingText(toScorable(lead)) }))
    .filter(({ text }) => text !== "");
  if (embeddable.length > 0) {
    const texts = [icp.description, ...embeddable.map(({ text }) => text)];
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
    icpVector = embedded[0].embedding;
    embeddable.forEach(({ lead }, i) => vectorsByLead.set(lead.id, embedded[i + 1].embedding));
  }

  let appended = 0;
  let rescored = 0;
  const driftedIds = new Set(drifted.map((l) => l.id));
  for (const lead of candidates) {
    const scorable = toScorable(lead);
    const breakdown: LeadScoreBreakdown = scoreLead(
      scorable,
      icp,
      { lead: vectorsByLead.get(lead.id) ?? null, icp: icpVector },
      request.config ?? {},
      request.nowMs,
    );
    const signals: Record<string, number> = {
      completeness: breakdown.components.completeness,
      recency: breakdown.components.recency,
    };
    if (breakdown.components.relevance !== null) signals.relevance = breakdown.components.relevance;
    if (breakdown.components.fit !== null) signals.fit = breakdown.components.fit;

    const { created } = await repos.leadScores.append(ctx, {
      leadId: lead.id,
      score: breakdown.score,
      reasons: breakdown.reasons,
      signals,
      profileHash,
      scoredAt,
    });
    if (created) {
      appended++;
      if (driftedIds.has(lead.id)) rescored++;
    }
    if (lead.status === "new") await repos.leads.setStatus(ctx, lead.id, "scored");
  }

  return {
    armed: true,
    candidates: candidates.length,
    scored: appended,
    rescored,
    profileHash,
  };
}
