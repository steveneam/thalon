import {
  VIDEO_CUT_STATUSES,
  VIDEO_TAKE_DISPOSITIONS,
  VIDEO_TAKE_KINDS,
} from "@thalon/contracts";
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
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * B-ve.1 (amendment A17 / ADR 0010): the video-project spine — the
 * concept-film tree (s43 founder direction: the reference shape for the
 * client video-project contract) formalized as tables. One project = one
 * film: its takes (keepers/rejects with reasons), its versioned cuts (each
 * carrying the EDL that built it), tenant-scoped like everything else
 * (rule 3).
 */
export const videoProjects = pgTable(
  "video_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Re-creating a project by name returns the existing one — idempotency
    // made structural (the search_targets get-or-create pattern).
    uniqueIndex("video_projects_tenant_name_idx").on(t.tenantId, t.name),
    tenantIsolation(),
  ],
);

/**
 * One take = one asset file in the project tree: a minted motion clip, a
 * still, or a music candidate. `disposition` is keeper/reject WITH the
 * reason on record (the s43 retake discipline — rejects are the learning
 * material the editor surfaces inline, B-ve.2). `provenance` is the B7.1
 * manifest data (model, prompt, credits, license tier, mint date) — pinned
 * at mint, never hotlinked.
 */
export const videoTakes = pgTable(
  "video_takes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => videoProjects.id),
    /** Beat slot the take auditions for ("beat-01"); music candidates carry none. */
    slot: text("slot"),
    kind: text("kind").notNull(),
    disposition: text("disposition").notNull().default("keeper"),
    /** Project-relative asset ref — the take's identity within its project. */
    ref: text("ref").notNull(),
    /** Why a reject was rejected — enforced non-null for rejects at the repo write door. */
    reason: text("reason"),
    provenance: jsonb("provenance").notNull().default({}),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One row per asset file: re-recording the same take returns the
    // existing row — idempotency made structural.
    uniqueIndex("video_takes_tenant_project_ref_idx").on(t.tenantId, t.projectId, t.ref),
    // Hot path: the beat lane reads a slot's takes (keepers first, rejects inline).
    index("video_takes_tenant_project_slot_idx").on(t.tenantId, t.projectId, t.slot),
    check("video_takes_kind_check", sql.raw(`kind in (${inList(VIDEO_TAKE_KINDS)})`)),
    check(
      "video_takes_disposition_check",
      sql.raw(`disposition in (${inList(VIDEO_TAKE_DISPOSITIONS)})`),
    ),
    tenantIsolation(),
  ],
);

/**
 * One cut = one versioned output and THE EDL THAT BUILT IT (contracts
 * edlSchema, zod-validated at the repo write door). The EDL is immutable
 * per row — a re-edit is a new version; (name, version) is the structural
 * idempotency key. `output_ref` lands at recordRender (draft → rendered);
 * the `approved` status exists in the check constraint from day one but no
 * repo door reaches it in this window — the approve transition arrives
 * with B-ve.3/4 behind the judge gate on caption text (ADR 0010 invariant).
 */
export const videoCuts = pgTable(
  "video_cuts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => videoProjects.id),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    /** contracts edlSchema — the complete deterministic build instruction. */
    edl: jsonb("edl").notNull(),
    status: text("status").notNull().default("draft"),
    /** Project-relative ref of the rendered output — set by recordRender. */
    outputRef: text("output_ref"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Versioned cuts: replaying the same (name, version) returns the
    // existing row untouched — idempotency made structural.
    uniqueIndex("video_cuts_tenant_project_name_version_idx").on(
      t.tenantId,
      t.projectId,
      t.name,
      t.version,
    ),
    // Hot path: the project surface lists cuts by status.
    index("video_cuts_tenant_project_status_idx").on(t.tenantId, t.projectId, t.status),
    check("video_cuts_status_check", sql.raw(`status in (${inList(VIDEO_CUT_STATUSES)})`)),
    tenantIsolation(),
  ],
);
