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
const { PATCH } = await import("./[areaId]/route");

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
    new Request("http://localhost/api/intel/areas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function patch(areaId: string, body: unknown): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/intel/areas/${areaId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ areaId }) },
  );
}

describe("/api/intel/areas", () => {
  it("returns an empty list unseeded and 503s writes — a service state, not a caller mistake", async () => {
    expect(await (await GET()).json()).toEqual({ areas: [] });
    expect((await post({ name: "ai", description: "agents drafting content" })).status).toBe(503);
  });

  it("creates, lists, edits, and pauses an area over the real repo", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });

    const created = await post({ name: "ai video", description: "HTML-to-video pipelines" });
    expect(created.status).toBe(201);
    const { area } = await created.json();
    expect(area).toMatchObject({ name: "ai video", status: "active" });

    const listed = await (await GET()).json();
    expect(listed.areas).toHaveLength(1);

    const edited = await patch(area.id, { description: "programmatic video rendering" });
    expect((await edited.json()).area.description).toBe("programmatic video rendering");

    // Pause, never delete — the paused row stays listed.
    const paused = await patch(area.id, { status: "paused" });
    expect((await paused.json()).area.status).toBe("paused");
    expect((await (await GET()).json()).areas).toHaveLength(1);
  });

  it("rejects a description-less area loudly — the description is load-bearing config", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    expect((await post({ name: "only a name" })).status).toBe(400);
  });

  it("404s a patch to an unknown or cross-tenant area id", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    const res = await patch("00000000-0000-4000-8000-000000000000", { status: "paused" });
    expect(res.status).toBe(404);
  });
});
