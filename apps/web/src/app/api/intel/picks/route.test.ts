import { afterEach, describe, expect, it } from "vitest";
import { promoteTrendCard, resetIntelStore } from "@/lib/intel/store";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { GET } from "./route";

/**
 * The pipeline board's Intel-picks read: PICKS ONLY (a promote capture is a
 * pick; a dismissal or an unpicked trend never reaches the pipeline), and an
 * empty store answers an empty list — TRUE on a fresh process, not a bug.
 */
describe("GET /api/intel/picks", () => {
  afterEach(() => {
    resetIntelStore();
  });

  it("answers empty when nothing has been picked", async () => {
    const body = (await (await GET()).json()) as { picks: unknown[] };
    expect(body.picks).toEqual([]);
  });

  it("projects trend_promote captures with the picked title and family", async () => {
    const card = fixtureTrendCards[0];
    promoteTrendCard(card.id, { family: "video" });

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
    const { dismissTrendCard } = await import("@/lib/intel/store");
    dismissTrendCard(fixtureTrendCards[1].id);
    const body = (await (await GET()).json()) as { picks: unknown[] };
    expect(body.picks).toEqual([]);
  });
});
