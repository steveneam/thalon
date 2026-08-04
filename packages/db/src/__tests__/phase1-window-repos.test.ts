import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../errors";
import { fixture, type Fixture } from "./helpers";

/**
 * Phase-I contract window repos (s61): planned slots · lead stage ·
 * intel captures · saved views. Same discipline as sprint7-repos.test.ts:
 * every behavior test doubles as the tenancy-wall proof and the B4.4
 * events-coverage pin for these repos' write fns (draft.slot_planned /
 * draft.slot_replanned / draft.slot_unplanned · lead.stage_set ·
 * intel.capture_recorded · saved_view.created / updated / deleted).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup() {
  fx = await fixture();
  const { repos } = fx.handle;
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), repos, draft: fx.draft };
}

describe("planned slots (Phase-I window)", () => {
  it("plans, re-plans, and unplans a draft's slot — one row per draft, every write evented", async () => {
    const { ctx, repos, draft } = await setup();

    const slot = await repos.plannedSlots.plan(ctx, {
      draftId: draft.id,
      scheduledFor: "2026-07-21T09:30:00+10:00",
      note: "pair with the launch story",
    });
    expect(slot.draftId).toBe(draft.id);
    expect(slot.note).toBe("pair with the launch story");

    // Re-planning MOVES the one slot — no second row, event carries from/to.
    const moved = await repos.plannedSlots.plan(ctx, {
      draftId: draft.id,
      scheduledFor: "2026-07-22T14:00:00+10:00",
    });
    expect(moved.id).toBe(slot.id);
    expect(moved.note).toBe("pair with the launch story"); // note survives a bare re-plan

    const inRange = await repos.plannedSlots.listRange(ctx, {
      from: new Date("2026-07-20T00:00:00Z"),
      to: new Date("2026-07-27T00:00:00Z"),
    });
    expect(inRange.map((s) => s.id)).toEqual([slot.id]);
    const outOfRange = await repos.plannedSlots.listRange(ctx, {
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-08T00:00:00Z"),
    });
    expect(outOfRange).toEqual([]);

    await repos.plannedSlots.unplan(ctx, draft.id);
    expect(await repos.plannedSlots.getForDraft(ctx, draft.id)).toBeNull();
    // Un-planning nothing is LOUD, never a silent no-op.
    await expect(repos.plannedSlots.unplan(ctx, draft.id)).rejects.toBeInstanceOf(NotFoundError);

    const events = await repos.events.list(ctx, { entityType: "draft", entityId: draft.id });
    expect(events.map((e) => e.event)).toEqual([
      "draft.created",
      "draft.slot_planned",
      "draft.slot_replanned",
      "draft.slot_unplanned",
    ]);
  });

  it("walls the tenant: a stranger cannot plan onto my draft, and invalid input stores nothing", async () => {
    const { ctx, other, repos, draft } = await setup();
    await expect(
      repos.plannedSlots.plan(other, { draftId: draft.id, scheduledFor: "2026-07-21T09:30:00Z" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      repos.plannedSlots.plan(ctx, { draftId: draft.id, scheduledFor: "not-a-time" }),
    ).rejects.toThrow();
    expect(await repos.plannedSlots.getForDraft(ctx, draft.id)).toBeNull();
  });
});

describe("lead stage (Phase-I window)", () => {
  it("sets the operator-owned stage separately from status; same-value is a silent no-op; null un-stages", async () => {
    const { ctx, other, repos } = await setup();
    const { lead } = await repos.leads.add(ctx, { source: "csv", email: "amy@example.com" });
    expect(lead.stage).toBeNull(); // unstaged by default — the board derives from status

    const staged = await repos.leads.setStage(ctx, lead.id, "qualified");
    expect(staged.stage).toBe("qualified");
    expect(staged.status).toBe("new"); // engine lifecycle untouched

    await repos.leads.setStage(ctx, lead.id, "qualified"); // no-op, no event
    const unstaged = await repos.leads.setStage(ctx, lead.id, null);
    expect(unstaged.stage).toBeNull();

    const events = await repos.events.list(ctx, { entityType: "lead", entityId: lead.id });
    expect(events.map((e) => e.event)).toEqual(["lead.created", "lead.stage_set", "lead.stage_set"]);
    expect(events[1].payload).toEqual({ from: null, to: "qualified" });
    expect(events[2].payload).toEqual({ from: "qualified", to: null });

    await expect(
      repos.leads.setStage(ctx, lead.id, "vip" as never),
    ).rejects.toThrow(/invalid lead stage/);
    await expect(repos.leads.setStage(other, lead.id, "inbox")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("intel captures (Phase-I window)", () => {
  it("records operator actions (never idempotent — every action is its own intent), reads walled", async () => {
    const { ctx, other, repos } = await setup();
    const a = await repos.intelCaptures.record(ctx, {
      kind: "trend_promote",
      payload: { title: "The board goes back in", angle: "craft" },
    });
    const b = await repos.intelCaptures.record(ctx, { kind: "trend_promote", payload: {} });
    expect(a.id).not.toBe(b.id); // two promotes = two captures, by design

    expect((await repos.intelCaptures.get(ctx, a.id))?.payload).toEqual({
      title: "The board goes back in",
      angle: "craft",
    });
    expect(await repos.intelCaptures.get(other, a.id)).toBeNull(); // tenancy wall

    const recent = await repos.intelCaptures.listRecent(ctx, { limit: 1 });
    expect(recent).toHaveLength(1); // bounded read (station 02's Bounded-List twin)

    const events = await repos.events.list(ctx, { entityType: "intel_capture", entityId: a.id });
    expect(events.map((e) => e.event)).toEqual(["intel.capture_recorded"]);

    await expect(
      repos.intelCaptures.record(ctx, { kind: "made_up" as never, payload: {} }),
    ).rejects.toThrow();
  });

  /**
   * s102: the pipeline board reads recent PICKS. Filtering by kind after the
   * bound would let a run of dismissals push a real pick past the limit and
   * render "you picked nothing" — so the filter is SQL, inside the bound.
   */
  it("filters by kind inside the bound, so a pick under a wall of dismissals is still found", async () => {
    const { ctx, repos } = await setup();
    await repos.intelCaptures.record(ctx, { kind: "trend_promote", payload: { title: "the one" } });
    for (let i = 0; i < 12; i += 1) {
      await repos.intelCaptures.record(ctx, { kind: "trend_dismiss", payload: { i } });
    }

    const picks = await repos.intelCaptures.listRecent(ctx, { kind: "trend_promote", limit: 5 });
    expect(picks.map((p) => p.payload)).toEqual([{ title: "the one" }]);
    // Unfiltered, the same bound sees only the dismissals that buried it.
    const recent = await repos.intelCaptures.listRecent(ctx, { limit: 5 });
    expect(recent.every((r) => r.kind === "trend_dismiss")).toBe(true);
  });
});

describe("saved views (Phase-I window)", () => {
  it("creates, patches, and removes named views — duplicate names fail loud, patches never re-default", async () => {
    const { ctx, other, repos } = await setup();
    const view = await repos.savedViews.create(ctx, {
      surface: "leads",
      name: "Hot pipeline",
      config: { filter: { stage: "qualified" } },
      position: 2,
    });
    await expect(
      repos.savedViews.create(ctx, { surface: "leads", name: "Hot pipeline" }),
    ).rejects.toThrow(); // (tenant, surface, name) unique — never silently overwritten

    // Patch position ONLY — name and config must survive untouched (the
    // explicit-partial contract shape; .partial() would have re-defaulted).
    const patched = await repos.savedViews.update(ctx, view.id, { position: 0 });
    expect(patched.name).toBe("Hot pipeline");
    expect(patched.config).toEqual({ filter: { stage: "qualified" } });
    expect(patched.position).toBe(0);

    await expect(repos.savedViews.update(other, view.id, { position: 9 })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const listed = await repos.savedViews.list(ctx, "leads");
    expect(listed.map((v) => v.name)).toEqual(["Hot pipeline"]);
    expect(await repos.savedViews.list(ctx, "schedule")).toEqual([]);

    await repos.savedViews.remove(ctx, view.id);
    expect(await repos.savedViews.list(ctx, "leads")).toEqual([]);

    const events = await repos.events.list(ctx, { entityType: "saved_view", entityId: view.id });
    expect(events.map((e) => e.event)).toEqual([
      "saved_view.created",
      "saved_view.updated",
      "saved_view.deleted",
    ]);

    await expect(
      repos.savedViews.create(ctx, { surface: "dashboard" as never, name: "x" }),
    ).rejects.toThrow(); // surface enum enforced at the contracts door
  });
});
