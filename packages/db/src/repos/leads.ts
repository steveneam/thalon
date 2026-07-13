import {
  assertLeadTransition,
  isLeadStatus,
  leadInputSchema,
  normalizeLeadEmail,
  type LeadInput,
  type LeadStatus,
  type TenantCtx,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { sha256Hex } from "../hash";
import { leads } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One inbound contact (B-crm.1) — official-API/operator-supplied sources only. */
export type Lead = typeof leads.$inferSelect;

/** The dedupe identity: hash of the ONE normalization (contracts normalizeLeadEmail). */
export function leadEmailHash(email: string): string {
  return sha256Hex(normalizeLeadEmail(email));
}

export function leadsRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, email_hash)`: importing the
     * same contact twice — any case/whitespace variant of the address —
     * returns the EXISTING lead with `created: false`, its original source
     * and fields untouched (first intake wins; enrichment/merge is
     * B-crm.3's business). Input is zod-validated at this single write door —
     * an invalid lead fails loud, nothing stores.
     */
    async add(ctx: TenantCtx, input: LeadInput): Promise<{ lead: Lead; created: boolean }> {
      const parsed = leadInputSchema.parse(input);
      const emailHash = leadEmailHash(parsed.email);
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(leads)
          .values({
            tenantId: ctx.tenantId,
            source: parsed.source,
            email: parsed.email,
            emailHash,
            name: parsed.name ?? null,
            company: parsed.company ?? null,
            role: parsed.role ?? null,
            website: parsed.website ?? null,
            notes: parsed.notes ?? null,
            painPoint: parsed.painPoint ?? null,
            meta: parsed.meta,
          })
          .onConflictDoNothing({ target: [leads.tenantId, leads.emailHash] })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(leads)
            .where(and(eq(leads.tenantId, ctx.tenantId), eq(leads.emailHash, emailHash)))
            .limit(1);
          if (!existing) {
            throw new Error(
              `lead add for tenant ${ctx.tenantId} conflicted on email hash but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { lead: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "lead",
          entityId: inserted.id,
          event: "lead.created",
          payload: { source: inserted.source },
        });
        return { lead: inserted, created: true };
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<Lead | null> {
      const [row] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** Resolves any case/whitespace variant of an address to its lead. */
    async getByEmail(ctx: TenantCtx, email: string): Promise<Lead | null> {
      const [row] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.tenantId, ctx.tenantId), eq(leads.emailHash, leadEmailHash(email))))
        .limit(1);
      return row ?? null;
    },

    async list(ctx: TenantCtx, filter?: { status?: LeadStatus }): Promise<Lead[]> {
      return db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, ctx.tenantId),
            ...(filter?.status ? [eq(leads.status, filter.status)] : []),
          ),
        );
    },

    /**
     * The ONLY writer of lead status. Transitions consult the contracts
     * rulebook (new → scored · new/scored → dismissed; dismissed is terminal
     * until B-crm.4's outreach state machine) — anything else throws before
     * anything writes. Dismissed leads are operator signal, never deleted.
     */
    async setStatus(ctx: TenantCtx, id: string, to: LeadStatus): Promise<Lead> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(leads)
          .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("lead", id);
        if (!isLeadStatus(current.status)) {
          throw new Error(`lead "${id}" carries unknown status "${current.status}"`);
        }
        assertLeadTransition(current.status, to);
        const [row] = await tx
          .update(leads)
          .set({ status: to, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "lead",
          entityId: row.id,
          event: "lead.status_changed",
          payload: { from: current.status, to },
        });
        return row;
      });
    },

    /**
     * B-crm.2 (window-1a): "mark hot" — a pin rides `meta.pinned` (open
     * shape, no schema change) and floats the lead in the queue; the
     * learning signal is the caller-composed eval row (recordLeadTriage).
     * Setting the value it already has is a no-op and emits nothing.
     */
    async setPinned(ctx: TenantCtx, id: string, pinned: boolean): Promise<Lead> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(leads)
          .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("lead", id);
        const meta = (current.meta ?? {}) as Record<string, unknown>;
        if ((meta.pinned === true) === pinned) return current;
        const [row] = await tx
          .update(leads)
          .set({ meta: { ...meta, pinned }, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "lead",
          entityId: row.id,
          event: "lead.pin_changed",
          payload: { pinned },
        });
        return row;
      });
    },
  };
}

export type LeadsRepo = ReturnType<typeof leadsRepo>;
