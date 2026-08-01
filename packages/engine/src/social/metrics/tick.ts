import type { SocialPlatform, TenantCtx } from "@thalon/contracts";
import type { Repos, SocialPublicationRow } from "@thalon/db";
import { metricCapability } from "./capability";
import { standingMetricsDeferral } from "./deferral";
import { SocialMetricsRefusedError } from "./errors";
import { isRefusingSocialMetricsReader, type SocialMetricsReader } from "./registry";

/**
 * D2 (s87): the METRICS COLLECTION TICK — `social_publications`' missing
 * second half. The ledger has recorded what we posted since B-pub.1 and
 * stopped there; this walks each publication through its platform's reader
 * and appends what came back.
 *
 * ⛔ IT SHIPS DISARMED, AND STRUCTURALLY SO. With `armed` absent the pass
 * REPORTS and touches nothing: it lists what it would measure, says which
 * platforms would refuse and why, and writes not one row. Beyond the flag,
 * `deps.resolveReader` has NO reader-producing default (the B-pub.1
 * convention), so an armed tick with nothing wired throws before it reads a
 * publication rather than finding its way to a platform by accident. It is
 * also NOT on any systemd unit — wiring the schedule is a lead/founder act.
 *
 * **It cannot post.** Not by flag — by type. A `SocialMetricsReader` has no
 * `publish`, so no bug in this file can reach a platform's write path. That
 * is the whole reason the lane built a parallel seam instead of hanging an
 * optional verb off `SocialPublisher`.
 *
 * Shape mirrors the proven ticks (../queue-consumer.ts, ../../trend/
 * sweep-scheduler.ts): the clock is ALWAYS an argument, one publication's
 * failure never blocks the others, every reason lands VERBATIM, and the pass
 * returns a report a thin driver can log.
 *
 * ⚠ THE HONESTY RULE IS ENFORCED BY OMISSION, WHICH IS THE ONLY WAY IT CAN
 * BE. Nothing here fills a gap: a label the platform did not answer produces
 * no `append` call at all. There is no `?? 0` in this file and there must
 * never be one — `publication_metrics` has no nullable value and no
 * "unavailable" flag precisely so that a zero can only ever mean a measured
 * zero.
 */

/** The default measurement window: a post older than this is not moving, and re-reading it spends quota (and, on X, money) for nothing. */
const DEFAULT_WINDOW_DAYS = 30;
/** The default bucket. One point per publication per hour — the idempotency key's third member. */
const DEFAULT_BUCKET_MINUTES = 60;
/** How many publications one pass measures, newest first. */
const DEFAULT_LIMIT = 50;

export interface CollectPublicationMetricsDeps {
  repos: Repos;
  /** Whose publications — measurement is tenant-walled at every read and every write. */
  ctx: TenantCtx;
  /**
   * ARMED = read the platforms and write rows. Absent or false, the pass is a
   * report: zero platform calls, zero appends. Nothing defaults it to true.
   */
  armed?: boolean;
  /**
   * The reader seam — REQUIRED when armed, no default. Production wires
   * `vaultSocialMetricsResolver`; tests inject the fake.
   */
  resolveReader?: (platform: SocialPlatform) => SocialMetricsReader;
  /** How many publications one pass measures (newest first). */
  limit?: number;
  /** Only publications published within this many days are measured. */
  windowDays?: number;
  /** Bucket size for `capturedAt`. A re-run inside the same bucket appends nothing. */
  bucketMinutes?: number;
}

/** One publication as the report names it. */
export interface MetricsCandidate {
  publicationId: string;
  draftId: string;
  platform: string;
  externalPostId: string;
  publishedAt: string;
}

export interface MetricsMeasured extends MetricsCandidate {
  /** Rows this pass actually wrote. */
  appended: number;
  /** Rows the repo reported as already present — a replay inside the same bucket, which is free rather than duplicated. */
  replayed: number;
  /** The labels that got a number, in the order the reader returned them. */
  labels: string[];
  /** What the platform said it will not report, verbatim — no rows were written for these. */
  unavailable: Array<{ label: string; reason: string }>;
}

export interface MetricsRefusal extends MetricsCandidate {
  /** The machine-readable rung code from the typed refusal. */
  refusal: string;
  /** Permanent, gated, or fixable-by-reconnect — what the surface needs to word the absence. */
  permanence: string;
  /** The refusal message VERBATIM. */
  reason: string;
}

export interface MetricsFailure extends MetricsCandidate {
  /** The thrown message, verbatim — a platform outage reads exactly as the platform wrote it. */
  reason: string;
}

export interface CollectPublicationMetricsResult {
  /** Whether this pass could write at all. false = a report; nothing was touched. */
  armed: boolean;
  /** The bucket every row this pass wrote carries. Deterministic from the passed clock. */
  capturedAt: Date;
  /** Publications in the window — what an armed pass would try, and the whole of a disarmed pass. */
  candidates: MetricsCandidate[];
  measured: MetricsMeasured[];
  /** The platform said no, in its own words. Expected and honest — not a failure. */
  refused: MetricsRefusal[];
  /** Anything else that went wrong. Reported per publication; the batch continues. */
  failed: MetricsFailure[];
  /**
   * Publications the tenant has beyond this pass's bound, and the bound
   * itself. Stated rather than silently truncated: a caller that reads
   * `measured` as "everything" would be wrong, and this is what tells it so.
   */
  bound: { limit: number; windowDays: number; totalPublications: number; truncated: boolean };
  /** Platforms in this pass whose reads are billed — the founder's call to make, so the tick says it out loud. */
  metered: Array<{ platform: string; note: string }>;
  /**
   * Platforms in this pass under a STANDING FOUNDER DEFERRAL (deferral.ts):
   * the reader is built and works, and the founder has ruled it stays parked.
   * Reported armed or not, with the ruling verbatim — and such a platform is
   * deliberately NOT in `metered`, because `metered` says "this pass will
   * bill" and a deferred platform's reads will not run at all. An armed pass
   * records each of its publications as a typed refusal (`deferred`), spends
   * nothing, and skips nothing silently.
   */
  deferred: Array<{ platform: string; ruling: string }>;
}

/**
 * The tick's window stamp: `now` floored to the bucket. Pure, so a replayed
 * collection is byte-identical and the repo's
 * `(tenant, publication, label, captured_at)` idempotency actually holds —
 * pass a raw `now` and every tick would write a fresh point.
 */
export function metricsWindowStart(now: Date, bucketMinutes: number = DEFAULT_BUCKET_MINUTES): Date {
  const ms = Math.max(1, Math.floor(bucketMinutes)) * 60_000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

function candidate(row: SocialPublicationRow): MetricsCandidate {
  return {
    publicationId: row.id,
    draftId: row.draftId,
    platform: row.platform,
    externalPostId: row.externalPostId,
    publishedAt: row.publishedAt.toISOString(),
  };
}

/**
 * One collection pass. Idempotent in the sense that matters: a second pass
 * inside the same bucket re-reads the platforms but appends nothing, and the
 * report says so through `replayed`.
 */
export async function collectPublicationMetrics(
  deps: CollectPublicationMetricsDeps,
  now: Date,
): Promise<CollectPublicationMetricsResult> {
  const { repos, ctx } = deps;
  const armed = deps.armed === true;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const windowDays = deps.windowDays ?? DEFAULT_WINDOW_DAYS;
  const capturedAt = metricsWindowStart(now, deps.bucketMinutes ?? DEFAULT_BUCKET_MINUTES);

  // Loud, and BEFORE any read: an armed tick with no reader seam is a wiring
  // mistake, and the only safe thing to do with it is refuse to run.
  if (armed && !deps.resolveReader) {
    throw new Error(
      "collectPublicationMetrics is ARMED but no resolveReader was wired — the tick has no platform-reaching default by design; wire the vault-first resolver or leave it disarmed",
    );
  }

  const { rows, total } = await repos.socialPublications.listRecent(ctx, limit);
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60_000);
  const inWindow = rows.filter((row) => row.publishedAt.getTime() >= since.getTime());

  const result: CollectPublicationMetricsResult = {
    armed,
    capturedAt,
    candidates: inWindow.map(candidate),
    measured: [],
    refused: [],
    failed: [],
    bound: { limit, windowDays, totalPublications: total, truncated: total > rows.length },
    metered: [],
    deferred: [],
  };

  // Say what a pass costs BEFORE it runs, armed or not — a disarmed report is
  // exactly where an operator should be able to see the bill. A platform
  // under a standing deferral lands in `deferred` INSTEAD of `metered`: the
  // founder already made the metered call for it — defer — so "this pass will
  // bill" would be false, and the ruling itself is the honest line. (While X
  // is both the only metered and the only deferred platform, the `metered`
  // branch is dormant; lifting the deferral reactivates it.)
  const platforms = [...new Set(inWindow.map((row) => row.platform))];
  for (const platform of platforms) {
    const ruling = standingMetricsDeferral(platform as SocialPlatform);
    if (ruling !== undefined) {
      result.deferred.push({ platform, ruling });
      continue;
    }
    const metered = metricCapability(platform as SocialPlatform).metered;
    if (metered) result.metered.push({ platform, note: metered });
  }

  // Disarmed: the report IS the whole pass. Nothing above wrote, nothing
  // below runs, and `candidates` says exactly what an armed tick would try.
  if (!armed) return result;

  for (const row of inWindow) {
    const item = candidate(row);
    try {
      const reader = deps.resolveReader!(row.platform as SocialPlatform);
      // A refusing reader carries its typed refusal, so the tick refuses
      // WITHOUT a call — the publish door's rung-b shape.
      if (isRefusingSocialMetricsReader(reader)) throw reader.refusal;

      const report = await reader.fetchPostMetrics({
        externalPostId: row.externalPostId,
        meta: (row.meta ?? {}) as Record<string, unknown>,
      });

      let appended = 0;
      let replayed = 0;
      for (const sample of report.samples) {
        // NOTE the repo takes no `platform`: it reads it off the publication
        // under this tenant, which is what makes a metric unable to claim a
        // platform its publication did not post to.
        const { created } = await repos.publicationMetrics.append(ctx, {
          publicationId: row.id,
          metricLabel: sample.label,
          metricValue: sample.value,
          capturedAt,
        });
        if (created) appended += 1;
        else replayed += 1;
      }
      result.measured.push({
        ...item,
        appended,
        replayed,
        labels: report.samples.map((s) => s.label),
        unavailable: report.unavailable.map((u) => ({ label: u.label, reason: u.reason })),
      });
    } catch (err) {
      // A typed metrics refusal is EXPECTED and honest — the platform said no
      // and named the permanence. Anything else is a failure. Both are
      // recorded against their publication and neither stops the batch: one
      // gated platform must never cost us the numbers from the others.
      if (err instanceof SocialMetricsRefusedError) {
        result.refused.push({
          ...item,
          refusal: err.refusal,
          permanence: err.permanence,
          reason: err.message,
        });
      } else {
        result.failed.push({ ...item, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return result;
}
