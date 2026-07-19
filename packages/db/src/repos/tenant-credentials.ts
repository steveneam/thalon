import {
  credentialEnvelopeSchema,
  destinationKeySchema,
  type CredentialEnvelope,
  type CredentialStoredState,
  type DestinationKey,
  type TenantCtx,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { tenantCredentials } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One vault row (B-int.0) — a tenant's sealed credential for one destination. */
export type TenantCredential = typeof tenantCredentials.$inferSelect;

/**
 * The vault's storage doors (B-int.0). Crypto lives OUTSIDE this repo: the
 * B-int.1 vault core seals plaintext into the envelope before `connect` and
 * opens it after `get` — this layer validates SHAPES (registry key, sealed
 * envelope), walls tenancy, and ledgers events. Redaction invariant, pinned
 * in b-int0-repos.test.ts: an event payload carries the destination key and
 * the public `connectedAs` label ONLY — never any envelope field.
 */
export function tenantCredentialsRepo(db: Db) {
  return {
    /**
     * Connect OR reconnect/rotate — the same upsert: one credential per
     * (tenant, destination), latest paste wins, status returns to
     * "connected". Emits `tenant_credential.connected` on first connect,
     * `.rotated` on replacement.
     */
    async connect(
      ctx: TenantCtx,
      input: {
        destination: DestinationKey;
        envelope: CredentialEnvelope;
        connectedAs?: string | null;
        expiresAt?: Date | null;
      },
    ): Promise<TenantCredential> {
      const destination = destinationKeySchema.parse(input.destination);
      const envelope = credentialEnvelopeSchema.parse(input.envelope);
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(tenantCredentials)
          .where(
            and(
              eq(tenantCredentials.tenantId, ctx.tenantId),
              eq(tenantCredentials.destination, destination),
            ),
          )
          .limit(1);
        const values = {
          status: "connected" as const,
          ciphertext: envelope.ciphertext,
          dataKeyWrapped: envelope.dataKeyWrapped,
          iv: envelope.iv,
          authTag: envelope.authTag,
          keyVersion: envelope.keyVersion,
          connectedAs: input.connectedAs ?? null,
          expiresAt: input.expiresAt ?? null,
          updatedAt: new Date(),
        };
        let row: TenantCredential;
        if (existing) {
          [row] = await tx
            .update(tenantCredentials)
            .set(values)
            .where(eq(tenantCredentials.id, existing.id))
            .returning();
        } else {
          [row] = await tx
            .insert(tenantCredentials)
            .values({ tenantId: ctx.tenantId, destination, ...values })
            .returning();
        }
        await appendEvent(tx, ctx, {
          entityType: "tenant_credential",
          entityId: row.id,
          event: existing ? "tenant_credential.rotated" : "tenant_credential.connected",
          // Redaction invariant: destination + public label ONLY.
          payload: { destination, connectedAs: row.connectedAs },
        });
        return row;
      });
    },

    async get(ctx: TenantCtx, destination: DestinationKey): Promise<TenantCredential | null> {
      const [row] = await db
        .select()
        .from(tenantCredentials)
        .where(
          and(
            eq(tenantCredentials.tenantId, ctx.tenantId),
            eq(tenantCredentials.destination, destinationKeySchema.parse(destination)),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /** The cards read: every connected destination for this tenant. */
    async list(ctx: TenantCtx): Promise<TenantCredential[]> {
      return db
        .select()
        .from(tenantCredentials)
        .where(eq(tenantCredentials.tenantId, ctx.tenantId));
    },

    /**
     * Stored-state transition — the validate-ping (→ "connected", stamps
     * validatedAt) and the failed-refresh (→ "needs_reauth") doors. Derived
     * card states never store (contracts CREDENTIAL_CARD_STATES doc).
     */
    async markStatus(
      ctx: TenantCtx,
      destination: DestinationKey,
      status: CredentialStoredState,
      opts: { validatedAt?: Date } = {},
    ): Promise<TenantCredential> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(tenantCredentials)
          .set({
            status,
            ...(opts.validatedAt ? { validatedAt: opts.validatedAt } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantCredentials.tenantId, ctx.tenantId),
              eq(tenantCredentials.destination, destinationKeySchema.parse(destination)),
            ),
          )
          .returning();
        if (!row) {
          throw new NotFoundError("tenant_credential", destination);
        }
        await appendEvent(tx, ctx, {
          entityType: "tenant_credential",
          entityId: row.id,
          event: "tenant_credential.state_changed",
          payload: { destination: row.destination, status },
        });
        return row;
      });
    },

    /** Disconnect — a real operator action: the row deletes, the ledger remembers. */
    async remove(ctx: TenantCtx, destination: DestinationKey): Promise<void> {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .delete(tenantCredentials)
          .where(
            and(
              eq(tenantCredentials.tenantId, ctx.tenantId),
              eq(tenantCredentials.destination, destinationKeySchema.parse(destination)),
            ),
          )
          .returning();
        if (!row) {
          throw new NotFoundError("tenant_credential", destination);
        }
        await appendEvent(tx, ctx, {
          entityType: "tenant_credential",
          entityId: row.id,
          event: "tenant_credential.removed",
          payload: { destination: row.destination },
        });
      });
    },
  };
}

export type TenantCredentialsRepo = ReturnType<typeof tenantCredentialsRepo>;
