import { socialPlatformSchema, type TenantCtx } from "@thalon/contracts";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { socialPublications } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One platform-accepted publication (Sprint-8 window, B-pub) — append-only audit ledger. */
export type SocialPublication = typeof socialPublications.$inferSelect;

/**
 * The (tenant, draft, platform) unique index lost a race — the platform
 * call already happened, so this is an INCIDENT to surface loudly, never
 * an idempotent replay (the outreach DuplicateSendError convention).
 */
export class DuplicatePublicationError extends Error {
  constructor(draftId: string, platform: string) {
    super(
      `draft ${draftId} already has a recorded publication on ${platform} — a second platform post was attempted`,
    );
    this.name = "DuplicatePublicationError";
  }
}

/** Driver-agnostic unique-violation detection (the outreach-sends convention — walks the cause chain). */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const withCode = err as { code?: unknown; message?: unknown; cause?: unknown };
  if (withCode.code === "23505") return true;
  if (typeof withCode.message === "string" && withCode.message.includes("duplicate key")) return true;
  return withCode.cause !== undefined && isUniqueViolation(withCode.cause);
}

export function socialPublicationsRepo(db: Db) {
  return {
    /**
     * Record one platform-ACCEPTED publication. Called by the publish door
     * AFTER the platform accepted — a row here is a fact about the world.
     */
    async record(
      ctx: TenantCtx,
      input: {
        draftId: string;
        platform: string;
        externalPostId: string;
        bodyHash: string;
        publishedAt: Date;
        meta?: Record<string, unknown>;
      },
    ): Promise<SocialPublication> {
      const platform = socialPlatformSchema.parse(input.platform);
      return db.transaction(async (tx) => {
        let row: SocialPublication | undefined;
        try {
          [row] = await tx
            .insert(socialPublications)
            .values({
              tenantId: ctx.tenantId,
              draftId: input.draftId,
              platform,
              externalPostId: input.externalPostId,
              bodyHash: input.bodyHash,
              publishedAt: input.publishedAt,
              meta: input.meta ?? {},
            })
            .returning();
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new DuplicatePublicationError(input.draftId, platform);
          }
          throw err;
        }
        await appendEvent(tx, ctx, {
          entityType: "social_publication",
          entityId: row.id,
          event: "social.published",
          payload: { draftId: input.draftId, platform, externalPostId: input.externalPostId },
        });
        return row;
      });
    },

    /** The refusal ladder's ≤cap/day rung: publications on a platform since a cutoff. */
    async countSince(ctx: TenantCtx, platform: string, since: Date): Promise<number> {
      const valid = socialPlatformSchema.parse(platform);
      const [row] = await db
        .select({ n: count() })
        .from(socialPublications)
        .where(
          and(
            eq(socialPublications.tenantId, ctx.tenantId),
            eq(socialPublications.platform, valid),
            gte(socialPublications.publishedAt, since),
          ),
        );
      return row?.n ?? 0;
    },

    /** The published-view read (B-int.2): newest platform-accepted publications first, plus the honest total behind the bound. */
    async listRecent(
      ctx: TenantCtx,
      limit: number,
    ): Promise<{ rows: SocialPublication[]; total: number }> {
      const [totalRow] = await db
        .select({ n: count() })
        .from(socialPublications)
        .where(eq(socialPublications.tenantId, ctx.tenantId));
      const rows = await db
        .select()
        .from(socialPublications)
        .where(eq(socialPublications.tenantId, ctx.tenantId))
        .orderBy(desc(socialPublications.publishedAt))
        .limit(limit);
      return { rows, total: totalRow?.n ?? 0 };
    },

    /** Audit read: where has this draft already gone? (Also the door's pre-post duplicate check.) */
    async listForDraft(ctx: TenantCtx, draftId: string): Promise<SocialPublication[]> {
      return db
        .select()
        .from(socialPublications)
        .where(
          and(
            eq(socialPublications.tenantId, ctx.tenantId),
            eq(socialPublications.draftId, draftId),
          ),
        );
    },
  };
}

export type SocialPublicationsRepo = ReturnType<typeof socialPublicationsRepo>;
