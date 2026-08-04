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

  it("surfaces are separate shelves — a schedule view never leaks into the leads list", async () => {
    await PUT(putReq({ surface: "schedule", name: "Week", config: {} }));
    const { views } = (await (await GET(getReq("leads"))).json()) as { views: unknown[] };
    expect(views).toHaveLength(0);
  });

  /**
   * Window 0027, and the reason it exists. `schedule-surface.tsx` has asked
   * for `"schedule"` since the s86 rename while the surface list still said
   * `"calendar"`, so both doors 400d — and both call sites swallow their
   * errors by design, so the operator's density/scope preference silently
   * never persisted. Proven live before the fix; pinned here after it.
   */
  it("the SCHEDULE surface round-trips — the s86 rename's stranded door", async () => {
    const put = await PUT(
      putReq({ surface: "schedule", name: "Default", config: { density: "month", scope: "all" } }),
    );
    expect(put.status).toBe(200);

    const read = await GET(getReq("schedule"));
    expect(read.status).toBe(200);
    const { views } = (await read.json()) as { views: Array<{ config: unknown }> };
    expect(views).toHaveLength(1);
    expect(views[0].config).toEqual({ density: "month", scope: "all" });
  });

  /** The retired name is gone, not quietly aliased — an unknown surface still refuses. */
  it("the retired `calendar` name is refused, and the error names what IS accepted", async () => {
    expect((await GET(getReq("calendar"))).status).toBe(400);
    const { error } = (await (await GET(getReq("calendar"))).json()) as { error: string };
    expect(error).toContain("schedule");
    expect((await PUT(putReq({ surface: "calendar", name: "Week", config: {} }))).status).toBe(400);
  });
});
