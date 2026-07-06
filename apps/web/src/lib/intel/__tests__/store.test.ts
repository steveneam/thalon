import { beforeEach, describe, expect, it } from "vitest";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import {
  dismissTrendCard,
  IntelStoreError,
  listIntelCaptures,
  listTrendCards,
  promoteTrendCard,
  resetIntelStore,
  resolveCreateContext,
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

  it("promote keeps the card and captures the exit family plus the picked title/angle/hook", () => {
    const card = fixtureTrendCards[1];
    const { capture } = promoteTrendCard(card.id, { family: "video", titleIndex: 1, angleIndex: 0 });
    expect(capture.kind).toBe("trend_promote");
    expect(capture.payload).toMatchObject({
      family: "video",
      title: card.dossier.titles[1],
      angle: card.dossier.angles[0],
      hook: card.dossier.hook,
    });
    expect(listTrendCards().map((c) => c.id)).toContain(card.id);
  });

  it("promote and dismiss write SYMMETRIC base payloads through the one capture door (wave-3 §3.6)", () => {
    const card = fixtureTrendCards[0];
    const promoted = promoteTrendCard(card.id, { family: "post" }).capture;
    const dismissed = dismissTrendCard(card.id);
    const base = ["source", "externalId", "areaName", "score", "text", "url"];
    for (const key of base) {
      expect(promoted.payload[key]).toEqual(dismissed.payload[key]);
    }
  });

  it("resolveCreateContext round-trips a promote capture into the structured Create context", () => {
    const card = fixtureTrendCards[2];
    const { capture } = promoteTrendCard(card.id, { family: "page", titleIndex: 2 });
    const context = resolveCreateContext(capture.id);
    expect(context).toMatchObject({
      captureId: capture.id,
      kind: "trend_promote",
      family: "page",
      title: card.dossier.titles[2],
      angle: card.dossier.angles[0],
      hook: card.dossier.hook,
      areaName: card.areaName,
      score: card.score,
      text: card.text,
      sourceUrl: card.url,
    });
  });

  it("target-this captures the query with its family and resolves to a keyword context", () => {
    const { capture } = targetSearchQuery("what is content automation");
    expect(capture).toMatchObject({ kind: "search_target_this", ref: "what is content automation" });
    expect(resolveCreateContext(capture.id)).toMatchObject({
      kind: "search_target_this",
      family: "page", // the keyword target's natural destination, changeable on Create
      keyword: "what is content automation",
    });
  });

  it("a dismiss capture is feedback, not context — resolving it is a 404", () => {
    const capture = dismissTrendCard(fixtureTrendCards[0].id);
    expect(() => resolveCreateContext(capture.id)).toThrowError(IntelStoreError);
    expect(() => resolveCreateContext("intel-capture-nope")).toThrowError(IntelStoreError);
  });

  it("an out-of-range dossier pick is a loud 400, never a silent fallback", () => {
    const card = fixtureTrendCards[0];
    expect(() => promoteTrendCard(card.id, { family: "post", titleIndex: 99 })).toThrowError(
      IntelStoreError,
    );
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
