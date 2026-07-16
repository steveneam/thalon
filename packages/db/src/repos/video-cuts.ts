import {
  assertVideoCutTransition,
  videoCutInputSchema,
  type TenantCtx,
  type VideoCutInput,
  type VideoCutStatus,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { videoCuts, videoProjects } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One versioned cut and the EDL that built it (B-ve.1). */
export type VideoCutRow = typeof videoCuts.$inferSelect;

/**
 * NOTE (ADR 0010, deliberate): this repo ships NO approve door. The
 * `approved` status exists in contracts + the check constraint, but the
 * rendered → approved transition lands with B-ve.3/4 behind the judge gate
 * on the cut's caption text — an edited caption is content like any other
 * draft. The repo-surface test pins this absence.
 */
export function videoCutsRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, project, name, version)` —
     * replaying the same cut returns the existing row UNTOUCHED (an EDL is
     * immutable per version; a re-edit is a new version). The full EDL is
     * zod-validated at this single write door — garbage never stores. The
     * project is resolved through the tenancy wall first.
     */
    async create(
      ctx: TenantCtx,
      projectId: string,
      input: VideoCutInput,
    ): Promise<{ cut: VideoCutRow; created: boolean }> {
      const parsed = videoCutInputSchema.parse(input);
      return db.transaction(async (tx) => {
        const [project] = await tx
          .select({ id: videoProjects.id })
          .from(videoProjects)
          .where(and(eq(videoProjects.id, projectId), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!project) throw new NotFoundError("video_project", projectId);
        const [inserted] = await tx
          .insert(videoCuts)
          .values({
            tenantId: ctx.tenantId,
            projectId,
            name: parsed.name,
            version: parsed.version,
            edl: parsed.edl,
            meta: parsed.meta,
          })
          .onConflictDoNothing({
            target: [videoCuts.tenantId, videoCuts.projectId, videoCuts.name, videoCuts.version],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(videoCuts)
            .where(
              and(
                eq(videoCuts.tenantId, ctx.tenantId),
                eq(videoCuts.projectId, projectId),
                eq(videoCuts.name, parsed.name),
                eq(videoCuts.version, parsed.version),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `video cut "${parsed.name}" v${parsed.version} conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { cut: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: inserted.id,
          event: "video_cut.created",
          payload: { name: parsed.name, version: parsed.version },
        });
        return { cut: inserted, created: true };
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<VideoCutRow | null> {
      const [row] = await db
        .select()
        .from(videoCuts)
        .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** The project surface's read: a project's cuts, optionally by status. */
    async list(
      ctx: TenantCtx,
      projectId: string,
      filter?: { status?: VideoCutStatus },
    ): Promise<VideoCutRow[]> {
      return db
        .select()
        .from(videoCuts)
        .where(
          and(
            eq(videoCuts.tenantId, ctx.tenantId),
            eq(videoCuts.projectId, projectId),
            ...(filter?.status ? [eq(videoCuts.status, filter.status)] : []),
          ),
        );
    },

    /**
     * draft → rendered, guarded by the contracts rulebook: the render
     * completed and its output landed at `outputRef` (project-relative).
     * The only status transition this window wires.
     */
    async recordRender(ctx: TenantCtx, id: string, outputRef: string): Promise<VideoCutRow> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);
        assertVideoCutTransition(current.status as VideoCutStatus, "rendered");
        const [row] = await tx
          .update(videoCuts)
          .set({ status: "rendered", outputRef, updatedAt: new Date() })
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: row.id,
          event: "video_cut.rendered",
          payload: { outputRef },
        });
        return row;
      });
    },
  };
}

export type VideoCutsRepo = ReturnType<typeof videoCutsRepo>;
