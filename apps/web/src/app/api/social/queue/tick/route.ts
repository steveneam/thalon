import { runDuePublishes, SOCIAL_QUEUE_ARM_KEY } from "@thalon/engine";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";

/**
 * C3 (s82): the queue consumer's ops door — one pass of `runDuePublishes`.
 *
 * ⛔ IT IS DISARMED, STRUCTURALLY, NOT BY A FLAG THIS FILE COULD FLIP. No
 * `armed` is passed and no publisher resolver is wired, so the pass reads
 * what is due, reports it, and touches nothing: no claim, no transition, no
 * platform call. Rows stay `pending`. That is the shipped posture and the
 * standing sequence gate: *"we're not posting anything yet until all the
 * walks are verified and fixed."*
 *
 * WHAT ARMING WILL TAKE, stated so it is a decision and not a discovery —
 * three deliberate pieces, none of them this lane's to write:
 *   1. `SOCIAL_QUEUE_ARMED` (see the engine's `SOCIAL_QUEUE_ARM_KEY`) added
 *      to the validated env schema in packages/platform;
 *   2. `armed: publishQueueArmed(env)` plus the vault-first per-tenant
 *      publisher resolver passed in here (the `publishApprovedSocial`
 *      wiring in lib/approve-queue/actions.ts is the shape);
 *   3. the timer itself — the sweep scheduler's own pattern: a thin driver
 *      under scripts/ run as a systemd user unit, never a cron this route
 *      invents.
 * Each platform ALSO stays behind its own founder GO underneath all of
 * that; an unarmed platform's rows fail closed and say so, which is the
 * correct behaviour rather than a gap.
 *
 * SYSTEM-LEVEL BY NATURE: due-ness is a cross-tenant question (the
 * `sweepSchedules.listAll` precedent), so this pass takes no tenant
 * context. It is an OPS door, not a tenant surface — it exposes only ids,
 * platforms and instants, never a draft body.
 */
export async function POST() {
  const repos = await getRepos();
  try {
    const result = await runDuePublishes({ repos }, new Date());
    return NextResponse.json({
      ...result,
      note:
        `the consumer is DISARMED — this pass read ${result.due.length} due row(s) and wrote nothing. ` +
        `Arming is a deliberate change (${SOCIAL_QUEUE_ARM_KEY} plus a wired publisher resolver), and every platform stays behind its own founder GO underneath it.`,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
