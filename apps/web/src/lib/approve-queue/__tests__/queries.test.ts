import { afterEach, describe, expect, it } from "vitest";
import { getDraftDetail, listRunDrafts, listRunsFeed } from "../queries";
import { seedAdditionalRun, seedDraft, type Seeded } from "./test-helpers";

let seeded: Seeded | undefined;
afterEach(async () => {
  await seeded?.close();
  seeded = undefined;
});

describe("approve-queue queries (events-hydrated lists — see B1.4 handoff notes on the repo-surface gap)", () => {
  it("lists fan-out runs newest first", async () => {
    seeded = await seedDraft({ platform: "linkedin" });
    const { handle, ctx, run } = seeded;
    const { run: second } = await seedAdditionalRun(handle, ctx, { platform: "x" });

    const runs = await listRunsFeed(handle.repos, ctx);
    expect(runs.map((r) => r.id)).toEqual([second.id, run.id]);
  });

  it("scopes drafts to one run only", async () => {
    seeded = await seedDraft({ platform: "linkedin" });
    const { handle, ctx, run, draft } = seeded;
    await seedAdditionalRun(handle, ctx, { platform: "x" });

    const drafts = await listRunDrafts(handle.repos, ctx, run.id);
    expect(drafts.map((d) => d.id)).toEqual([draft.id]);
    expect(drafts.every((d) => d.fanoutRunId === run.id)).toBe(true);
  });

  it("returns draft + judge results for the panel, or null when missing", async () => {
    seeded = await seedDraft();
    const { handle, ctx, draft } = seeded;
    await handle.repos.judgeResults.append(ctx, { draftId: draft.id, gate: "g1", verdict: "pass" });

    const detail = await getDraftDetail(handle.repos, ctx, draft.id);
    expect(detail?.draft.id).toBe(draft.id);
    expect(detail?.judgeResults).toHaveLength(1);

    const missing = await getDraftDetail(handle.repos, ctx, "00000000-0000-0000-0000-000000000000");
    expect(missing).toBeNull();
  });

  it("tenant scoping: another tenant sees no runs or drafts", async () => {
    seeded = await seedDraft();
    const { handle, ctx, run } = seeded;
    const other = await handle.repos.tenants.create({ slug: "other", name: "Other" });
    const otherCtx = { tenantId: other.id };

    expect(await listRunsFeed(handle.repos, otherCtx)).toEqual([]);
    expect(await listRunDrafts(handle.repos, otherCtx, run.id)).toEqual([]);
  });
});
