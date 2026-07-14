/**
 * Wire types for the →Email compose door (B-crm.4 front half). The context
 * block mirrors the Create surface's PRUNED chips — what the operator kept
 * is exactly what grounds the draft; a removed chip never reaches the brief.
 */

export interface ComposeEmailContext {
  contact?: string;
  company?: string;
  role?: string;
  painPoint?: string;
  /** The lead's website — provenance in the brief, never crawled here. */
  sourceUrl?: string;
  /** The lead's notes (rides the Create context as `text`). */
  notes?: string;
}

export interface ComposeEmailInput {
  leadId: string;
  /** Operator direction from the Create prompt box (optional — the chips may be the whole brief). */
  prompt?: string;
  context?: ComposeEmailContext;
}

export interface ComposeEmailResult {
  draftId: string;
  runId: string;
  /** The draft's post-judge status: "queued" parks in the approve queue; "blocked" is honest triage. */
  status: string;
  /** True when an identical brief had already been composed — the existing draft returns untouched, zero model calls. */
  alreadyComposed: boolean;
  blockedReason?: string;
}
