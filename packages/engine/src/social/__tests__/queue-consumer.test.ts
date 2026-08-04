import { FINAL_JUDGE_GATE, tenantCtx, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import {
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type PublishQueueRow,
  type Repos,
} from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import {
  publishQueueArmed,
  runDuePublishes,
  SOCIAL_QUEUE_ARM_KEY,
} from "../queue-consumer";
import { createFakeSocialPublisher, resolveSocialPublisher, type SocialPublisher } from "../registry";
import { scheduleApprovedDraft } from "../schedule";

/**
 * C3 (s82): the queue consumer tick. Two things are load-bearing here and
 * both are tested as invariants rather than as behaviour:
 *
 *   1. DISARMED MEANS DISARMED. Absent the arm, a pass reads and reports —
 *      it claims nothing, transitions nothing, and reaches no platform.
 *   2. The publish door's refusal ladder is UNTOUCHED. An unarmed platform's
 *      row fails closed with the door's own words, which is the correct
 *      behaviour and not a gap.
 *   3. THE TWO GATES ARE **AND** (control-arc part A, s102). The master key
 *      and the destination's own `off`/`review`/`live` must BOTH say yes.
 *      Every armed test below therefore has to name a live destination —
 *      when this landed, every one of them stopped publishing until it did,
 *      which is the property working rather than a chore.
 */

const NOW = new Date(Date.UTC(2026, 6, 28, 12, 0));

/** Every destination authorized — what the tests that predate part A implicitly assumed. */
const allLive = () => "live" as const;
const EARLIER = new Date(Date.UTC(2026, 6, 28, 9, 0));
const SLOT = new Date(Date.UTC(2026, 6, 28, 11, 0));
const POST_BODY = "A short, fitting post about local work.";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  repos: Repos;
  runId: string;
  sourceId: string;
  seq: { n: number };
}

/** `social: null` = a profile with NO social block (the disarmed-tenant case). */
async function setup(opts: { social?: Record<string, unknown> | null } = {}): Promise<Fixture> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const social = opts.social === null ? undefined : (opts.social ?? { linkedin: { maxPostsPerDay: 2 } });
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: { company: "Thalon", links: { site: "https://thalon.example" } },
      ...(social ? { social } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("consumer brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("brief-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout-generate.v2",
    model: "test/model",
    generationKey: `${ctx.tenantId}:consumer-run`,
  });
  return { ctx, repos, runId: run.id, sourceId: source.id, seq: { n: 0 } };
}

async function approvedDraft(f: Fixture, body = POST_BODY): Promise<Draft> {
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform: "linkedin",
    body,
    format: "post",
    generationKey: `${f.ctx.tenantId}:consumer-draft-${f.seq.n++}`,
    meta: {},
  });
  await f.repos.drafts.transition(f.ctx, draft.id, "judging");
  await f.repos.judgeResults.append(f.ctx, {
    draftId: draft.id,
    gate: FINAL_JUDGE_GATE,
    verdict: "pass",
  });
  await f.repos.drafts.transition(f.ctx, draft.id, "queued");
  return f.repos.drafts.transition(f.ctx, draft.id, "approved");
}

/** One committed row through the real producer, scheduled for `SLOT` (due at NOW). */
async function queueRow(f: Fixture, body?: string): Promise<PublishQueueRow> {
  const draft = await approvedDraft(f, body);
  const { row } = await scheduleApprovedDraft(
    { ctx: f.ctx, repos: f.repos },
    { draftId: draft.id, platform: "linkedin", scheduledAt: SLOT },
    EARLIER,
  );
  return row;
}

function fakeResolver(publisher: SocialPublisher) {
  return () => (): SocialPublisher => publisher;
}

describe("the arm", () => {
  it('reads exactly "true" — nothing else arms the seam', () => {
    expect(publishQueueArmed({})).toBe(false);
    expect(publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: "" })).toBe(false);
    expect(publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: "1" })).toBe(false);
    expect(publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: "TRUE" })).toBe(false);
    expect(publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: "yes" })).toBe(false);
    expect(publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: "true" })).toBe(true);
  });
});

describe("runDuePublishes — DISARMED, the shipped posture", () => {
  it("reports what is due and touches NOTHING", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const result = await runDuePublishes({ repos: f.repos }, NOW);

    expect(result.armed).toBe(false);
    expect(result.due.map((d) => d.id)).toEqual([row.id]);
    expect(result.published).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.released).toEqual([]);

    // The row is untouched: still pending, never claimed.
    const after = await f.repos.publishQueue.get(f.ctx, row.id);
    expect(after?.status).toBe("pending");
    const events = await f.repos.events.list(f.ctx, { entityType: "publish_queue", entityId: row.id });
    expect(events.map((e) => e.event)).toEqual(["publish_queue.enqueued"]);
  });

  it("makes no platform call even when a publisher IS wired", async () => {
    const f = await setup();
    await queueRow(f);
    const publisher = createFakeSocialPublisher();
    const result = await runDuePublishes(
      { repos: f.repos, resolvePublisher: fakeResolver(publisher) },
      NOW,
    );
    expect(result.armed).toBe(false);
    expect(publisher.calls).toEqual([]);
  });

  it("a row scheduled in the future is not due yet", async () => {
    const f = await setup();
    await queueRow(f);
    const before = new Date(SLOT.getTime() - 60_000);
    expect((await runDuePublishes({ repos: f.repos }, before)).due).toEqual([]);
  });

  it("releases nothing while disarmed — recovery is a WRITE, and disarmed writes nothing", async () => {
    const f = await setup();
    const row = await queueRow(f);
    await f.repos.publishQueue.claim(row.id, new Date(NOW.getTime() - 60 * 60_000));
    const result = await runDuePublishes({ repos: f.repos }, NOW);
    expect(result.released).toEqual([]);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("processing");
  });
});

describe("runDuePublishes — ARMED (tests only; the lane ships no armed caller)", () => {
  it("refuses to run armed without a publisher seam — no network-reaching default exists", async () => {
    const f = await setup();
    await expect(runDuePublishes({ repos: f.repos, armed: true }, NOW)).rejects.toThrow(
      /ARMED but no resolvePublisher/,
    );
  });

  it("walks a due row through the publish door and completes it", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const publisher = createFakeSocialPublisher();
    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(publisher) },
      NOW,
    );

    expect(result.published).toHaveLength(1);
    expect(result.published[0].externalPostId).toBe("fake-post-1");
    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0].text).toBe(POST_BODY);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("published");
    // The LEDGER is the audit answer; the queue keeps its own copy of the id.
    const ledger = await f.repos.socialPublications.listForDraft(f.ctx, row.draftId);
    expect(ledger.map((p) => p.externalPostId)).toEqual(["fake-post-1"]);
  });

  it("an UNARMED platform's row fails closed with the door's own words — the correct behaviour, not a gap", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const unarmed = resolveSocialPublisher("linkedin", {});
    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(unarmed) },
      NOW,
    );

    expect(result.published).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("DISARMED");
    const after = await f.repos.publishQueue.get(f.ctx, row.id);
    expect(after?.status).toBe("failed");
    // The reason lands VERBATIM on the row's face (the B1.5 lesson).
    expect(after?.lastError).toBe(result.failed[0].reason);
  });

  it("`failed` is TERMINAL — the next pass does not pick the row up again", async () => {
    const f = await setup();
    await queueRow(f);
    const unarmed = resolveSocialPublisher("linkedin", {});
    await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(unarmed) },
      NOW,
    );
    const second = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(unarmed) },
      new Date(NOW.getTime() + 60_000),
    );
    expect(second.due).toEqual([]);
    expect(second.failed).toEqual([]);
  });

  it("one row's failure never blocks the others in the same pass", async () => {
    // A one-a-day cap: the first row publishes, the second meets the door's
    // rung d and fails — and the pass reports both honestly.
    const f = await setup({ social: { linkedin: { maxPostsPerDay: 1 } } });
    const first = await queueRow(f);
    const second = await queueRow(f);

    const publisher = createFakeSocialPublisher();
    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(publisher) },
      NOW,
    );
    expect(result.published.map((p) => p.id)).toEqual([first.id]);
    expect(result.failed.map((p) => p.id)).toEqual([second.id]);
    expect(result.failed[0].reason).toContain("daily cap reached");
    expect(publisher.calls).toHaveLength(1);
  });

  /**
   * A FINDING FOR THE RECORD, pinned as a test (see the lane's wrap note).
   *
   * The frozen draft state machine carries `approved → scheduled → published`
   * — an edge nothing has ever written. The producer deliberately does NOT
   * take it: the publish door's rung (a) opens ONLY for a draft whose status
   * is exactly `approved`, and lane C may not modify that door. So a
   * scheduled draft stays `approved` and the QUEUE ROW carries the scheduled
   * fact. Reconciling the two is a contracts-side decision for a later
   * window, not an ad-hoc edit; this test states the current, deliberate
   * behaviour so a future change to it is a decision rather than a surprise.
   */
  it("scheduling leaves the draft `approved` — the queue row carries the scheduled fact", async () => {
    const f = await setup();
    const row = await queueRow(f);
    expect((await f.repos.drafts.get(f.ctx, row.draftId)).status).toBe("approved");
    await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(createFakeSocialPublisher()) },
      NOW,
    );
    // And still approved after publishing: the social path records its truth
    // in the ledger and the queue row, never in drafts.status.
    expect((await f.repos.drafts.get(f.ctx, row.draftId)).status).toBe("approved");
  });

  it("recovery runs FIRST: a stranded `processing` row is released and published in the same pass", async () => {
    const f = await setup();
    const row = await queueRow(f);
    // A consumer that died mid-tick an hour ago.
    await f.repos.publishQueue.claim(row.id, new Date(NOW.getTime() - 60 * 60_000));
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("processing");

    const publisher = createFakeSocialPublisher();
    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(publisher), staleAfterMinutes: 15 },
      NOW,
    );
    expect(result.released.map((r) => r.id)).toEqual([row.id]);
    expect(result.published.map((p) => p.id)).toEqual([row.id]);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("published");
  });

  it("a FRESHLY claimed row is left alone — recovery must not steal a live tick's work", async () => {
    const f = await setup();
    const row = await queueRow(f);
    await f.repos.publishQueue.claim(row.id, new Date(NOW.getTime() - 60_000));
    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(createFakeSocialPublisher()), staleAfterMinutes: 15 },
      NOW,
    );
    expect(result.released).toEqual([]);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("processing");
  });

  it("a row another consumer claimed first is reported as raced, never published twice", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const publisher = createFakeSocialPublisher();
    const racing: Repos = {
      ...f.repos,
      publishQueue: {
        ...f.repos.publishQueue,
        // The database resolves the race: this pass's claim finds the row
        // already taken and returns null.
        claim: async () => null,
      },
    };
    const result = await runDuePublishes(
      { repos: racing, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(publisher) },
      NOW,
    );
    expect(result.raced.map((r) => r.id)).toEqual([row.id]);
    expect(result.published).toEqual([]);
    expect(publisher.calls).toEqual([]);
  });

  it("the tenant's own context walls the pass — the ledger row lands on the row's tenant", async () => {
    const f = await setup();
    const row = await queueRow(f);
    await runDuePublishes(
      { repos: f.repos, armed: true, resolveArmState: allLive, resolvePublisher: fakeResolver(createFakeSocialPublisher()) },
      NOW,
    );
    const events = await f.repos.events.list(f.ctx, { entityType: "publish_queue", entityId: row.id });
    expect(events.map((e) => e.event)).toEqual([
      "publish_queue.enqueued",
      "publish_queue.claimed",
      "publish_queue.published",
    ]);
  });

  it("the platform travels from the ROW, so a row's own platform decides where it goes", async () => {
    const f = await setup({ social: { linkedin: { maxPostsPerDay: 2 }, x: { maxPostsPerDay: 2 } } });
    const draft = await approvedDraft(f);
    await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "x", scheduledAt: SLOT },
      EARLIER,
    );
    const seen: SocialPlatform[] = [];
    await runDuePublishes(
      {
        repos: f.repos,
        armed: true,
        resolveArmState: allLive,
        resolvePublisher: () => (platform: SocialPlatform) => {
          seen.push(platform);
          return createFakeSocialPublisher({ platform });
        },
      },
      NOW,
    );
    expect(seen).toEqual(["x"]);
  });
});

/**
 * Control-arc part A (s102). The founder's own note — *"arming is per-run; the
 * queue consumer's key rests EMPTY"* — was a workaround for a gate that could
 * not say what he meant: one boolean over every platform and every draft, so
 * letting one Bluesky post out armed everything that was due. These pin the
 * finer gate, and the invariant is that it can only ever NARROW a GO.
 */
describe("runDuePublishes — the per-destination arm gate", () => {
  it("a master-armed pass with NO per-destination config publishes nothing at all", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const publisher = createFakeSocialPublisher();

    const result = await runDuePublishes(
      { repos: f.repos, armed: true, resolvePublisher: fakeResolver(publisher) },
      NOW,
    );

    expect(result.published).toEqual([]);
    expect(publisher.calls).toEqual([]);
    expect(result.holds).toEqual([
      expect.objectContaining({ id: row.id, platform: "linkedin", armState: "off" }),
    ]);
    // Untouched, not failed: a held row keeps its turn.
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("pending");
  });

  it("`review` HOLDS the row for the operator rather than sending or failing it", async () => {
    const f = await setup();
    const row = await queueRow(f);
    const publisher = createFakeSocialPublisher();

    const result = await runDuePublishes(
      {
        repos: f.repos,
        armed: true,
        resolveArmState: () => "review",
        resolvePublisher: fakeResolver(publisher),
      },
      NOW,
    );

    expect(publisher.calls).toEqual([]);
    expect(result.holds[0]).toMatchObject({ id: row.id, armState: "review" });
    expect(result.failed).toEqual([]);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("pending");
  });

  it("arms ONE destination without arming the other that is equally due", async () => {
    const f = await setup({
      social: { linkedin: { maxPostsPerDay: 2 }, x: { maxPostsPerDay: 2 } },
    });
    await queueRow(f); // linkedin
    const draft = await approvedDraft(f, "a second body for the other platform");
    await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "x", scheduledAt: SLOT },
      EARLIER,
    );

    const seen: SocialPlatform[] = [];
    const result = await runDuePublishes(
      {
        repos: f.repos,
        armed: true,
        resolveArmState: ({ platform }) => (platform === "x" ? "live" : "off"),
        resolvePublisher: () => (platform: SocialPlatform) => {
          seen.push(platform);
          return createFakeSocialPublisher({ platform });
        },
      },
      NOW,
    );

    // THE point of part A: the blast radius is the destination that was named.
    expect(seen).toEqual(["x"]);
    expect(result.published).toHaveLength(1);
    expect(result.holds).toEqual([expect.objectContaining({ platform: "linkedin", armState: "off" })]);
  });

  it("fails CLOSED — a resolver that throws leaves the destination off, and the pass carries on", async () => {
    const f = await setup({
      social: { linkedin: { maxPostsPerDay: 2 }, x: { maxPostsPerDay: 2 } },
    });
    await queueRow(f); // linkedin — its resolver throws
    const draft = await approvedDraft(f, "the other tenant-mate row");
    await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "x", scheduledAt: SLOT },
      EARLIER,
    );

    const result = await runDuePublishes(
      {
        repos: f.repos,
        armed: true,
        resolveArmState: ({ platform }) => {
          if (platform === "linkedin") throw new Error("unreadable config");
          return "live";
        },
        resolvePublisher: () => (platform: SocialPlatform) => createFakeSocialPublisher({ platform }),
      },
      NOW,
    );

    expect(result.holds).toEqual([expect.objectContaining({ platform: "linkedin", armState: "off" })]);
    // One destination's unreadable config never stops the rest of the pass.
    expect(result.published.map((p) => p.platform)).toEqual(["x"]);
  });

  it("an answer that is not one of the three states is off, not a truthy yes", async () => {
    const f = await setup();
    await queueRow(f);
    const publisher = createFakeSocialPublisher();
    const result = await runDuePublishes(
      {
        repos: f.repos,
        armed: true,
        resolveArmState: () => "LIVE" as never, // near-miss casing, the readArm lesson
        resolvePublisher: fakeResolver(publisher),
      },
      NOW,
    );
    expect(publisher.calls).toEqual([]);
    expect(result.holds[0].armState).toBe("off");
  });

  it("the DISARMED report still says which rows a live tick would have skipped", async () => {
    const f = await setup();
    const row = await queueRow(f);

    const result = await runDuePublishes(
      { repos: f.repos, resolveArmState: () => "review" },
      NOW,
    );

    expect(result.armed).toBe(false);
    expect(result.due).toHaveLength(1);
    // A report listing a due row without saying it would be held describes a
    // tick that would never happen.
    expect(result.holds).toEqual([expect.objectContaining({ id: row.id, armState: "review" })]);
    expect((await f.repos.publishQueue.get(f.ctx, row.id))?.status).toBe("pending");
  });
});
