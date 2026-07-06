import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET, POST } = await import("./route");
const { PATCH } = await import("./[targetId]/route");

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

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/intel/search/targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function patch(targetId: string, body: unknown): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/intel/search/targets/${targetId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ targetId }) },
  );
}

describe("/api/intel/search/targets", () => {
  it("adds an operator target, replays idempotently, and keeps a dismissal durable", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });

    const created = await post({ keyword: "  AI content automation " });
    expect(created.status).toBe(201);
    const { target } = await created.json();
    expect(target).toMatchObject({ keyword: "AI content automation", origin: "operator", status: "active" });

    // Same keyword again: the existing row comes back UNCHANGED (first origin wins).
    const replay = await post({ keyword: "AI content automation" });
    expect(replay.status).toBe(200);
    expect((await replay.json()).created).toBe(false);

    // Dismiss — durable signal, never deletion…
    const dismissed = await patch(target.id, { status: "dismissed" });
    expect((await dismissed.json()).target.status).toBe("dismissed");

    // …and a re-add does NOT resurrect it.
    const reAdd = await post({ keyword: "AI content automation" });
    expect((await reAdd.json()).target.status).toBe("dismissed");
    const listed = await (await GET()).json();
    expect(listed.targets).toHaveLength(1);
    expect(listed.targets[0].status).toBe("dismissed");
  });

  it("rejects an empty keyword and 503s unseeded writes", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    expect((await post({ keyword: "   " })).status).toBe(400);
  });
});
