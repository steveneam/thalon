import type { ApprovalAction, TenantCtx } from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { sha256Hex } from "../hash";
import { approvals, drafts, editDiffs, evalCases } from "../schema";
import type { Approval, Db, Draft } from "../types";
import { getDraftScoped, transitionInTx } from "./drafts";

export interface RecordApprovalInput {
  draftId: string;
  actor: string;
  action: ApprovalAction;
  /** Required when action is "edit". */
  editedBody?: string;
  /**
   * Operator's stated reason on a "reject" (s90 window). Present ⇒ the
   * rejection is a CORRECTION: an eval_cases row (origin 'approve_reject')
   * lands in the same transaction as the queued→rejected transition, and
   * the reason rides the transition event. Absent ⇒ a bare decision — no
   * eval row (the learning doors record signal, not ceremony).
   */
  reason?: string;
}

export function approvalsRepo(db: Db) {
  return {
    /**
     * One operator touch, one transaction. approve ⇒ queued→approved;
     * reject ⇒ queued→rejected (+ an 'approve_reject' eval row when a
     * reason is stated — s90 window); edit ⇒ approvals + edit_diffs +
     * eval_cases rows AND the body swap AND the re-judge transition,
     * atomically — the "every override becomes an eval row in the same
     * change" rule as a mechanism, not a habit (SPINE risk 4). An illegal
     * starting status rolls the whole touch back, approval row included.
     */
    async record(
      ctx: TenantCtx,
      input: RecordApprovalInput,
    ): Promise<{ approval: Approval; draft: Draft }> {
      return db.transaction(async (tx) => {
        const draft = await getDraftScoped(tx, ctx, input.draftId);
        // approve/reject are policed by the transition itself (queued-only
        // edges). edit needs its own guard: its re-judge transition
        // (→ judging) is also legal from `generated`, which would let an
        // operator touch a draft the judge has never seen.
        if (
          input.action === "edit" &&
          draft.status !== "queued" &&
          draft.status !== "blocked"
        ) {
          throw new Error(
            `operator edit requires a queued or blocked draft, got "${draft.status}"`,
          );
        }
        const [approval] = await tx
          .insert(approvals)
          .values({
            tenantId: ctx.tenantId,
            draftId: input.draftId,
            actor: input.actor,
            action: input.action,
            editedBody: input.action === "edit" ? input.editedBody : undefined,
          })
          .returning();
        const opts = { actor: input.actor, approvalId: approval.id };

        if (input.action === "approve") {
          const updated = await transitionInTx(tx, ctx, draft.id, "approved", opts);
          return { approval, draft: updated };
        }
        if (input.action === "reject") {
          const reason = input.reason?.trim();
          if (reason) {
            // Ground truth only, mirroring the edit branch's eval row: what
            // the operator did and said — never an invented semantic label.
            await tx.insert(evalCases).values({
              tenantId: ctx.tenantId,
              kind: "draft_reject",
              input: { draftId: draft.id, platform: draft.platform, body: draft.body },
              expected: { operatorAction: "rejected", reason },
              origin: "approve_reject",
              sourceRef: approval.id,
            });
          }
          const updated = await transitionInTx(tx, ctx, draft.id, "rejected", {
            ...opts,
            ...(reason ? { reason } : {}),
          });
          return { approval, draft: updated };
        }

        if (!input.editedBody) {
          throw new Error('action "edit" requires editedBody');
        }
        const afterHash = sha256Hex(input.editedBody);
        const [diffRow] = await tx
          .insert(editDiffs)
          .values({
            tenantId: ctx.tenantId,
            draftId: draft.id,
            approvalId: approval.id,
            beforeHash: draft.bodyHash,
            afterHash,
            diff: JSON.stringify({ before: draft.body, after: input.editedBody }),
          })
          .returning();
        await tx.insert(evalCases).values({
          tenantId: ctx.tenantId,
          kind: "draft_edit",
          input: { draftId: draft.id, platform: draft.platform, body: draft.body },
          expected: { body: input.editedBody },
          origin: "edit_diff",
          sourceRef: diffRow.id,
        });
        await tx
          .update(drafts)
          .set({
            body: input.editedBody,
            bodyHash: afterHash,
            updatedAt: new Date(),
          })
          .where(and(eq(drafts.id, draft.id), eq(drafts.tenantId, ctx.tenantId)));
        // Edited body = new content → back to judging first (SPINE §1.1).
        const updated = await transitionInTx(tx, ctx, draft.id, "judging", {
          ...opts,
          reason: "approve-with-edit re-judge",
        });
        return { approval, draft: updated };
      });
    },
  };
}

export type ApprovalsRepo = ReturnType<typeof approvalsRepo>;
