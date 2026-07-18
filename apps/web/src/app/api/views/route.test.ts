import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET, PUT } = await import("./route");

let handle: DbHandle | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  await repos.tenants.create({ slug: "self", name: "Self" });
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

function getReq(surface: string): Request {
  return new Request(`http://test.local/api/views?surface=${surface}`);
}

function putReq(body: unknown): Request {
  return new Request("http://test.local/api/views", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/views (Phase-I window store — the tenant-wide view record)", () => {
  it("rejects an unknown surface and a malformed body loudly", async () => {
    expect((await GET(getReq("mystery"))).status).toBe(400);
    expect((await PUT(putReq({ surface: "leads" }))).status).toBe(400);
  });

  it("PUT is an idempotent upsert by (surface, name): create, then update in place — never a duplicate", async () => {
    const first = await PUT(
      putReq({ surface: "leads", name: "Board", config: { wipLimits: { new: 2 } } }),
    );
    expect(first.status).toBe(200);
    const { view: created } = (await first.json()) as { view: { id: string } };

    const second = await PUT(
      putReq({ surface: "leads", name: "Board", config: { wipLimits: { new: 5 } } }),
    );
    expect(second.status).toBe(200);
    const { view: updated } = (await second.json()) as {
      view: { id: string; config: Record<string, unknown> };
    };
    expect(updated.id).toBe(created.id);
    expect(updated.config).toEqual({ wipLimits: { new: 5 } });

    const list = await GET(getReq("leads"));
    const { views } = (await list.json()) as { views: unknown[] };
    expect(views).toHaveLength(1);
  });

  it("surfaces are separate shelves — a calendar view never leaks into the leads list", async () => {
    await PUT(putReq({ surface: "calendar", name: "Week", config: {} }));
    const { views } = (await (await GET(getReq("leads"))).json()) as { views: unknown[] };
    expect(views).toHaveLength(0);
  });
});
