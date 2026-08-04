import { InvalidPublishQueueTransitionError, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidStateError, NotFoundError } from "../errors";
import type { Repos } from "../repos";
import { fixture, type Fixture } from "./helpers";

/**
 * s82 contract-window repos (W1): the publish queue's first repository. Same
 * discipline as phase1-window-repos.test.ts — every behavior test doubles as
 * the tenancy-wall proof and the B4.4 events-coverage pin for these repos'
 * write fns (publish_queue.enqueued / claimed / published / failed /
 * cancelled / released).
 *
 * The video cut removal verb WAS pinned here too. Window 0026 turned it from
 * a hard delete into a reversible retire, so its tests moved WHOLE to
 * s100-window-0026-repos.test.ts rather than being copied — one home per
 * lesson (AGENTS.md rule 8).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{
  ctx: TenantCtx;
  other: TenantCtx;
  repos: Repos;
  draftId: string;
}> {
  fx = await fixture();
  const { repos } = fx.handle;
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), repos, draftId: fx.draft.id };
}

const AT = new Date("2026-08-01T09:30:00Z");

describe("publish queue repo (s82 W1)", () => {
  it("enqueues idempotently on (tenant, draft, platform, time) — the identical schedule replays untouched", async () => {
    const { ctx, repos, draftId } = await setup();

    const first = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:30:00Z",
    });
    expect(first.created).toBe(true);
    expect(first.row.status).toBe("pending");
    expect(first.row.scheduledAt?.toISOString()).toBe("2026-08-01T09:30:00.000Z");

    // The same moment expressed in another timezone is the SAME moment — the
    // key hashes the instant, not the string the operator typed.
    const replay = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T19:30:00+10:00",
    });
    expect(replay.created).toBe(false);
    expect(replay.row.id).toBe(first.row.id);

    // B4.4 pin: the replay appended no second event.
    const events = await repos.events.list(ctx, {
      entityType: "publish_queue",
      entityId: first.row.id,
    });
    expect(events.map((e) => e.event)).toEqual(["publish_queue.enqueued"]);
  });

  it("refuses a SECOND live row for the same draft+platform, and names the row in the way", async () => {
    const { ctx, repos, draftId } = await setup();
    const first = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:30:00Z",
    });

    // Two live rows would race to post the same draft twice.
    await expect(
      repos.publishQueue.enqueue(ctx, {
        draftId,
        platform: "linkedin",
        scheduledAt: "2026-08-02T09:30:00Z",
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    // Cross-posting the same draft to a DIFFERENT platform stays legal.
    const elsewhere = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "x",
      scheduledAt: "2026-08-02T09:30:00Z",
    });
    expect(elsewhere.created).toBe(true);

    // Withdrawing the first frees the platform for a new time.
    await repos.publishQueue.cancel(ctx, first.row.id);
    const rescheduled = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-02T09:30:00Z",
    });
    expect(rescheduled.created).toBe(true);
    expect(rescheduled.row.id).not.toBe(first.row.id);
  });

  it("walls the tenant: a stranger cannot queue my draft, and invalid input stores nothing", async () => {
    const { ctx, other, repos, draftId } = await setup();
    await expect(
      repos.publishQueue.enqueue(other, {
        draftId,
        platform: "linkedin",
        scheduledAt: "2026-08-01T09:30:00Z",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      repos.publishQueue.enqueue(ctx, {
        draftId,
        platform: "linkedin",
        scheduledAt: "whenever",
      }),
    ).rejects.toThrow();
    expect(await repos.publishQueue.list(ctx)).toEqual([]);
  });

  it("lists only what is due, oldest first, and claims a row exactly once", async () => {
    const { ctx, repos, draftId } = await setup();
    const soon = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:00:00Z",
    });
    const later = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "x",
      scheduledAt: "2026-08-01T23:00:00Z",
    });

    const due = await repos.publishQueue.listDue(AT);
    expect(due.map((r) => r.id)).toEqual([soon.row.id]);

    const claimed = await repos.publishQueue.claim(soon.row.id, AT);
    expect(claimed?.status).toBe("processing");
    expect(claimed?.updatedAt.toISOString()).toBe(AT.toISOString());

    // A second consumer racing the same row loses in the database, not in a
    // branch someone remembered to write.
    expect(await repos.publishQueue.claim(soon.row.id, AT)).toBeNull();
    // ...and a claimed row is no longer due.
    expect(await repos.publishQueue.listDue(AT)).toEqual([]);
    expect((await repos.publishQueue.get(ctx, later.row.id))?.status).toBe("pending");
  });

  it("completes a claimed row, and refuses a transition the rulebook forbids", async () => {
    const { ctx, repos, draftId } = await setup();
    const queued = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:00:00Z",
    });

    // Publishing without claiming skips the rulebook's only path.
    await expect(
      repos.publishQueue.complete(ctx, queued.row.id, { externalPostId: "urn:li:share:1" }),
    ).rejects.toBeInstanceOf(InvalidPublishQueueTransitionError);

    await repos.publishQueue.claim(queued.row.id, AT);
    const done = await repos.publishQueue.complete(ctx, queued.row.id, {
      externalPostId: "urn:li:share:1",
    });
    expect(done.status).toBe("published");

    // Terminal means terminal.
    await expect(
      repos.publishQueue.cancel(ctx, queued.row.id),
    ).rejects.toBeInstanceOf(InvalidPublishQueueTransitionError);

    const events = await repos.events.list(ctx, {
      entityType: "publish_queue",
      entityId: queued.row.id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "publish_queue.enqueued",
      "publish_queue.claimed",
      "publish_queue.published",
    ]);
    const published = events.find((e) => e.event === "publish_queue.published");
    expect((published?.payload as { externalPostId?: string }).externalPostId).toBe(
      "urn:li:share:1",
    );
  });

  it("a failed row says why on its face, verbatim, and stays failed", async () => {
    const { ctx, repos, draftId } = await setup();
    const queued = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:00:00Z",
    });
    await repos.publishQueue.claim(queued.row.id, AT);

    const reason =
      'the tenant\'s social block carries no "linkedin" entry — an unconfigured platform is disarmed';
    const failed = await repos.publishQueue.fail(ctx, queued.row.id, { reason });
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toBe(reason);

    // No automatic retry ladder: re-queueing is a deliberate operator act.
    await expect(repos.publishQueue.claim(queued.row.id, AT)).resolves.toBeNull();

    const events = await repos.events.list(ctx, {
      entityType: "publish_queue",
      entityId: queued.row.id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "publish_queue.enqueued",
      "publish_queue.claimed",
      "publish_queue.failed",
    ]);
    const failedEvent = events.find((e) => e.event === "publish_queue.failed");
    expect((failedEvent?.payload as { reason?: string }).reason).toBe(reason);
  });

  it("releases a stale claim so a died-mid-tick consumer cannot strand a row forever", async () => {
    const { ctx, repos, draftId } = await setup();
    const queued = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:00:00Z",
    });
    await repos.publishQueue.claim(queued.row.id, AT);

    // A claim younger than the staleness horizon is left strictly alone.
    const fresh = await repos.publishQueue.releaseStale(new Date(AT.getTime() - 60_000), AT);
    expect(fresh).toEqual([]);
    expect((await repos.publishQueue.get(ctx, queued.row.id))?.status).toBe("processing");

    const horizon = new Date(AT.getTime() + 15 * 60_000);
    const released = await repos.publishQueue.releaseStale(horizon, horizon);
    expect(released.map((r) => r.id)).toEqual([queued.row.id]);
    expect((await repos.publishQueue.get(ctx, queued.row.id))?.status).toBe("pending");
    // Released means due again — the next tick picks it up.
    expect((await repos.publishQueue.listDue(horizon)).map((r) => r.id)).toEqual([queued.row.id]);

    const events = await repos.events.list(ctx, {
      entityType: "publish_queue",
      entityId: queued.row.id,
    });
    expect(events.map((e) => e.event)).toEqual([
      "publish_queue.enqueued",
      "publish_queue.claimed",
      "publish_queue.released",
    ]);
  });

  it("keeps the queue tenant-walled on every read and terminal write", async () => {
    const { ctx, other, repos, draftId } = await setup();
    const queued = await repos.publishQueue.enqueue(ctx, {
      draftId,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:00:00Z",
    });
    expect(await repos.publishQueue.get(other, queued.row.id)).toBeNull();
    expect(await repos.publishQueue.list(other)).toEqual([]);
    await expect(repos.publishQueue.cancel(other, queued.row.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
