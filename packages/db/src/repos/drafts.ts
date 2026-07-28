import {
  assertTransition,
  DISCLOSURE_GATE,
  FINAL_JUDGE_GATE,
  isDraftStatus,
  type DraftStatus,
  type TenantCtx,
} from "@thalon/contracts";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  ConcurrentUpdateError,
  InvalidStateError,
  InvariantViolationError,
  NotFoundError,
} from "../errors";
import { sha256Hex } from "../hash";
import { approvals, drafts, events, judgeResults } from "../schema";
import type { Db, Draft, Executor, Tx } from "../types";
import { appendEvent } from "./events";

export interface TransitionOpts {
  actor?: string;
  reason?: string;
  approvalId?: string;
}

/** B7.a: statuses that still consume a cadence slot — past the judge, not dead. */
const CADENCE_LIVE_STATUSES: DraftStatus[] = ["queued", "approved", "published"];

export async function getDraftScoped(
  ex: Executor,
  ctx: TenantCtx,
  draftId: string,
): Promise<Draft> {
  const [row] = await ex
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.tenantId, ctx.tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError("draft", draftId);
  return row;
}

async function hasPassingVerdict(
  tx: Tx,
  ctx: TenantCtx,
  draft: Draft,
  gate: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: judgeResults.id })
    .from(judgeResults)
    .where(
      and(
        eq(judgeResults.tenantId, ctx.tenantId),
        eq(judgeResults.draftId, draft.id),
        eq(judgeResults.gate, gate),
        eq(judgeResults.verdict, "pass"),
        // Verdicts bind to CONTENT: an edit changes body_hash and thereby
        // invalidates every earlier verdict (invariant I1; SPINE risk 5).
        eq(judgeResults.bodyHash, draft.bodyHash),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * THE one writer of drafts.status (SPINE §1.1). Every transition is
 * validated against the contracts state machine, enforces I1/I2, and appends
 * exactly one events row (I4) in the same transaction.
 */
export async function transitionInTx(
  tx: Tx,
  ctx: TenantCtx,
  draftId: string,
  to: DraftStatus,
  opts: TransitionOpts = {},
): Promise<Draft> {
  const draft = await getDraftScoped(tx, ctx, draftId);
  if (!isDraftStatus(draft.status)) {
    throw new Error(`draft ${draftId} has unknown status "${draft.status}"`);
  }
  const from = draft.status;
  assertTransition(from, to);

  if (to === "queued" && !(await hasPassingVerdict(tx, ctx, draft, FINAL_JUDGE_GATE))) {
    throw new InvariantViolationError(
      "I1",
      `draft ${draftId} cannot be queued: no passing ${FINAL_JUDGE_GATE} verdict for its current body hash`,
    );
  }

  if (to === "published") {
    // Sprint 3+: an approve row AND a passing disclosure verdict for the
    // current body hash. Neither can exist in Sprints 0–2, which is exactly
    // what keeps the publish path unreachable now.
    const [approved] = await tx
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(
          eq(approvals.tenantId, ctx.tenantId),
          eq(approvals.draftId, draftId),
          eq(approvals.action, "approve"),
        ),
      )
      .limit(1);
    if (!approved || !(await hasPassingVerdict(tx, ctx, draft, DISCLOSURE_GATE))) {
      throw new InvariantViolationError(
        "I2",
        `draft ${draftId} cannot be published without an approval and a passing ${DISCLOSURE_GATE} disclosure verdict`,
      );
    }
  }

  const [updated] = await tx
    .update(drafts)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(drafts.id, draftId), eq(drafts.tenantId, ctx.tenantId)))
    .returning();

  await appendEvent(tx, ctx, {
    entityType: "draft",
    entityId: draftId,
    event: "draft.transition",
    payload: {
      from,
      to,
      ...(opts.reason ? { reason: opts.reason } : {}),
      ...(opts.approvalId ? { approvalId: opts.approvalId } : {}),
    },
    actor: opts.actor,
  });

  return updated;
}

export function draftsRepo(db: Db) {
  return {
    /** Idempotent by generation_key, like the run that spawns it. */
    async create(
      ctx: TenantCtx,
      input: {
        fanoutRunId: string;
        sourceId: string;
        platform: string;
        body: string;
        generationKey: string;
        format?: string;
        meta?: Record<string, unknown>;
      },
    ): Promise<Draft> {
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(drafts)
          .values({
            tenantId: ctx.tenantId,
            fanoutRunId: input.fanoutRunId,
            sourceId: input.sourceId,
            platform: input.platform,
            format: input.format,
            body: input.body,
            bodyHash: sha256Hex(input.body),
            meta: input.meta ?? {},
            generationKey: input.generationKey,
          })
          .onConflictDoNothing({ target: drafts.generationKey })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(drafts)
            .where(
              and(
                eq(drafts.generationKey, input.generationKey),
                eq(drafts.tenantId, ctx.tenantId),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `generation_key "${input.generationKey}" exists under another tenant — keys must be tenant-salted`,
            );
          }
          return existing;
        }
        await appendEvent(tx, ctx, {
          entityType: "draft",
          entityId: inserted.id,
          event: "draft.created",
          payload: { generationKey: input.generationKey, platform: input.platform },
        });
        return inserted;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<Draft> {
      return getDraftScoped(db, ctx, id);
    },

    /** Groups the N drafts of one fan-out run — the Approve batch unit (SPINE §2.5). Landed with B1.2, which needs it for idempotent-replay reads. */
    async listByRun(ctx: TenantCtx, fanoutRunId: string): Promise<Draft[]> {
      return db
        .select()
        .from(drafts)
        .where(and(eq(drafts.tenantId, ctx.tenantId), eq(drafts.fanoutRunId, fanoutRunId)));
    },

    /** Every draft of one format for the tenant (B6.6: the posts-bundle rebuild scans `web_page` drafts). Additive, id-ordered for deterministic replays. */
    async listByFormat(ctx: TenantCtx, format: string): Promise<Draft[]> {
      return db
        .select()
        .from(drafts)
        .where(and(eq(drafts.tenantId, ctx.tenantId), eq(drafts.format, format)))
        .orderBy(drafts.id);
    },

    /**
     * B7.a cadence reads: each draft's LATEST `→ queued` admission on one
     * platform since `since`, for drafts still in the live band (queued /
     * approved / published — a blocked or rejected draft no
     * longer consumes a cadence slot). Read-only over the I4 events audit
     * spine (every transition appends exactly one events row
     * in-transaction), so admission times are exact — no new schema, no new
     * write path. Newest first.
     */
    async listQueueAdmissions(
      ctx: TenantCtx,
      opts: { platform: string; since: Date },
    ): Promise<Array<{ draftId: string; admittedAt: Date }>> {
      const rows = await db
        .select({ draftId: events.entityId, admittedAt: events.createdAt })
        .from(events)
        .innerJoin(drafts, eq(drafts.id, events.entityId))
        .where(
          and(
            eq(events.tenantId, ctx.tenantId),
            eq(drafts.tenantId, ctx.tenantId),
            eq(events.entityType, "draft"),
            eq(events.event, "draft.transition"),
            sql`${events.payload}->>'to' = 'queued'`,
            gte(events.createdAt, opts.since),
            eq(drafts.platform, opts.platform),
            inArray(drafts.status, CADENCE_LIVE_STATUSES),
          ),
        )
        .orderBy(desc(events.createdAt));
      // A re-judged draft can be admitted more than once in-window — its
      // latest admission is the one that counts, once.
      const latestPerDraft = new Map<string, Date>();
      for (const row of rows) {
        if (!latestPerDraft.has(row.draftId)) latestPerDraft.set(row.draftId, row.admittedAt);
      }
      return [...latestPerDraft].map(([draftId, admittedAt]) => ({ draftId, admittedAt }));
    },

    async transition(
      ctx: TenantCtx,
      draftId: string,
      to: DraftStatus,
      opts: TransitionOpts = {},
    ): Promise<Draft> {
      return db.transaction((tx) => transitionInTx(tx, ctx, draftId, to, opts));
    },

    /**
     * Merges a patch into `drafts.meta` — never touches `status` or `body`
     * (the ONE writer of `drafts.status` stays `transition` above). B2.5's
     * demo-capture write-back is the first caller: it needs to record
     * `captureStatus`/`captureRef` onto an already-`approved` draft's meta
     * without any lifecycle transition.
     *
     * Optimistic concurrency: `expectedUpdatedAt` must match the row's
     * CURRENT `updated_at` or the write is rejected with
     * `ConcurrentUpdateError` — never a silent last-write-wins overwrite.
     * The UPDATE's own WHERE clause carries the check (not just the
     * read-time comparison), so it is race-safe even if another write lands
     * between this call's read and its write. Callers pass the
     * `updatedAt` from whatever read produced the meta they're patching
     * (e.g. B2.5's `driveDemoCapture` reads the draft once at drive start and
     * reuses that same timestamp for its eventual write).
     */
    async updateMeta(
      ctx: TenantCtx,
      draftId: string,
      expectedUpdatedAt: Date,
      metaPatch: Record<string, unknown>,
    ): Promise<Draft> {
      return db.transaction(async (tx) => {
        const draft = await getDraftScoped(tx, ctx, draftId);
        const nextMeta = { ...(draft.meta as Record<string, unknown>), ...metaPatch };
        const [updated] = await tx
          .update(drafts)
          .set({ meta: nextMeta, updatedAt: new Date() })
          .where(
            and(
              eq(drafts.id, draftId),
              eq(drafts.tenantId, ctx.tenantId),
              eq(drafts.updatedAt, expectedUpdatedAt),
            ),
          )
          .returning();
        if (!updated) {
          throw new ConcurrentUpdateError("draft", draftId);
        }
        await appendEvent(tx, ctx, {
          entityType: "draft",
          entityId: draftId,
          event: "draft.meta_updated",
          payload: { keys: Object.keys(metaPatch) },
        });
        return updated;
      });
    },

    /**
     * B2.6: the operator re-judge escape hatch — re-runs judging on the
     * UNMODIFIED draft, for either of two cases edit alone can't reach:
     * (a) a verdict-`blocked` draft the operator wants retried as-is, or
     * (b) a draft an operational halt (e.g. BudgetExceededError — a hard
     * stop, not a verdict) stranded in `judging` with no automatic way back.
     * Composes ONLY `transitionInTx`, the one writer of drafts.status —
     * never a new side door. Case (b) walks judging -> blocked -> judging:
     * both edges already exist in the state machine, and NEITHER can ever
     * land on `queued` itself — only a fresh judge pass's own `-> queued`
     * transition re-verifies I1 — so this action can never queue a draft
     * without a fresh judge pass.
     */
    async reJudge(
      ctx: TenantCtx,
      draftId: string,
      opts: TransitionOpts = {},
    ): Promise<Draft> {
      return db.transaction(async (tx) => {
        const draft = await getDraftScoped(tx, ctx, draftId);
        if (draft.status !== "judging" && draft.status !== "blocked") {
          throw new InvalidStateError(
            `re-judge requires a "blocked" draft or a "judging" draft stuck by an operational halt, got "${draft.status}"`,
          );
        }
        if (draft.status === "judging") {
          await transitionInTx(tx, ctx, draftId, "blocked", {
            ...opts,
            reason: opts.reason ?? "operator re-judge: releasing an operational halt",
          });
        }
        return transitionInTx(tx, ctx, draftId, "judging", {
          ...opts,
          reason: opts.reason ?? "operator re-judge",
        });
      });
    },
  };
}

export type DraftsRepo = ReturnType<typeof draftsRepo>;
