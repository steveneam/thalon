import {
  assertVideoCutTransition,
  videoCutInputSchema,
  videoCutLineageSchema,
  type TenantCtx,
  type VideoCutInput,
  type VideoCutLineage,
  type VideoCutStatus,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { videoCuts, videoProjects } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One versioned cut and the EDL that built it (B-ve.1). */
export type VideoCutRow = typeof videoCuts.$inferSelect;

/**
 * The judge receipt the approve door DEMANDS (B-ve.4, ADR 0010 invariant:
 * an edited caption is content — no cut approves without a green verdict).
 * `verdict` is the literal "pass": a red verdict is unrepresentable at this
 * door, so "approve despite a fail" cannot even be typed.
 */
export interface CutJudgeReceipt {
  /** Which lens produced the verdict (e.g. "g1-captions"). */
  gate: string;
  verdict: "pass";
  /** How many text layers the lens examined (0 = a caption-less cut). */
  lines: number;
}

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
     * The only status transition this window wires. `elapsedMs` is the
     * render's MEASURED wall time (V7 — durations are honest): recorded
     * when the caller measured one, absent otherwise, never invented.
     */
    async recordRender(
      ctx: TenantCtx,
      id: string,
      outputRef: string,
      elapsedMs?: number,
    ): Promise<VideoCutRow> {
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
          payload: { outputRef, ...(elapsedMs !== undefined ? { elapsedMs } : {}) },
        });
        return row;
      });
    },

    /**
     * rendered → approved, behind the judge gate (B-ve.4, ADR 0010): the
     * caller hands over the green receipt — gate name + verdict + how many
     * text layers were examined — and it lands verbatim in the event
     * payload, so every approval carries WHAT vouched for it. The receipt
     * type only admits `verdict: "pass"`; running the lens is the web
     * door's job, refusing without a green receipt is this one's.
     */
    async approve(ctx: TenantCtx, id: string, judge: CutJudgeReceipt): Promise<VideoCutRow> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);
        assertVideoCutTransition(current.status as VideoCutStatus, "approved");
        const [row] = await tx
          .update(videoCuts)
          .set({ status: "approved", updatedAt: new Date() })
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: row.id,
          event: "video_cut.approved",
          payload: { judge: { ...judge } },
        });
        return row;
      });
    },

    /**
     * B-ve.5 (additive): stamp `meta.lineage` on a cut that predates the
     * derive door (the 9:16 master import-backfill case). Lineage is
     * IMMUTABLE once present — an identical re-stamp replays as a no-op
     * (idempotent, no event), a DIFFERENT one fails loud: provenance is
     * one-way. The parent must be a cut of the same project, through the
     * tenancy wall.
     */
    async stampLineage(
      ctx: TenantCtx,
      id: string,
      lineage: VideoCutLineage,
    ): Promise<{ cut: VideoCutRow; stamped: boolean }> {
      const parsed = videoCutLineageSchema.parse(lineage);
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);
        const existing = (current.meta as { lineage?: unknown }).lineage;
        if (existing !== undefined) {
          const parsedExisting = videoCutLineageSchema.safeParse(existing);
          if (
            parsedExisting.success &&
            parsedExisting.data.parentCutId === parsed.parentCutId &&
            parsedExisting.data.aspect === parsed.aspect
          ) {
            return { cut: current, stamped: false };
          }
          throw new Error(
            `video cut ${id} already carries a different lineage — lineage is immutable once stamped`,
          );
        }
        const [parent] = await tx
          .select({ id: videoCuts.id, projectId: videoCuts.projectId })
          .from(videoCuts)
          .where(and(eq(videoCuts.id, parsed.parentCutId), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!parent || parent.projectId !== current.projectId) {
          throw new NotFoundError("video_cut (lineage parent in project)", parsed.parentCutId);
        }
        const [row] = await tx
          .update(videoCuts)
          .set({
            meta: { ...(current.meta as Record<string, unknown>), lineage: parsed },
            updatedAt: new Date(),
          })
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: row.id,
          event: "video_cut.lineage_stamped",
          payload: { lineage: { ...parsed } },
        });
        return { cut: row, stamped: true };
      });
    },

    /**
     * s82 window (W1): delete a version — the editor's A3 verb, for the
     * abandoned derived cut and the mis-saved variant. A HARD delete of the
     * row; the rendered FILE is the caller's to remove, which is why the
     * deleted row's `outputRef` comes back (a repo cannot reach the object
     * store, and a delete that silently orphaned a render would be the
     * quieter bug).
     *
     * Three refusals, ratified by the founder at the s81 close (plan §3 call
     * #2). Each is a typed `InvalidStateError` naming what stands in the way,
     * because a verb that refuses without saying why is the dead door this
     * session exists to stop shipping:
     *
     *   a. **an approved cut** — approval is a judge receipt (ADR 0010);
     *      deleting one deletes the evidence that the gate passed.
     *   b. **a lineage parent of a living derived cut** — the child's
     *      provenance points here, and provenance that dangles is worse than
     *      provenance absent.
     *   c. **the project's last cut** — a project with zero cuts has no
     *      recoverable state in the editor; deleting the project is a
     *      different, deliberate act.
     *
     * Rejected-proposal eval rows live in their own table and are untouched:
     * what the judge refused stays on the record whatever happens to the cut.
     */
    async remove(ctx: TenantCtx, id: string): Promise<{ removed: VideoCutRow }> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);

        if (current.status === "approved") {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is approved — an approved cut carries its judge receipt and cannot be deleted`,
          );
        }

        const siblings = await tx
          .select({ id: videoCuts.id, name: videoCuts.name, version: videoCuts.version, meta: videoCuts.meta })
          .from(videoCuts)
          .where(
            and(
              eq(videoCuts.tenantId, ctx.tenantId),
              eq(videoCuts.projectId, current.projectId),
            ),
          );

        if (siblings.length <= 1) {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is this project's only cut — deleting it would leave the project with nothing to open`,
          );
        }

        const child = siblings.find((row) => {
          if (row.id === current.id) return false;
          const lineage = (row.meta as { lineage?: { parentCutId?: string } }).lineage;
          return lineage?.parentCutId === current.id;
        });
        if (child) {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is the lineage parent of "${child.name}" v${child.version} — delete the derived cut first, or its provenance would dangle`,
          );
        }

        const [removed] = await tx
          .delete(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: removed.id,
          event: "video_cut.removed",
          payload: {
            name: removed.name,
            version: removed.version,
            status: removed.status,
            outputRef: removed.outputRef,
          },
        });
        return { removed };
      });
    },
  };
}

export type VideoCutsRepo = ReturnType<typeof videoCutsRepo>;
