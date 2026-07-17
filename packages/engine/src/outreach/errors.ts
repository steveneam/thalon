/**
 * B-crm.4 back half (s54): the send door's refusal taxonomy. Each arm of
 * the ladder in ./send.ts throws its OWN class — an executable invariant
 * with its own test — and every class extends `SendRefusedError`, so a
 * future caller (the send web route / ops door) can distinguish "the door
 * said no" (map to a precise 4xx) from infrastructure failure. `refusal`
 * is the stable machine-readable arm code.
 */
export abstract class SendRefusedError extends Error {
  abstract readonly refusal: string;
}

/** Arm a: the draft's format does not carry the registry `sendable` capability. */
export class NotSendableFormatError extends SendRefusedError {
  readonly refusal = "draft_not_sendable";
  constructor(
    public readonly draftId: string,
    format: string | null,
  ) {
    super(
      `draft "${draftId}" is format "${format ?? "null"}" — the send door reaches ONLY formats whose registry capability is sendable (exactly outreach_email)`,
    );
    this.name = "NotSendableFormatError";
  }
}

/** Arm a: only an APPROVED draft may reach the door — anything else re-enters the judge gate. */
export class DraftNotApprovedError extends SendRefusedError {
  readonly refusal = "draft_not_approved";
  constructor(
    public readonly draftId: string,
    status: string,
  ) {
    super(
      `draft "${draftId}" is status "${status}" — the send door opens ONLY for an APPROVED draft; a changed or re-queued draft re-enters the judge gate, never the door`,
    );
    this.name = "DraftNotApprovedError";
  }
}

/** Arm b: the lead's lifecycle refuses contact — `unsubscribed` is the one-way door. */
export class LeadNotContactableError extends SendRefusedError {
  readonly refusal = "lead_not_contactable";
  constructor(
    public readonly leadId: string,
    public readonly status: string,
  ) {
    super(
      status === "unsubscribed"
        ? `lead "${leadId}" is unsubscribed — the do-not-contact ONE-WAY door; no send path may ever cross it`
        : `lead "${leadId}" is status "${status}" — outreach sends only to a "scored" or "contacted" lead`,
    );
    this.name = "LeadNotContactableError";
  }
}

/** Arm c (AU Spam Act invariant 1): no consent basis, no send — fail closed on unknown values too. */
export class ConsentRefusedError extends SendRefusedError {
  readonly refusal = "consent_refused";
  constructor(
    public readonly leadId: string,
    public readonly basis: string,
  ) {
    super(
      `lead "${leadId}" carries consent basis "${basis}" — no send without "express" or "inferred-published" consent (record it via repos.leads.setConsent, with provenance)`,
    );
    this.name = "ConsentRefusedError";
  }
}

/** Arm d (AU Spam Act invariant 2): the judged body fails a deterministic sender-identification check. */
export class SenderIdentityError extends SendRefusedError {
  readonly refusal = "sender_identity";
  constructor(
    public readonly draftId: string,
    reason: string,
  ) {
    super(`draft "${draftId}" fails sender identification: ${reason}`);
    this.name = "SenderIdentityError";
  }
}

/** Arm e: the tenant carries no `outreach` config block (or no active profile) — absence disarms the whole door. */
export class OutreachDisarmedError extends SendRefusedError {
  readonly refusal = "outreach_disarmed";
  constructor(reason: string) {
    super(`outreach is DISARMED for this tenant: ${reason}`);
    this.name = "OutreachDisarmedError";
  }
}

/** Arm e: the tenant's UTC-day send count is at the configured cap (≤50, schema-ceilinged). */
export class DailyCapReachedError extends SendRefusedError {
  readonly refusal = "daily_cap_reached";
  constructor(
    public readonly cap: number,
    public readonly sentToday: number,
  ) {
    super(
      `daily batch cap reached: ${sentToday}/${cap} sends already recorded this UTC day — the deliverability ceiling; the next send day is the earliest retry`,
    );
    this.name = "DailyCapReachedError";
  }
}

/** Arm e: this draft already went out — a draft is sent at most once, ever. */
export class DraftAlreadySentError extends SendRefusedError {
  readonly refusal = "draft_already_sent";
  constructor(
    public readonly draftId: string,
    public readonly providerMessageId: string,
  ) {
    super(
      `draft "${draftId}" already has a recorded send (provider message "${providerMessageId}") — a draft is sent at most once, ever; re-sending content means a new draft through the judge gate`,
    );
    this.name = "DraftAlreadySentError";
  }
}

/** Arm e: every configured touch has gone out — over-touching is a deliverability/spam hazard. */
export class SequenceCompleteError extends SendRefusedError {
  readonly refusal = "sequence_complete";
  constructor(
    public readonly leadId: string,
    public readonly touches: number,
  ) {
    super(
      `lead "${leadId}" has received all ${touches} configured touches — the sequence is complete; nothing further is ever due`,
    );
    this.name = "SequenceCompleteError";
  }
}

/** Arm e: the next touch exists but its due time (offsets from sequence start) is still ahead. */
export class TouchNotDueError extends SendRefusedError {
  readonly refusal = "touch_not_due";
  constructor(
    public readonly leadId: string,
    public readonly touchIndex: number,
    public readonly dueAtMs: number,
  ) {
    super(
      `lead "${leadId}" touch ${touchIndex} is not due until ${new Date(dueAtMs).toISOString()} — touch offsets are day offsets from sequence start`,
    );
    this.name = "TouchNotDueError";
  }
}

/** Arm e: the send day carries weight 0 — "never send on this day" (weekends off by default). */
export class NotSendDayError extends SendRefusedError {
  readonly refusal = "not_send_day";
  constructor(public readonly day: string) {
    super(
      `"${day}" carries send-day weight 0 — never send on this day (per-tenant sendDayWeights; weekends are off by default)`,
    );
    this.name = "NotSendDayError";
  }
}
