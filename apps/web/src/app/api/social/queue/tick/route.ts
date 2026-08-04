import { tenantCtx } from "@thalon/contracts";
import { passArmStateResolver, runDuePublishes, SOCIAL_QUEUE_ARM_KEY } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
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
 * WHAT ARMING WOULD TAKE HERE, stated so it is a decision and not a
 * discovery. Two of the three pieces the s82 note listed have since landed
 * ELSEWHERE, and re-grounding them at s102 corrected this list:
 *   1. ~~`SOCIAL_QUEUE_ARMED` added to the validated env schema~~ — DONE,
 *      `packages/platform/src/env.ts`. The key exists and rests empty.
 *   2. `armed: publishQueueArmed(env)` plus the vault-first per-tenant
 *      publisher resolver. Wired in `scripts/run-publish-queue.ts`, which is
 *      the ONE armed caller and is run one pass at a time — deliberately not
 *      here, because an HTTP endpoint that can reach a platform is a wider
 *      door than a driver the operator invokes.
 *   3. the timer itself — the sweep scheduler's own pattern: a thin driver
 *      under scripts/ run as a systemd user unit, never a cron this route
 *      invents. Still a separate founder decision.
 * Each platform ALSO stays behind its own founder GO underneath all of
 * that; an unarmed platform's rows fail closed and say so, which is the
 * correct behaviour rather than a gap.
 *
 * WHAT THIS PASS DOES REPORT (control-arc part A, s102): the per-destination
 * arm state is resolved for every due row even here, so the ops door says
 * which rows a live tick would actually touch. Reading tenant config gives
 * this route no new power — it still has no publisher and cannot claim a row.
 *
 * SYSTEM-LEVEL BY NATURE: due-ness is a cross-tenant question (the
 * `sweepSchedules.listAll` precedent), so this pass takes no tenant
 * context. It is an OPS door, not a tenant surface — it exposes only ids,
 * platforms and instants, never a draft body.
 */
export async function POST() {
  const repos = await getRepos();
  try {
    const result = await runDuePublishes(
      {
        repos,
        resolveArmState: passArmStateResolver({ repos, env: readEnv(), ctxFor: tenantCtx }),
      },
      new Date(),
    );
    const live = result.due.length - result.holds.length;
    return NextResponse.json({
      ...result,
      note:
        `the consumer is DISARMED — this pass read ${result.due.length} due row(s) and wrote nothing. ` +
        `Of those, ${result.holds.length} would be held by their destination's arm state and ${live} would be attempted by an armed tick. ` +
        `Arming is a deliberate change (${SOCIAL_QUEUE_ARM_KEY} plus a wired publisher resolver, AND a destination set to "live"), and every platform stays behind its own founder GO underneath it.`,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
