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

const { POST } = await import("./route");

let handle: DbHandle | undefined;
let ctx = { tenantId: "" };
let queueRowId = "";

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = { tenantId: tenant.id };
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      social: { linkedin: { maxPostsPerDay: 2 } },
    },
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
    generationKey: sha256Hex(`${tenant.id}:tick-run`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "linkedin",
    body: "A short, fitting post.",
    format: "post",
    generationKey: sha256Hex(`${tenant.id}:tick-draft`),
  });
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  await repos.drafts.transition(ctx, draft.id, "approved");
  // Due already: a past instant is legal for the repo (the producer is what
  // refuses one), and this is the row an armed tick would take.
  const { row } = await repos.publishQueue.enqueue(ctx, {
    draftId: draft.id,
    platform: "linkedin",
    scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  });
  queueRowId = row.id;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

interface TickBody {
  armed: boolean;
  due: Array<{ id: string; platform: string }>;
  released: unknown[];
  published: unknown[];
  failed: unknown[];
  note: string;
}

/**
 * C3 — the consumer's ops door, DISARMED. This is the executable form of
 * the lane's hardest constraint: with the arm absent the tick REPORTS and
 * touches nothing. If this test ever goes green while a row changed status,
 * the disarmed posture has been lost.
 */
describe("/api/social/queue/tick (the consumer pass — disarmed)", () => {
  it("reports what is due and writes NOTHING", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as TickBody;

    expect(body.armed).toBe(false);
    expect(body.due.map((d) => d.id)).toEqual([queueRowId]);
    expect(body.released).toEqual([]);
    expect(body.published).toEqual([]);
    expect(body.failed).toEqual([]);
    expect(body.note).toContain("DISARMED");

    const row = await repos!.publishQueue.get(ctx, queueRowId);
    expect(row?.status).toBe("pending");
    const events = await repos!.events.list(ctx, {
      entityType: "publish_queue",
      entityId: queueRowId,
    });
    expect(events.map((e) => e.event)).toEqual(["publish_queue.enqueued"]);
  });

  it("records no publication — the ledger stays empty however many passes run", async () => {
    await POST();
    await POST();
    const row = await repos!.publishQueue.get(ctx, queueRowId);
    expect(await repos!.socialPublications.listForDraft(ctx, row!.draftId)).toEqual([]);
  });
});
