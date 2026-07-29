import type { SocialPlatform } from "@thalon/contracts";
import type { MetricAbsence } from "./capability";

/**
 * D2 (s87): the METRICS refusal taxonomy — deliberately its own tree, not a
 * branch of `PublishRefusedError`.
 *
 * A publish refusal answers "may this post go out?" (arming, cadence, fit).
 * A metrics refusal answers a different question — "will the platform tell
 * us, and if not, whose fault is that?" — and the fixes are unrelated: a
 * publish refusal is fixed by arming or editing, a metrics refusal by
 * reconnecting with a scope, applying to a partner program, or by nothing at
 * all. Sharing a base class would have made the two read as one ladder and
 * invited a caller to handle them together, which is exactly wrong.
 *
 * Every class carries `permanence` (see MetricAbsence) because the Analytics
 * surface renders a DIFFERENT sentence for "nobody can have this" than for
 * "this token can't". `refusal` is the stable machine-readable code.
 */
export abstract class SocialMetricsRefusedError extends Error {
  abstract readonly refusal: string;
  abstract readonly permanence: MetricAbsence;
  abstract readonly platform: SocialPlatform;
}

/**
 * No reader could be built for this platform: no connected credential, or no
 * reader is installed at all. Names every missing arm verbatim — the
 * `SocialPublisherDisarmedError` convention, minus the posting GO, which
 * measurement deliberately does not require (see the lane's seam decision).
 */
export class SocialMetricsUnavailableError extends SocialMetricsRefusedError {
  readonly refusal = "reader_unavailable";
  readonly permanence: MetricAbsence;
  constructor(
    public readonly platform: SocialPlatform,
    public readonly missing: readonly string[],
    permanence: MetricAbsence = "no_driver",
  ) {
    super(
      `no metrics reader for "${platform}" — missing: ${missing.join(", ")}. Measurement needs a connected credential and an installed reader; it deliberately does NOT need the platform's posting arm, so disarming a platform never blinds the analytics on what it already published.`,
    );
    this.name = "SocialMetricsUnavailableError";
    this.permanence = permanence;
  }
}

/**
 * The reader EXISTS AND WORKS; we are deliberately not running it yet, on
 * cost. Not a capability fact about the platform at all — a standing founder
 * decision about when we start paying.
 *
 * Its own class because every other refusal here means "we can't" and this
 * one means "we won't yet", which has a completely different fix (a launch
 * date, not a scope or an application). Collapsing it into
 * `SocialMetricsUnavailableError` would send someone to build a reader that
 * is already built and passing tests.
 *
 * Live instance: X, per the founder's s87 ruling — *"X analytics and posting
 * bill will only be paid once thalon is ready to launch, so towards the
 * end."* Lifting it is a founder act, not a config change.
 */
export class SocialMetricsDeferredError extends SocialMetricsRefusedError {
  readonly refusal = "deferred_on_cost";
  readonly permanence: MetricAbsence = "deferred";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly reason: string,
  ) {
    super(
      `metrics for "${platform}" are deferred on cost, not unavailable — the reader is built and works. ${reason} Lifting this is a founder decision, not a configuration change.`,
    );
    this.name = "SocialMetricsDeferredError";
  }
}

/**
 * The platform HAS the number and will not give it to us: access is granted
 * to selected partners, or behind a permission we cannot simply add.
 * LinkedIn is the whole reason this class exists — both its roads
 * (organization share statistics, member socialActions) are gated, and the
 * surface prints this sentence verbatim as "partner-gated".
 */
export class SocialMetricsGatedError extends SocialMetricsRefusedError {
  readonly refusal = "platform_gated";
  readonly permanence: MetricAbsence = "gated";
  constructor(
    public readonly platform: SocialPlatform,
    reason: string,
  ) {
    super(`${platform} will not report this post's metrics: ${reason}`);
    this.name = "SocialMetricsGatedError";
  }
}

/**
 * The API answered, and its answer was "you lack the permission". Carries the
 * platform's OWN words (truncated to triage size by the caller) rather than a
 * paraphrase — an operator fixing a Meta scope needs Meta's error, not ours.
 * Distinct from gated: this one a reconnect can fix.
 */
export class SocialMetricsPermissionError extends SocialMetricsRefusedError {
  readonly refusal = "permission_missing";
  readonly permanence: MetricAbsence = "permissioned";
  constructor(
    public readonly platform: SocialPlatform,
    public readonly status: number,
    detail: string,
  ) {
    super(
      `${platform} refused the metrics read (HTTP ${status}): ${detail} — the credential is live but lacks the insights permission; reconnect the destination with the metrics scope granted`,
    );
    this.name = "SocialMetricsPermissionError";
  }
}

/**
 * The platform answered 2xx with something we cannot read as this post's
 * metrics — a shape change, or a post the account no longer owns. Not a
 * refusal the operator can fix by granting anything, so it is reported as a
 * failure rather than dressed up as a capability limit.
 */
export class SocialMetricsUnreadableError extends SocialMetricsRefusedError {
  readonly refusal = "response_unreadable";
  readonly permanence: MetricAbsence = "structural";
  constructor(
    public readonly platform: SocialPlatform,
    detail: string,
  ) {
    super(
      `${platform} answered the metrics read with something unreadable: ${detail} — recording nothing rather than guessing a number`,
    );
    this.name = "SocialMetricsUnreadableError";
  }
}
