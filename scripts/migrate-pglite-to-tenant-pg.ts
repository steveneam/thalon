/**
 * migrate-pglite-to-tenant-pg.ts — staging cutover data migration (s53).
 *
 * Copies a PGlite data dir into a real Postgres database, transactionally,
 * with per-table row-count + content-hash verification. DRY-RUN IS THE
 * DEFAULT: without --execute the full copy is rehearsed inside a transaction
 * and rolled back, so the target is untouched either way unless every table
 * verifies.
 *
 * This script prepares TO the cutover door, never through it: it refuses to
 * read DATABASE_URL — the target comes from --target/TARGET_DATABASE_URL
 * only, and flipping the app's DATABASE_URL stays an operator console
 * action outside this repo.
 *
 * Usage (from repo root):
 *   npx tsx scripts/migrate-pglite-to-tenant-pg.ts \
 *     --source <pglite-data-dir> --target <postgres-url> \
 *     [--execute] [--prepare-target] [--migrate-source]
 *
 *   --source          PGlite data dir (the seam data dir or its pg/ child).
 *                     STOP the app that owns it first — PGlite is
 *                     single-process; a live owner means a torn read.
 *   --target          Postgres URL; TARGET_DATABASE_URL env is the fallback.
 *                     Run as the schema-owner role (the migration runner),
 *                     not a future RLS-enforcing app role.
 *   --execute         Commit. Default is the rehearse-and-rollback dry run.
 *   --prepare-target  Apply this checkout's migrations to the target first
 *                     (schema-only DDL; the role must be able to CREATE
 *                     EXTENSION vector, or pgvector must be pre-installed).
 *   --migrate-source  Bring a behind-source data dir up to this checkout's
 *                     migrations first (WRITES to the source dir).
 *
 * The target must be empty (one-shot cutover) and both sides must sit at
 * exactly this checkout's migration tip; every violation aborts before any
 * copy. On --execute, verification runs before commit — a mismatch rolls
 * everything back.
 */
// Relative into the package's public surface (not "@thalon/db"): worktree
// lanes junction node_modules to the main checkout, so the package name would
// resolve to main's copy — the relative path always runs THIS checkout's code.
import { migratePgliteToPostgres, MigratePreconditionError } from "../packages/db/src/index";

function usageAndExit(message?: string): never {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    "usage: npx tsx scripts/migrate-pglite-to-tenant-pg.ts --source <pglite-data-dir> --target <postgres-url> [--execute] [--prepare-target] [--migrate-source]\n" +
      "       (--target may come from TARGET_DATABASE_URL; DATABASE_URL is deliberately never read)",
  );
  process.exit(2);
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? "***@" : ""}${u.host}${u.pathname}`;
  } catch {
    return "<unparseable url>";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--source" || a === "--target") {
      const v = args[++i];
      if (!v) usageAndExit(`${a} requires a value`);
      values[a] = v;
    } else if (["--execute", "--prepare-target", "--migrate-source", "--help", "-h"].includes(a)) {
      flags.add(a);
    } else {
      usageAndExit(`unknown argument: ${a}`);
    }
  }
  if (flags.has("--help") || flags.has("-h")) usageAndExit();

  const sourceDataDir = values["--source"];
  if (!sourceDataDir) usageAndExit("--source is required");
  const targetUrl = values["--target"] ?? process.env.TARGET_DATABASE_URL;
  if (!targetUrl) {
    usageAndExit(
      "no target: pass --target or set TARGET_DATABASE_URL. DATABASE_URL is NOT consulted by design — the staging flip is a separate, operator-owned step.",
    );
  }

  const execute = flags.has("--execute");
  console.log(`mode:   ${execute ? "EXECUTE (will commit)" : "dry-run (rehearse + rollback)"}`);
  console.log(`source: ${sourceDataDir}`);
  console.log(`target: ${redactUrl(targetUrl)}`);

  const report = await migratePgliteToPostgres({
    sourceDataDir,
    targetUrl,
    execute,
    prepareTarget: flags.has("--prepare-target"),
    migrateSource: flags.has("--migrate-source"),
  });

  const width = Math.max(...report.tables.map((t) => t.table.length));
  console.log(`\n${"table".padEnd(width)}  source  target  verified`);
  for (const t of report.tables) {
    console.log(
      `${t.table.padEnd(width)}  ${String(t.sourceRows).padStart(6)}  ${String(t.targetRows).padStart(6)}  ${t.verified ? "ok" : "MISMATCH"}`,
    );
  }
  for (const note of report.notes) console.log(`note: ${note}`);
  console.log(report.ok ? `\n${report.mode}: all tables verified` : "\nverification FAILED");
  process.exit(report.ok ? 0 : 1);
}

main().catch((e: unknown) => {
  if (e instanceof MigratePreconditionError) {
    console.error(`precondition failed: ${e.message}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
