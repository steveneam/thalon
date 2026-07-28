import type { SocialPlatform } from "@thalon/contracts";

/**
 * B-pub.1 (Sprint-8 window): the publish door's refusal taxonomy — the
 * outreach ./outreach/errors.ts convention applied to social posting. Each
 * rung of the ladder in ./publish.ts throws its OWN class — an executable
 * invariant with its own test — and every class extends
 * `PublishRefusedError`, so a future caller (queue worker / ops door) can
 * distinguish "the door said no" from infrastructure failure. `refusal` is
 * the stable machine-readable rung code.
 */
export abstract class PublishRefusedError extends Error {
  abstract readonly refusal: string;
}

/**
 * Rung a: only the `post` family (the fan-out's open-ended social formats)
 * may reach this door. The frozen contract has no `publishable` capability
 * in DraftFormatCapabilities yet (reported gap) — until that lands at a
 * contract window, the registry-resolved `post` family IS the eligibility
 * check, keeping outreach emails and web pages structurally out.
 */
export class SocialFormatNotPublishableError extends PublishRefusedError {
  readonly refusal = "draft_not_publishable";
  constructor(
    public readonly draftId: string,
    format: string | null,
  ) {
    super(
      `draft "${draftId}" is format "${format ?? "null"}" — the social publish door reaches ONLY the registry post family (social platform drafts)`,
    );
    this.name = "SocialFormatNotPublishableError";
  }
}

/** Rung a: only an APPROVED draft may reach the door — anything else re-enters the judge gate. */
export class SocialDraftNotApprovedError extends PublishRefusedError {
  readonly refusal = "draft_not_approved";
  constructor(
    public readonly draftId: string,
    status: string,
  ) {
    super(
      `draft "${draftId}" is status "${status}" — the publish door opens ONLY for an APPROVED draft; a changed or re-queued draft re-enters the judge gate, never the door`,
    );
    this.name = "SocialDraftNotApprovedError";
  }
}

/**
 * Rung b: the platform's publisher is DISARMED — names every missing arm
 * verbatim (the outreach TransportDisarmedError pattern), so the operator
 * knows exactly what stays unset. Arms are per-platform: credential env
 * key + founder-GO flag + an installed driver; one dead platform never
 * blocks another.
 */
export class SocialPublisherDisarmedError extends PublishRefusedError {
  readonly refusal = "platform_unarmed";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly missing: readonly string[],
  ) {
    super(
      `social publisher for "${platform}" is DISARMED — missing arm(s): ${missing.join(
        ", ",
      )}. Live posting is a separate per-platform founder GO; every arm must be deliberately set.`,
    );
    this.name = "SocialPublisherDisarmedError";
  }
}

/**
 * Rung b: both arms are set but the credential's SHAPE is invalid (a
 * pasted-wrong secret — whitespace, line breaks, control characters). A
 * DEAD credential (revoked upstream) can only surface from the driver's
 * API error at B-pub.2+; this deterministic check covers shape.
 */
export class SocialCredentialInvalidError extends PublishRefusedError {
  readonly refusal = "credential_invalid";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly key: string,
    reason: string,
  ) {
    super(
      `social credential ${key} for "${platform}" is INVALID: ${reason} — re-paste the credential; the publisher stays refusing until the shape is sound`,
    );
    this.name = "SocialCredentialInvalidError";
  }
}

/**
 * Rung c: the tenant's social config refuses — no active brand profile, no
 * `social` block, or no entry for the target platform. Absence disarms
 * (the outreach OutreachDisarmedError convention): an unconfigured
 * platform is the unarmed-config rung, never a default cadence.
 */
export class SocialPublishDisarmedError extends PublishRefusedError {
  readonly refusal = "social_disarmed";
  constructor(reason: string) {
    super(`social publishing is DISARMED for this tenant: ${reason}`);
    this.name = "SocialPublishDisarmedError";
  }
}

/** Rung d: the platform's UTC-day publication count is at the configured cap (schema-ceilinged ≤10). */
export class SocialDailyCapReachedError extends PublishRefusedError {
  readonly refusal = "daily_cap_reached";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly cap: number,
    public readonly publishedToday: number,
  ) {
    super(
      `daily cap reached for "${platform}": ${publishedToday}/${cap} publications already recorded this UTC day — the next posting day is the earliest retry`,
    );
    this.name = "SocialDailyCapReachedError";
  }
}

/**
 * C1/C2 (s82): the SCHEDULE door's fit rung — the platform will bounce this
 * post as written, so the queue refuses to commit it. Deterministic and
 * spend-free: every reason comes from the frozen capability matrix
 * (`validateForPlatform`), never from a platform call that had to fail to
 * find out. The reasons land VERBATIM (the B1.5 lesson) and ALL of them at
 * once — an operator fixing a post should see the whole bill.
 *
 * Not a publish-door rung: the door's ladder a→f is untouched. This refuses
 * earlier, at the moment of commitment, which is the only moment at which
 * the fix is free.
 */
export class SocialPostDoesNotFitError extends PublishRefusedError {
  readonly refusal = "platform_fit";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly problems: readonly { code: string; message: string }[],
  ) {
    super(
      `this draft does not fit "${platform}": ${problems.map((p) => p.message).join(" ")} — the capability matrix is the platform's ceiling, not a style budget; edit the draft and the judge re-runs.`,
    );
    this.name = "SocialPostDoesNotFitError";
  }
}

/**
 * C2 (s82): a queue row's `scheduledAt` must be in the FUTURE. A row
 * scheduled at a past instant is due the moment it is written — which makes
 * "schedule" mean "publish now" without the operator ever saying so, and
 * `listDue` would hand it to the very next tick. Under the standing sequence
 * gate that is not a commitment anyone has consented to, so the door refuses
 * and names both instants.
 */
export class SocialScheduleInPastError extends PublishRefusedError {
  readonly refusal = "schedule_in_past";
  constructor(
    public readonly scheduledAt: Date,
    public readonly now: Date,
  ) {
    super(
      `a queue row must be scheduled in the future: ${scheduledAt.toISOString()} has already passed (now ${now.toISOString()}) — a past slot is due immediately, which is "publish now" wearing a schedule's clothes. Pick a later instant.`,
    );
    this.name = "SocialScheduleInPastError";
  }
}

/** Rung e: this draft already went to this platform — a draft posts to a platform at most once, ever (cross-posting to a DIFFERENT platform stays legal by the ledger's key design). */
export class DraftAlreadyPublishedError extends PublishRefusedError {
  readonly refusal = "draft_already_published";
  constructor(
    public readonly draftId: string,
    public readonly platform: SocialPlatform,
    public readonly externalPostId: string,
  ) {
    super(
      `draft "${draftId}" already has a recorded publication on "${platform}" (external post "${externalPostId}") — reposting content means a new draft through the judge gate`,
    );
    this.name = "DraftAlreadyPublishedError";
  }
}
