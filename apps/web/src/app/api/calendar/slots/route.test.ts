import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST, DELETE } = await import("./route");

let handle: DbHandle | undefined;
let draftId = "";

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = { tenantId: tenant.id };
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("s") });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${tenant.id}:run-1`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "linkedin",
    body: "The pipeline thread.",
    generationKey: sha256Hex(`${tenant.id}:draft-1`),
  });
  draftId = draft.id;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

function postReq(body: unknown): Request {
  return new Request("http://test.local/api/calendar/slots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(id: string): Request {
  return new Request(`http://test.local/api/calendar/slots?draftId=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * s78 — the calendar's write door. It exists because the slot store already
 * did: table, contract schema, repo, events and the tenancy wall all shipped
 * in the Phase-I window, so arming reschedule needed a route and nothing
 * else. These pin the honesty posture the repo already owns, THROUGH the
 * route: an upsert rather than a second row, a loud 404 rather than a
 * plausible success, and validation at the boundary.
 */
describe("/api/calendar/slots (the slot write door)", () => {
  it("plans a slot, then RE-plans the same draft — one slot, moved, never a duplicate", async () => {
    const planned = await POST(
      postReq({ draftId, scheduledFor: "2026-07-27T09:30:00+10:00", note: "pipeline thread" }),
    );
    expect(planned.status).toBe(200);
    const first = (await planned.json()) as { slot: { scheduledFor: string; note: string | null } };
    expect(first.slot.note).toBe("pipeline thread");

    const moved = await POST(postReq({ draftId, scheduledFor: "2026-07-27T16:45:00+10:00" }));
    expect(moved.status).toBe(200);
    const second = (await moved.json()) as { slot: { scheduledFor: string; note: string | null } };
    expect(new Date(second.slot.scheduledFor).getTime()).toBe(
      new Date("2026-07-27T16:45:00+10:00").getTime(),
    );
    // The note survives a bare re-plan — the repo's own rule, through the door.
    expect(second.slot.note).toBe("pipeline thread");

    const rows = await repos?.plannedSlots.listRange(
      { tenantId: (await repos.tenants.getBySlug("self"))?.id as string },
      { from: new Date("2026-07-01T00:00:00Z"), to: new Date("2026-08-01T00:00:00Z") },
    );
    expect(rows).toHaveLength(1);
  });

  it("removes a plan, and a second remove is a LOUD 404 — never a quiet success", async () => {
    await POST(postReq({ draftId, scheduledFor: "2026-07-27T09:30:00+10:00" }));

    const removed = await DELETE(deleteReq(draftId));
    expect(removed.status).toBe(200);

    const again = await DELETE(deleteReq(draftId));
    expect(again.status).toBe(404);
  });

  it("refuses a malformed body and an unnamed draft at the boundary", async () => {
    expect((await POST(postReq({ draftId }))).status).toBe(400);
    expect((await POST(postReq({ draftId, scheduledFor: "not-an-instant" }))).status).toBe(400);
    // A bare local time has no offset: the calendar owns display zones, the
    // wire carries real instants.
    expect((await POST(postReq({ draftId, scheduledFor: "2026-07-27T09:30:00" }))).status).toBe(400);
    expect((await DELETE(deleteReq(""))).status).toBe(400);
  });

  it("a draft that is not the tenant's own reads as absent — the tenancy wall, not an error page", async () => {
    const stranger = await repos?.tenants.create({ slug: "other", name: "Other" });
    const strangerCtx = { tenantId: stranger?.id as string };
    const profile = await repos?.brandProfiles.create(strangerCtx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    const source = await repos?.sources.create(strangerCtx, {
      kind: "prompt",
      contentHash: sha256Hex("other"),
    });
    const run = await repos?.fanoutRuns.create(strangerCtx, {
      sourceId: source?.id as string,
      brandProfileId: profile?.id as string,
      brandProfileVersion: profile?.version as number,
      platforms: ["linkedin"],
      promptVersion: "fanout.v1",
      model: "test/model",
      generationKey: sha256Hex(`${stranger?.id}:run-1`),
    });
    const foreign = await repos?.drafts.create(strangerCtx, {
      fanoutRunId: run?.id as string,
      sourceId: source?.id as string,
      platform: "linkedin",
      body: "Not yours.",
      generationKey: sha256Hex(`${stranger?.id}:draft-1`),
    });

    const res = await POST(
      postReq({ draftId: foreign?.id, scheduledFor: "2026-07-27T09:30:00+10:00" }),
    );
    expect(res.status).toBe(404);
  });
});
