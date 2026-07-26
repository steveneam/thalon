import { openTestDb, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedAdditionalRun, seedDraft, type Seeded } from "@/lib/approve-queue/__tests__/test-helpers";

// Route tests run against a fresh in-memory db per test (the B0.4 pattern);
// only the process-cached getRepos() accessor is swapped.
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

describe("GET /api/app/pulse", () => {
  it("returns the first-run shape on an unseeded db", async () => {
    const handle = await openTestDb();
    repos = handle.repos;
    const body = await (await GET()).json();
    expect(body).toEqual({
      tenant: null,
      profile: null,
      counts: { runs: 0, runsWithErrors: 0, drafts: 0, queued: 0, blocked: 0, approved: 0, staged: 0 },
      needsYou: 0,
    });
    await handle.close();
  });

  it("counts drafts by operator-facing status and derives needs-you", async () => {
    seeded = await seedDraft();
    repos = seeded.handle.repos;
    const { ctx } = seeded;

    // Run 1's draft → queued (judge passed, waiting on the operator — I1
    // requires the passing g3_final verdict before the queued transition).
    await repos.drafts.transition(ctx, seeded.draft.id, "judging");
    await repos.judgeResults.append(ctx, { draftId: seeded.draft.id, gate: "g3_final", verdict: "pass" });
    await repos.drafts.transition(ctx, seeded.draft.id, "queued");
    // Run 2's draft → blocked, and the run carries a lastError.
    const second = await seedAdditionalRun(seeded.handle, ctx, { platform: "x" });
    await repos.drafts.transition(ctx, second.draft.id, "judging");
    await repos.drafts.transition(ctx, second.draft.id, "blocked");
    await repos.fanoutRuns.recordLastError(ctx, second.run.id, "gateway 400: malformed shell output");

    const body = await (await GET()).json();
    expect(body.tenant).toEqual({ slug: "self", name: "Self (dogfood)" });
    expect(body.profile).toMatchObject({ version: 1 });
    expect(body.counts).toEqual({
      runs: 2,
      runsWithErrors: 1,
      drafts: 2,
      queued: 1,
      blocked: 1,
      approved: 0,
      staged: 0,
    });
    expect(body.needsYou).toBe(2);
  });

  /*
   * The founder's s79 ruling, made executable: a queue only counts what the
   * operator can act on. A `storyboard`/`direction_doc` sits in queued/blocked
   * like any draft, but "approve a storyboard" has no defined meaning against
   * the judge gate — its verb is ADVANCE through the staged lifecycle, which
   * the Approve surface's own staged pane owns. So it stays in the RAW counts
   * (nothing is hidden) and is subtracted from needs-you.
   */
  it("does not count staged artifacts toward needs-you, and says how many it dropped", async () => {
    seeded = await seedDraft();
    repos = seeded.handle.repos;
    const { ctx } = seeded;

    // A real post waiting on approve/reject — this one IS the operator's work.
    await repos.drafts.transition(ctx, seeded.draft.id, "judging");
    await repos.judgeResults.append(ctx, { draftId: seeded.draft.id, gate: "g3_final", verdict: "pass" });
    await repos.drafts.transition(ctx, seeded.draft.id, "queued");
    // A stage artifact in the same waiting status — NOT the operator's queue.
    const stage = await seedAdditionalRun(seeded.handle, ctx, {
      platform: "video",
      format: "storyboard",
    });
    await repos.drafts.transition(ctx, stage.draft.id, "judging");
    await repos.drafts.transition(ctx, stage.draft.id, "blocked");

    const body = await (await GET()).json();
    // Raw counts still see both — the staged row is subtracted, never hidden.
    expect(body.counts.queued).toBe(1);
    expect(body.counts.blocked).toBe(1);
    expect(body.counts.staged).toBe(1);
    expect(body.needsYou).toBe(1);
  });
});
