import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST } = await import("./route");

let handle: DbHandle | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

function post(body: unknown): Request {
  return new Request("http://test/api/create/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The happy path (compose → judge → queue) is covered end-to-end with
 * injected fakes in lib/outreach/__tests__/service.test.ts — this route test
 * pins the thin-route contract: parse, authorize, and the ComposeEmailError
 * status mapping, all of which fire BEFORE any driver could be reached.
 */
describe("POST /api/create/email", () => {
  it("400s a malformed body with the shape hint", async () => {
    const res = await POST(post({ family: "email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("leadId");
  });

  it("503s before the tenant is seeded — set up the workspace first", async () => {
    const res = await POST(post({ leadId: "lead-1", context: { painPoint: "x" } }));
    expect(res.status).toBe(503);
  });

  it("404s an unknown lead and 400s an all-pruned brief, verbatim reasons", async () => {
    const tenant = await repos!.tenants.create({ slug: "self", name: "Self" });
    const ctx = { tenantId: tenant.id };
    await repos!.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });

    const missing = await POST(
      post({ leadId: "00000000-0000-4000-8000-000000000000", context: { painPoint: "x" } }),
    );
    expect(missing.status).toBe(404);

    const { lead } = await repos!.leads.add(ctx, { source: "csv", email: "sam@x.example" });
    const empty = await POST(post({ leadId: lead.id }));
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toContain("Nothing to compose from");
  });
});
