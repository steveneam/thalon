import { tenantCtx } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import { expect } from "vitest";
import { createRepos } from "../repos";
import * as schema from "../schema";
import { withTenantSession } from "../tenant-session";
import type { Db } from "../types";

function rows(res: unknown): Record<string, unknown>[] {
  return (res as { rows: Record<string, unknown>[] }).rows;
}

/** Drizzle wraps driver errors ("Failed query: …" with the violation in `cause`) — collect the whole chain. */
function errorChain(e: unknown): string {
  const parts: string[] = [];
  let cur = e;
  while (cur instanceof Error) {
    parts.push(cur.message);
    cur = cur.cause;
  }
  return parts.join(" <- ");
}

/**
 * The tenancy-isolation proof (kickoff mission 2), shared by the ungated
 * PGlite run and the gated real-server run — PGlite IS Postgres, so the
 * same checks must hold verbatim on both. The caller hands a MIGRATED db
 * connected as a privileged user (owner/superuser) on a SINGLE connection
 * (session state — set role / set_config — must stick); this function seeds
 * two tenants, then switches to a freshly created enforcing role (no
 * ownership, no superuser, plain grants — the intended production posture)
 * and proves cross-tenant SELECT/UPDATE/DELETE/INSERT are all blocked, that
 * repos are locked without the session belt and unlocked only inside
 * withTenantSession, and that the documented cache exemption stays
 * cross-tenant. `role` is created here and left for the caller to drop
 * (roles are cluster-level on a real server).
 */
export async function runRlsIsolationChecks(db: Db, opts: { role: string }): Promise<void> {
  const repos = createRepos(db);

  const a = await repos.tenants.create({ slug: "rls-tenant-a", name: "RLS Tenant A" });
  const b = await repos.tenants.create({ slug: "rls-tenant-b", name: "RLS Tenant B" });
  const ctxB = tenantCtx(b.id);
  const ctxA = tenantCtx(a.id);
  await repos.leads.add(ctxA, { source: "csv", email: "a1@rls-a.example" });
  await repos.leads.add(ctxA, { source: "csv", email: "a2@rls-a.example" });
  const { lead: leadB } = await repos.leads.add(ctxB, { source: "csv", email: "b1@rls-b.example" });
  await db
    .insert(schema.events)
    .values({ tenantId: a.id, entityType: "rls_fixture", entityId: a.id, event: "seeded" });
  await repos.caches.llm.put(ctxA, { key: "rls-shared-cache-key", valueRef: "obj/warmed-by-a" });

  await db.execute(sql.raw(`create role ${opts.role}`));
  await db.execute(
    sql.raw(`grant select, insert, update, delete on all tables in schema public to ${opts.role}`),
  );
  await db.execute(sql.raw(`grant usage, select on all sequences in schema public to ${opts.role}`));
  await db.execute(sql.raw(`set role ${opts.role}`));
  try {
    const count = async (table: string) =>
      Number(rows(await db.execute(sql.raw(`select count(*)::int as n from ${table}`)))[0].n);

    // 1. No tenant context ⇒ nothing tenant-scoped is visible — while the
    //    exempt tables keep working exactly as designed.
    await db.execute(sql`select set_config('app.tenant_id', '', false)`);
    expect(await count("leads"), "leads must be invisible without tenant context").toBe(0);
    expect(await count("events"), "events must be invisible without tenant context").toBe(0);
    expect(await count("tenants"), "tenants (exempt identity anchor) must stay readable").toBe(2);
    expect(
      await repos.tenants.getBySlug("rls-tenant-b"),
      "slug→tenant resolution must work before any tenant context exists",
    ).toBeTruthy();
    expect(await count("llm_cache"), "llm_cache (exempt by design) must stay readable").toBe(1);
    expect(
      await repos.leads.list(ctxB),
      "the app-layer WHERE alone must not unlock rows for an enforcing role",
    ).toEqual([]);

    // 2. Pinned to tenant A ⇒ SELECT sees exactly A's rows.
    await db.execute(sql`select set_config('app.tenant_id', ${a.id}, false)`);
    const seen = rows(await db.execute(sql`select email from leads order by email`));
    expect(seen.map((r) => r.email)).toEqual(["a1@rls-a.example", "a2@rls-a.example"]);

    // 3. Cross-tenant UPDATE and DELETE hit zero rows — by id and by sweep.
    expect(
      rows(await db.execute(sql`update leads set notes = 'crossed' where id = ${leadB.id} returning id`)),
    ).toHaveLength(0);
    expect(
      rows(
        await db.execute(sql`update leads set notes = 'crossed' where tenant_id = ${b.id} returning id`),
      ),
    ).toHaveLength(0);
    expect(
      rows(await db.execute(sql`delete from leads where id = ${leadB.id} returning id`)),
    ).toHaveLength(0);

    // 4. Cross-tenant INSERT violates WITH CHECK; same-tenant passes.
    const smuggleError = await db
      .execute(
        sql`insert into leads (tenant_id, source, email, email_hash) values (${b.id}, 'csv', 'smuggled@rls-b.example', 'rls-smuggled-hash') returning id`,
      )
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(smuggleError, "cross-tenant INSERT must be rejected").toBeTruthy();
    expect(errorChain(smuggleError)).toMatch(/row-level security/);
    // pg-pool discards a connection whose query errored, so the deliberate
    // failure above may have cost a pooled driver its session-level role and
    // setting — re-pin both before proving anything else. (The product door
    // is immune: withTenantSession is transaction-scoped on one client.)
    await db.execute(sql.raw(`set role ${opts.role}`));
    await db.execute(sql`select set_config('app.tenant_id', ${a.id}, false)`);
    expect(
      rows(
        await db.execute(
          sql`insert into leads (tenant_id, source, email, email_hash) values (${a.id}, 'csv', 'a3@rls-a.example', 'rls-own-hash') returning id`,
        ),
      ),
    ).toHaveLength(1);

    // 5. withTenantSession is the unlock — and it resets with its transaction.
    await db.execute(sql`select set_config('app.tenant_id', '', false)`);
    expect(await repos.leads.list(ctxB)).toEqual([]);
    const inside = await withTenantSession(db, ctxB, (r) => r.leads.list(ctxB));
    expect(inside.map((l) => l.email)).toEqual(["b1@rls-b.example"]);
    expect(
      await repos.leads.list(ctxB),
      "the transaction-local setting must not outlive withTenantSession",
    ).toEqual([]);

    // 6. Writes through the session door land (WITH CHECK passes for the
    //    pinned tenant, sequences included).
    const added = await withTenantSession(db, ctxB, (r) =>
      r.leads.add(ctxB, { source: "api", email: "b2@rls-b.example" }),
    );
    expect(added.created).toBe(true);
    const backIn = await withTenantSession(db, ctxB, (r) => r.leads.list(ctxB));
    expect(backIn.map((l) => l.email).sort()).toEqual(["b1@rls-b.example", "b2@rls-b.example"]);

    // 7. The documented cache exemption: warmed by A, hits for B —
    //    content-addressed by design (schema/ops.ts).
    const hit = await withTenantSession(db, ctxB, (r) => r.caches.llm.get("rls-shared-cache-key"));
    expect(hit?.valueRef).toBe("obj/warmed-by-a");
  } finally {
    await db.execute(sql`reset role`);
  }
}
