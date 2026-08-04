/**
 * run-publish-queue.ts — the publish-queue consumer driver (s83, deferred
 * item 1's second piece; the run-sweep-scheduler.ts pattern).
 *
 * One pass of `runDuePublishes` per invocation: claims due rows and walks
 * each through the publish door with the vault-first per-tenant resolver —
 * the door's whole refusal ladder stands, and an unarmed platform's rows
 * fail closed and say so.
 *
 * ⛔ ARMING: a pass may WRITE only when SOCIAL_QUEUE_ARMED="true" in the
 * validated env (publishQueueArmed). Anything else = a report: due rows are
 * listed, nothing is claimed, nothing is called. Each platform ALSO stays
 * behind its own per-platform arming + founder GO underneath this key.
 *
 * Usage (from repo root; source apps/web/.env.local first):
 *   npx tsx scripts/run-publish-queue.ts --once   # one pass, exit 1 on any failure
 * The standing timer (a systemd user unit, the thalon-sweeper pattern) is
 * item 1's third piece and stays a separate founder decision — this script
 * is deliberately runnable one pass at a time.
 */
// Relative imports on purpose: worktree lanes junction node_modules to the
// main checkout, so "@thalon/*" would resolve to main's copy — the relative
// path always runs THIS checkout's code.
import { tenantCtx } from "../packages/contracts/src/index";
import { openDb } from "../packages/db/src/index";
import {
  passArmStateResolver,
  publishQueueArmed,
  runDuePublishes,
  vaultSocialPublisherResolver,
} from "../packages/engine/src/index";
import { readEnv } from "../packages/platform/src/index";

async function main(): Promise<void> {
  if (!process.argv.includes("--once")) {
    console.error("run-publish-queue.ts runs one pass at a time: pass --once");
    process.exit(2);
  }
  const env = readEnv(process.env);
  const armed = publishQueueArmed(env);
  const handle = await openDb();
  try {
    const result = await runDuePublishes(
      {
        repos: handle.repos,
        armed,
        // Control-arc part A (s102): the master key above and this
        // per-destination state are AND. A pass armed by the env key touches
        // only destinations the tenant set to `live`; everything else is held
        // and reported. Absent config = `off`, so arming the key alone
        // publishes nothing.
        resolveArmState: passArmStateResolver({ repos: handle.repos, env, ctxFor: tenantCtx }),
        // Per-tenant on purpose: arming is tenant data (B-int.3) and the
        // vault view opens per tenant.
        resolvePublisher: (tenantId) =>
          vaultSocialPublisherResolver({ repos: handle.repos, ctx: tenantCtx(tenantId), env }),
      },
      new Date(),
    );
    console.log(
      `pass (${result.armed ? "ARMED" : "report-only"}): ${result.due.length} due, ` +
        `${result.holds.length} held by destination, ` +
        `${result.published.length} published, ${result.failed.length} failed, ` +
        `${result.released.length} released, ${result.raced.length} raced`,
    );
    for (const row of result.holds) {
      console.log(`  held ${row.platform} ${row.draftId}: destination is ${row.armState}`);
    }
    for (const row of result.published) {
      console.log(`  published ${row.platform} ${row.draftId} → ${row.externalPostId}`);
    }
    for (const row of result.failed) {
      console.error(`  FAILED ${row.platform} ${row.draftId}: ${row.reason}`);
    }
    process.exit(result.failed.length > 0 ? 1 : 0);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
