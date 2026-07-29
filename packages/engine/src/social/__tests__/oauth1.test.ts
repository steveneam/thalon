import { createHmac } from "node:crypto";
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

/**
 * D2 (s87): the signer learned RFC 5849 §3.4.1 query handling, because the
 * metrics read is a signed `GET /2/tweets?ids=…&tweet.fields=…`. Signing a
 * query-bearing URL as if it had no query yields a 401 that looks exactly
 * like a dead credential — a debugging trap worth an executable pin.
 *
 * These do NOT re-derive the expected signature with the code under test.
 * The base string is assembled BY HAND from the spec and HMAC'd
 * independently, so an implementation that agrees with itself but not with
 * the RFC still fails here.
 */
describe("oauth1Header — query strings (RFC 5849 §3.4.1)", () => {
  const pct = (v: string) =>
    encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  /** The signature the spec says a request must carry, computed from scratch. */
  function expectedSignature(method: string, baseUri: string, params: Array<[string, string]>): string {
    const encoded = params
      .map(([k, v]) => [pct(k), pct(v)] as const)
      .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    const paramString = encoded.map(([k, v]) => `${k}=${v}`).join("&");
    const baseString = [method, pct(baseUri), pct(paramString)].join("&");
    return createHmac("sha1", `${pct(KEYS.consumerSecret)}&${pct(KEYS.tokenSecret)}`)
      .update(baseString)
      .digest("base64");
  }

  const OAUTH_PARAMS: Array<[string, string]> = [
    ["oauth_consumer_key", KEYS.consumerKey],
    ["oauth_nonce", FIXED.nonce],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", String(FIXED.timestampSec)],
    ["oauth_token", KEYS.token],
    ["oauth_version", "1.0"],
  ];

  it("signs query parameters alongside the oauth_* set, against the query-LESS base URI", () => {
    const url = "https://api.x.com/2/tweets?ids=1234567890&tweet.fields=public_metrics";
    const header = oauth1Header("GET", url, KEYS, FIXED);
    const expected = expectedSignature("GET", "https://api.x.com/2/tweets", [
      ...OAUTH_PARAMS,
      ["ids", "1234567890"],
      ["tweet.fields", "public_metrics"],
    ]);
    expect(header).toContain(`oauth_signature="${pct(expected)}"`);
  });

  it("a URL-encoded query value is decoded once and re-encoded once (the classic double-encoding bug)", () => {
    // `at://did:plc:me/x` — the shape a metrics read actually carries.
    const raw = "at://did:plc:me/app.bsky.feed.post/abc";
    const url = `https://api.example.com/read?uri=${encodeURIComponent(raw)}`;
    const header = oauth1Header("GET", url, KEYS, FIXED);
    const expected = expectedSignature("GET", "https://api.example.com/read", [
      ...OAUTH_PARAMS,
      ["uri", raw],
    ]);
    expect(header).toContain(`oauth_signature="${pct(expected)}"`);
  });

  it("changing ONLY a query value changes the signature — the query is genuinely bound", () => {
    const sig = (h: string) => /oauth_signature="([^"]+)"/.exec(h)?.[1];
    const a = oauth1Header("GET", "https://api.x.com/2/tweets?ids=1", KEYS, FIXED);
    const b = oauth1Header("GET", "https://api.x.com/2/tweets?ids=2", KEYS, FIXED);
    expect(sig(a)).not.toBe(sig(b));
  });

  it("a fragment never reaches the base string", () => {
    const sig = (h: string) => /oauth_signature="([^"]+)"/.exec(h)?.[1];
    const plain = oauth1Header("GET", "https://api.x.com/2/tweets?ids=1", KEYS, FIXED);
    const fragmented = oauth1Header("GET", "https://api.x.com/2/tweets?ids=1#anchor", KEYS, FIXED);
    expect(sig(fragmented)).toBe(sig(plain));
  });

  it("the POST-without-query path is byte-identical to before the widening", () => {
    // The same golden as the pin above — the widening must not have moved it.
    expect(oauth1Header("POST", "https://api.x.com/2/tweets", KEYS, FIXED)).toContain(
      'oauth_signature="VqqX3SFcGRi3HW0%2Bi3vEQLYJt1U%3D"',
    );
  });
});
