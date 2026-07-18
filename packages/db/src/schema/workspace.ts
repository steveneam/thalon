import { SAVED_VIEW_SURFACES } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { drafts } from "./content";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * Phase-I contract window (s61): operator workspace state — the write doors
 * the Phase I lanes honestly refused to fake. Both tables are mutable
 * config-row registers (the watchlists exemplar), never append-only
 * history: a plan is an intention the operator revises, a saved view is a
 * named preference.
 */

/**
 * One operator-planned publish slot per draft — the calendar's drag target
 * and the week strip's dashed "planned" mark. Planning is NOT publishing
 * (no publish path is wired anywhere; charter standing discipline): a slot
 * carries intent only. (tenant, draft) unique = one active plan per draft;
 * re-planning updates the row.
 */
export const plannedSlots = pgTable(
  "planned_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("planned_slots_tenant_draft_idx").on(t.tenantId, t.draftId),
    // The calendar's hot path: every slot in a visible range.
    index("planned_slots_tenant_scheduled_idx").on(t.tenantId, t.scheduledFor),
    tenantIsolation(),
  ],
);

/**
 * Tenant-wide named view configs for the surfaces Phase D designed with
 * saved-view tabs (leads board · calendar). Config is open jsonb — filter
 * and sort vocabulary is surface data, never schema; the surface list is
 * the contracts SAVED_VIEW_SURFACES closed set (one source of truth).
 */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    surface: text("surface").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_views_tenant_surface_name_idx").on(t.tenantId, t.surface, t.name),
    check(
      "saved_views_surface_check",
      sql.raw(`surface in (${inList(SAVED_VIEW_SURFACES)})`),
    ),
    tenantIsolation(),
  ],
);
