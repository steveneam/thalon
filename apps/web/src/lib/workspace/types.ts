/**
 * Wire types for the workspace shell/dashboard reads (B6.2). Dates cross the
 * wire as ISO strings (the lib/approve-queue/types.ts convention). All three
 * endpoints are thin reads over repos/platform — no engine dependency
 * (SPINE §5 lane doctrine).
 */

export interface PulseCounts {
  /** Fan-out runs in the feed window (fanoutRuns.list cap). */
  runs: number;
  /** Runs carrying a recorded lastError — the triage signal. */
  runsWithErrors: number;
  /** All drafts across the feed-window runs. */
  drafts: number;
  /** Judge-passed, unreviewed — RAW, staged artifacts included. */
  queued: number;
  /** Judge-blocked, needs edit/re-judge — RAW, staged artifacts included. */
  blocked: number;
  approved: number;
  /**
   * Of the queued+blocked rows, how many are STAGE artifacts
   * (`storyboard`/`direction_doc`). Their verb is ADVANCE through the staged
   * lifecycle, not approve/reject — "approve a storyboard" has no defined
   * meaning against the judge gate — so they are subtracted from `needsYou`
   * (founder ruling, s79 close). Kept as its own number rather than filtered
   * away silently: the queue must be able to say what it is not counting.
   */
  staged: number;
}

/** Client-safe zero state (this module carries no server imports — the pulse READ lives in ./pulse.ts, server-only). */
export const EMPTY_COUNTS: PulseCounts = {
  runs: 0,
  runsWithErrors: 0,
  drafts: 0,
  queued: 0,
  blocked: 0,
  approved: 0,
  staged: 0,
};

export interface WorkspacePulse {
  /** null = the configured demo tenant is not seeded yet (fresh dev db) — the first-run state. */
  tenant: { slug: string; name: string } | null;
  /** The active brand-profile version, when one exists. */
  profile: { version: number; company: string | null } | null;
  counts: PulseCounts;
  /**
   * queued + blocked MINUS staged artifacts — the one number the shell badge
   * and needs-you card show. A queue only counts what the operator can act on.
   */
  needsYou: number;
}

export interface ActivityItem {
  /** The event row's seq — stable, unique per tenant. */
  id: number;
  event: string;
  entityType: string;
  entityId: string;
  at: string;
  payload: Record<string, unknown>;
}

/**
 * Dashboard v3 (§10): the plan read — what the engine WILL do (sweeps), what
 * it MAY do (cadence allowances), and where every recent asset stands in the
 * pipeline. One aggregate over sweep pointer + active profile + the
 * feed-window walk; no engine dependency beyond the sanctioned sweep-bundle
 * read the Intel surface already uses.
 */
export interface PlanSweep {
  lastSweptAt: string;
  nextSweepAt: string;
  /** Exact cadence for tick projection; hours are derived for display. */
  intervalMs: number;
  source: string;
}

/** One per-platform cadence allowance (B7.a config) — absent fields mean no constraint. */
export interface PlanCadenceRule {
  platform: string;
  maxPerDay?: number;
  maxPerWeek?: number;
  minGapMinutes?: number;
}

export interface PipelineGate {
  gate: string;
  verdict: string;
}

/**
 * One draft as a pipeline lineage row (§10 item 3). Stage instants are ISO
 * or null = honestly not reached; `decidedAt`/`publishedAt` derive from the
 * transition-maintained `updatedAt` and the deploy meta the engine records —
 * the view is honest by construction, never inferred.
 */
export interface PipelineAsset {
  draftId: string;
  runId: string;
  platform: string;
  format: string | null;
  status: string;
  sourceKind: string | null;
  capturedAt: string | null;
  generatedAt: string;
  judgedAt: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
  /** Per-gate verdicts for the draft's CURRENT body hash (invariant I1). */
  gates: PipelineGate[];
  /** Plain-language failing-claim lines (judge evidence) — why it's blocked. */
  reasons: string[];
  /** Live page URL once the own-site deploy recorded it. */
  deployRef: string | null;
  /**
   * First line of the draft body, whitespace-collapsed and bounded — the
   * media-first excerpt the dashboard rows quote (founder s71: excerpts
   * over abstractions).
   */
  excerpt: string;
  /**
   * s96 (Schedule S1) — the draft's OWN first attached image, off
   * `meta.mediaRefs` (the exact media the publish door sends), parsed
   * tolerantly at the serializer. A read widening on this wire, no schema
   * change; null = a text-only post, which the chip says with its Aa mark.
   */
  media: DraftCardMedia | null;
}

/** A stored image the workspace door can serve — sha + ext, plus the alt the drafting path recorded. */
export interface DraftCardMedia {
  sha256: string;
  ext: string;
  alt: string | null;
}

/** One planned slot (Phase-I window table) as a wire row — plans, not uploads; the publish door stays unarmed. */
export interface PlannedSlotWire {
  draftId: string;
  platform: string;
  /** ISO instant the operator planned the draft for. */
  scheduledFor: string;
  note: string | null;
}

export interface PlanPayload {
  sweep: PlanSweep | null;
  /** Active monitored areas — the Intel station's magnitude. */
  areas: number;
  cadence: PlanCadenceRule[];
  /** Feed-window drafts as lineage rows, newest first. */
  assets: PipelineAsset[];
  /** Planned slots in a ±2-week server window — the client buckets into its local week. */
  plannedSlots: PlannedSlotWire[];
}

/** Mirrors @thalon/platform resolveSeams() — names, never key material. */
export interface SeamReadout {
  db: string;
  objectStore: string;
  queue: string;
  auth: string;
  gateway: "configured" | "unconfigured";
  tracing: "configured" | "unconfigured";
  dataDir: string;
}

export interface WorkspaceStatus {
  seams: SeamReadout;
  /** The env-selected driver per registry seam (the packages/platform choke point) — read-only display. */
  drivers: { render: string; transcript: string; searchIntel: string };
  models: { draft: string; judgeScreen: string; judgeFinal: string; embedding: string };
  budget: { tenantDailyTokens: number };
  tenantSlug: string;
}
