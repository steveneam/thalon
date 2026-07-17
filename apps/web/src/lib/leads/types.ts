import type { LeadSource, LeadStatus, LeadWeightMultipliers } from "@thalon/contracts";

/**
 * Wire types for the Leads queue (B-crm.2 over the frozen Sprint-7 window 1
 * contract). Dates cross as ISO strings. A LeadCard is the lead row joined
 * with its LATEST score (append-only history stays server-side — the queue
 * reads the newest row per lead, the trend-card convention).
 */

export interface LeadCard {
  id: string;
  source: LeadSource;
  email: string;
  name: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  notes: string | null;
  /** The lead's problem/need (window-1b) — the thing outreach addresses; joins the relevance embedding. */
  painPoint: string | null;
  status: LeadStatus;
  /** "Mark hot" state — rides lead meta, floats the card. */
  pinned: boolean;
  createdAt: string;
  /** Latest deterministic score; null while status is `new` (not yet scored). */
  score: number | null;
  /** One line per armed signal, verbatim from the scorer — never a black box. */
  reasons: string[];
  scoredAt: string | null;
  /** Hash of the ICP that produced the score — the drift indicator. */
  profileHash: string | null;
  /** B-crm.5: the learned weight state the latest score APPLIED (null = base weights). */
  weightStateId: string | null;
  /**
   * Everything else the source supplied (unmapped CSV columns, waitlist
   * referral context) — preserved on `leads.meta` since window 1 but
   * invisible until the s29 founder rider: a real CRM export's phone
   * columns must show on the card. Internal keys (pinned) excluded;
   * key-sorted for a stable wire.
   */
  extras: Array<{ key: string; value: string }>;
}

export interface LeadsPayload {
  leads: LeadCard[];
  /** false = the active profile has no ICP block; the surface says how to arm scoring. */
  scoringArmed: boolean;
  /** Hash of the CURRENT ICP — cards whose profileHash differs are stale-scored. */
  currentProfileHash: string | null;
  /** B-crm.5 provenance: the learned-weight state scoring rides right now. */
  learnedWeights: LearnedWeightsInfo;
  counts: { new: number; scored: number; dismissed: number };
}

/**
 * What the NEXT scoring pass will apply (B-crm.5): the newest learned state
 * bound to the CURRENT ICP hash, or base weights when none. Per-card
 * `weightStateId` says what the LAST pass actually applied — the two
 * together make weight provenance honest on the queue.
 */
export interface LearnedWeightsInfo {
  state: {
    id: string;
    /** The learn pass's clock, ISO — "learned when". */
    computedAt: string;
    /** Evidence size: triage rows read / final verdicts consumed by the pass. */
    rows: number;
    verdicts: number;
    /** Per-signal multipliers on the resolved weights; 1 = neutral. */
    multipliers: LeadWeightMultipliers;
  } | null;
  /** True when learning exists only under an OLDER ICP — base weights until re-learned (a signal, not an error). */
  staleForProfile: boolean;
}

/** The learn trigger's report, verbatim from the engine (LeadWeightLearningResult on the wire). */
export interface LearnReport {
  armed: boolean;
  reason?: string;
  rows: number;
  verdicts: number;
  stateId: string | null;
  /** true = a NEW state version was appended; false = replay/no-change. */
  created: boolean;
  multipliers: LeadWeightMultipliers | null;
  reasons: string[];
  profileHash: string | null;
}

/** The CSV import report, verbatim from the engine (added/duplicate/invalid + row reasons). */
export interface ImportReport {
  rows: number;
  added: number;
  duplicates: number;
  invalid: number;
  reasons: Array<{ row: number; reason: string }>;
}

export interface ScoringReport {
  armed: boolean;
  reason?: string;
  candidates: number;
  scored: number;
  rescored: number;
}

export interface SyncReport {
  seen: number;
  added: number;
  existing: number;
}

export type TriageAction = "dismiss" | "pin" | "unpin";

/** Bulk-capable triage result — partial failures never abort the batch (FRONTEND §0). */
export interface TriageResult {
  done: number;
  failed: Array<{ id: string; error: string }>;
}
