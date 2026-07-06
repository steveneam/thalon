import type { MonitoredAreaRow, SearchTargetRow } from "@thalon/db";
import type { AreaRow, TargetRow } from "./types";

/** Row → wire (dates to ISO; drizzle's string-typed columns narrowed by the repo's zod door). */
export function toAreaRow(row: MonitoredAreaRow): AreaRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as AreaRow["status"],
    config: (row.config ?? {}) as AreaRow["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTargetRow(row: SearchTargetRow): TargetRow {
  return {
    id: row.id,
    keyword: row.keyword,
    origin: row.origin as TargetRow["origin"],
    status: row.status as TargetRow["status"],
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
