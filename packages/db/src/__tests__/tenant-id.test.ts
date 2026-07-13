import { getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";

/**
 * Multi-tenant from table one (AGENTS.md rule 3; SPINE §2.6 ratchet): every
 * table carries tenant_id. The single exemption is `tenants` itself, whose
 * own id IS the tenant identifier. Adding a table without tenant_id fails
 * here by design.
 */
describe("tenancy ratchet", () => {
  const tables = Object.values(schema).filter((v) => is(v, PgTable)) as PgTable[];

  it("finds the full SPINE §2.5 table set", () => {
    const names = tables.map((t) => getTableName(t)).sort();
    expect(names).toEqual(
      [
        "approvals",
        "brand_profiles",
        "drafts",
        "edit_diffs",
        "eval_cases",
        "events",
        "fanout_runs",
        "judge_results",
        "lead_scores",
        "leads",
        "llm_cache",
        "monitored_areas",
        "publish_queue",
        "retrieval_cache",
        "search_snapshots",
        "search_targets",
        "source_chunks",
        "source_metrics",
        "sources",
        "tenants",
        "trend_snapshots",
        "usage_ledger",
        "waitlist",
        "watchlists",
      ].sort(),
    );
  });

  it("every table carries tenant_id (tenants exempt — its id IS the tenant id)", () => {
    for (const table of tables) {
      const name = getTableName(table);
      if (name === "tenants") continue;
      const columns = Object.values(getTableColumns(table)).map((c) => c.name);
      expect(columns, `table "${name}" is missing tenant_id`).toContain("tenant_id");
    }
  });

  /**
   * Contract-window convention made executable (Sprint-6 follow-up): a
   * `uniqueIndex()` is how a table declares its structural idempotency key
   * (replay appends nothing) — and that key must be tenant-salted, or two
   * tenants watching the same item/keyword/email would collide across the
   * tenancy wall. Scope is deliberately composite unique INDEXES only:
   * column-level `.unique()` keys (generation_key, idempotency_key,
   * events.seq, tenants.slug) are content-addressed or global by design.
   * An index salted TRANSITIVELY (leading with a uuid FK that is itself
   * tenant-scoped and globally unique) goes in the exemption map with its
   * reason — a deliberate, review-visible decision.
   */
  it("every composite unique index leads with tenant_id (structural idempotency keys are tenant-salted)", () => {
    const transitivelySalted: Record<string, string> = {
      source_chunks_source_seq_idx:
        "salted via source_id — a uuid PK reference that is itself tenant-scoped",
    };
    for (const table of tables) {
      const { indexes, name: tableName } = getTableConfig(table);
      for (const index of indexes) {
        const { name, unique, columns } = index.config;
        if (!unique || (name && transitivelySalted[name])) continue;
        const first = columns[0] as { name?: string };
        expect(
          first?.name,
          `unique index "${name}" on "${tableName}" must lead with tenant_id (or be exempted with a reason)`,
        ).toBe("tenant_id");
      }
    }
  });
});
