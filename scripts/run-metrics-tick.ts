/**
 * run-metrics-tick.ts — the own-post metrics collection driver (D2, s87;
 * the run-publish-queue.ts pattern).
 *
 * One pass of `collectPublicationMetrics` per invocation, per tenant: reads
 * each recent `social_publications` row, asks that platform's METRICS READER
 * what it will say about the post, and appends what came back to
 * `publication_metrics`.
 *
 * ⛔ ARMING: a pass may read platforms and WRITE rows only with `--armed`.
 * Without it the pass is a report — it lists what it would measure, names
 * every platform that would refuse and why, prices the pass, and touches
 * nothing. The arm is a CLI flag rather than an env key on purpose: this
 * script is hand-run, and the env schema (packages/platform) is outside this
 * lane's file set. When the tick earns a standing timer, `SOCIAL_METRICS_ARMED`
 * belongs in that schema beside `SOCIAL_QUEUE_ARMED` — flagged in the wrap.
 *
 * ⛔ IT CANNOT POST. Not by flag — by type: this script resolves
 * `SocialMetricsReader`s, which have no publish verb, so no path from here
 * reaches a platform's write endpoint.
 *
 * ⚠ IT CAN COST MONEY. X's API is metered pay-per-use; a pass that includes X
 * publications spends real money per post read. The report prints the bill
 * before any of it happens, armed or not. While a platform sits under a
 * STANDING FOUNDER DEFERRAL (packages/engine/src/social/metrics/deferral.ts —
 * X, since the 2026-07-29 ruling) an armed pass spends nothing on it: the
 * ratchet refuses its reads with the ruling, and the report prints ⏸ instead
 * of 💸.
 *
 * Usage (from repo root; source apps/web/.env.local first):
 *   npx tsx scripts/run-metrics-tick.ts --once            # report only
 *   npx tsx scripts/run-metrics-tick.ts --once --armed    # read + append
 *
 * NOT wired to any systemd unit. The standing timer (the thalon-sweeper
 * pattern) is a separate lead/founder act after merge.
 */
// Relative imports on purpose: worktree lanes junction node_modules to the
// main checkout, so "@thalon/*" would resolve to main's copy — the relative
// path always runs THIS checkout's code.
import { tenantCtx } from "../packages/contracts/src/index";
import { openDb } from "../packages/db/src/index";
import {
  collectPublicationMetrics,
  vaultSocialMetricsResolver,
} from "../packages/engine/src/index";
import { readEnv } from "../packages/platform/src/index";

async function main(): Promise<void> {
  if (!process.argv.includes("--once")) {
    console.error("run-metrics-tick.ts runs one pass at a time: pass --once");
    process.exit(2);
  }
  const armed = process.argv.includes("--armed");
  const env = readEnv(process.env);
  const handle = await openDb();
  const now = new Date();
  let failures = 0;
  try {
    const tenants = await handle.repos.tenants.list();
    for (const tenant of tenants) {
      const ctx = tenantCtx(tenant.id);
      const result = await collectPublicationMetrics(
        {
          repos: handle.repos,
          ctx,
          armed,
          // Per-tenant on purpose: credentials live in the tenant's vault.
          // Resolved lazily so a disarmed pass never opens the vault at all.
          resolveReader: armed
            ? await vaultSocialMetricsResolver({ repos: handle.repos, ctx, env })
            : undefined,
        },
        now,
      );
      const label = `${tenant.slug} (${result.armed ? "ARMED" : "report-only"})`;
      console.log(
        `${label}: ${result.candidates.length} in window, ` +
          `${result.measured.length} measured, ${result.refused.length} refused, ` +
          `${result.failed.length} failed · bucket ${result.capturedAt.toISOString()}`,
      );
      for (const note of result.metered) {
        console.log(`  💸 ${note.platform}: ${note.note}`);
      }
      // A standing deferral is the founder's answer to the 💸 line: the pass
      // spends NOTHING on this platform, armed or not, and the ruling prints
      // verbatim so nobody has to rediscover why the numbers are absent.
      for (const note of result.deferred) {
        console.log(`  ⏸ ${note.platform}: $0 this pass — ${note.ruling}`);
      }
      if (result.bound.truncated) {
        console.log(
          `  … bounded at ${result.bound.limit} of ${result.bound.totalPublications} publications — older posts were NOT measured this pass`,
        );
      }
      for (const row of result.measured) {
        console.log(
          `  measured ${row.platform} ${row.externalPostId}: ` +
            `+${row.appended} row(s)${row.replayed > 0 ? `, ${row.replayed} already in this bucket` : ""}` +
            `${row.labels.length > 0 ? ` [${row.labels.join(", ")}]` : " [nothing reported]"}`,
        );
      }
      // A refusal is the platform being honest, not a broken pass — it is
      // reported loudly and does NOT fail the run.
      for (const row of result.refused) {
        console.log(`  refused ${row.platform} ${row.externalPostId} (${row.permanence}): ${row.reason}`);
      }
      for (const row of result.failed) {
        console.error(`  FAILED ${row.platform} ${row.externalPostId}: ${row.reason}`);
      }
      failures += result.failed.length;
    }
    process.exit(failures > 0 ? 1 : 0);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
