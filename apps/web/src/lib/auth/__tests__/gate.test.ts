import { describe, expect, it } from "vitest";
import { gateRequest, isPublicPath, timingSafeEqualString } from "../gate";

const CRED = "operator:correct horse battery staple";
const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

describe("isPublicPath (a CLOSED allowlist — new routes are gated by default)", () => {
  it.each(["/", "/blog", "/blog/why-ai-content-needs-an-approval-gate", "/blog/rss.xml", "/llms.txt", "/robots.txt", "/sitemap.xml", "/api/health", "/api/waitlist"])(
    "public: %s",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/app", "/app/approve", "/approve", "/brand", "/api/runs", "/api/drafts/abc/approve", "/api/intel/sweep", "/api/library", "/blogx", "/api/healthz"])(
    "gated: %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );

  it("the retired db-dump hook is GATED again (s64: route removed, SELF_GATED empty)", () => {
    expect(isPublicPath("/api/admin/db-dump")).toBe(false);
    expect(isPublicPath("/api/admin")).toBe(false);
  });

  it("the public image door is open (B-pub.4 — IG/Threads fetch anonymously; the route's own allowlist gates content)", () => {
    expect(isPublicPath(`/assets/${"a".repeat(64)}.png`)).toBe(true);
    expect(isPublicPath("/assets/anything")).toBe(true); // basic auth never challenges; the route 404s garbage itself
    expect(isPublicPath("/assets")).toBe(false); // no bare-prefix surface — there is nothing to list
  });

  it("the OAuth callback is open (D1 — the platform redirects a credential-less browser; the state row is the real gate)", () => {
    expect(isPublicPath("/api/integrations/callback/facebook")).toBe(true);
    expect(isPublicPath("/api/integrations/callback/reddit")).toBe(true);
    // Garbage is equally "open" and equally inert: without a valid single-use
    // state row the route stores nothing and redirects with a refusal.
    expect(isPublicPath("/api/integrations/callback/whatever")).toBe(true);
    // The exemption is the CALLBACK only — the begin door and every other
    // integrations route stay gated, or a stranger could mint a flight.
    expect(isPublicPath("/api/integrations/callback")).toBe(false);
    expect(isPublicPath("/api/integrations")).toBe(false);
    expect(isPublicPath("/api/integrations/instagram/oauth")).toBe(false);
    expect(isPublicPath("/api/integrations/instagram/connect")).toBe(false);
  });
});

describe("gateRequest", () => {
  it("allows public paths without any credential in every mode", () => {
    for (const production of [true, false]) {
      expect(
        gateRequest({ pathname: "/blog", authorization: null, credential: undefined, production }),
      ).toEqual({ action: "allow" });
    }
  });

  it("dev auth stub: no credential configured outside production leaves the workspace open", () => {
    expect(
      gateRequest({ pathname: "/app", authorization: null, credential: undefined, production: false }),
    ).toEqual({ action: "allow" });
  });

  it("FAILS CLOSED: production with no credential configured returns unavailable, never open (the invariant)", () => {
    expect(
      gateRequest({ pathname: "/app", authorization: null, credential: undefined, production: true }),
    ).toEqual({ action: "unavailable" });
  });

  it("challenges a gated path with no Authorization header", () => {
    expect(
      gateRequest({ pathname: "/app", authorization: null, credential: CRED, production: true }),
    ).toEqual({ action: "unauthorized" });
  });

  it("rejects wrong credentials and malformed headers", () => {
    for (const header of [
      `Basic ${b64("operator:wrong")}`,
      `Basic ${b64("operator")}`,
      "Basic not-base64!!!",
      `Bearer ${b64(CRED)}`,
      "Basic",
    ]) {
      expect(
        gateRequest({ pathname: "/api/runs", authorization: header, credential: CRED, production: true }),
      ).toEqual({ action: "unauthorized" });
    }
  });

  it("allows correct credentials (scheme case-insensitive per RFC 7617)", () => {
    for (const scheme of ["Basic", "basic", "BASIC"]) {
      expect(
        gateRequest({
          pathname: "/app/approve",
          authorization: `${scheme} ${b64(CRED)}`,
          credential: CRED,
          production: true,
        }),
      ).toEqual({ action: "allow" });
    }
  });
});

describe("timingSafeEqualString", () => {
  it("matches equal strings and rejects length or content differences", () => {
    expect(timingSafeEqualString(CRED, CRED)).toBe(true);
    expect(timingSafeEqualString(CRED, `${CRED} `)).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("a", "")).toBe(false);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
  });
});
