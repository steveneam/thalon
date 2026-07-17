import {
  leadWeightStateRecordSchema,
  type LeadWeightStateRecordInput,
  type TenantCtx,
} from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { leadWeightStates } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One learn-loop pass (B-crm.5) — append-only, never updated. */
export type LeadWeightState = typeof leadWeightStates.$inferSelect;

export function leadWeightStatesRepo(db: Db) {
  return {
    /**
     * Append-only capture, validated at the write door (contracts
     * leadWeightStateRecordSchema — positive multipliers, non-empty
     * profile/evidence hashes). Idempotent on the structural key `(tenant,
     * profile_hash, evidence_hash)`: replaying the loop over the same
     * verdicts appends nothing and reports `created: false`; new verdicts
     * change the evidence hash, so learning accrues as new versions — the
     * audit trail for "why did this weight move, and when".
     */
    async append(
      ctx: TenantCtx,
      input: { computedAt: Date } & LeadWeightStateRecordInput,
    ): Promise<{ state: LeadWeightState; created: boolean }> {
      const record = leadWeightStateRecordSchema.parse(input);
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(leadWeightStates)
          .values({
            tenantId: ctx.tenantId,
            profileHash: record.profileHash,
            evidenceHash: record.evidenceHash,
            multipliers: record.multipliers,
            reasons: record.reasons,
            evidence: record.evidence,
            computedAt: input.computedAt,
          })
          .onConflictDoNothing({
            target: [
              leadWeightStates.tenantId,
              leadWeightStates.profileHash,
              leadWeightStates.evidenceHash,
            ],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(leadWeightStates)
            .where(
              and(
                eq(leadWeightStates.tenantId, ctx.tenantId),
                eq(leadWeightStates.profileHash, record.profileHash),
                eq(leadWeightStates.evidenceHash, record.evidenceHash),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `lead weight state (${record.profileHash}, ${record.evidenceHash}) conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { state: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "lead_weight_state",
          entityId: inserted.id,
          event: "lead_weight_state.recorded",
          payload: {
            profileHash: record.profileHash,
            multipliers: record.multipliers,
          },
        });
        return { state: inserted, created: true };
      });
    },

    /**
     * The scoring job's read: the newest state computed against THIS
     * profile, null when none. A drifted profile finds nothing — the
     * learned layer disarms until the loop re-runs (application binds to
     * the profile hash, the lead_scores drift discipline).
     */
    async latestForProfile(ctx: TenantCtx, profileHash: string): Promise<LeadWeightState | null> {
      const [row] = await db
        .select()
        .from(leadWeightStates)
        .where(
          and(
            eq(leadWeightStates.tenantId, ctx.tenantId),
            eq(leadWeightStates.profileHash, profileHash),
          ),
        )
        .orderBy(desc(leadWeightStates.computedAt), desc(leadWeightStates.createdAt))
        .limit(1);
      return row ?? null;
    },

    /** The audit read: full learning history, newest first. */
    async list(ctx: TenantCtx, filter: { limit?: number } = {}): Promise<LeadWeightState[]> {
      return db
        .select()
        .from(leadWeightStates)
        .where(eq(leadWeightStates.tenantId, ctx.tenantId))
        .orderBy(desc(leadWeightStates.computedAt), desc(leadWeightStates.createdAt))
        .limit(filter.limit ?? 100);
    },
  };
}

export type LeadWeightStatesRepo = ReturnType<typeof leadWeightStatesRepo>;
