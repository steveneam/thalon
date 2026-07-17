import {
  leadScoreRecordSchema,
  type LeadScoreRecordInput,
  type TenantCtx,
} from "@thalon/contracts";
import { and, asc, desc, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { leads, leadScores } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One deterministic scoring pass (B-crm.2) — append-only, never updated. */
export type LeadScore = typeof leadScores.$inferSelect;

export function leadScoresRepo(db: Db) {
  return {
    /**
     * Append-only capture, validated at the write door (contracts
     * leadScoreRecordSchema — score in [0,1], readable reasons, non-empty
     * profile hash). Idempotent on the structural key `(tenant, lead,
     * profile_hash, scored_at)`: replaying the same scoring run appends
     * nothing and reports `created: false`; a profile edit changes
     * `profileHash`, so re-scores accrue as new history. The lead is read
     * tenant-scoped first — scoring a foreign tenant's lead 404s, the FK
     * alone would not enforce the wall.
     */
    async append(
      ctx: TenantCtx,
      input: {
        leadId: string;
        scoredAt: Date;
        /** B-crm.5: the learned weight state whose multipliers shaped this pass — provenance + the re-score trigger. */
        weightStateId?: string | null;
      } & LeadScoreRecordInput,
    ): Promise<{ score: LeadScore; created: boolean }> {
      const record = leadScoreRecordSchema.parse(input);
      return db.transaction(async (tx) => {
        const [lead] = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)))
          .limit(1);
        if (!lead) throw new NotFoundError("lead", input.leadId);
        const [inserted] = await tx
          .insert(leadScores)
          .values({
            tenantId: ctx.tenantId,
            leadId: input.leadId,
            score: record.score,
            reasons: record.reasons,
            signals: record.signals,
            profileHash: record.profileHash,
            weightStateId: input.weightStateId ?? null,
            scoredAt: input.scoredAt,
          })
          .onConflictDoNothing({
            target: [
              leadScores.tenantId,
              leadScores.leadId,
              leadScores.profileHash,
              leadScores.scoredAt,
            ],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(leadScores)
            .where(
              and(
                eq(leadScores.tenantId, ctx.tenantId),
                eq(leadScores.leadId, input.leadId),
                eq(leadScores.profileHash, record.profileHash),
                eq(leadScores.scoredAt, input.scoredAt),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `lead score (${input.leadId}, ${record.profileHash}, ${input.scoredAt.toISOString()}) conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { score: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "lead_score",
          entityId: inserted.id,
          event: "lead_score.recorded",
          payload: { leadId: input.leadId, score: record.score },
        });
        return { score: inserted, created: true };
      });
    },

    /** One lead's full scoring history in scoring order — the tuning read. */
    async listByLead(ctx: TenantCtx, leadId: string): Promise<LeadScore[]> {
      return db
        .select()
        .from(leadScores)
        .where(and(eq(leadScores.tenantId, ctx.tenantId), eq(leadScores.leadId, leadId)))
        .orderBy(asc(leadScores.scoredAt));
    },

    /** The queue's read: a lead's most recent score, null when never scored. */
    async latestByLead(ctx: TenantCtx, leadId: string): Promise<LeadScore | null> {
      const [row] = await db
        .select()
        .from(leadScores)
        .where(and(eq(leadScores.tenantId, ctx.tenantId), eq(leadScores.leadId, leadId)))
        .orderBy(desc(leadScores.scoredAt))
        .limit(1);
      return row ?? null;
    },
  };
}

export type LeadScoresRepo = ReturnType<typeof leadScoresRepo>;
