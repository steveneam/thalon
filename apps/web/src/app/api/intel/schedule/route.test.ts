import { tenantCtx, type TenantCtx } from "@thalon/contracts";
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
let ctx: TenantCtx | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  repos = undefined;
  ctx = undefined;
  await handle?.close();
  handle = undefined;
});

function putReq(body: unknown): Request {
  return new Request("http://test.local/api/intel/schedule", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface WireSchedule {
  enabled: boolean;
  cadenceMinutes: number;
  lastSweepAt: string | null;
  configured: boolean;
}

describe("/api/intel/schedule (B-arm.1 config door)", () => {
  it("GET before any save is the honest disabled default, never a fabricated row", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { schedule } = (await res.json()) as { schedule: WireSchedule };
    expect(schedule).toEqual({
      enabled: false,
      cadenceMinutes: 240,
      lastSweepAt: null,
      configured: false,
    });
  });

  it("rejects out-of-bounds cadence and malformed bodies loudly (contract bounds 15–1440)", async () => {
    expect((await PUT(putReq({ enabled: true, cadenceMinutes: 5 }))).status).toBe(400);
    expect((await PUT(putReq({ enabled: true, cadenceMinutes: 2000 }))).status).toBe(400);
    expect((await PUT(putReq("cadence please"))).status).toBe(400);
  });

  it("PUT upserts the one row — create, then update in place — and GET reflects it", async () => {
    const created = await PUT(putReq({ enabled: true, cadenceMinutes: 60 }));
    expect(created.status).toBe(200);
    const first = ((await created.json()) as { schedule: WireSchedule }).schedule;
    expect(first).toMatchObject({ enabled: true, cadenceMinutes: 60, configured: true });

    const updated = await PUT(putReq({ enabled: false, cadenceMinutes: 240 }));
    const second = ((await updated.json()) as { schedule: WireSchedule }).schedule;
    expect(second).toMatchObject({ enabled: false, cadenceMinutes: 240, configured: true });

    const read = ((await (await GET()).json()) as { schedule: WireSchedule }).schedule;
    expect(read).toEqual(second);
  });

  it("lastSweepAt is read-only through this door — only a sweep that ran sets it", async () => {
    await PUT(putReq({ enabled: true, cadenceMinutes: 60 }));
    const sweptAt = new Date("2026-07-19T00:00:00.000Z");
    await repos!.sweepSchedules.markSwept(ctx!, sweptAt);

    // A config re-save must not touch the honest clock.
    await PUT(putReq({ enabled: true, cadenceMinutes: 120 }));
    const read = ((await (await GET()).json()) as { schedule: WireSchedule }).schedule;
    expect(read.lastSweepAt).toBe(sweptAt.toISOString());
    expect(read.cadenceMinutes).toBe(120);
  });
});
