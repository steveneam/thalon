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
    new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/profiles", () => {
  it("returns the first-run shape on an unseeded db", async () => {
    expect(await (await GET()).json()).toEqual({ active: null, history: [], tenant: null });
  });

  it("first save SEEDS the tenant (idempotent ensure) and creates v1 active", async () => {
    const res = await post({
      config: { identity: { company: "Thalon", topics: ["ai video"] } },
    });
    expect(res.status).toBe(201);
    const { profile } = await res.json();
    expect(profile).toMatchObject({ version: 1, active: true });
    expect(profile.config.identity.company).toBe("Thalon");

    // The tenant row exists with the identity's company as its name.
    const tenant = await repos!.tenants.getBySlug("self");
    expect(tenant).toMatchObject({ slug: "self", name: "Thalon" });
  });

  it("every save is a NEW active version; history reads newest-first from the events spine", async () => {
    await post({ config: { identity: { company: "Thalon" } } });
    await post({ config: { identity: { company: "Thalon" }, denylist: ["guarantee"] } });

    const body = await (await GET()).json();
    expect(body.active).toMatchObject({ version: 2, active: true });
    expect(body.active.config.denylist).toEqual(["guarantee"]);
    expect(body.history.map((h: { version: number }) => h.version)).toEqual([2, 1]);
    expect(body.tenant).toMatchObject({ slug: "self" });
  });

  it("rejects an invalid config loudly with the failing path named", async () => {
    const res = await post({ config: { denylist: "not-a-list" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("denylist");
  });

  it("window-1 blocks (icp · cadence · routing) round-trip through the wire — a GET-built save can never drop them", async () => {
    const icp = { description: "Owner-operated local service businesses", verticals: ["plumbing"] };
    const cadence = { linkedin: { maxPerDay: 2 } };
    const routing = { launch: ["linkedin", "x"] };
    const saved = await post({ config: { identity: { company: "Thalon" }, icp, cadence, routing } });
    expect(saved.status).toBe(201);

    const body = await (await GET()).json();
    // Parsed shapes (zod defaults fill icp's list fields) — the blocks are
    // PRESENT on the wire; that presence is what the editor's carry relies on.
    expect(body.active.config.icp).toMatchObject(icp);
    expect(body.active.config.cadence).toEqual(cadence);
    expect(body.active.config.routing).toEqual(routing);
  });

  it("a profile without window-1 blocks keeps its pre-window wire shape (no icp/cadence/routing keys)", async () => {
    await post({ config: { identity: { company: "Thalon" } } });
    const body = await (await GET()).json();
    expect("icp" in body.active.config).toBe(false);
    expect("cadence" in body.active.config).toBe(false);
    expect("routing" in body.active.config).toBe(false);
  });
});
