import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { getTableName, is, sql } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import { resolveMigrationsFolder } from "./client";
import { sha256Hex, stableStringify } from "./hash";
import * as schema from "./schema";
import type { Db } from "./types";

/**
 * Staging data migration, PGlite data dir → real Postgres (s53 lane B —
 * preparation TO the cutover door, never through it: nothing here reads or
 * writes DATABASE_URL; the target URL is caller-supplied and the staging
 * env flip stays an operator action outside this repo).
 *
 * Copy fidelity note: rows travel as driver-parsed JS values, so timestamps
 * carry millisecond precision — sub-millisecond digits of server-generated
 * defaults (now()) are dropped. Every structural idempotency key that
 * includes a timestamp stores app-generated ms-precision clocks already, so
 * no key can collide from this. Verification compares both sides through the
 * same lossy lens and is therefore self-consistent.
 */

/**
 * FK-safe copy order. Completeness is executable: copyAllTables throws if
 * this list and the schema barrel ever disagree (a new table cannot be
 * silently skipped), and __tests__/migrate-data.test.ts pins it.
 */
const COPY_ORDER: PgTable[] = [
  schema.tenants,
  schema.brandProfiles,
  schema.sources,
  schema.sourceChunks,
  schema.sourceMetrics,
  schema.fanoutRuns,
  // intel_captures BEFORE drafts (0015): drafts.capture_id references it.
  schema.intelCaptures,
  schema.drafts,
  schema.judgeResults,
  schema.approvals,
  schema.editDiffs,
  schema.evalCases,
  schema.publishQueue,
  schema.events,
  schema.usageLedger,
  schema.llmCache,
  schema.retrievalCache,
  schema.watchlists,
  schema.monitoredAreas,
  schema.trendSnapshots,
  schema.searchTargets,
  schema.searchSnapshots,
  schema.waitlist,
  schema.leads,
  // lead_weight_states before lead_scores: scores carry weight_state_id provenance (0012).
  schema.leadWeightStates,
  schema.leadScores,
  // After leads AND drafts (0014): a send references both.
  schema.outreachSends,
  schema.videoProjects,
  schema.videoTakes,
  schema.videoCuts,
  // Phase-I window (0015): planned_slots after drafts; saved_views is leaf config.
  schema.plannedSlots,
  schema.savedViews,
  // Sprint-8 window (0016): entitlements + sweep config after tenants;
  // social_publications after drafts (it references them).
  schema.tenantEntitlements,
  schema.sweepSchedules,
  schema.socialPublications,
  // B-int.0 window (0018): the credential vault references only tenants.
  schema.tenantCredentials,
];

const INSERT_BATCH = 200;

export interface TableReport {
  table: string;
  sourceRows: number;
  targetRows: number;
  verified: boolean;
}

export interface MigrateReport {
  mode: "dry-run" | "execute";
  ok: boolean;
  tables: TableReport[];
  notes: string[];
}

export class MigratePreconditionError extends Error {}

export function copyOrderTableNames(): string[] {
  return COPY_ORDER.map((t) => getTableName(t));
}

/** The executable completeness ratchet: schema barrel and COPY_ORDER must agree exactly. */
export function assertCopyOrderCoversSchema(): void {
  const inSchema = Object.values(schema)
    .filter((v) => is(v, PgTable))
    .map((t) => getTableName(t as PgTable))
    .sort();
  const inOrder = copyOrderTableNames().slice().sort();
  const missing = inSchema.filter((n) => !inOrder.includes(n));
  const extra = inOrder.filter((n) => !inSchema.includes(n));
  if (missing.length || extra.length) {
    throw new MigratePreconditionError(
      `COPY_ORDER is out of sync with the schema barrel — missing: [${missing.join(", ")}], extra: [${extra.join(", ")}]. A table the copy would silently skip is exactly the bug this check exists to stop.`,
    );
  }
}

/** Dates → ISO so stableStringify sees a scalar (a Date key-sorts to `{}`). */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );
}

function contentHash(rows: Record<string, unknown>[]): string {
  const canon = rows.map((r) => stableStringify(normalizeRow(r))).sort();
  return sha256Hex(canon.join("\n"));
}

/** waitlist self-references via referred_by; a referee always signs up after its referrer, so per-tenant position order is FK-safe. */
function insertionOrder(tableName: string, rows: Record<string, unknown>[]) {
  if (tableName !== "waitlist") return rows;
  return rows
    .slice()
    .sort(
      (a, b) =>
        String(a.tenantId).localeCompare(String(b.tenantId)) ||
        Number(a.position) - Number(b.position),
    );
}

class DryRunRollback extends Error {
  constructor(public report: MigrateReport) {
    super("dry-run rollback (intentional)");
  }
}

/**
 * Copies every table from `source` into `target` inside ONE target
 * transaction, verifying per-table row counts and content hashes against the
 * source before anything commits. Without `execute` the fully-verified
 * transaction is rolled back — a complete rehearsal that persists nothing.
 * A non-empty target aborts: the cutover is one-shot by design; emptying a
 * target is a deliberate operator action, never this function's.
 */
export async function copyAllTables(
  source: Db,
  target: Db,
  opts: { execute: boolean },
): Promise<MigrateReport> {
  assertCopyOrderCoversSchema();
  const mode = opts.execute ? "execute" : "dry-run";
  const notes: string[] = [];

  const run = async (tx: Db): Promise<MigrateReport> => {
    const nonEmpty: string[] = [];
    for (const table of COPY_ORDER) {
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(table)) as {
        n: number;
      }[];
      if (n > 0) nonEmpty.push(`${getTableName(table)} (${n})`);
    }
    if (nonEmpty.length) {
      throw new MigratePreconditionError(
        `target is not empty — refusing to copy into: ${nonEmpty.join(", ")}. The cutover is one-shot; wiping a target is a deliberate operator action, not this script's.`,
      );
    }

    const tables: TableReport[] = [];
    for (const table of COPY_ORDER) {
      const name = getTableName(table);
      const sourceRows = (await source.select().from(table)) as Record<string, unknown>[];
      const ordered = insertionOrder(name, sourceRows);
      for (let i = 0; i < ordered.length; i += INSERT_BATCH) {
        await tx.insert(table).values(ordered.slice(i, i + INSERT_BATCH));
      }
      const targetRows = (await tx.select().from(table)) as Record<string, unknown>[];
      const verified =
        targetRows.length === sourceRows.length &&
        contentHash(targetRows) === contentHash(sourceRows);
      tables.push({ table: name, sourceRows: sourceRows.length, targetRows: targetRows.length, verified });
    }

    const ok = tables.every((t) => t.verified);
    if (!ok) {
      const bad = tables.filter((t) => !t.verified).map((t) => t.table);
      throw new MigratePreconditionError(
        `content verification failed for: ${bad.join(", ")} — transaction rolled back, nothing was committed.`,
      );
    }
    return { mode, ok, tables, notes };
  };

  let report: MigrateReport;
  try {
    report = await target.transaction(async (tx) => {
      const r = await run(tx as Db);
      if (!opts.execute) throw new DryRunRollback(r);
      return r;
    });
  } catch (e) {
    if (e instanceof DryRunRollback) {
      report = e.report;
      report.notes.push("dry-run: full copy rehearsed and verified inside a transaction, then rolled back — target unchanged");
    } else {
      throw e;
    }
  }

  // events.seq is the one serial column; its sequence is non-transactional,
  // so it is advanced only on a committed execute run.
  const eventsReport = report.tables.find((t) => t.table === "events");
  if (eventsReport && eventsReport.sourceRows > 0) {
    if (opts.execute) {
      await target.execute(
        sql`select setval(pg_get_serial_sequence('events', 'seq'), (select max(seq) from events))`,
      );
      report.notes.push("events.seq sequence advanced to max(seq)");
    } else {
      report.notes.push("execute would advance the events.seq sequence to max(seq) after commit");
    }
  }
  return report;
}

interface JournalTip {
  count: number;
  lastWhen: number;
}

function localJournalTip(migrationsFolder: string): JournalTip {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: { when: number }[] };
  return {
    count: journal.entries.length,
    lastWhen: journal.entries[journal.entries.length - 1]?.when ?? 0,
  };
}

async function appliedTip(db: Db): Promise<JournalTip | null> {
  try {
    const result = await db.execute(
      sql`select count(*)::int as count, coalesce(max(created_at), 0)::bigint as last from drizzle."__drizzle_migrations"`,
    );
    const row = (result as { rows: { count: number; last: string | number }[] }).rows[0];
    return { count: Number(row.count), lastWhen: Number(row.last) };
  } catch {
    return null; // migrations table absent — never migrated
  }
}

function describeTip(tip: JournalTip | null): string {
  return tip ? `${tip.count} applied (tip ${tip.lastWhen})` : "never migrated";
}

export interface MigratePgliteToPostgresOptions {
  /** The PGlite data directory (contains PG_VERSION); the seam data dir's `pg/` child is auto-detected. */
  sourceDataDir: string;
  /** Target Postgres URL — caller-supplied only; DATABASE_URL is deliberately never consulted. */
  targetUrl: string;
  /** Commit the copy. Default (false) = full rehearsal + rollback. */
  execute: boolean;
  /** Apply this checkout's migrations to the SOURCE data dir first (writes to it!) when it is behind. */
  migrateSource?: boolean;
  /** Apply this checkout's migrations to the TARGET first (schema-only DDL; needs a role that may CREATE EXTENSION vector). */
  prepareTarget?: boolean;
}

/**
 * The operator door the cutover choreography calls. Opens the PGlite dir
 * directly (stop the app that owns it first — PGlite is single-process),
 * requires both sides at exactly this checkout's migration tip, then
 * delegates to copyAllTables. See scripts/migrate-pglite-to-tenant-pg.ts.
 */
export async function migratePgliteToPostgres(
  opts: MigratePgliteToPostgresOptions,
): Promise<MigrateReport> {
  const migrationsFolder = resolveMigrationsFolder();
  const local = localJournalTip(migrationsFolder);

  let dir = path.resolve(opts.sourceDataDir);
  const hasVersion = (d: string) => {
    try {
      readFileSync(path.join(d, "PG_VERSION"));
      return true;
    } catch {
      return false;
    }
  };
  if (!hasVersion(dir)) {
    if (hasVersion(path.join(dir, "pg"))) {
      dir = path.join(dir, "pg");
    } else {
      throw new MigratePreconditionError(
        `${dir} is not a PGlite data directory (no PG_VERSION) — pass the seam data dir or its pg/ child`,
      );
    }
  }

  const sourceClient = new PGlite(dir, { extensions: { vector } });
  const sourcePglite = drizzlePglite(sourceClient, { schema });
  const sourceDb = sourcePglite as unknown as Db;
  const pool = new pg.Pool({ connectionString: opts.targetUrl });
  const targetNodePg = drizzleNodePg(pool, { schema });
  const targetDb = targetNodePg as unknown as Db;

  try {
    const sourceTip = await appliedTip(sourceDb);
    if (!sourceTip || sourceTip.count < local.count) {
      if (opts.migrateSource) {
        await migratePglite(sourcePglite, { migrationsFolder });
      } else {
        throw new MigratePreconditionError(
          `source is behind this checkout's migrations (${describeTip(sourceTip)} vs ${local.count} local) — pass --migrate-source to bring it forward (writes to the source dir) or run the app once first`,
        );
      }
    } else if (sourceTip.count > local.count || sourceTip.lastWhen !== local.lastWhen) {
      throw new MigratePreconditionError(
        `source migration history (${describeTip(sourceTip)}) does not match this checkout (${local.count}, tip ${local.lastWhen}) — wrong checkout for this data dir`,
      );
    }

    const targetTip = await appliedTip(targetDb);
    if (!targetTip || targetTip.count < local.count) {
      if (opts.prepareTarget) {
        await migrateNodePg(targetNodePg, { migrationsFolder });
      } else {
        throw new MigratePreconditionError(
          `target is not migrated to this checkout (${describeTip(targetTip)} vs ${local.count} local) — pass --prepare-target to apply migrations (schema-only DDL) first`,
        );
      }
    } else if (targetTip.count > local.count || targetTip.lastWhen !== local.lastWhen) {
      throw new MigratePreconditionError(
        `target migration history (${describeTip(targetTip)}) does not match this checkout (${local.count}, tip ${local.lastWhen}) — target belongs to a different build`,
      );
    }

    return await copyAllTables(sourceDb, targetDb, { execute: opts.execute });
  } finally {
    await pool.end();
    await sourceClient.close();
  }
}
