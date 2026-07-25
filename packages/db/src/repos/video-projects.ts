import {
  videoProjectInputSchema,
  type TenantCtx,
  type VideoProjectInput,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { videoProjects } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One video project (B-ve.1) — one film: its takes, its versioned cuts. */
export type VideoProject = typeof videoProjects.$inferSelect;

export function videoProjectsRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, name)` — re-creating a
     * project replays cleanly (`created: false`, the existing row returned
     * UNCHANGED: first origin wins). Input is zod-validated at this single
     * write door.
     */
    async create(
      ctx: TenantCtx,
      input: VideoProjectInput,
    ): Promise<{ project: VideoProject; created: boolean }> {
      const parsed = videoProjectInputSchema.parse(input);
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(videoProjects)
          .values({
            tenantId: ctx.tenantId,
            name: parsed.name,
            description: parsed.description,
            meta: parsed.meta,
          })
          .onConflictDoNothing({ target: [videoProjects.tenantId, videoProjects.name] })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(videoProjects)
            .where(
              and(
                eq(videoProjects.tenantId, ctx.tenantId),
                eq(videoProjects.name, parsed.name),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `video project "${parsed.name}" conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { project: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: inserted.id,
          event: "video_project.created",
          payload: { name: parsed.name },
        });
        return { project: inserted, created: true };
      });
    },

    /**
     * The meta-update door the import path never needed: a one-prompt
     * project is CREATED without a box-local media root (the plan carries no
     * media), so the first real mint (s70, pillar #1) had no sanctioned way
     * to point the render door at its keepers. This sets ONLY `mediaRoot`
     * (absolute path, operator/box data — never committed), merging the rest
     * of meta untouched.
     */
    async setMediaRoot(ctx: TenantCtx, id: string, mediaRoot: string): Promise<VideoProject> {
      if (!mediaRoot.startsWith("/") || mediaRoot === "/") {
        throw new Error(`mediaRoot must be an absolute path — got "${mediaRoot}"`);
      }
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(videoProjects)
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!existing) {
          throw new Error(`video project ${id} not found for this tenant`);
        }
        const meta = { ...(existing.meta as Record<string, unknown>), mediaRoot };
        const [row] = await tx
          .update(videoProjects)
          .set({ meta })
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: id,
          event: "video_project.media_root_set",
          payload: { mediaRoot },
        });
        return row;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<VideoProject | null> {
      const [row] = await db
        .select()
        .from(videoProjects)
        .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    async list(ctx: TenantCtx): Promise<VideoProject[]> {
      return db
        .select()
        .from(videoProjects)
        .where(eq(videoProjects.tenantId, ctx.tenantId));
    },
  };
}

export type VideoProjectsRepo = ReturnType<typeof videoProjectsRepo>;
