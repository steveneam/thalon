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
import { tenantIsolation } from "./rls";

/**
 * Tenant #0 = self/dogfood; #2 (Sprint 2) proves config-not-code. This is the
 * one table whose own `id` IS the tenant identifier — and therefore the one
 * tenant-adjacent table WITHOUT a tenantIsolation() policy: resolving a tenant
 * by slug is how per-request tenant context gets established in the first
 * place, so it must be readable before any context exists (rls-ratchet test
 * pins this exemption).
 */
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
    /** B3.8: durable company identity (facts, philosophy, audience, offers, links) — doubles as judge grounding, see contracts brandIdentitySchema. */
    identity: jsonb("identity").notNull().default({}),
    /** A16/B-crm.2: ideal-customer-profile block (contracts icpSchema); null = lead scoring not armed for this tenant. */
    icp: jsonb("icp"),
    /** B7.a: per-platform posting-cadence norms (contracts cadenceConfigSchema); null = no cadence gate armed. */
    cadence: jsonb("cadence"),
    /** B7.e: content-bucket → platform routing map (contracts routingTableSchema); null = default routing. */
    routing: jsonb("routing"),
    version: integer("version").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("brand_profiles_tenant_version_idx").on(t.tenantId, t.version),
    index("brand_profiles_tenant_active_idx").on(t.tenantId, t.active),
    tenantIsolation(),
  ],
);
