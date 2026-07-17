import {
  outreachSendRecordSchema,
  type OutreachSendRecordInput,
  type TenantCtx,
} from "@thalon/contracts";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { drafts, leads, outreachSends } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One provider-accepted send (B-crm.4) — append-only, never updated. */
export type OutreachSend = typeof outreachSends.$inferSelect;

/**
 * A second send of the same draft is an INCIDENT (the provider call already
 * happened), never an idempotent replay — the unique key backstops the
 * door's pre-send check and this error names what leaked through.
 */
export class DuplicateSendError extends Error {
  constructor(public readonly draftId: string) {
    super(
      `draft "${draftId}" already has a recorded send — a draft is sent at most once, ever; re-sending content means a new draft through the judge gate`,
    );
    this.name = "DuplicateSendError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const withCode = err as { code?: unknown; message?: unknown; cause?: unknown };
  if (withCode.code === "23505") return true;
  if (typeof withCode.message === "string" && withCode.message.includes("duplicate key")) return true;
  return withCode.cause !== undefined && isUniqueViolation(withCode.cause);
}

export function outreachSendsRepo(db: Db) {
  return {
    /**
     * The send door's ONLY write, validated at the door (contracts
     * outreachSendRecordSchema — a provider-accepted send with its audit
     * snapshots). NOT idempotent by design: `(tenant, draft)` conflicting
     * throws DuplicateSendError instead of returning the existing row —
     * the waitlist collision-fails-loud convention, because reaching this
     * conflict means a provider call raced past the pre-send check.
     */
    async record(
      ctx: TenantCtx,
      input: { sentAt: Date } & OutreachSendRecordInput,
    ): Promise<OutreachSend> {
      const record = outreachSendRecordSchema.parse(input);
      try {
        return await db.transaction(async (tx) => {
          // Tenancy wall on FK-carrying writes (the lead-scores convention):
          // the lead AND the draft must belong to THIS tenant.
          const [lead] = await tx
            .select({ id: leads.id })
            .from(leads)
            .where(and(eq(leads.id, record.leadId), eq(leads.tenantId, ctx.tenantId)))
            .limit(1);
          if (!lead) throw new NotFoundError("lead", record.leadId);
          const [draft] = await tx
            .select({ id: drafts.id })
            .from(drafts)
            .where(and(eq(drafts.id, record.draftId), eq(drafts.tenantId, ctx.tenantId)))
            .limit(1);
          if (!draft) throw new NotFoundError("draft", record.draftId);
          const [inserted] = await tx
            .insert(outreachSends)
            .values({
              tenantId: ctx.tenantId,
              leadId: record.leadId,
              draftId: record.draftId,
              provider: record.provider,
              providerMessageId: record.providerMessageId,
              recipientEmail: record.recipientEmail,
              bodyHash: record.bodyHash,
              touchIndex: record.touchIndex,
              meta: record.meta,
              sentAt: input.sentAt,
            })
            .returning();
          await appendEvent(tx, ctx, {
            entityType: "outreach_send",
            entityId: inserted.id,
            event: "outreach_send.recorded",
            payload: {
              leadId: record.leadId,
              draftId: record.draftId,
              provider: record.provider,
              touchIndex: record.touchIndex,
            },
          });
          return inserted;
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw new DuplicateSendError(record.draftId);
        throw err;
      }
    },

    /** The door's pre-send refusal read: has this draft already gone out? */
    async getByDraft(ctx: TenantCtx, draftId: string): Promise<OutreachSend | null> {
      const [row] = await db
        .select()
        .from(outreachSends)
        .where(and(eq(outreachSends.tenantId, ctx.tenantId), eq(outreachSends.draftId, draftId)))
        .limit(1);
      return row ?? null;
    },

    /**
     * The ≤cap/day batch count: sends with sentAt in [from, to). The door
     * computes the day window from ITS clock and refuses at the cap —
     * counting real sends only (this ledger holds nothing else).
     */
    async countInWindow(ctx: TenantCtx, window: { from: Date; to: Date }): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(outreachSends)
        .where(
          and(
            eq(outreachSends.tenantId, ctx.tenantId),
            gte(outreachSends.sentAt, window.from),
            lt(outreachSends.sentAt, window.to),
          ),
        );
      return row?.value ?? 0;
    },

    /** Cadence derivation: a lead's touch history in send order (oldest first). */
    async listForLead(ctx: TenantCtx, leadId: string): Promise<OutreachSend[]> {
      return db
        .select()
        .from(outreachSends)
        .where(and(eq(outreachSends.tenantId, ctx.tenantId), eq(outreachSends.leadId, leadId)))
        .orderBy(asc(outreachSends.sentAt), asc(outreachSends.createdAt));
    },
  };
}

export type OutreachSendsRepo = ReturnType<typeof outreachSendsRepo>;
