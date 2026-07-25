import { describe, expect, it } from "vitest";
import { oauth1Header } from "../drivers/oauth1";

/**
 * B-pub.3 pins: the OAuth 1.0a signer is deterministic under injected
 * nonce/timestamp, and its signature is FROZEN as a golden — any change to
 * encoding, param ordering, or the base string breaks a live integration,
 * so it must break this test first.
 */

const KEYS = {
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  token: "account-token",
  tokenSecret: "token-secret",
};
const FIXED = { nonce: "fixed-nonce-123", timestampSec: 1784958000 };

describe("oauth1Header", () => {
  it("golden signature pin — deterministic under fixed nonce/timestamp", () => {
    const header = oauth1Header("POST", "https://api.x.com/2/tweets", KEYS, FIXED);
    expect(header).toContain('oauth_signature="VqqX3SFcGRi3HW0%2Bi3vEQLYJt1U%3D"');
    expect(oauth1Header("POST", "https://api.x.com/2/tweets", KEYS, FIXED)).toBe(header);
  });

  it("carries every protocol param, percent-encoded, in sorted order", () => {
    const header = oauth1Header("POST", "https://api.x.com/2/media/upload", KEYS, FIXED);
    expect(header.startsWith("OAuth ")).toBe(true);
    for (const key of [
      "oauth_consumer_key",
      "oauth_nonce",
      "oauth_signature",
      "oauth_signature_method",
      "oauth_timestamp",
      "oauth_token",
      "oauth_version",
    ]) {
      expect(header).toContain(`${key}="`);
    }
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    // Secrets never appear — only the derived signature does.
    expect(header).not.toContain("consumer-secret");
    expect(header).not.toContain("token-secret");
  });

  it("a different URL signs differently (the base string binds the endpoint)", () => {
    const tweets = oauth1Header("POST", "https://api.x.com/2/tweets", KEYS, FIXED);
    const upload = oauth1Header("POST", "https://api.x.com/2/media/upload", KEYS, FIXED);
    const sig = (h: string) => /oauth_signature="([^"]+)"/.exec(h)?.[1];
    expect(sig(tweets)).not.toBe(sig(upload));
  });

  it("production path (no injected nonce/timestamp) varies per call", () => {
    const a = oauth1Header("POST", "https://api.x.com/2/tweets", KEYS);
    const b = oauth1Header("POST", "https://api.x.com/2/tweets", KEYS);
    expect(a).not.toBe(b);
  });
});
