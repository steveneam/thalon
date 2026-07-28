import { destinationKeySchema, type DestinationKey, type TenantCtx } from "@thalon/contracts";
import { and, eq, lt } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { oauthStates } from "../schema";
import type { Db } from "../types";

/** One in-flight OAuth authorization (D1, s83 window). */
export type OauthStateRow = typeof oauthStates.$inferSelect;

/**
 * The connect dance's state store (D1). Three verbs, deliberately narrow:
 * `create` opens a flight, `consume` closes it exactly once (delete-returning
 * inside the tenant wall — a replayed callback finds nothing), and
 * `purgeExpired` sweeps abandoned consents. The clock is passed in, never
 * read here (deterministic-core convention). No events: a state row is
 * transport scaffolding, not an audit fact — the audit fact is the vault
 * connect it leads to, which ledgers itself.
 */
export function oauthStatesRepo(db: Db) {
  return {
    async create(
      ctx: TenantCtx,
      input: {
        state: string;
        destination: DestinationKey;
        codeVerifier?: string | null;
        expiresAt: Date;
      },
    ): Promise<OauthStateRow> {
      destinationKeySchema.parse(input.destination);
      const [row] = await db
        .insert(oauthStates)
        .values({
          state: input.state,
          tenantId: ctx.tenantId,
          destination: input.destination,
          codeVerifier: input.codeVerifier ?? null,
          expiresAt: input.expiresAt,
        })
        .returning();
      return row;
    },

    /**
     * Single-use consume: DELETE … RETURNING inside the tenant wall. A state
     * that never existed, was already consumed, or belongs to another tenant
     * all answer identically (NotFoundError) — a callback must not be able to
     * distinguish "someone else's flight" from "no flight". An EXPIRED row is
     * deleted too but refuses with the reason on its face: the operator
     * re-opens the connect door rather than wondering.
     */
    async consume(ctx: TenantCtx, state: string, now: Date): Promise<OauthStateRow> {
      const [row] = await db
        .delete(oauthStates)
        .where(and(eq(oauthStates.state, state), eq(oauthStates.tenantId, ctx.tenantId)))
        .returning();
      if (!row) throw new NotFoundError("oauth state", state);
      if (row.expiresAt.getTime() <= now.getTime()) {
        throw new InvalidStateError(
          `oauth state for "${row.destination}" expired at ${row.expiresAt.toISOString()} — ` +
            `the consent took too long; start the connect again`,
        );
      }
      return row;
    },

    /** SYSTEM-level sweep of abandoned flights — rows whose TTL passed. Returns the count removed. */
    async purgeExpired(now: Date): Promise<number> {
      const rows = await db.delete(oauthStates).where(lt(oauthStates.expiresAt, now)).returning();
      return rows.length;
    },
  };
}

export type OauthStatesRepo = ReturnType<typeof oauthStatesRepo>;
