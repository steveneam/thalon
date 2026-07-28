import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_CARD_STATES,
  CREDENTIAL_STORED_STATES,
  credentialEnvelopeSchema,
  DESTINATION_CLASSES,
  DESTINATION_KEYS,
  DESTINATIONS,
  destinationKeySchema,
  resolveDestination,
  type DestinationDef,
} from "../integrations";

/** B-int.0 window pins: registry integrity + the stored/derived state split + the envelope shape. */

describe("DESTINATIONS registry (B-int.0)", () => {
  it("every entry names a known class, a driver seat, a label, and a zod credentials shape", () => {
    for (const [key, def] of Object.entries(DESTINATIONS)) {
      expect(DESTINATION_CLASSES).toContain(def.class);
      expect(def.driver.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.credentials.safeParse).toBe("function");
      expect(destinationKeySchema.parse(key)).toBe(key);
    }
  });

  it("credential shapes validate their mode-2 paste payloads and reject malformed ones", () => {
    expect(
      DESTINATIONS.linkedin.credentials.safeParse({ accessToken: "tok" }).success,
    ).toBe(true);
    expect(DESTINATIONS.linkedin.credentials.safeParse({}).success).toBe(false);
    expect(
      DESTINATIONS.facebook.credentials.safeParse({ accessToken: "tok", pageId: "123" }).success,
    ).toBe(true);
    expect(
      DESTINATIONS.facebook.credentials.safeParse({ accessToken: "tok" }).success,
    ).toBe(false);
    expect(
      DESTINATIONS.intel_bluesky.credentials.safeParse({
        identifier: "who.bsky.social",
        appPassword: "xxxx",
      }).success,
    ).toBe(true);
    // The hosted blog collects NO secret — connecting is the explicit opt-in.
    expect(DESTINATIONS.website_hosted.credentials.safeParse({}).success).toBe(true);
  });

  it("tiktok deliberately has no entry (review-gated, no driver) — adding one later is additive", () => {
    expect(DESTINATION_KEYS).not.toContain("tiktok");
  });

  it("resolveDestination throws loudly on an unknown key, naming the vocabulary", () => {
    expect(() => resolveDestination("myspace")).toThrow(/unknown destination "myspace"/);
  });
});

describe("connect flavors (D1, s83 window)", () => {
  it("reddit is the oauth2 proof: dance-yielded token pair, scopes stated", () => {
    expect(DESTINATIONS.reddit.connect).toEqual({
      flavor: "oauth2",
      scopes: ["identity", "submit"],
    });
    expect(
      DESTINATIONS.reddit.credentials.safeParse({ accessToken: "a", refreshToken: "r" }).success,
    ).toBe(true);
    // The dance yields BOTH tokens — an access token alone cannot refresh and must not store.
    expect(DESTINATIONS.reddit.credentials.safeParse({ accessToken: "a" }).success).toBe(false);
  });

  it("bluesky is the app_password proof: the platform's own designed paste pair", () => {
    expect(DESTINATIONS.bluesky.connect).toEqual({ flavor: "app_password" });
    expect(
      DESTINATIONS.bluesky.credentials.safeParse({
        identifier: "who.bsky.social",
        appPassword: "xxxx-xxxx",
      }).success,
    ).toBe(true);
  });

  it("every oauth2-flavored destination states its scopes — a dance without scopes cannot build a consent URL", () => {
    // Widened through the interface: `as const` entries without `connect`
    // have no such property in their literal type.
    for (const def of Object.values(DESTINATIONS) as DestinationDef[]) {
      if (def.connect?.flavor === "oauth2") {
        expect(def.connect.scopes?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("pre-D1 entries carry NO connect field (= manual guided paste, unchanged behavior)", () => {
    for (const key of ["linkedin", "x", "facebook", "instagram"] as const) {
      expect((DESTINATIONS[key] as DestinationDef).connect).toBeUndefined();
    }
  });
});

describe("card-state vocabulary", () => {
  it("stored states are a strict subset of card states (the rest DERIVE, never store)", () => {
    for (const state of CREDENTIAL_STORED_STATES) {
      expect(CREDENTIAL_CARD_STATES).toContain(state);
    }
    expect(CREDENTIAL_CARD_STATES.length).toBeGreaterThan(CREDENTIAL_STORED_STATES.length);
  });
});

describe("credentialEnvelopeSchema", () => {
  const sealed = {
    ciphertext: "c2VhbGVk",
    dataKeyWrapped: "d3JhcHBlZA==",
    iv: "aXY=",
    authTag: "dGFn",
    keyVersion: 1,
  };

  it("accepts a sealed envelope and rejects missing fields or a zero key version", () => {
    expect(credentialEnvelopeSchema.parse(sealed)).toEqual(sealed);
    expect(credentialEnvelopeSchema.safeParse({ ...sealed, authTag: "" }).success).toBe(false);
    expect(credentialEnvelopeSchema.safeParse({ ...sealed, keyVersion: 0 }).success).toBe(false);
    const { iv: _iv, ...missing } = sealed;
    expect(credentialEnvelopeSchema.safeParse(missing).success).toBe(false);
  });
});
