import {
  audioRefEnvelopeSchema,
  videoProjectInputSchema,
  videoProjectRenameSchema,
  type AudioRefEnvelope,
  type TenantCtx,
  type VideoProjectInput,
} from "@thalon/contracts";
import { and, eq, isNull } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { videoProjects } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One video project (B-ve.1) — one film: its takes, its versioned cuts. */
export type VideoProject = typeof videoProjects.$inferSelect;

/**
 * Window 0026: reads EXCLUDE retired rows unless the caller says otherwise.
 * The default is the whole point — a retire that still showed up everywhere
 * is not a retire — and the opt-in exists for exactly one kind of caller: the
 * restore door, which must be able to see what it is bringing back.
 */
export interface RetiredReadOptions {
  includeRetired?: boolean;
}

const livingOnly = (opts?: RetiredReadOptions) =>
  opts?.includeRetired ? [] : [isNull(videoProjects.retiredAt)];

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
          // Window 0026: a RETIRED project still holds its name. Handing it
          // back as a get-or-create hit would silently resurrect nothing —
          // the caller would receive a project that no read of theirs can
          // see, and the one-prompt runner would then mint takes into it.
          // Refuse loudly and name both ways out.
          if (existing.retiredAt) {
            throw new InvalidStateError(
              `video project "${parsed.name}" is retired — restore it to keep working in it, or choose another name`,
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

    /**
     * B-audio.1 (s77): point the project at its operator-licensed music bed —
     * `meta.audioBed = { bed, license }`, merging the rest of meta untouched
     * (the `setMediaRoot` shape, jsonb, no table change).
     *
     * The REF is validated by the frozen `audioRefEnvelopeSchema`, which makes
     * a bed structurally stored-only: you cannot license bytes you do not
     * hold. The LICENCE rides in the same write because a bed whose right-to-
     * use nobody stated is precisely what the gate exists to stop; its richer
     * shape is validated at the engine door (`render/audio-bed.ts`, the
     * pre-window home `assetProvenanceSchema` used), and this door holds the
     * floor: a non-empty licence and a non-empty source, always.
     */
    async setAudioBed(
      ctx: TenantCtx,
      id: string,
      input: { bed: AudioRefEnvelope; license: Record<string, unknown> },
    ): Promise<VideoProject> {
      const bed = audioRefEnvelopeSchema.parse(input.bed);
      const license = input.license;
      const stated = (key: string): boolean =>
        typeof license?.[key] === "string" && (license[key] as string).trim().length > 0;
      if (!stated("license") || !stated("source")) {
        throw new Error(
          "an audio bed must arrive with its licence and its source stated — licensing is attested, never assumed",
        );
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
        const meta = { ...(existing.meta as Record<string, unknown>), audioBed: { bed, license } };
        const [row] = await tx
          .update(videoProjects)
          .set({ meta })
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: id,
          event: "video_project.audio_bed_set",
          payload: { sha256: bed.ref.sha256, ext: bed.ref.ext, license: license.license },
        });
        return row;
      });
    },

    /**
     * Window 0026 — RENAME, and the one thing it must never do: MERGE. The
     * founder's call at the s99 close, off the live grid's two near-duplicate
     * one-prompt runs. `(tenant, name)` is not just a unique index, it is the
     * get-or-create idempotency key (`create`, above), so "rename A to B where
     * B exists" cannot mean "combine them" — it would mean every later
     * get-or-create for B lands in a project that used to be A. It refuses,
     * and it names the project standing in the way.
     *
     * Renaming to the name it already has is a NO-OP: the row comes back
     * untouched and no event appends (the replay-appends-nothing rule — an
     * audit spine that records non-changes is one an operator learns to skim).
     */
    async rename(
      ctx: TenantCtx,
      id: string,
      input: { name: string },
    ): Promise<{ project: VideoProject; renamed: boolean }> {
      const parsed = videoProjectRenameSchema.parse(input);
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoProjects)
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_project", id);
        if (current.name === parsed.name) return { project: current, renamed: false };

        // Deliberately NOT filtered by retiredAt: a retired project still
        // owns its name in the unique index. Letting the constraint fire
        // instead would surface a Postgres error where an answer belongs.
        const [taken] = await tx
          .select({ id: videoProjects.id, retiredAt: videoProjects.retiredAt })
          .from(videoProjects)
          .where(
            and(eq(videoProjects.tenantId, ctx.tenantId), eq(videoProjects.name, parsed.name)),
          )
          .limit(1);
        if (taken) {
          throw new InvalidStateError(
            taken.retiredAt
              ? `a retired project is already called "${parsed.name}" — restore and rename that one, or pick another name`
              : `another project is already called "${parsed.name}" — names are unique, and renaming onto one would merge two projects into it`,
          );
        }

        const [row] = await tx
          .update(videoProjects)
          .set({ name: parsed.name, updatedAt: new Date() })
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: row.id,
          event: "video_project.renamed",
          payload: { from: current.name, to: parsed.name },
        });
        return { project: row, renamed: true };
      });
    },

    /**
     * Window 0026 — RETIRE: the project leaves every default read, and
     * nothing else happens to it. Its cuts, takes, rendered files, judge
     * receipts and events all stay exactly as they are, which is what makes
     * `restore` able to promise "exactly as it is now" honestly.
     *
     * There are deliberately NO refusals here, and that asymmetry with
     * `videoCuts.retire` is the point: a cut's refusals protect things that
     * would be left DANGLING inside a living project (a derived cut's
     * provenance, an openable project, an approved cut's receipt). Retiring
     * the whole project dangles nothing — the tree leaves together and comes
     * back together. Blocking it would have blocked the founder's actual
     * case (two near-duplicate one-prompt runs on the live grid) for no
     * safety gained.
     *
     * Retiring an already-retired project replays as a no-op: the original
     * stamp stands (first retirement wins — a re-retire must not rewrite when
     * it happened) and no event appends.
     */
    async retire(ctx: TenantCtx, id: string): Promise<{ project: VideoProject; retired: boolean }> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoProjects)
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_project", id);
        if (current.retiredAt) return { project: current, retired: false };

        const [row] = await tx
          .update(videoProjects)
          .set({ retiredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: row.id,
          event: "video_project.retired",
          payload: { name: row.name },
        });
        return { project: row, retired: true };
      });
    },

    /**
     * Window 0026 — RESTORE: clears the stamp, and that is the whole verb.
     * It can restore only what it can find, so it reads WITH retired rows
     * included (the single sanctioned use of that opt-in). Restoring a living
     * project replays as a no-op.
     */
    async restore(
      ctx: TenantCtx,
      id: string,
    ): Promise<{ project: VideoProject; restored: boolean }> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(videoProjects)
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("video_project", id);
        if (!current.retiredAt) return { project: current, restored: false };

        const [row] = await tx
          .update(videoProjects)
          .set({ retiredAt: null, updatedAt: new Date() })
          .where(and(eq(videoProjects.id, id), eq(videoProjects.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "video_project",
          entityId: row.id,
          event: "video_project.restored",
          payload: { name: row.name, retiredAt: current.retiredAt.toISOString() },
        });
        return { project: row, restored: true };
      });
    },

    async get(
      ctx: TenantCtx,
      id: string,
      opts?: RetiredReadOptions,
    ): Promise<VideoProject | null> {
      const [row] = await db
        .select()
        .from(videoProjects)
        .where(
          and(
            eq(videoProjects.id, id),
            eq(videoProjects.tenantId, ctx.tenantId),
            ...livingOnly(opts),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async list(ctx: TenantCtx, opts?: RetiredReadOptions): Promise<VideoProject[]> {
      return db
        .select()
        .from(videoProjects)
        .where(and(eq(videoProjects.tenantId, ctx.tenantId), ...livingOnly(opts)));
    },
  };
}

export type VideoProjectsRepo = ReturnType<typeof videoProjectsRepo>;
