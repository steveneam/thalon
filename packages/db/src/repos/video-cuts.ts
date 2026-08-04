import {
  assertVideoCutTransition,
  videoCutInputSchema,
  videoCutLineageSchema,
  type TenantCtx,
  type VideoCutInput,
  type VideoCutLineage,
  type VideoCutStatus,
} from "@thalon/contracts";
import { and, eq, isNull } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { videoCuts, videoProjects } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";
import type { RetiredReadOptions } from "./video-projects";

/** One versioned cut and the EDL that built it (B-ve.1). */
export type VideoCutRow = typeof videoCuts.$inferSelect;

/** Window 0026: reads exclude retired cuts unless the caller opts in (the restore door). */
const livingOnly = (opts?: RetiredReadOptions) =>
  opts?.includeRetired ? [] : [isNull(videoCuts.retiredAt)];

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
          // Window 0026: a RETIRED cut still holds its (name, version) slot.
          // Replaying onto it would hand the caller a cut none of their reads
          // can see — and, worse, one whose EDL is the OLD one (create is
          // idempotent, it never overwrites). Refuse and name the way out.
          if (existing.retiredAt) {
            throw new InvalidStateError(
              `video cut "${parsed.name}" v${parsed.version} is retired — restore it, or save as a new version`,
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

    async get(
      ctx: TenantCtx,
      id: string,
      opts?: RetiredReadOptions,
    ): Promise<VideoCutRow | null> {
      const [row] = await db
        .select()
        .from(videoCuts)
        .where(
          and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId), ...livingOnly(opts)),
        )
        .limit(1);
      return row ?? null;
    },

    /** The project surface's read: a project's LIVING cuts, optionally by status. */
    async list(
      ctx: TenantCtx,
      projectId: string,
      filter?: { status?: VideoCutStatus } & RetiredReadOptions,
    ): Promise<VideoCutRow[]> {
      return db
        .select()
        .from(videoCuts)
        .where(
          and(
            eq(videoCuts.tenantId, ctx.tenantId),
            eq(videoCuts.projectId, projectId),
            ...(filter?.status ? [eq(videoCuts.status, filter.status)] : []),
            ...livingOnly(filter),
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
     * Window 0026 — RETIRE a version. This is s82's A3 delete verb, and the
     * founder's call at the s99 close turned it from destruction into
     * reversal: **removal retires, it never destroys.** The row stays, its
     * `output_ref` stays, and THE RENDERED FILE STAYS ON DISK — no caller
     * unlinks anything any more. That is not tidiness, it is the only way the
     * confirm the sheet has been drawing all along ("Restore brings it back
     * exactly as it is now") can be true; a retire that deleted the render
     * would make the product's own promise a lie. Nothing auto-purges a
     * retired cut — the disk cost is accepted on the 180 GB box.
     *
     * The three refusals ratified by the founder at the s81 close SURVIVE the
     * change, each re-scoped to LIVING rows, because every one of them
     * protects something inside a project that is still open — and reversal
     * does not repair a dangle that exists while the retirement stands:
     *
     *   a. **an approved cut** — approval is a judge receipt (ADR 0010), and
     *      it is the evidence of what shipped; hiding it from the strip hides
     *      what the operator is answerable for.
     *   b. **a lineage parent of a LIVING derived cut** — the child's
     *      provenance points here, and provenance pointing at something the
     *      operator cannot see is worse than provenance absent. Retire the
     *      derived cut first (then the parent is free).
     *   c. **the project's last LIVING cut** — a project with nothing left to
     *      open is not a tidier project. Retiring the PROJECT is the verb for
     *      that, and it has no such refusal.
     *
     * Retiring an already-retired cut replays as a no-op — the first stamp
     * stands and no event appends. Rejected-proposal eval rows live in their
     * own table and are untouched: what the judge refused stays on the record.
     */
    async retire(ctx: TenantCtx, id: string): Promise<{ cut: VideoCutRow; retired: boolean }> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);
        if (current.retiredAt) return { cut: current, retired: false };

        if (current.status === "approved") {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is approved — an approved cut carries its judge receipt and stays on the strip`,
          );
        }

        // Living siblings only: what is already retired cannot be left
        // dangling by this retirement, and cannot keep the project openable.
        const siblings = await tx
          .select({
            id: videoCuts.id,
            name: videoCuts.name,
            version: videoCuts.version,
            meta: videoCuts.meta,
          })
          .from(videoCuts)
          .where(
            and(
              eq(videoCuts.tenantId, ctx.tenantId),
              eq(videoCuts.projectId, current.projectId),
              isNull(videoCuts.retiredAt),
            ),
          );

        if (siblings.length <= 1) {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is this project's only remaining cut — retiring it would leave the project with nothing to open`,
          );
        }

        const child = siblings.find((row) => {
          if (row.id === current.id) return false;
          const lineage = (row.meta as { lineage?: { parentCutId?: string } }).lineage;
          return lineage?.parentCutId === current.id;
        });
        if (child) {
          throw new InvalidStateError(
            `video cut "${current.name}" v${current.version} is the lineage parent of "${child.name}" v${child.version} — retire the derived cut first, or its provenance would dangle`,
          );
        }

        const [row] = await tx
          .update(videoCuts)
          .set({ retiredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: row.id,
          event: "video_cut.retired",
          payload: {
            name: row.name,
            version: row.version,
            status: row.status,
            // The render it KEEPS — the retire's whole difference from s82's
            // delete, stated in the audit spine rather than implied.
            outputRef: row.outputRef,
          },
        });
        return { cut: row, retired: true };
      });
    },

    /**
     * Window 0026 — RESTORE: clear the stamp and the cut is back on the strip
     * exactly as it was, render and all. It reads WITH retired rows included
     * (the sanctioned use of that opt-in — a restore door that could not see
     * retired rows could not restore anything).
     *
     * One refusal: a cut whose (name, version) slot has been taken by a
     * LIVING cut since it was retired cannot come back, because the unique
     * index will not hold two. That is reachable — retire v3, save a new v3 —
     * and refusing by name beats surfacing a constraint violation.
     * Restoring a living cut replays as a no-op.
     */
    async restore(ctx: TenantCtx, id: string): Promise<{ cut: VideoCutRow; restored: boolean }> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoCuts)
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_cut", id);
        if (!current.retiredAt) return { cut: current, restored: false };

        const [taken] = await tx
          .select({ id: videoCuts.id })
          .from(videoCuts)
          .where(
            and(
              eq(videoCuts.tenantId, ctx.tenantId),
              eq(videoCuts.projectId, current.projectId),
              eq(videoCuts.name, current.name),
              eq(videoCuts.version, current.version),
              isNull(videoCuts.retiredAt),
            ),
          )
          .limit(1);
        if (taken) {
          throw new InvalidStateError(
            `another cut now holds "${current.name}" v${current.version} — restoring this one would collide with it`,
          );
        }

        const [row] = await tx
          .update(videoCuts)
          .set({ retiredAt: null, updatedAt: new Date() })
          .where(and(eq(videoCuts.id, id), eq(videoCuts.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_cut",
          entityId: row.id,
          event: "video_cut.restored",
          payload: {
            name: row.name,
            version: row.version,
            outputRef: row.outputRef,
            retiredAt: current.retiredAt.toISOString(),
          },
        });
        return { cut: row, restored: true };
      });
    },
  };
}

export type VideoCutsRepo = ReturnType<typeof videoCutsRepo>;
