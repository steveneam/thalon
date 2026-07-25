import type { TenantCtx } from "@thalon/contracts";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { trendAdmissions } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One claimed admission-cap slot (B-learn L0) — see schema/intel.ts trendAdmissions. */
export type TrendAdmission = typeof trendAdmissions.$inferSelect;

/** The sweep's argument clock → the cap-ledger's UTC day key. */
export function admissionDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

const claimInputSchema = z.object({
  areaId: z.string().uuid(),
  /** The sweep's "now", ms epoch — clock stays an argument (SPINE §1). */
  nowMs: z.number().int().nonnegative(),
  /** The area's resolved maxAdmissionsPerDay at claim time — knobs are config-data, so the cap arrives as an argument. */
  cap: z.number().int().nonnegative(),
  /** sha256 of the PII-stripped text — MUST match the ingest door's hash byte-for-byte or the replay key lies. */
  contentHash: z.string().min(1),
  source: z.string().min(1),
  externalId: z.string().min(1),
});
export type ClaimAdmissionInput = z.input<typeof claimInputSchema>;

export type ClaimAdmissionResult =
  | { claimed: true; claim: TrendAdmission; created: boolean }
  | { claimed: false; capUsed: number };

export function trendAdmissionsRepo(db: Db) {
  return {
    /**
     * Claim one slot in the area's UTC-day cap — the durable replacement
     * for the engine's read-then-advance in-memory count. Idempotent on
     * (area, day, contentHash): re-claiming the same content the same day
     * returns the existing claim with `created: false` and emits nothing.
     * A fresh claim inserts slot = committed-count + 1; when a racing
     * sweep takes that slot first, the unique index rejects the insert and
     * the claim re-reads and retries — so the cap holds under races by
     * construction. At/over cap → `{ claimed: false }` with the honest
     * committed count; the caller records it as a cap rejection.
     */
    async claim(ctx: TenantCtx, input: ClaimAdmissionInput): Promise<ClaimAdmissionResult> {
      const parsed = claimInputSchema.parse(input);
      const day = admissionDay(parsed.nowMs);
      const scope = and(
        eq(trendAdmissions.tenantId, ctx.tenantId),
        eq(trendAdmissions.areaId, parsed.areaId),
        eq(trendAdmissions.day, day),
      );

      // A retry only ever follows ANOTHER claim's committed slot, so cap+1
      // attempts is the honest ceiling — exhausting it means the index
      // rejected inserts without anyone progressing, which is a bug to
      // surface, not a loop to spin.
      const maxAttempts = parsed.cap + 1;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const replayed = await db
          .select()
          .from(trendAdmissions)
          .where(and(scope, eq(trendAdmissions.contentHash, parsed.contentHash)))
          .limit(1);
        if (replayed[0]) return { claimed: true, claim: replayed[0], created: false };

        const [{ used }] = await db.select({ used: count() }).from(trendAdmissions).where(scope);
        if (used >= parsed.cap) return { claimed: false, capUsed: used };

        const result = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(trendAdmissions)
            .values({
              tenantId: ctx.tenantId,
              areaId: parsed.areaId,
              day,
              slot: used + 1,
              contentHash: parsed.contentHash,
              source: parsed.source,
              externalId: parsed.externalId,
            })
            .onConflictDoNothing({
              target: [
                trendAdmissions.tenantId,
                trendAdmissions.areaId,
                trendAdmissions.day,
                trendAdmissions.slot,
              ],
            })
            .returning();
          if (!inserted) return null; // a racer took the slot — re-read and retry
          await appendEvent(tx, ctx, {
            entityType: "trend_admission",
            entityId: inserted.id,
            event: "trend_admission.claimed",
            payload: { areaId: inserted.areaId, day, slot: inserted.slot },
          });
          return inserted;
        });
        if (result) return { claimed: true, claim: result, created: true };
      }
      throw new Error(
        `trend-admission claim for area ${parsed.areaId} on ${day} lost ${maxAttempts} slot races without the ledger filling — refusing rather than looping`,
      );
    },

    /**
     * Committed claims per area for the UTC day containing `nowMs` — the
     * durable read behind each area's `capRemaining`. Areas with no claims
     * are simply absent.
     */
    async countsForDay(ctx: TenantCtx, nowMs: number): Promise<Map<string, number>> {
      const day = admissionDay(nowMs);
      const rows = await db
        .select({ areaId: trendAdmissions.areaId, used: count() })
        .from(trendAdmissions)
        .where(and(eq(trendAdmissions.tenantId, ctx.tenantId), eq(trendAdmissions.day, day)))
        .groupBy(trendAdmissions.areaId);
      return new Map(rows.map((r) => [r.areaId, r.used]));
    },
  };
}

export type TrendAdmissionsRepo = ReturnType<typeof trendAdmissionsRepo>;
