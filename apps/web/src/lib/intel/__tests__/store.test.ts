import { beforeEach, describe, expect, it } from "vitest";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import {
  dismissTrendCard,
  IntelStoreError,
  listIntelCaptures,
  listTrendCards,
  promoteLead,
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
      title: card.dossier!.titles[1],
      angle: card.dossier!.angles[0],
      hook: card.dossier!.hook,
    });
    expect(listTrendCards().map((c) => c.id)).toContain(card.id);
  });

  // s79 I2 — the dossier offers "Click again to ride without an angle" and
  // the seam re-attached the first one anyway, so the affordance lied and a
  // brief was seeded with an angle nobody chose. The two defaults are split:
  // a title always rides, an angle only rides when it was picked.
  describe("the optional angle really is optional", () => {
    it("rides as nothing when no angle was picked, while the title still defaults to the first", () => {
      const card = fixtureTrendCards[1];
      const { capture } = promoteTrendCard(card.id, { family: "post" });
      expect(capture.payload.angle).toBeUndefined();
      expect(capture.payload.title).toBe(card.dossier!.titles[0]);
    });

    it("rides when it WAS picked", () => {
      const card = fixtureTrendCards[1];
      const last = card.dossier!.angles.length - 1;
      const { capture } = promoteTrendCard(card.id, { family: "post", angleIndex: last });
      expect(capture.payload.angle).toBe(card.dossier!.angles[last]);
    });

    it("still refuses an explicit out-of-range angle rather than silently falling back", () => {
      const card = fixtureTrendCards[1];
      expect(() => promoteTrendCard(card.id, { family: "post", angleIndex: 99 })).toThrow(
        IntelStoreError,
      );
    });

    it("resolves into a Create context carrying no angle", () => {
      const card = fixtureTrendCards[1];
      const { capture } = promoteTrendCard(card.id, { family: "post" });
      expect(resolveCreateContext(capture.id).angle).toBeUndefined();
    });
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
      title: card.dossier!.titles[2],
      // No angleIndex was passed, so NO angle rides. This assertion used to
      // read `angles[0]` — it pinned the very defaulting that made the
      // dossier's "ride without an angle" a false promise (s79 I2).
      angle: undefined,
      hook: card.dossier!.hook,
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

  it("a lead promote resolves with the lead's id and DNA — the →Email compose needs both (B-crm.4 front half)", () => {
    const { capture } = promoteLead({
      leadId: "lead-1",
      family: "email",
      name: "Sam Reyes",
      company: "Riverbend Plumbing",
      role: "Owner",
      website: "https://riverbend.example",
      notes: "met at the trade expo",
      painPoint: "website never brings in local work",
      score: 0.9,
    });
    expect(resolveCreateContext(capture.id)).toMatchObject({
      kind: "lead_promote",
      family: "email",
      leadId: "lead-1",
      contact: "Sam Reyes",
      company: "Riverbend Plumbing",
      painPoint: "website never brings in local work",
      sourceUrl: "https://riverbend.example",
      text: "met at the trade expo",
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
