import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
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
        "llm_cache",
        "publish_queue",
        "retrieval_cache",
        "source_chunks",
        "sources",
        "tenants",
        "usage_ledger",
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
});
