import { sql } from "drizzle-orm";
import {
  boolean,
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

/** Tenant #0 = self/dogfood; #2 (Sprint 2) proves config-not-code. This is the one table whose own `id` IS the tenant identifier. */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [check("tenants_status_check", sql.raw(`status in ('active', 'suspended')`))],
);

/**
 * Versioned per-tenant config-as-data (charter: brand/voice, denylist,
 * platform profiles are runtime data, never code). Drafts record the profile
 * version they were generated under — provenance for evals.
 */
export const brandProfiles = pgTable(
  "brand_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    voice: jsonb("voice").notNull().default({}),
    denylist: jsonb("denylist").notNull().default([]),
    platformProfiles: jsonb("platform_profiles").notNull().default({}),
    version: integer("version").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("brand_profiles_tenant_version_idx").on(t.tenantId, t.version),
    index("brand_profiles_tenant_active_idx").on(t.tenantId, t.active),
  ],
);
