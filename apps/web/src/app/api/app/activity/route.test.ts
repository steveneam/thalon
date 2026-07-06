import { openTestDb, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedDraft, type Seeded } from "@/lib/approve-queue/__tests__/test-helpers";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");

let seeded: Seeded | undefined;

afterEach(async () => {
  repos = undefined;
  await seeded?.close();
  seeded = undefined;
});

describe("GET /api/app/activity", () => {
  it("returns an empty feed on an unseeded db", async () => {
    const handle = await openTestDb();
    repos = handle.repos;
    expect(await (await GET()).json()).toEqual({ items: [] });
    await handle.close();
  });

  it("returns the events tail newest-first with ISO timestamps", async () => {
    seeded = await seedDraft();
    repos = seeded.handle.repos;
    await repos.drafts.transition(seeded.ctx, seeded.draft.id, "judging");

    const { items } = await (await GET()).json();
    expect(items.length).toBeGreaterThanOrEqual(4); // profile + run + draft + transition
    // Newest first = descending seq; the latest event is the transition.
    const seqs = items.map((i: { id: number }) => i.id);
    expect([...seqs].sort((a, b) => b - a)).toEqual(seqs);
    expect(items[0]).toMatchObject({
      event: "draft.transition",
      entityType: "draft",
      entityId: seeded.draft.id,
      payload: { from: "generated", to: "judging" },
    });
    expect(new Date(items[0].at).toISOString()).toBe(items[0].at);
  });
});
