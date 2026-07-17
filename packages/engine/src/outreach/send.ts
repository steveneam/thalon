import {
  brandIdentitySchema,
  isConsentBasis,
  outreachEmailDraftMetaSchema,
  outreachSequenceSchema,
  resolveDraftFormatSpec,
  type BrandIdentity,
  type OutreachSequence,
  type TenantCtx,
} from "@thalon/contracts";
import {
  NotFoundError,
  type BrandProfile,
  type LeadRow,
  type OutreachSendRow,
  type Repos,
} from "@thalon/db";
import { deriveCadence, isSendDay, utcDayKey } from "./cadence";
import {
  ConsentRefusedError,
  DailyCapReachedError,
  DraftAlreadySentError,
  DraftNotApprovedError,
  LeadNotContactableError,
  NotSendableFormatError,
  NotSendDayError,
  OutreachDisarmedError,
  SenderIdentityError,
  SequenceCompleteError,
  TouchNotDueError,
} from "./errors";
import type { SendTransport } from "./transport";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * B-crm.4 BACK HALF (s54 window): the send door — the ONLY path from an
 * APPROVED `outreach_email` draft to a provider call, built TO the door and
 * never through it (live send is a separate founder GO; deps.transport has
 * no network-reaching default). The core-caller shape mirrors compose.ts:
 * deterministic clock passed in, never read in core; every refusal below is
 * an executable invariant with its own typed error (./errors.ts) and its
 * own test, checked in kickoff order a→f:
 *
 *   a. draft exists (tenant-walled get), format `sendable`, status APPROVED;
 *   b. the lead (draft meta recipient.leadId) exists and is "scored" or
 *      "contacted" — `unsubscribed` is the one-way door, pre-checked only:
 *      the ledger records what actually happened after the provider call;
 *   c. consent basis is express/inferred-published (Spam Act invariant 1 —
 *      fail closed on "none" AND on anything unrecognized);
 *   d. sender identification (invariant 2): deterministic string checks
 *      over the judged body — the template's job to satisfy, this door's
 *      job to verify;
 *   e. cadence gates: `outreach` block present (absence disarms) → daily
 *      cap (UTC day from nowMs) → draft not already sent → touch due per
 *      ./cadence.ts → send-day weight nonzero;
 *   f. only then: transport call → outreachSends.record (the repo's unique
 *      key backstops e's pre-check — a raced double-send surfaces
 *      DuplicateSendError LOUD) → lead scored→contacted (first touch only;
 *      the record and transition ride the repo fns' own events).
 */
export interface SendApprovedEmailRequest {
  draftId: string;
  /** The door's clock (ms epoch) — deterministic, passed in, never read in core. */
  nowMs: number;
}

export interface SendApprovedEmailDeps {
  /**
   * The transport seam — REQUIRED, no default: nothing reaches the network
   * unless the caller wired `resolveSendTransport`'s two-key arming ratchet
   * (or a test injected the fake).
   */
  transport: SendTransport;
}

export interface SendApprovedEmailResult {
  /** The recorded ledger row — the audit answer to "what did we send them". */
  send: OutreachSendRow;
  /** The lead after any lifecycle transition. */
  lead: LeadRow;
  /** Which cadence touch this send was (0-based) — always the prior history length. */
  touchIndex: number;
  /** true only when this send crossed scored → contacted (the first touch). */
  transitioned: boolean;
}

export async function sendApprovedEmail(
  ctx: TenantCtx,
  repos: Repos,
  request: SendApprovedEmailRequest,
  deps: SendApprovedEmailDeps,
): Promise<SendApprovedEmailResult> {
  // (a) draft exists (tenant-walled — repos.drafts.get throws NotFoundError),
  // format resolves `sendable`, status APPROVED.
  const draft = await repos.drafts.get(ctx, request.draftId);
  const spec = resolveDraftFormatSpec(draft.format);
  if (!spec.capabilities.sendable) {
    throw new NotSendableFormatError(draft.id, draft.format);
  }
  if (draft.status !== "approved") {
    throw new DraftNotApprovedError(draft.id, draft.status);
  }
  const meta = outreachEmailDraftMetaSchema.parse(draft.meta);

  // (b) the lead the judged draft addresses exists and is contactable.
  const lead = await repos.leads.get(ctx, meta.recipient.leadId);
  if (!lead) throw new NotFoundError("lead", meta.recipient.leadId);
  if (lead.status !== "scored" && lead.status !== "contacted") {
    throw new LeadNotContactableError(lead.id, lead.status);
  }

  // (c) consent — Spam Act invariant 1, fail closed on unknown values.
  if (!isConsentBasis(lead.consentBasis) || lead.consentBasis === "none") {
    throw new ConsentRefusedError(lead.id, lead.consentBasis);
  }

  // Arms d and e both read the active brand profile (identity block +
  // outreach block); a tenant without one has configured nothing — disarmed.
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new OutreachDisarmedError(
      "tenant has no active brand profile — no sender identity, no outreach block",
    );
  }

  // (d) sender identification — Spam Act invariant 2.
  assertSenderIdentity(draft.id, draft.body, brandIdentitySchema.parse(profile.identity ?? {}));

  // (e) cadence gates, in kickoff order.
  const sequence = readOutreachSequence(profile);
  if (!sequence) {
    throw new OutreachDisarmedError(
      'the active brand profile carries no "outreach" block — absence disarms the send door',
    );
  }

  const sentToday = await repos.outreachSends.countInWindow(ctx, utcDayWindow(request.nowMs));
  if (sentToday >= sequence.dailyBatchCap) {
    throw new DailyCapReachedError(sequence.dailyBatchCap, sentToday);
  }

  const existing = await repos.outreachSends.getByDraft(ctx, draft.id);
  if (existing) throw new DraftAlreadySentError(draft.id, existing.providerMessageId);

  const history = await repos.outreachSends.listForLead(ctx, lead.id);
  const cadence = deriveCadence(history, sequence, request.nowMs);
  if (cadence.complete) throw new SequenceCompleteError(lead.id, history.length);
  if (cadence.dueAtMs !== null && cadence.dueAtMs > request.nowMs) {
    throw new TouchNotDueError(lead.id, cadence.nextTouchIndex, cadence.dueAtMs);
  }
  if (!isSendDay(request.nowMs, sequence.sendDayWeights)) {
    throw new NotSendDayError(utcDayKey(request.nowMs));
  }

  // (f) only now: transport → ledger → lifecycle. The ledger row snapshots
  // what actually left (recipient + judged body hash) at send time.
  const { providerMessageId } = await deps.transport.sendEmail({
    to: meta.recipient.email,
    subject: meta.subject,
    text: meta.emailBody,
  });
  const send = await repos.outreachSends.record(ctx, {
    sentAt: new Date(request.nowMs),
    leadId: lead.id,
    draftId: draft.id,
    provider: deps.transport.provider,
    providerMessageId,
    recipientEmail: meta.recipient.email,
    bodyHash: draft.bodyHash,
    touchIndex: cadence.nextTouchIndex,
  });
  const transitioned = lead.status === "scored";
  const updatedLead = transitioned ? await repos.leads.setStatus(ctx, lead.id, "contacted") : lead;
  return { send, lead: updatedLead, touchIndex: cadence.nextTouchIndex, transitioned };
}

/**
 * FROZEN-CONTRACT GAP (s54, reported in the lane wrap): contracts declare
 * the brand profile's optional `outreach` block, but `brand_profiles` has
 * no `outreach` column yet and brandProfilesRepo.create drops
 * `config.outreach` on the floor — so this structural read is honestly
 * disarmed for EVERY real tenant until the db half lands. Reading the
 * property structurally (the icp/cadence/routing column pattern) keeps the
 * door byte-compatible with the column when it arrives; the block is still
 * schema-parsed at this boundary.
 */
function readOutreachSequence(profile: BrandProfile): OutreachSequence | null {
  const block = (profile as { outreach?: unknown }).outreach;
  if (block === undefined || block === null) return null;
  return outreachSequenceSchema.parse(block);
}

/**
 * Deterministic sender-identification checks over the judged body (the
 * claim surface recipients actually read: subject + email body). The
 * template's job to satisfy; this door's job to verify. Case-insensitive
 * on purpose — capitalization must never flip a compliance refusal.
 */
function assertSenderIdentity(draftId: string, body: string, identity: BrandIdentity): void {
  const haystack = body.toLowerCase();
  // The name must appear in PROSE the recipient reads — a company name that
  // only occurs inside a URL does not identify the sender.
  const prose = haystack.replace(/https?:\/\/\S+/g, " ");
  const company = identity.company?.trim();
  if (!company) {
    throw new SenderIdentityError(
      draftId,
      "the active brand profile's identity block carries no company name (identity.company) — the door cannot verify an unnamed sender",
    );
  }
  if (!prose.includes(company.toLowerCase())) {
    throw new SenderIdentityError(
      draftId,
      `the judged body never names the sender "${company}" — the recipient must know who is contacting them`,
    );
  }
  const links = Object.values(identity.links)
    .map((url) => url.trim())
    .filter(Boolean);
  if (links.length === 0) {
    throw new SenderIdentityError(
      draftId,
      "the identity block carries no links — a contactable identity (site/profile URL) must be configured before any send",
    );
  }
  if (!links.some((url) => haystack.includes(url.toLowerCase()))) {
    throw new SenderIdentityError(
      draftId,
      "the judged body contains none of the identity's contact links — the recipient must be able to reach or verify the sender",
    );
  }
  if (!haystack.includes("unsubscribe")) {
    throw new SenderIdentityError(
      draftId,
      'the judged body carries no unsubscribe affordance line (the word "unsubscribe") — the recipient must always have a way out',
    );
  }
}

/** The ≤cap/day window: the UTC calendar day `nowMs` falls in — [00:00, +24h). */
function utcDayWindow(nowMs: number): { from: Date; to: Date } {
  const from = new Date(nowMs);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}
