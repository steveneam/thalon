import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_JOINS_PER_WINDOW, resetRateLimit } from "@/lib/waitlist/rate-limit";

// Route tests run against a fresh in-memory db per test (the B0.4 pattern);
// only the process-cached getRepos() accessor is swapped.
let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST } = await import("./route");

let handle: DbHandle | undefined;
let ipSeq = 0;

/** Each request gets its own IP unless a test pins one — keeps the limiter out of unrelated tests. */
function post(body: unknown, ip?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip ?? `10.0.0.${++ipSeq}`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  resetRateLimit();
  handle = await openTestDb();
  repos = handle.repos;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

async function seedTenant(): Promise<void> {
  // resolveTenantCtx looks up DEMO_TENANT_SLUG (default "self").
  await repos!.tenants.create({ slug: "self", name: "Self" });
}

describe("POST /api/waitlist", () => {
  it("creates a signup: 201, queue position, referral link", async () => {
    await seedTenant();
    const res = await post({ email: "First@Example.com " });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ created: true, position: 1, effectivePosition: 1, total: 1 });
    expect(body.referralUrl).toContain(`?ref=${body.referralCode}`);
  });

  it("re-signup replays idempotently: 200, original position and code", async () => {
    await seedTenant();
    const first = await (await post({ email: "a@example.com" })).json();
    const res = await post({ email: "  A@EXAMPLE.COM" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(false);
    expect(body.position).toBe(first.position);
    expect(body.referralCode).toBe(first.referralCode);
  });

  it("attributes a referred signup through the ?ref code", async () => {
    await seedTenant();
    const referrer = await (await post({ email: "referrer@example.com" })).json();
    const res = await post({ email: "friend@example.com", ref: referrer.referralCode });
    expect(res.status).toBe(201);
    const entry = await repos!.waitlist.getByEmail(
      { tenantId: (await repos!.tenants.getBySlug("self"))!.id },
      "friend@example.com",
    );
    expect(entry?.referredBy).not.toBeNull();
  });

  it("rejects a malformed email with 400 before touching the db", async () => {
    // Deliberately NO tenant seeded — a 400 here proves validation runs first.
    expect((await post({ email: "not-an-email" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
  });

  it("rate-limits a single IP with 429 + Retry-After", async () => {
    await seedTenant();
    const ip = "203.0.113.9";
    for (let i = 0; i < MAX_JOINS_PER_WINDOW; i++) {
      const res = await post({ email: `u${i}@example.com` }, ip);
      expect(res.status).toBe(201);
    }
    const blocked = await post({ email: "late@example.com" }, ip);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another IP is unaffected.
    expect((await post({ email: "other@example.com" })).status).toBe(201);
  });

  it("answers 503 while the tenant is unseeded — service state, not caller error", async () => {
    expect((await post({ email: "a@example.com" })).status).toBe(503);
  });
});
