import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { recordCapture } = await import("@/lib/intel/captures");
const { promoteTrendCard, dismissTrendCard, resetIntelStore } = await import("@/lib/intel/store");
const { fixtureTrendCards } = await import("@/lib/intel/fixtures");
const { GET } = await import("./route");

let handle: DbHandle | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  await repos.tenants.create({ slug: "self", name: "Self" });
});

afterEach(async () => {
  resetIntelStore();
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

/**
 * The pipeline board's Intel-picks read: PICKS ONLY (a promote capture is a
 * pick; a dismissal or an unpicked trend never reaches the pipeline). Since
 * s102 the captures are DURABLE rows, so this reads through the same seat
 * production does — an empty list means nothing has been picked, not that the
 * process was restarted.
 */
describe("GET /api/intel/picks", () => {
  it("answers empty when nothing has been picked", async () => {
    const body = (await (await GET()).json()) as { picks: unknown[] };
    expect(body.picks).toEqual([]);
  });

  it("projects trend_promote captures with the picked title and family", async () => {
    const card = fixtureTrendCards[0];
    await recordCapture(promoteTrendCard(card.id, { family: "video" }));

    const body = (await (await GET()).json()) as {
      picks: Array<{ title: string; family: string; source: string; score: number | null }>;
    };
    expect(body.picks.length).toBe(1);
    const pick = body.picks[0];
    expect(pick.family).toBe("video");
    // The dossier's picked title where one exists, else the item's own text —
    // never an invented headline.
    expect(pick.title).toBe(card.dossier?.titles[0] ?? card.text);
    expect(pick.source).toBe(card.source);
    expect(pick.score).toBe(card.score);
  });

  it("leaves dismissals out — feedback is not a pick", async () => {
    await recordCapture(dismissTrendCard(fixtureTrendCards[1].id));
    const body = (await (await GET()).json()) as { picks: unknown[] };
    expect(body.picks).toEqual([]);
  });

  /**
   * The bound is a cap on the ANSWER, not a window over the raw table: the
   * kind filter runs in SQL. Filtering after the bound would let a run of
   * dismissals push a real pick off the end, and the board would render "you
   * picked nothing" — the failure mode this read exists to never have.
   */
  it("finds a pick buried under more dismissals than the read's own bound", async () => {
    await recordCapture(promoteTrendCard(fixtureTrendCards[0].id, { family: "post" }));
    const noise = fixtureTrendCards[1];
    for (let i = 0; i < 205; i += 1) await recordCapture(dismissTrendCard(noise));

    const body = (await (await GET()).json()) as { picks: Array<{ family: string }> };
    expect(body.picks.length).toBe(1);
    expect(body.picks[0].family).toBe("post");
  });
});
