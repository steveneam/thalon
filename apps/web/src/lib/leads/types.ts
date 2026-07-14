import type { LeadSource, LeadStatus } from "@thalon/contracts";

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
  counts: { new: number; scored: number; dismissed: number };
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
