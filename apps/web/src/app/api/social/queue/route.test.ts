import { FINAL_JUDGE_GATE } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET, POST, DELETE } = await import("./route");

let handle: DbHandle | undefined;
let ctx = { tenantId: "" };
let runId = "";
let sourceId = "";
let seq = 0;

const TOMORROW = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = { tenantId: tenant.id };
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("s") });
  sourceId = source.id;
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${tenant.id}:run-1`),
  });
  runId = run.id;
  seq = 0;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

async function draft(opts: { body?: string; approve?: boolean } = {}): Promise<string> {
  const row = await repos!.drafts.create(ctx, {
    fanoutRunId: runId,
    sourceId,
    platform: "linkedin",
    body: opts.body ?? "A short, fitting post.",
    format: "post",
    generationKey: sha256Hex(`${ctx.tenantId}:draft-${seq++}`),
  });
  if (opts.approve === false) return row.id;
  await repos!.drafts.transition(ctx, row.id, "judging");
  await repos!.judgeResults.append(ctx, {
    draftId: row.id,
    gate: FINAL_JUDGE_GATE,
    verdict: "pass",
  });
  await repos!.drafts.transition(ctx, row.id, "queued");
  await repos!.drafts.transition(ctx, row.id, "approved");
  return row.id;
}

function postReq(body: unknown): Request {
  return new Request("http://test.local/api/social/queue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(query = ""): Request {
  return new Request(`http://test.local/api/social/queue${query}`);
}

function deleteReq(id: string): Request {
  return new Request(`http://test.local/api/social/queue?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

interface WireRow {
  id: string;
  draftId: string;
  platform: string;
  scheduledAt: string | null;
  status: string;
  lastError: string | null;
}

/**
 * C2 (s82) — the Schedule verb's door, through the route. These pin the
 * honesty posture the engine and the frozen repo already own: a commitment
 * that refuses before it is written, an idempotent replay, a real way back
 * out, and — the whole point — a row that is an INTENT TO PUBLISH and never
 * a publish.
 */
describe("/api/social/queue (the Schedule verb)", () => {
  it("schedules an approved draft, and the row is pending — nothing published", async () => {
    const draftId = await draft();
    const at = TOMORROW();
    const res = await POST(postReq({ draftId, platform: "linkedin", scheduledAt: at }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { row: WireRow; created: boolean };
    expect(body.created).toBe(true);
    expect(body.row.status).toBe("pending");
    expect(new Date(body.row.scheduledAt as string).getTime()).toBe(new Date(at).getTime());
    expect(await repos!.socialPublications.listForDraft(ctx, draftId)).toEqual([]);
  });

  it("refuses a draft that has not been approved — 409, with the reason", async () => {
    const draftId = await draft({ approve: false });
    const res = await POST(postReq({ draftId, platform: "linkedin", scheduledAt: TOMORROW() }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("APPROVED");
  });

  it("refuses a post the platform will bounce — the capability matrix, before any call", async () => {
    const draftId = await draft({ body: "x".repeat(400) });
    const res = await POST(postReq({ draftId, platform: "x", scheduledAt: TOMORROW() }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("280");
    expect(await repos!.publishQueue.list(ctx)).toEqual([]);
  });

  it("refuses a slot that has already passed", async () => {
    const draftId = await draft();
    const res = await POST(
      postReq({ draftId, platform: "linkedin", scheduledAt: new Date(Date.now() - 60_000).toISOString() }),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("future");
  });

  it("validates the body at the boundary", async () => {
    const draftId = await draft();
    expect((await POST(postReq({ draftId, platform: "linkedin" }))).status).toBe(400);
    expect((await POST(postReq({ draftId, scheduledAt: TOMORROW() }))).status).toBe(400);
    expect((await POST(postReq({ draftId, platform: "myspace", scheduledAt: TOMORROW() }))).status).toBe(400);
    expect((await POST(postReq({ platform: "linkedin", scheduledAt: TOMORROW() }))).status).toBe(400);
  });

  it("a foreign draft reads as absent — the tenancy wall, not an error page", async () => {
    const stranger = await repos!.tenants.create({ slug: "other", name: "Other" });
    const strangerCtx = { tenantId: stranger.id };
    const profile = await repos!.brandProfiles.create(strangerCtx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    const source = await repos!.sources.create(strangerCtx, {
      kind: "prompt",
      contentHash: sha256Hex("other"),
    });
    const run = await repos!.fanoutRuns.create(strangerCtx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["linkedin"],
      promptVersion: "fanout.v1",
      model: "test/model",
      generationKey: sha256Hex(`${stranger.id}:run-1`),
    });
    const foreign = await repos!.drafts.create(strangerCtx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "linkedin",
      body: "Not yours.",
      generationKey: sha256Hex(`${stranger.id}:draft-1`),
    });
    const res = await POST(
      postReq({ draftId: foreign.id, platform: "linkedin", scheduledAt: TOMORROW() }),
    );
    expect(res.status).toBe(404);
  });

  it("reads the tenant's rows, and narrows to one draft's", async () => {
    const a = await draft();
    const b = await draft();
    await POST(postReq({ draftId: a, platform: "linkedin", scheduledAt: TOMORROW() }));
    await POST(postReq({ draftId: b, platform: "linkedin", scheduledAt: TOMORROW() }));

    const all = (await (await GET(getReq())).json()) as { rows: WireRow[] };
    expect(all.rows).toHaveLength(2);

    const one = (await (await GET(getReq(`?draftId=${a}`))).json()) as { rows: WireRow[] };
    expect(one.rows.map((r) => r.draftId)).toEqual([a]);

    const pending = (await (await GET(getReq("?status=pending"))).json()) as { rows: WireRow[] };
    expect(pending.rows).toHaveLength(2);
    expect((await GET(getReq("?status=nonsense"))).status).toBe(400);
  });

  it("cancels a row — and a second cancel is refused by the rulebook, never a quiet success", async () => {
    const draftId = await draft();
    const created = (await (
      await POST(postReq({ draftId, platform: "linkedin", scheduledAt: TOMORROW() }))
    ).json()) as { row: WireRow };

    const cancelled = await DELETE(deleteReq(created.row.id));
    expect(cancelled.status).toBe(200);
    expect(((await cancelled.json()) as { row: WireRow }).row.status).toBe("cancelled");

    // `cancelled` is terminal — the transition rulebook refuses the repeat.
    expect((await DELETE(deleteReq(created.row.id))).status).toBe(409);
    expect((await DELETE(deleteReq(""))).status).toBe(400);
  });

  it("cancelling frees the draft to be scheduled at a different time", async () => {
    const draftId = await draft();
    const first = (await (
      await POST(postReq({ draftId, platform: "linkedin", scheduledAt: TOMORROW() }))
    ).json()) as { row: WireRow };
    // A second, different time is refused while the first row is live.
    const clash = await POST(
      postReq({
        draftId,
        platform: "linkedin",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(clash.status).not.toBe(200);
    expect(((await clash.json()) as { error: string }).error).toContain("cancel that row");

    await DELETE(deleteReq(first.row.id));
    const retry = await POST(
      postReq({
        draftId,
        platform: "linkedin",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(retry.status).toBe(200);
  });
});
