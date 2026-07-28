import { CREDENTIAL_STORED_STATES, DESTINATION_KEYS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * B-int.0 (ADR 0011): the per-tenant credential vault — one row per
 * connected destination. The secret NEVER stores in the clear: the four
 * envelope columns hold the B-int.1 sealed shape (per-row AES-256-GCM data
 * key, wrapped by the box master key; contracts credentialEnvelopeSchema),
 * and nothing outside the vault doors can open them. `connected_as` is the
 * card's PUBLIC identity label (@handle, site host) — never secret
 * material; events carry destination + label only (redaction test-pinned
 * at the repo). One credential per (tenant, destination): reconnect and
 * rotation are the same upsert.
 */
export const tenantCredentials = pgTable(
  "tenant_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** contracts DESTINATIONS registry key — the card's identity. */
    destination: text("destination").notNull(),
    /** Stored card state only ("connected" | "needs_reauth"); the rest derive (contracts CREDENTIAL_CARD_STATES doc). */
    status: text("status").notNull().default("connected"),
    /** The sealed envelope (contracts credentialEnvelopeSchema) — opaque outside the B-int.1 vault doors. */
    ciphertext: text("ciphertext").notNull(),
    dataKeyWrapped: text("data_key_wrapped").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    /** Public identity label for the card ("@handle", "blog.example.com") — NEVER secret material. */
    connectedAs: text("connected_as"),
    /** Last successful read-only validate ping (B-int.1) — flips a card to connected. */
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    /** Token expiry when the platform reports one — the "expiring" card state derives from this. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tenant_credentials_tenant_destination_idx").on(t.tenantId, t.destination),
    check(
      "tenant_credentials_destination_check",
      sql.raw(`destination in (${inList(DESTINATION_KEYS)})`),
    ),
    check(
      "tenant_credentials_status_check",
      sql.raw(`status in (${inList(CREDENTIAL_STORED_STATES)})`),
    ),
    tenantIsolation(),
  ],
);

/**
 * D1 (s83 window): single-use state rows for the generic OAuth connect
 * dance — the honest Postgres equivalent of the reference pattern's Redis
 * TTL entries (we run no Redis). One row = one in-flight authorization: the
 * connect door writes it, the platform round-trips the `state` value, and
 * the callback CONSUMES it (delete-returning) exactly once. Expiry is a
 * fact on the row; the consume verb refuses a row past it, and anything
 * left behind (abandoned consents) is swept by the purge verb. Never
 * secret material: the verifier is a per-flight random challenge, dead the
 * moment the row is consumed or expired.
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    /** The `state` value itself (random, base64url) — the PK because it IS the callback's lookup key. */
    state: text("state").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** contracts DESTINATIONS registry key this flight connects. */
    destination: text("destination").notNull(),
    /** PKCE code_verifier when the provider's dance uses one; null otherwise. */
    codeVerifier: text("code_verifier"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Hard TTL — consume refuses past this instant (single-use AND short-lived). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("oauth_states_tenant_idx").on(t.tenantId),
    index("oauth_states_expires_idx").on(t.expiresAt),
    check(
      "oauth_states_destination_check",
      sql.raw(`destination in (${inList(DESTINATION_KEYS)})`),
    ),
    tenantIsolation(),
  ],
);
