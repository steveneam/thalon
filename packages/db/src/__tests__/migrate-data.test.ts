import path from "node:path";
import { fileURLToPath } from "node:url";
import { tenantCtx } from "@thalon/contracts";
import { createMemoryDbClient } from "@thalon/platform";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCopyOrderCoversSchema,
  copyAllTables,
  MigratePreconditionError,
} from "../migrate-data";
import { createRepos } from "../repos";
import * as schema from "../schema";
import type { Db } from "../types";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

/**
 * The staging data-migration core (kickoff mission 3), proven PGlite→PGlite —
 * both sides are the same Postgres engine the real cutover uses (the real
 * server side of the copy runs in pg-scratch.test.ts, gated). Covers the
 * dry-run-persists-nothing default, full verification, FK-ordered copy
 * (waitlist self-reference), the events sequence advance, and the one-shot
 * non-empty-target refusal.
 */

let clients: ReturnType<typeof createMemoryDbClient>[] = [];

async function openRaw(): Promise<Db> {
  const client = createMemoryDbClient();
  clients.push(client);
  const pglite = drizzle(client, { schema });
  await migrate(pglite, { migrationsFolder });
  return pglite as unknown as Db;
}

afterEach(async () => {
  await Promise.all(clients.map((c) => c.close()));
  clients = [];
});

async function seedFixture(db: Db) {
  const repos = createRepos(db);
  const a = await repos.tenants.create({ slug: "mig-a", name: "Mig A" });
  const b = await repos.tenants.create({ slug: "mig-b", name: "Mig B" });
  const ctxA = tenantCtx(a.id);
  await repos.leads.add(ctxA, { source: "csv", email: "one@mig-a.example" });
  await repos.leads.add(tenantCtx(b.id), { source: "csv", email: "two@mig-b.example" });
  await repos.caches.llm.put(ctxA, { key: "mig-cache-key", valueRef: "obj/mig" });
  // explicit events rows pin the bigserial seq copy + setval
  await db
    .insert(schema.events)
    .values([
      { tenantId: a.id, entityType: "mig_fixture", entityId: a.id, event: "first" },
      { tenantId: b.id, entityType: "mig_fixture", entityId: b.id, event: "second" },
    ]);
  // waitlist self-FK chain: referee must land after its referrer
  const [root] = await db
    .insert(schema.waitlist)
    .values({ tenantId: a.id, email: "root@mig-a.example", referralCode: "root-code", position: 1 })
    .returning();
  await db.insert(schema.waitlist).values({
    tenantId: a.id,
    email: "referred@mig-a.example",
    referralCode: "ref-code",
    referredBy: root.id,
    position: 2,
  });
  await db.insert(schema.usageLedger).values({
    tenantId: a.id,
    day: "2026-07-17",
    model: "fake-model",
    tokensIn: 10,
    tokensOut: 20,
    costEstimate: 0.5,
  });
  // widest type surface: jsonb metrics + app-clock timestamps + a pgvector column
  await db.insert(schema.trendSnapshots).values({
    tenantId: a.id,
    source: "fake",
    externalId: "item-1",
    account: "acct",
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    metrics: { views: 42, likes: 7 },
    capturedAt: new Date("2026-07-10T12:00:00.000Z"),
  });
  const [src] = await db
    .insert(schema.sources)
    .values({ tenantId: a.id, kind: "prompt", contentHash: "mig-src-hash", meta: { via: "test" } })
    .returning();
  await db.insert(schema.sourceChunks).values({
    tenantId: a.id,
    sourceId: src.id,
    seq: 0,
    text: "chunk zero",
    embedding: Array.from({ length: 1536 }, (_, i) => Math.round((i / 1536) * 1e6) / 1e6),
    contentHash: "mig-chunk-hash",
  });
  return { a, b };
}

describe("migrate-data copy core", () => {
  it("COPY_ORDER covers the schema barrel exactly (executable completeness ratchet)", () => {
    expect(() => assertCopyOrderCoversSchema()).not.toThrow();
  });

  it("dry-run rehearses and verifies the full copy, then persists nothing", async () => {
    const source = await openRaw();
    const target = await openRaw();
    await seedFixture(source);

    const report = await copyAllTables(source, target, { execute: false });
    expect(report.mode).toBe("dry-run");
    expect(report.ok).toBe(true);
    expect(report.notes.join(" ")).toMatch(/rolled back/);
    const leads = report.tables.find((t) => t.table === "leads");
    expect(leads?.sourceRows).toBe(2);
    expect(leads?.verified).toBe(true);

    for (const table of ["tenants", "leads", "events", "waitlist", "source_chunks"]) {
      const res = (await target.execute(sql.raw(`select count(*)::int as n from ${table}`))) as {
        rows: { n: number }[];
      };
      expect(res.rows[0].n, `dry-run must leave ${table} empty`).toBe(0);
    }
  }, 60_000);

  it("execute copies everything verified, preserves the waitlist chain, and advances events.seq", async () => {
    const source = await openRaw();
    const target = await openRaw();
    const { a } = await seedFixture(source);

    const report = await copyAllTables(source, target, { execute: true });
    expect(report.ok).toBe(true);
    expect(report.tables.every((t) => t.verified)).toBe(true);
    expect(report.notes.join(" ")).toMatch(/sequence advanced/);

    const referred = await target
      .select()
      .from(schema.waitlist)
      .then((rows) => rows.find((r) => r.email === "referred@mig-a.example"));
    expect(referred?.referredBy, "waitlist self-FK must survive the copy").toBeTruthy();

    const chunk = (await target.select().from(schema.sourceChunks))[0];
    expect(chunk.embedding).toHaveLength(1536);

    // the sequence is live past the copied rows: a fresh insert must not collide
    const [next] = await target
      .insert(schema.events)
      .values({ tenantId: a.id, entityType: "mig_fixture", entityId: a.id, event: "post-copy" })
      .returning();
    const maxCopied = Math.max(
      ...(await target.select().from(schema.events)).map((e) => e.seq),
    );
    expect(next.seq).toBe(maxCopied);
    expect(next.seq).toBeGreaterThan(2);

    // one-shot by design: a second run refuses the now-populated target
    await expect(copyAllTables(source, target, { execute: true })).rejects.toThrow(
      MigratePreconditionError,
    );
  }, 60_000);
});
