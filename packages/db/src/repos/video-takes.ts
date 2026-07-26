import {
  videoTakePosterSchema,
  videoTakeSchema,
  type TenantCtx,
  type VideoTakeDisposition,
  type VideoTakeInput,
  type VideoTakePoster,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { stableStringify } from "../hash";
import { videoProjects, videoTakes } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One take = one asset file in a project's tree: keeper or reject, reason on record. */
export type VideoTakeRow = typeof videoTakes.$inferSelect;

export function videoTakesRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, project, ref)` — re-recording
     * the same asset replays cleanly (`created: false`, the existing row
     * returned UNCHANGED). Zod-validated at this single write door: a reject
     * without a reason is refused (the learning material, s43 discipline).
     * The project is resolved through the tenancy wall first — the FK alone
     * is not the wall.
     */
    async record(
      ctx: TenantCtx,
      projectId: string,
      input: VideoTakeInput,
    ): Promise<{ take: VideoTakeRow; created: boolean }> {
      const parsed = videoTakeSchema.parse(input);
      return db.transaction(async (tx) => {
        const [project] = await tx
          .select({ id: videoProjects.id })
          .from(videoProjects)
          .where(and(eq(videoProjects.id, projectId), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!project) throw new NotFoundError("video_project", projectId);
        const [inserted] = await tx
          .insert(videoTakes)
          .values({
            tenantId: ctx.tenantId,
            projectId,
            slot: parsed.slot,
            kind: parsed.kind,
            disposition: parsed.disposition,
            ref: parsed.ref,
            reason: parsed.reason,
            provenance: parsed.provenance,
            meta: parsed.meta,
          })
          .onConflictDoNothing({
            target: [videoTakes.tenantId, videoTakes.projectId, videoTakes.ref],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(videoTakes)
            .where(
              and(
                eq(videoTakes.tenantId, ctx.tenantId),
                eq(videoTakes.projectId, projectId),
                eq(videoTakes.ref, parsed.ref),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `video take "${parsed.ref}" conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { take: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "video_take",
          entityId: inserted.id,
          event: "video_take.recorded",
          payload: { ref: parsed.ref, slot: parsed.slot ?? null, disposition: parsed.disposition },
        });
        return { take: inserted, created: true };
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<VideoTakeRow | null> {
      const [row] = await db
        .select()
        .from(videoTakes)
        .where(and(eq(videoTakes.id, id), eq(videoTakes.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** The beat lane's read: a project's takes, optionally one slot or disposition. */
    async list(
      ctx: TenantCtx,
      projectId: string,
      filter?: { slot?: string; disposition?: VideoTakeDisposition },
    ): Promise<VideoTakeRow[]> {
      return db
        .select()
        .from(videoTakes)
        .where(
          and(
            eq(videoTakes.tenantId, ctx.tenantId),
            eq(videoTakes.projectId, projectId),
            ...(filter?.slot ? [eq(videoTakes.slot, filter.slot)] : []),
            ...(filter?.disposition ? [eq(videoTakes.disposition, filter.disposition)] : []),
          ),
        );
    },

    /**
     * B-media.0 (s77): stamp the take's derived poster onto `meta.posterRef`
     * — write moment 2 of the media framework, validated at this single door
     * by the frozen `videoTakePosterSchema` (the `meta.lineage` pattern; jsonb,
     * no table change).
     *
     * Idempotent on the VALUE, not on presence: re-stamping the identical
     * envelope is a silent no-op (`stamped: false`), so a re-run of the
     * backfill door costs one read. A DIFFERENT poster replaces the old one
     * rather than refusing — unlike lineage, a poster is a choice of frame,
     * and the future import door lets an operator pick a better one.
     */
    async setPoster(
      ctx: TenantCtx,
      id: string,
      poster: VideoTakePoster,
    ): Promise<{ take: VideoTakeRow; stamped: boolean }> {
      const parsed = videoTakePosterSchema.parse(poster);
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoTakes)
          .where(and(eq(videoTakes.id, id), eq(videoTakes.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_take", id);
        const meta = current.meta as Record<string, unknown>;
        const existing = videoTakePosterSchema.safeParse(meta.posterRef);
        if (existing.success && stableStringify(existing.data) === stableStringify(parsed)) {
          return { take: current, stamped: false };
        }
        const [row] = await tx
          .update(videoTakes)
          .set({ meta: { ...meta, posterRef: parsed }, updatedAt: new Date() })
          .where(and(eq(videoTakes.id, id), eq(videoTakes.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_take",
          entityId: row.id,
          event: "video_take.poster_stamped",
          payload: {
            sha256: parsed.ref.sha256,
            ext: parsed.ref.ext,
            provenance: parsed.provenance,
            replaced: existing.success,
          },
        });
        return { take: row, stamped: true };
      });
    },

    /**
     * The retake verb: a superseded keeper becomes a reject WITH its reason
     * (required — refused loudly without one); a re-promoted reject clears
     * it. Re-applying the same disposition is a silent no-op (no event).
     */
    async setDisposition(
      ctx: TenantCtx,
      id: string,
      disposition: VideoTakeDisposition,
      reason?: string,
    ): Promise<VideoTakeRow> {
      if (disposition === "reject" && !reason) {
        throw new Error("a reject must carry its reason (the learning material)");
      }
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoTakes)
          .where(and(eq(videoTakes.id, id), eq(videoTakes.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_take", id);
        if (current.disposition === disposition) return current;
        const [row] = await tx
          .update(videoTakes)
          .set({
            disposition,
            reason: disposition === "reject" ? (reason as string) : null,
            updatedAt: new Date(),
          })
          .where(and(eq(videoTakes.id, id), eq(videoTakes.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_take",
          entityId: row.id,
          event: "video_take.disposition_changed",
          payload: { from: current.disposition, to: disposition, reason: reason ?? null },
        });
        return row;
      });
    },
  };
}

export type VideoTakesRepo = ReturnType<typeof videoTakesRepo>;
