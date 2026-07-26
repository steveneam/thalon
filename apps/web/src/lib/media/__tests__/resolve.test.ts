import { describe, expect, it } from "vitest";
import {
  EMPTY,
  MEDIA_CHAINS,
  resolveSourceMedia,
  resolveTakeMedia,
  resolveTrendItemMedia,
  srcOf,
} from "@/lib/media/resolve";

const SHA = "b".repeat(64);
const AT = new Date("2026-07-26T04:00:00.000Z");

describe("the resolver is pure over current row state", () => {
  it("resolves a source thumbnail, stamping the row's creation as the capture", () => {
    const result = resolveSourceMedia({
      meta: { thumbnailUrl: "https://i.ytimg.test/vi/x/hq.jpg", thumbnailWidth: 480, thumbnailHeight: 360 },
      createdAt: AT,
    });
    expect(result).toMatchObject({
      state: "resolved",
      src: "https://i.ytimg.test/vi/x/hq.jpg",
      orientation: "landscape",
    });
  });

  it("calls a 9:16 source portrait — the one case cover-crop decapitates", () => {
    const result = resolveSourceMedia({
      meta: { thumbnailUrl: "https://i.ytimg.test/vi/s/hq.jpg", thumbnailWidth: 1080, thumbnailHeight: 1920 },
      createdAt: AT,
    });
    expect(result.state === "resolved" && result.orientation).toBe("portrait");
  });

  /** A source that never had media is `empty` — the truth, not a degradation. */
  it("returns empty for a text source and for a pre-rider row", () => {
    expect(resolveSourceMedia({ meta: {}, createdAt: AT })).toEqual(EMPTY);
    expect(resolveSourceMedia({ meta: { title: "An article" }, createdAt: AT })).toEqual(EMPTY);
    expect(resolveSourceMedia({ createdAt: AT })).toEqual(EMPTY);
  });

  it("refuses an http thumbnail rather than rendering mixed content", () => {
    expect(resolveSourceMedia({ meta: { thumbnailUrl: "http://cdn.test/a.jpg" }, createdAt: AT })).toEqual(EMPTY);
  });

  it("resolves a take poster through the workspace door, never the public one", () => {
    const result = resolveTakeMedia({
      meta: { posterRef: { ref: { kind: "stored", sha256: SHA, ext: "webp" }, provenance: "derived", capturedAt: AT.toISOString() } },
    });
    expect(result).toMatchObject({ state: "resolved", src: `/api/media/${SHA}.webp` });
    expect(result.state === "resolved" && result.src.startsWith("/assets/")).toBe(false);
  });

  it("treats a take with no poster, and a malformed one, as empty rather than broken", () => {
    expect(resolveTakeMedia({ meta: {} })).toEqual(EMPTY);
    // Nothing was ever fetched, so "the image died" would be a lie about it.
    expect(resolveTakeMedia({ meta: { posterRef: { ref: { kind: "external", url: "https://x.test/a.jpg" } } } })).toEqual(
      EMPTY,
    );
    expect(resolveTakeMedia({ meta: { posterRef: "nonsense" } })).toEqual(EMPTY);
  });

  it("resolves a trend item only when the driver actually captured something", () => {
    expect(
      resolveTrendItemMedia({ thumbnailUrl: "https://cdn.test/t.jpg", capturedAt: AT }),
    ).toMatchObject({ state: "resolved", orientation: "unknown" });
    expect(resolveTrendItemMedia({ capturedAt: AT })).toEqual(EMPTY);
  });

  it("carries trend dimensions only when both arrived", () => {
    const half = resolveTrendItemMedia({
      thumbnailUrl: "https://cdn.test/t.jpg",
      thumbnailWidth: 1280,
      capturedAt: AT,
    });
    expect(half.state === "resolved" && half.envelope.ref).toEqual({
      kind: "external",
      url: "https://cdn.test/t.jpg",
    });
  });
});

describe("srcOf — external renders direct, stored goes through our door", () => {
  it("never proxies an external URL", () => {
    expect(
      srcOf({ ref: { kind: "external", url: "https://cdn.test/a.jpg" }, provenance: "captured", capturedAt: AT.toISOString() }),
    ).toBe("https://cdn.test/a.jpg");
  });

  it("routes stored bytes to the authed workspace door", () => {
    expect(
      srcOf({ ref: { kind: "stored", sha256: SHA, ext: "png" }, provenance: "operator", capturedAt: AT.toISOString() }),
    ).toBe(`/api/media/${SHA}.png`);
  });
});

/**
 * INVARIANT 1 as a ratchet. The Approve ruling (s75) is that a draft never
 * wears its run's or its grounding source's image; this walks the declared
 * chains and fails if any of them reaches into a foreign entity's fields, so
 * widening one is a visible, argued diff rather than a quiet convenience.
 */
describe("declared chains never borrow across entities", () => {
  const OWN_FIELDS: Record<string, readonly string[]> = {
    source: ["meta.thumbnailUrl", "meta.thumbnailWidth", "meta.thumbnailHeight"],
    take: ["meta.posterRef", "ref", "provenance"],
    trendItem: ["thumbnailUrl", "thumbnailWidth", "thumbnailHeight"],
    draft: [],
    run: [],
  };

  it("every link names a field the entity itself owns", () => {
    for (const [entity, chain] of Object.entries(MEDIA_CHAINS)) {
      for (const field of chain.fields) {
        expect(OWN_FIELDS[entity], `${entity} has no declared field list`).toBeDefined();
        expect(OWN_FIELDS[entity]).toContain(field);
      }
    }
  });

  it("keeps drafts and runs resolving NOTHING — the Approve ruling, written down", () => {
    expect(MEDIA_CHAINS.draft.fields).toEqual([]);
    expect(MEDIA_CHAINS.run.fields).toEqual([]);
  });

  it("declares a chain for every entity that resolves media", () => {
    expect(Object.keys(MEDIA_CHAINS).sort()).toEqual(["draft", "run", "source", "take", "trendItem"]);
  });
});
