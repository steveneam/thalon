import { ENTITLEMENT_FEATURES, PLAN_TIERS } from "@thalon/contracts";
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

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

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
    /**
     * Sprint-8 window (founder s64): the entitlements seam's tier key
     * (contracts PLAN_TIERS). Column default `internal` exists ONLY for the
     * backfill — every pre-window row is the self/dogfood tenant; the
     * create door defaults NEW tenants to `starter` explicitly (repo).
     */
    plan: text("plan").notNull().default("internal"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    check("tenants_status_check", sql.raw(`status in ('active', 'suspended')`)),
    check("tenants_plan_check", sql.raw(`plan in (${inList(PLAN_TIERS)})`)),
  ],
);

/**
 * Sprint-8 window (founder s64, clarified live): per-tenant entitlement
 * OVERRIDES — the flip switch. One row = one explicit per-tenant decision
 * that beats the tier default (contracts DEFAULT_PLAN_ENTITLEMENTS);
 * absence of a row means the tier decides. Resolution is contracts
 * `isEntitled` — one function, no forked rule.
 */
export const tenantEntitlements = pgTable(
  "tenant_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Gated surface key (contracts ENTITLEMENT_FEATURES). */
    feature: text("feature").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One override per feature per tenant — the upsert key.
    uniqueIndex("tenant_entitlements_tenant_feature_idx").on(t.tenantId, t.feature),
    check(
      "tenant_entitlements_feature_check",
      sql.raw(`feature in (${inList(ENTITLEMENT_FEATURES)})`),
    ),
    tenantIsolation(),
  ],
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
    /**
     * B-crm.4 outreach-sequence block (contracts outreachSequenceSchema);
     * null = the send door is disarmed. Column landed Sprint-8 window 2 —
     * the s54 window shipped the schema field only, so the repo dropped the
     * block on create and the door's structural read could never find it
     * for a real tenant (found + pinned closing the same gap for `social`).
     */
    outreach: jsonb("outreach"),
    /** Sprint-8 window 2: per-platform social publishing config (contracts socialPublishConfigSchema); null = the publish door is disarmed for this tenant. */
    social: jsonb("social"),
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
