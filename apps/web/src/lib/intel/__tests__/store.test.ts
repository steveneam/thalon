import { beforeEach, describe, expect, it } from "vitest";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import {
  dismissTrendCard,
  IntelStoreError,
  listIntelCaptures,
  listTrendCards,
  promoteTrendCard,
  resetIntelStore,
  targetSearchQuery,
} from "@/lib/intel/store";

beforeEach(() => resetIntelStore());

describe("intel fake-driver store", () => {
  it("dismiss removes the card from the list and records the capture payload", () => {
    const card = fixtureTrendCards[0];
    const capture = dismissTrendCard(card.id);
    expect(listTrendCards().map((c) => c.id)).not.toContain(card.id);
    expect(capture).toMatchObject({
      kind: "trend_dismiss",
      ref: card.id,
      payload: { source: card.source, externalId: card.externalId, areaName: card.areaName },
    });
    expect(listIntelCaptures()).toHaveLength(1);
  });

  it("promote keeps the card, captures the pick, and seeds the prompt with the item text", () => {
    const card = fixtureTrendCards[1];
    const { capture, promptSeed } = promoteTrendCard(card.id);
    expect(promptSeed).toBe(card.text);
    expect(capture.kind).toBe("trend_promote");
    expect(listTrendCards().map((c) => c.id)).toContain(card.id);
  });

  it("target-this captures the query as generation context", () => {
    const { capture, promptSeed } = targetSearchQuery("what is content automation");
    expect(promptSeed).toBe("what is content automation");
    expect(capture).toMatchObject({ kind: "search_target_this", ref: "what is content automation" });
  });

  it("throws a typed 404 for a card outside the demo dataset", () => {
    expect(() => dismissTrendCard("nope")).toThrowError(IntelStoreError);
  });

  it("reset restores the full demo dataset (test isolation, like the staged store)", () => {
    dismissTrendCard(fixtureTrendCards[0].id);
    resetIntelStore();
    expect(listTrendCards()).toHaveLength(fixtureTrendCards.length);
    expect(listIntelCaptures()).toHaveLength(0);
  });
});
