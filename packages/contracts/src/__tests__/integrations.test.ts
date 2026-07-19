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
