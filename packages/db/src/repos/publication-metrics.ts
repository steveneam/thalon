import type { TenantCtx } from "@thalon/contracts";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { publicationMetrics, socialPublications } from "../schema";
import type { Db, PublicationMetric } from "../types";

export interface PublicationMetricInput {
  publicationId: string;
  /** Generic by rule: platform metric names (`likes`, `reposts`, `impressions`…) arrive as data. */
  metricLabel: string;
  metricValue: number;
  /** The tick's window stamp — passed in, never read here (deterministic replay). */
  capturedAt: Date;
}

/**
 * s87 window (D2): append-only metrics for OUR OWN publications.
 *
 * **No events, deliberately** — the `source_metrics` precedent. A metric row
 * is a measurement of the outside world, not a state change an operator
 * needs to reconstruct; auditing every collected number would bury the
 * events spine under tick noise while telling nobody anything. What IS
 * audited is the publication itself (`social.published`), which is the fact
 * the audit trail is about.
 *
 * **Absence, never zero.** A platform that cannot report a metric yields no
 * row for it, and every read below preserves that: nothing here fills a gap
 * with a default. The Analytics surface's honesty depends on this repo
 * refusing to invent the number a driver refused to give.
 */
export function publicationMetricsRepo(db: Db) {
  return {
    /**
     * Append one measurement. Idempotent on
     * `(tenant, publication, label, captured_at)` — re-running the tick
     * inside the same window appends nothing and reports `created: false`,
     * so a retried collection is free rather than a duplicate series.
     *
     * `platform` is NOT a parameter: it is read from the publication row
     * under the caller's tenant. That is what makes the denormalization safe
     * (a metric can never claim a platform its publication didn't post to)
     * AND what walls the tenancy — a foreign publication id is NotFound, so
     * a stranger cannot write metrics onto our ledger by guessing a uuid.
     */
    async append(
      ctx: TenantCtx,
      input: PublicationMetricInput,
    ): Promise<{ row: PublicationMetric; created: boolean }> {
      const [publication] = await db
        .select({ platform: socialPublications.platform })
        .from(socialPublications)
        .where(
          and(
            eq(socialPublications.id, input.publicationId),
            eq(socialPublications.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);
      if (!publication) throw new NotFoundError("social_publication", input.publicationId);

      const [inserted] = await db
        .insert(publicationMetrics)
        .values({
          tenantId: ctx.tenantId,
          publicationId: input.publicationId,
          platform: publication.platform,
          metricLabel: input.metricLabel,
          metricValue: input.metricValue,
          capturedAt: input.capturedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) return { row: inserted, created: true };

      // Lost the idempotency race (or a genuine replay): read the row back
      // rather than reporting success on nothing — the trend_snapshots
      // read-back-or-throw convention.
      const [existing] = await db
        .select()
        .from(publicationMetrics)
        .where(
          and(
            eq(publicationMetrics.tenantId, ctx.tenantId),
            eq(publicationMetrics.publicationId, input.publicationId),
            eq(publicationMetrics.metricLabel, input.metricLabel),
            eq(publicationMetrics.capturedAt, input.capturedAt),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new Error(
          `publication_metrics insert appended nothing and the row is not readable — (${input.publicationId}, ${input.metricLabel}) at ${input.capturedAt.toISOString()}`,
        );
      }
      return { row: existing, created: false };
    },

    /** One publication's series, oldest first — what a per-post sparkline reads. */
    async series(
      ctx: TenantCtx,
      publicationId: string,
      opts: { metricLabel?: string } = {},
    ): Promise<PublicationMetric[]> {
      const filters = [
        eq(publicationMetrics.tenantId, ctx.tenantId),
        eq(publicationMetrics.publicationId, publicationId),
      ];
      if (opts.metricLabel !== undefined) {
        filters.push(eq(publicationMetrics.metricLabel, opts.metricLabel));
      }
      return db
        .select()
        .from(publicationMetrics)
        .where(and(...filters))
        .orderBy(
          asc(publicationMetrics.capturedAt),
          // Ties broken by LABEL before id. `id` is `defaultRandom()`, so
          // ordering on it alone made two labels written into the SAME
          // bucket come back in arbitrary order — a consumer reading across
          // labels positionally would have been flaky, and flaky in the way
          // that passes alone and fails in a full suite. Found by the s87
          // analytics-spine lane, whose read-model groups by label first and
          // so never tripped on it.
          asc(publicationMetrics.metricLabel),
          asc(publicationMetrics.id),
        );
    },

    /**
     * The newest value per label for one publication — the per-post tiles.
     * A label with no rows is simply not in the result: the caller renders
     * "not measured" from its absence, never a zero this repo made up.
     */
    async latestPerLabel(
      ctx: TenantCtx,
      publicationId: string,
    ): Promise<Record<string, PublicationMetric>> {
      const rows = await db
        .select()
        .from(publicationMetrics)
        .where(
          and(
            eq(publicationMetrics.tenantId, ctx.tenantId),
            eq(publicationMetrics.publicationId, publicationId),
          ),
        )
        .orderBy(asc(publicationMetrics.capturedAt), asc(publicationMetrics.id));
      const latest: Record<string, PublicationMetric> = {};
      // Ascending order means the last write per label wins — the newest.
      for (const row of rows) latest[row.metricLabel] = row;
      return latest;
    },

    /** A channel's rows since a cutoff, newest first — the per-channel roll-up. */
    async listForPlatform(
      ctx: TenantCtx,
      platform: string,
      since: Date,
    ): Promise<PublicationMetric[]> {
      return db
        .select()
        .from(publicationMetrics)
        .where(
          and(
            eq(publicationMetrics.tenantId, ctx.tenantId),
            eq(publicationMetrics.platform, platform),
            gte(publicationMetrics.capturedAt, since),
          ),
        )
        .orderBy(desc(publicationMetrics.capturedAt), asc(publicationMetrics.id));
    },
  };
}

export type PublicationMetricsRepo = ReturnType<typeof publicationMetricsRepo>;
