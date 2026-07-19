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
  return new Request("http://test/api/create/video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The happy path (brief → staged drafts → judge → project tree) is covered
 * end-to-end with injected fakes in lib/videos/__tests__/one-prompt.test.ts —
 * this route test pins the thin-route contract: parse, authorize, and the
 * InvalidStateError status mapping, all of which fire BEFORE any driver
 * could be reached.
 */
describe("POST /api/create/video", () => {
  it("400s a malformed body with the shape hint", async () => {
    const res = await POST(post({ family: "video" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("prompt");
  });

  it("503s before the tenant is seeded — set up the workspace first", async () => {
    const res = await POST(post({ prompt: "Introduce the staged flow." }));
    expect(res.status).toBe(503);
  });

  it("409s a whitespace-only prompt — the engine's state refusal, verbatim, before any driver", async () => {
    const tenant = await repos!.tenants.create({ slug: "self", name: "Self" });
    await repos!.brandProfiles.create(
      { tenantId: tenant.id },
      { config: { voice: {}, denylist: [], platformProfiles: {} }, activate: true },
    );
    const res = await POST(post({ prompt: "   " }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("non-empty prompt");
  });
});
